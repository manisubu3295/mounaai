import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { rateLimits } from '../middleware/rate-limit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createChatSchema, updateChatSchema, sendMessageSchema } from '../validation/chat.schema.js';
import * as chatService from '../services/chat.service.js';
import { executePipeline, executePipelineStream } from '../services/message-pipeline.service.js';
import { z } from 'zod';

export const chatRouter: ExpressRouter = Router();

chatRouter.use(authenticate);

// GET /chats
chatRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 50);
    const result = await chatService.listChats(req.user!.id, req.user!.tenant_id, page, limit);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /chats
chatRouter.post('/', validate(createChatSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof createChatSchema>;
    const chat = await chatService.createChat(req.user!.id, req.user!.tenant_id, body.title);
    res.status(201).json({ success: true, data: { chat } });
  } catch (err) { next(err); }
});

// GET /chats/:id
chatRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await chatService.getChat(req.params['id']!, req.user!.id, req.user!.tenant_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// PATCH /chats/:id
chatRouter.patch('/:id', validate(updateChatSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof updateChatSchema>;
    const update: { title?: string; status?: 'ACTIVE' | 'ARCHIVED' } = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.status !== undefined) update.status = body.status;

    const chat = await chatService.updateChat(req.params['id']!, req.user!.id, req.user!.tenant_id, update);
    res.json({ success: true, data: { chat } });
  } catch (err) { next(err); }
});

// DELETE /chats/:id
chatRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await chatService.deleteChat(req.params['id']!, req.user!.id, req.user!.tenant_id);
    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /chats/:id/messages
chatRouter.post(
  '/:id/messages',
  rateLimits.chatMessage,
  validate(sendMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.validatedBody as z.infer<typeof sendMessageSchema>;
      const chatId = req.params['id']!;

      // Verify chat ownership and get history
      const { chat, messages } = await chatService.getChat(chatId, req.user!.id, req.user!.tenant_id);

      if (chat.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          error: { code: 'CHAT_NOT_ACTIVE', message: 'Cannot send messages to an archived chat.', request_id: req.id },
        });
      }

      const isFirstMessage = messages.filter(m => m.role === 'USER').length === 0;

      const assistantMsg = await executePipeline({
        chatId,
        tenantId: req.user!.tenant_id,
        userId: req.user!.id,
        userMessage: body.content,
        chatHistory: messages,
        isFirstMessage,
      });

      res.json({ success: true, data: { message: assistantMsg } });
    } catch (err) { next(err); }
  }
);

// POST /chats/:id/messages/stream  — SSE streaming response
chatRouter.post(
  '/:id/messages/stream',
  rateLimits.chatMessage,
  validate(sendMessageSchema),
  async (req: Request, res: Response) => {
    const body = req.validatedBody as z.infer<typeof sendMessageSchema>;
    const chatId = req.params['id']!;

    let chatData: Awaited<ReturnType<typeof chatService.getChat>>;
    try {
      chatData = await chatService.getChat(chatId, req.user!.id, req.user!.tenant_id);
    } catch {
      res.status(404).json({ success: false, error: 'Chat not found' });
      return;
    }

    if (chatData.chat.status !== 'ACTIVE') {
      res.status(400).json({ success: false, error: 'Cannot send messages to an archived chat.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const isFirstMessage = chatData.messages.filter(m => m.role === 'USER').length === 0;

    await executePipelineStream(
      {
        chatId,
        tenantId: req.user!.tenant_id,
        userId: req.user!.id,
        userMessage: body.content,
        chatHistory: chatData.messages,
        isFirstMessage,
      },
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
      },
      (msg) => {
        res.write(`data: ${JSON.stringify({ type: 'done', message: msg })}\n\n`);
        res.end();
      },
      (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
        res.end();
      }
    );
  }
);
