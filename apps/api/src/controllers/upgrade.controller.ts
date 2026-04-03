import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

export const upgradeRouter: ExpressRouter = Router();
upgradeRouter.use(authenticate);

upgradeRouter.post('/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feature_attempted = req.body['feature_attempted'] as string | undefined;

    const upgradeRequest = await prisma.upgradeRequest.create({
      data: {
        tenant_id: req.user!.tenant_id,
        user_id: req.user!.id,
        feature_attempted: feature_attempted ?? null,
      },
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenant_id } });
    const message = encodeURIComponent(
      `${env.WHATSAPP_MESSAGE} (Tenant: ${tenant?.slug ?? req.user!.tenant_id})`
    );
    const whatsapp_url = `https://wa.me/${env.WHATSAPP_NUMBER}?text=${message}`;

    // Log the redirect
    await prisma.upgradeRequest.update({
      where: { id: upgradeRequest.id },
      data: { whatsapp_opened: true },
    });

    res.json({ success: true, data: { upgrade_request_id: upgradeRequest.id, whatsapp_url } });
  } catch (err) { next(err); }
});
