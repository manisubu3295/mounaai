import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';
import * as userService from '../services/user.service.js';
import { prisma } from '../lib/prisma.js';

export const userRouter: ExpressRouter = Router();
userRouter.use(authenticate, requireAdmin);

// GET /users
userRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await userService.listUsers(req.user!.tenant_id);
    res.json({ success: true, data: { users } });
  } catch (err) { next(err); }
});

// POST /users  — invite a new user
userRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, role, full_name } = req.body as {
      email: string;
      role: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER';
      full_name?: string;
    };
    if (!email || !role) {
      return void res.status(400).json({ success: false, error: 'email and role are required' });
    }
    const [tenant, inviter] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: req.user!.tenant_id } }),
      prisma.user.findUnique({ where: { id: req.user!.id } }),
    ]);
    const inviterName = inviter?.full_name ?? req.user!.email;
    const user = await userService.inviteUser(
      req.user!.tenant_id,
      inviterName,
      tenant?.name ?? 'your workspace',
      email,
      role,
      full_name
    );
    res.status(201).json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

// PUT /users/:id/role
userRouter.put('/:id/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body as { role: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER' };
    if (!role) return void res.status(400).json({ success: false, error: 'role is required' });
    const user = await userService.updateUserRole(req.user!.tenant_id, req.params['id']!, role);
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

// DELETE /users/:id  — deactivate
userRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await userService.deactivateUser(req.user!.tenant_id, req.params['id']!, req.user!.id);
    if (!ok) return void res.status(404).json({ success: false, error: 'User not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});
