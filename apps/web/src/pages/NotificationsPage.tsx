import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
} from '@/services/notification.service';
import type { NotificationType } from '@pocketcomputer/shared-types';

const TYPE_LABELS: Record<NotificationType, { label: string; color: string }> = {
  INSIGHT_CRITICAL:            { label: 'Critical',      color: 'bg-red-500/10 text-red-600 border-red-200' },
  INSIGHT_WARNING:             { label: 'Warning',       color: 'bg-yellow-500/10 text-yellow-700 border-yellow-200' },
  DECISION_APPROVAL_REQUIRED:  { label: 'Approval',      color: 'bg-purple-500/10 text-purple-700 border-purple-200' },
  RULE_TRIGGERED:              { label: 'Rule',          color: 'bg-orange-500/10 text-orange-700 border-orange-200' },
  CONNECTOR_ERROR:             { label: 'Connector',     color: 'bg-red-500/10 text-red-600 border-red-200' },
  ANALYSIS_COMPLETED:          { label: 'Analysis',      color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  ANALYSIS_FAILED:             { label: 'Failed',        color: 'bg-red-500/10 text-red-600 border-red-200' },
  SYSTEM:                      { label: 'System',        color: 'bg-gray-500/10 text-gray-600 border-gray-200' },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(1, 50),
  });

  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notification-unread-count'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notification-unread-count'] });
    },
  });

  const unreadCount = data?.items.filter(n => !n.is_read).length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </CardTitle>
              <CardDescription>Alerts, insights and decisions that need your attention.</CardDescription>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="gap-1.5 text-xs"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </Button>
            )}
          </CardHeader>

          <CardContent className="space-y-2">
            {isLoading && (
              <p className="text-sm text-[hsl(var(--text-secondary))] py-4 text-center">Loading notifications...</p>
            )}
            {!isLoading && !data?.items.length && (
              <p className="text-sm text-[hsl(var(--text-secondary))] py-8 text-center">
                No notifications yet. They will appear here when the AI detects something that needs your attention.
              </p>
            )}

            {data?.items.map((n) => {
              const badge = TYPE_LABELS[n.type] ?? { label: n.type, color: 'bg-gray-100 text-gray-600' };
              return (
                <div
                  key={n.id}
                  onClick={() => { if (!n.is_read) markReadMutation.mutate(n.id); }}
                  className={cn(
                    'group flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors cursor-pointer',
                    n.is_read
                      ? 'border-[hsl(var(--border))] bg-transparent opacity-60'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] hover:bg-[hsl(var(--surface-2))]'
                  )}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 flex-shrink-0">
                    {!n.is_read
                      ? <div className="w-2 h-2 rounded-full bg-[hsl(var(--accent))]" />
                      : <div className="w-2 h-2" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] px-1.5 py-0 border', badge.color)}
                      >
                        {badge.label}
                      </Badge>
                      <p className="text-sm font-medium text-[hsl(var(--text-primary))] leading-snug">
                        {n.title}
                      </p>
                    </div>
                    <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  </div>

                  <span className="flex-shrink-0 text-[11px] text-[hsl(var(--text-secondary))] whitespace-nowrap mt-0.5">
                    {formatRelativeTime(n.created_at)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
