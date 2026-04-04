import { z } from 'zod';

export const updateDailyReportSchema = z.object({
  is_enabled: z.boolean().optional(),
  send_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'send_time must be HH:MM format')
    .optional(),
  timezone: z.string().min(1).max(64).optional(),
  email_recipients: z
    .array(z.string().email())
    .max(20, 'Maximum 20 recipients')
    .optional(),
});
