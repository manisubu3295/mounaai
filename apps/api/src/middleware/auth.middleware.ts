import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthError } from '../types/errors.js';

interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
  email: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return next(new AuthError('No access token provided'));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.sub,
      tenant_id: payload.tenant_id,
      role: payload.role as Express.Request['user'] extends undefined ? never : NonNullable<Express.Request['user']>['role'],
      email: payload.email,
    };
    next();
  } catch {
    next(new AuthError('Invalid or expired token', 'TOKEN_EXPIRED'));
  }
}
