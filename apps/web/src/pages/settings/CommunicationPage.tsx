import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/services/notification.service';

interface CommunicationFormValues {
  communication_email: string;
  email_enabled: boolean;
  notify_on_rule_trigger: boolean;
  notify_on_approval_required: boolean;
  notify_on_connector_error: boolean;
}

export function CommunicationPage() {
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
  });

  const {
    register,
    reset,
    handleSubmit,
    formState: { isDirty },
  } = useForm<CommunicationFormValues>({
    defaultValues: {
      communication_email: '',
      email_enabled: true,
      notify_on_rule_trigger: true,
      notify_on_approval_required: true,
      notify_on_connector_error: true,
    },
  });

  useEffect(() => {
    if (!preferences) return;

    reset({
      communication_email: preferences.email_recipients[0] ?? '',
      email_enabled: preferences.email_enabled,
      notify_on_rule_trigger: preferences.notify_on_rule_trigger,
      notify_on_approval_required: preferences.notify_on_approval_required,
      notify_on_connector_error: preferences.notify_on_connector_error,
    });
  }, [preferences, reset]);

  const saveMutation = useMutation({
    mutationFn: async (values: CommunicationFormValues) => {
      const recipient = values.communication_email.trim();

      return updateNotificationPreferences({
        email_enabled: values.email_enabled,
        email_recipients: recipient ? [recipient] : [],
        notify_on_rule_trigger: values.notify_on_rule_trigger,
        notify_on_approval_required: values.notify_on_approval_required,
        notify_on_connector_error: values.notify_on_connector_error,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['notification-preferences'], updated);
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      setSaveState({ kind: 'success', message: 'Communication email updated.' });
      reset({
        communication_email: updated.email_recipients[0] ?? '',
        email_enabled: updated.email_enabled,
        notify_on_rule_trigger: updated.notify_on_rule_trigger,
        notify_on_approval_required: updated.notify_on_approval_required,
        notify_on_connector_error: updated.notify_on_connector_error,
      });
    },
    onError: () => {
      setSaveState({ kind: 'error', message: 'Could not update communication settings.' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--text-secondary))]" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-[hsl(var(--text-primary))]">Communication</h1>
          <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
            Configure the primary email address that receives rule, approval, and connector notifications.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4 text-[hsl(var(--accent-hover))]" />
              Communication Email
            </CardTitle>
            <CardDescription>
              This address is stored in tenant notification preferences and used for operational alerts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="communication_email">Primary email address</Label>
                <Input
                  id="communication_email"
                  type="email"
                  placeholder="mani1@gmail.com"
                  {...register('communication_email')}
                />
                <p className="text-xs text-[hsl(var(--text-secondary))]">
                  Leave empty to fall back to tenant admin addresses.
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4">
                <label className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium text-[hsl(var(--text-primary))]">Email delivery enabled</p>
                    <p className="text-xs text-[hsl(var(--text-secondary))]">Allow the platform to send email notifications.</p>
                  </div>
                  <input type="checkbox" className="accent-[hsl(var(--accent))]" {...register('email_enabled')} />
                </label>

                <label className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium text-[hsl(var(--text-primary))]">Rule triggered alerts</p>
                    <p className="text-xs text-[hsl(var(--text-secondary))]">Send emails when a business rule triggers.</p>
                  </div>
                  <input type="checkbox" className="accent-[hsl(var(--accent))]" {...register('notify_on_rule_trigger')} />
                </label>

                <label className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium text-[hsl(var(--text-primary))]">Decision approval alerts</p>
                    <p className="text-xs text-[hsl(var(--text-secondary))]">Send emails when a decision needs approval.</p>
                  </div>
                  <input type="checkbox" className="accent-[hsl(var(--accent))]" {...register('notify_on_approval_required')} />
                </label>

                <label className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium text-[hsl(var(--text-primary))]">Connector error alerts</p>
                    <p className="text-xs text-[hsl(var(--text-secondary))]">Send emails when a connector fails.</p>
                  </div>
                  <input type="checkbox" className="accent-[hsl(var(--accent))]" {...register('notify_on_connector_error')} />
                </label>
              </div>

              {saveState && (
                <div
                  className={saveState.kind === 'success'
                    ? 'flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'
                    : 'flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'}
                >
                  {saveState.kind === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {saveState.message}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={saveMutation.isPending || !isDirty}>
                  {saveMutation.isPending ? 'Saving...' : 'Save Communication Settings'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}