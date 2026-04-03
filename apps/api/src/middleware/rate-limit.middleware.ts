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
    } catch {
      next(new AppError('RATE_LIMIT_EXCEEDED', 'Too many requests. Please slow down.', 429));
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
