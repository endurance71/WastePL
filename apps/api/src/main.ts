import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

import { requestLoggerHook } from './common/logger.middleware.js';
import { createRateLimiter } from './common/rate-limiter.js';

export async function createApp(): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({ logger: false });
  const fastifyInstance = adapter.getInstance();

  // 1. Structured JSON logger hook with x-request-id
  fastifyInstance.addHook('onRequest', requestLoggerHook);

  // 2. Global Rate Limiting: 120 req / minute per IP
  fastifyInstance.addHook(
    'onRequest',
    createRateLimiter({
      windowMs: 60_000,
      maxRequests: 120,
    }),
  );

  // 3. Security headers (HSTS, X-Content-Type-Options, X-Frame-Options)
  fastifyInstance.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { bufferLogs: true },
  );

  app.enableCors();
  app.enableShutdownHooks();
  return app;
}


export async function bootstrap(): Promise<void> {
  const app = await createApp();
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);
  console.log(`WastePL API listening on http://${host}:${port}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
