import type { FastifyReply, FastifyRequest } from 'fastify';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

// Cleans up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}, 60_000).unref();

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: FastifyRequest) => string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyGenerator } = options;

  return function rateLimitHook(
    req: FastifyRequest,
    reply: FastifyReply,
    done: () => void,
  ): void {
    // Disable or bypass rate limiting in test runs, internal test harness or lightMyRequest
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.DISABLE_RATE_LIMIT === 'true' ||
      req.headers['user-agent'] === 'lightMyRequest'
    ) {
      return done();
    }


    const path = ((req as unknown as { routerPath?: string }).routerPath ?? req.url.split('?')[0]) || '/';
    const key = keyGenerator ? keyGenerator(req) : `${req.ip}:${path}`;

    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 1, resetAt: now + windowMs };
      buckets.set(key, bucket);
    } else {
      bucket.count += 1;
    }

    const remaining = Math.max(0, maxRequests - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    reply.header('X-RateLimit-Limit', maxRequests);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', resetSeconds);

    if (bucket.count > maxRequests) {
      reply.header('Retry-After', resetSeconds);
      reply.status(429).send({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
        retryAfter: resetSeconds,
      });
      return;
    }

    done();
  };
}
