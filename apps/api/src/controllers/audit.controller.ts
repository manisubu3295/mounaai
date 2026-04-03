import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';
import { prisma } from '../lib/prisma.js';

export const auditRouter: ExpressRouter = Router();
auditRouter.use(authenticate, requireAdmin);

auditRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
    const action = req.query['action'] as string | undefined;
    const userId = req.query['user_id'] as string | undefined;
    const fromDate = req.query['from_date'] ? new Date(req.query['from_date'] as string) : undefined;
    const toDate = req.query['to_date'] ? new Date(req.query['to_date'] as string) : undefined;

    const where = {
      tenant_id: req.user!.tenant_id,
      ...(action && { action: { contains: action } }),
      ...(userId && { user_id: userId }),
      ...(fromDate || toDate ? { created_at: { ...(fromDate && { gte: fromDate }), ...(toDate && { lte: toDate }) } } : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { email: true } } },
      }),
    ]);

    const formatted = logs.map((l: (typeof logs)[number]) => ({
      id: l.id,
      user_id: l.user_id,
      user_email: l.user?.email,
      action: l.action,
      resource_type: l.resource_type,
      resource_id: l.resource_id,
      ip_address: l.ip_address,
      payload: l.payload,
      status: l.status,
      created_at: l.created_at.toISOString(),
    }));

    res.json({ success: true, data: { items: formatted, total, page, limit, has_more: (page - 1) * limit + logs.length < total } });
  } catch (err) { next(err); }
});
