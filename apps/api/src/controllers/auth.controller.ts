import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { rateLimits } from '../middleware/rate-limit.middleware.js';
import { registerSchema, loginSchema } from '../validation/auth.schema.js';
import * as authService from '../services/auth.service.js';
import { auditLog } from '../services/audit.service.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env['NODE_ENV'] === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
};

export const authRouter: ExpressRouter = Router();

// POST /auth/register
authRouter.post(
  '/register',
  rateLimits.authRegister,
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.validatedBody as typeof registerSchema._type;
      const result = await authService.register(body);

      res.cookie('refresh_token', result.refresh_token, COOKIE_OPTIONS);
      res.status(201).json({ success: true, data: { user: result.user, access_token: result.access_token } });
    } catch (err) { next(err); }
  }
);

// POST /auth/login
authRouter.post(
  '/login',
  rateLimits.authLogin,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.validatedBody as typeof loginSchema._type;
      const result = await authService.login(body);

      await auditLog({
        tenant_id: result.user.tenant_id,
        user_id: result.user.id,
        action: 'auth.login',
        resource_type: 'user',
        resource_id: result.user.id,
        ip_address: req.ip ?? null,
        status: 'SUCCESS',
      });

      res.cookie('refresh_token', result.refresh_token, COOKIE_OPTIONS);
      res.json({ success: true, data: { user: result.user, access_token: result.access_token } });
    } catch (err) { next(err); }
  }
);

// POST /auth/refresh
authRouter.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = req.cookies['refresh_token'] as string | undefined;
      if (!raw) throw new Error('No refresh token');

      const result = await authService.refreshAccessToken(raw);
      res.cookie('refresh_token', result.refresh_token, COOKIE_OPTIONS);
      res.json({ success: true, data: { access_token: result.access_token } });
    } catch (err) { next(err); }
  }
);

// POST /auth/logout
authRouter.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = req.cookies['refresh_token'] as string | undefined;
      if (raw) await authService.logout(raw);
      res.clearCookie('refresh_token', { path: '/api/v1/auth' });
      res.status(204).send();
    } catch (err) { next(err); }
  }
);

// GET /auth/me
authRouter.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getMe(req.user!.id);
      res.json({ success: true, data: { user } });
    } catch (err) { next(err); }
  }
);
