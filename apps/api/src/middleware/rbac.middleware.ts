import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@pocketcomputer/shared-types';
import { ForbiddenError, AuthError } from '../types/errors.js';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  TENANT_ADMIN: 3,
  ANALYST: 2,
  VIEWER: 1,
};

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AuthError());

    const userLevel = ROLE_HIERARCHY[req.user.role];
    const hasPermission = roles.some((r) => userLevel >= ROLE_HIERARCHY[r]);

    if (!hasPermission) {
      return next(new ForbiddenError());
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole('TENANT_ADMIN')(req, res, next);
}
