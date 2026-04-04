import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../lib/redis.js';
import { AppError } from '../types/errors.js';

function createLimiter(keyPrefix: string, points: number, duration: number) {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration,
  });
}

const limiters = {
  authLogin: createLimiter('rl:auth:login', 5, 900),
  authRegister: createLimiter('rl:auth:register', 10, 3600),
  chatMessage: createLimiter('rl:chat:msg', 60, 60),
  connectorTest: createLimiter('rl:conn:test', 10, 60),
  global: createLimiter('rl:global', 300, 60),
};

function buildMiddleware(
  limiter: RateLimiterRedis,
  keyFn: (req: Request) => string
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await limiter.consume(keyFn(req));
      next();
    } catch (err: unknown) {
      // RateLimiterRedis throws a RateLimiterRes object when the limit is exceeded.
      // If the thrown value has a msBeforeNext property it's a real rate-limit hit.
      // Any other error (e.g. Redis connection failure) should fail open — let the
      // request through rather than blocking all traffic when Redis is unavailable.
      if (err !== null && typeof err === 'object' && 'msBeforeNext' in err) {
        next(new AppError('RATE_LIMIT_EXCEEDED', 'Too many requests. Please slow down.', 429));
      } else {
        next();
      }
    }
  };
}

export const rateLimits = {
  authLogin: buildMiddleware(limiters.authLogin, (r) => r.ip ?? 'unknown'),
  authRegister: buildMiddleware(limiters.authRegister, (r) => r.ip ?? 'unknown'),
  chatMessage: buildMiddleware(limiters.chatMessage, (r) => r.user?.id ?? r.ip ?? 'unknown'),
  connectorTest: buildMiddleware(limiters.connectorTest, (r) => r.user?.id ?? r.ip ?? 'unknown'),
  global: buildMiddleware(limiters.global, (r) => r.user?.tenant_id ?? r.ip ?? 'unknown'),
};
