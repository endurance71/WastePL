import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

export function requestLoggerHook(
  req: FastifyRequest,
  reply: FastifyReply,
  done: () => void,
): void {
  const startTime = process.hrtime.bigint();
  const rawRequestId = req.headers['x-request-id'];
  const requestId = typeof rawRequestId === 'string' && rawRequestId.trim()
    ? rawRequestId.trim()
    : randomUUID();

  reply.header('x-request-id', requestId);
  (req as unknown as { requestId: string }).requestId = requestId;

  reply.raw.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    const logPayload = {
      level: reply.statusCode >= 500 ? 'error' : 'info',
      event: 'http.request',
      requestId,
      method: req.method,
      url: req.url,
      statusCode: reply.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    };

    if (process.env.NODE_ENV !== 'test' && !process.env.SUPPRESS_HTTP_LOGS) {
      console.log(JSON.stringify(logPayload));
    }
  });

  done();
}
