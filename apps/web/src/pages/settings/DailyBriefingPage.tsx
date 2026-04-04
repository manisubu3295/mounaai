import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Clock, Globe, Mail, Plus, Trash2, Save, CheckCircle2 } from 'lucide-react';
import { getDailyReport, updateDailyReport } from '@/services/daily-report.service';

// Common IANA timezones for the dropdown
const TIMEZONES = [
  { label: 'Asia/Kolkata (IST, UTC+5:30)', value: 'Asia/Kolkata' },
  { label: 'Asia/Dubai (GST, UTC+4)', value: 'Asia/Dubai' },
  { label: 'Asia/Singapore (SGT, UTC+8)', value: 'Asia/Singapore' },
  { label: 'Asia/Tokyo (JST, UTC+9)', value: 'Asia/Tokyo' },
  { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
  { label: 'Europe/Paris (CET, UTC+1)', value: 'Europe/Paris' },
  { label: 'America/New_York (EST/EDT)', value: 'America/New_York' },
  { label: 'America/Chicago (CST/CDT)', value: 'America/Chicago' },
  { label: 'America/Los_Angeles (PST/PDT)', value: 'America/Los_Angeles' },
  { label: 'UTC', value: 'UTC' },
];

export function DailyBriefingPage() {
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['daily-report'],
    queryFn: getDailyReport,
  });

  const [isEnabled, setIsEnabled] = useState(false);
  const [sendTime, setSendTime] = useState('09:00');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setIsEnabled(config.is_enabled);
      setSendTime(config.send_time);
      setTimezone(config.timezone);
      setRecipients(config.email_recipients ?? []);
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: updateDailyReport,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-report'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function addEmail() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Invalid email address');
      return;
    }
    if (recipients.includes(trimmed)) {
      setEmailError('Already in list');
      return;
    }
    if (recipients.length >= 20) {
      setEmailError('Maximum 20 recipients');
      return;
    }
    setRecipients(prev => [...prev, trimmed]);
    setNewEmail('');
    setEmailError('');
  }

  function removeEmail(email: string) {
    setRecipients(prev => prev.filter(e => e !== email));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addEmail(); }
  }

  function handleSave() {
    mutation.mutate({ is_enabled: isEnabled, send_time: sendTime, timezone, email_recipients: recipients });
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-[hsl(var(--border-strong))] border-t-[hsl(var(--accent))]" />
      </div>
    );
  }

  const lastSent = config?.last_sent_at
    ? new Date(config.last_sent_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-[18px] font-semibold text-[hsl(var(--text-primary))]">Daily Briefing</h1>
          <p className="text-[13px] text-[hsl(var(--text-muted))] mt-1">
            Schedule an automatic daily analysis run and receive the results by email.
          </p>
        </div>

        {/* Enable toggle */}
        <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[hsl(var(--accent))]/10 flex items-center justify-center flex-shrink-0">
              <Bell className="h-4 w-4 text-[hsl(var(--accent))]" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-[hsl(var(--text-primary))]">Enable Daily Briefing</p>
              <p className="text-[12px] text-[hsl(var(--text-muted))]">
                Triggers an AI analysis run daily and emails the summary
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
              isEnabled ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--border-strong))]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Schedule */}
        <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-[hsl(var(--text-muted))]" />
            <span className="text-[13px] font-medium text-[hsl(var(--text-primary))]">Schedule</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] text-[hsl(var(--text-muted))]">Send Time</label>
              <input
                type="time"
                value={sendTime}
                onChange={e => setSendTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[13px] text-[hsl(var(--text-primary))] focus:outline-none focus:border-[hsl(var(--accent))]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] text-[hsl(var(--text-muted))]">
                <Globe className="inline h-3 w-3 mr-1" />Timezone
              </label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[13px] text-[hsl(var(--text-primary))] focus:outline-none focus:border-[hsl(var(--accent))]"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>

          {isEnabled && (
            <p className="text-[12px] text-[hsl(var(--text-muted))] bg-[hsl(var(--accent))]/5 border border-[hsl(var(--accent))]/20 rounded-lg px-3 py-2">
              Analysis will run daily at <strong>{sendTime}</strong> ({timezone}) and results will be emailed automatically.
            </p>
          )}

          {lastSent && (
            <p className="text-[12px] text-[hsl(var(--text-muted))]">
              Last sent: <span className="text-[hsl(var(--text-secondary))]">{lastSent}</span>
            </p>
          )}
        </div>

        {/* Email Recipients */}
        <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-4 w-4 text-[hsl(var(--text-muted))]" />
            <span className="text-[13px] font-medium text-[hsl(var(--text-primary))]">Email Recipients</span>
            <span className="ml-auto text-[11px] text-[hsl(var(--text-disabled))]">{recipients.length}/20</span>
          </div>

          {/* Add email input */}
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="email"
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
                onKeyDown={handleKeyDown}
                placeholder="you@yourcompany.com"
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[13px] text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-disabled))] focus:outline-none focus:border-[hsl(var(--accent))]"
              />
              {emailError && (
                <p className="text-[11px] text-red-500 mt-1">{emailError}</p>
              )}
            </div>
            <button
              onClick={addEmail}
              className="px-3 py-2 rounded-lg bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/20 transition-colors flex items-center gap-1.5 text-[13px] font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {/* Recipient list */}
          {recipients.length > 0 ? (
            <div className="space-y-2">
              {recipients.map(email => (
                <div
                  key={email}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]"
                >
                  <span className="text-[13px] text-[hsl(var(--text-primary))]">{email}</span>
                  <button
                    onClick={() => removeEmail(email)}
                    className="text-[hsl(var(--text-disabled))] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[hsl(var(--text-disabled))] text-center py-3">
              No recipients added yet. Add at least one email to receive briefings.
            </p>
          )}
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between">
          {saved ? (
            <span className="flex items-center gap-1.5 text-[13px] text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              Settings saved
            </span>
          ) : (
            <span />
          )}
          <button
            onClick={handleSave}
            disabled={mutation.isPending || (isEnabled && recipients.length === 0)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--accent))] text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-3.5 w-3.5" />
            {mutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
        {isEnabled && recipients.length === 0 && (
          <p className="text-[12px] text-amber-500 text-right -mt-4">
            Add at least one recipient to enable briefings.
          </p>
        )}
        {mutation.isError && (
          <p className="text-[12px] text-red-500 text-right">
            {(mutation.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
              ?? (mutation.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}
