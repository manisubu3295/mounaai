import { z } from 'zod';

export const createChatSchema = z.object({
  title: z.string().max(255).optional(),
});

export const updateChatSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
