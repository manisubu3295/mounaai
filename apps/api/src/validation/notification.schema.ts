import { z } from 'zod';

export const updateNotificationPreferencesSchema = z.object({
  email_enabled: z.boolean().optional(),
  email_recipients: z.array(z.string().email()).max(20).optional(),
  notify_on_critical: z.boolean().optional(),
  notify_on_warning: z.boolean().optional(),
  notify_on_rule_trigger: z.boolean().optional(),
  notify_on_approval_required: z.boolean().optional(),
  notify_on_connector_error: z.boolean().optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
