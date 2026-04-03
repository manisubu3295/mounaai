import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateNotificationPreferencesSchema } from '../validation/notification.schema.js';
import * as notificationService from '../services/notification.service.js';
import { NotFoundError } from '../types/errors.js';
import type { z } from 'zod';
import type { updateNotificationPreferencesSchema as Schema } from '../validation/notification.schema.js';

export const notificationRouter: ExpressRouter = Router();
notificationRouter.use(authenticate);

// GET /api/v1/notifications — list notifications for current user
notificationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = parseInt(req.query['page']  as string) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
    const result = await notificationService.listNotifications(
      req.user!.tenant_id,
      req.user!.id,
      page,
      limit
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/v1/notifications/unread-count — fast badge count
notificationRouter.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.tenant_id, req.user!.id);
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
});

// GET /api/v1/notifications/preferences — get preferences (auto-creates defaults)
notificationRouter.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prefs = await notificationService.getOrCreatePreferences(req.user!.tenant_id);
    res.json({ success: true, data: { preferences: prefs } });
  } catch (err) { next(err); }
});

// PUT /api/v1/notifications/preferences — update preferences (admin only)
notificationRouter.put(
  '/preferences',
  requireAdmin,
  validate(updateNotificationPreferencesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.validatedBody as z.infer<typeof Schema>;
      const prefs = await notificationService.updatePreferences(req.user!.tenant_id, body);
      res.json({ success: true, data: { preferences: prefs } });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/notifications/:id/read — mark single notification as read
notificationRouter.post('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const marked = await notificationService.markAsRead(
      req.user!.tenant_id,
      req.user!.id,
      req.params['id']!
    );
    if (!marked) throw new NotFoundError('Notification');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/v1/notifications/read-all — mark all as read
notificationRouter.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.markAllAsRead(req.user!.tenant_id, req.user!.id);
    res.json({ success: true, data: { marked: count } });
  } catch (err) { next(err); }
});
