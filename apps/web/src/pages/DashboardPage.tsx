import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, CheckCircle2, Lightbulb, PlayCircle, ArrowRight,
  Clock, Trash2, BarChart3, Calendar, CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listAnalysisRuns, createAnalysisRun, clearAnalysis, getPeriodicSummary } from '@/services/analysis.service';
import { listInsights } from '@/services/insight.service';
import { listDecisions } from '@/services/decision.service';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import type { PeriodSummary } from '@pocketcomputer/shared-types';

type PeriodMode = 'all' | 'monthly' | 'quarterly';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'default' | 'outline' }> = {
    COMPLETED: { label: 'Completed', variant: 'success' },
    RUNNING:   { label: 'Running',   variant: 'default' },
    QUEUED:    { label: 'Queued',    variant: 'outline' },
    FAILED:    { label: 'Failed',    variant: 'error' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'outline' };
  return <Badge variant={variant}>{label}</Badge>;
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    URGENT: 'bg-red-500',
    HIGH:   'bg-orange-400',
    MEDIUM: 'bg-yellow-400',
    LOW:    'bg-[hsl(var(--text-disabled))]',
  };
  return (
    <span
      title={priority}
      className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0 mt-[3px]', colors[priority] ?? 'bg-[hsl(var(--text-disabled))]')}
    />
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmClearDialog({ onConfirm, onCancel, isPending }: {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <Trash2 className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[hsl(var(--text-primary))]">Clear All Analysis Data</p>
            <p className="text-[12px] text-[hsl(var(--text-muted))]">This cannot be undone</p>
          </div>
        </div>
        <p className="text-[13px] text-[hsl(var(--text-secondary))] mb-5">
          This will permanently delete all AI checks, insights, and suggested actions for your workspace. Your connectors and settings will not be affected.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[hsl(var(--border))] text-[13px] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-red-500 text-white text-[13px] font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Clearing…' : 'Yes, Clear Everything'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Period Summary Card ───────────────────────────────────────────────────────
function PeriodCard({ item }: { item: PeriodSummary }) {
  const hasData = item.run_count > 0;
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-[hsl(var(--text-primary))]">{item.period_label}</p>
        <span className="text-[11px] text-[hsl(var(--text-disabled))] bg-[hsl(var(--surface-2))] px-2 py-0.5 rounded-full">
          {item.run_count} run{item.run_count !== 1 ? 's' : ''}
        </span>
      </div>
      {hasData ? (
        <div className="space-y-2">
          {/* Insights row */}
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[hsl(var(--text-muted))]">Insights found</span>
            <div className="flex items-center gap-2">
              {item.critical_count > 0 && (
                <span className="text-[11px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                  {item.critical_count} critical
                </span>
              )}
              {item.warning_count > 0 && (
                <span className="text-[11px] font-medium text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                  {item.warning_count} warning
                </span>
              )}
              {item.info_count > 0 && (
                <span className="text-[11px] font-medium text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                  {item.info_count} info
                </span>
              )}
              {item.insight_count === 0 && (
                <span className="text-[12px] text-[hsl(var(--text-disabled))]">None</span>
              )}
            </div>
          </div>
          {/* Decisions row */}
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[hsl(var(--text-muted))]">Actions</span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[hsl(var(--text-secondary))]">{item.decision_count} total</span>
              {item.approved_count > 0 && (
                <span className="text-[11px] font-medium text-green-400">✓ {item.approved_count} done</span>
              )}
              {item.rejected_count > 0 && (
                <span className="text-[11px] font-medium text-red-400">✗ {item.rejected_count} skipped</span>
              )}
            </div>
          </div>
          {/* Performance bar */}
          {item.insight_count > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[11px] text-[hsl(var(--text-disabled))] mb-1">
                <span>Action rate</span>
                <span>{item.decision_count > 0 ? Math.round((item.approved_count / item.decision_count) * 100) : 0}%</span>
              </div>
              <div className="h-1 bg-[hsl(var(--border))] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--accent))] rounded-full transition-all"
                  style={{ width: item.decision_count > 0 ? `${Math.round((item.approved_count / item.decision_count) * 100)}%` : '0%' }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-[hsl(var(--text-disabled))]">No completed analysis runs this period.</p>
      )}
    </div>
  );
}

const STAT_CARDS = [
  { label: 'AI Checks Run',      icon: Activity,      color: 'text-[hsl(var(--accent-hover))]', bg: 'bg-[hsl(var(--accent)/0.1)]',  key: 'analysisRuns' as const },
  { label: 'Things Found',       icon: Lightbulb,     color: 'text-yellow-400',                 bg: 'bg-yellow-400/10',              key: 'insights'     as const },
  { label: 'Actions Suggested',  icon: AlertTriangle, color: 'text-orange-400',                 bg: 'bg-orange-400/10',              key: 'decisions'    as const },
  { label: 'Actions Taken',      icon: CheckCircle2,  color: 'text-[hsl(var(--success))]',      bg: 'bg-[hsl(var(--success)/0.1)]',  key: 'approved'     as const },
];

export function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'TENANT_ADMIN';

  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { data: analysisRuns } = useQuery({
    queryKey: ['analysis-runs', 'dashboard'],
    queryFn: () => listAnalysisRuns(1, 5),
  });
  const { data: insights } = useQuery({
    queryKey: ['insights', 'dashboard'],
    queryFn: () => listInsights(1, 5),
  });
  const { data: decisions } = useQuery({
    queryKey: ['decisions', 'dashboard'],
    queryFn: () => listDecisions(1, 5),
  });
  const { data: periodData, isLoading: periodLoading } = useQuery({
    queryKey: ['periodic-summary', periodMode],
    queryFn: () => getPeriodicSummary(periodMode as 'monthly' | 'quarterly'),
    enabled: periodMode !== 'all',
  });

  const createRunMutation = useMutation({
    mutationFn: () => createAnalysisRun({ source: 'manual_dashboard_trigger' }),
    onSuccess: (run) => {
      void qc.invalidateQueries({ queryKey: ['analysis-runs'] });
      navigate(`/analysis-runs/${run.id}`);
    },
  });

  const clearMutation = useMutation({
    mutationFn: clearAnalysis,
    onSuccess: () => {
      setShowClearConfirm(false);
      void qc.invalidateQueries({ queryKey: ['analysis-runs'] });
      void qc.invalidateQueries({ queryKey: ['insights'] });
      void qc.invalidateQueries({ queryKey: ['decisions'] });
      void qc.invalidateQueries({ queryKey: ['periodic-summary'] });
    },
  });

  const approvedCount = decisions?.items.filter((d) => d.status === 'APPROVED').length ?? 0;
  const statValues: Record<string, number> = {
    analysisRuns: analysisRuns?.total ?? 0,
    insights:     insights?.total ?? 0,
    decisions:    decisions?.total ?? 0,
    approved:     approvedCount,
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex-1 overflow-y-auto bg-[hsl(var(--background))]">
      {showClearConfirm && (
        <ConfirmClearDialog
          onConfirm={() => clearMutation.mutate()}
          onCancel={() => setShowClearConfirm(false)}
          isPending={clearMutation.isPending}
        />
      )}

      <div className="max-w-6xl mx-auto px-6 py-7 space-y-6">

        {/* ── Page header ─────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-eyebrow mb-1">{dateStr}</p>
            <h1 className="text-[18px] font-semibold text-[hsl(var(--text-primary))] tracking-tight">
              {user?.full_name ? `Hi ${user.full_name.split(' ')[0]}, here's your summary` : 'Your Business Summary'}
            </h1>
            <p className="text-[13px] text-[hsl(var(--text-secondary))] mt-0.5">
              See what your AI found, what needs your attention, and what's been done.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-500 text-[12.5px] hover:bg-red-500/10 transition-colors"
                title="Clear all analysis data"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
            <Button
              onClick={() => createRunMutation.mutate()}
              loading={createRunMutation.isPending}
              className="shadow-sm"
            >
              <PlayCircle className="w-4 h-4" />
              Check My Business
            </Button>
          </div>
        </div>

        {/* ── KPI tiles ───────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STAT_CARDS.map(({ label, icon: Icon, color, bg, key }) => (
            <div
              key={label}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-5 py-4 flex items-center gap-4"
            >
              <div className={cn('w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0', bg)}>
                <Icon className={cn('w-4 h-4', color)} />
              </div>
              <div className="min-w-0">
                <p className="stat-value">{statValues[key]}</p>
                <p className="text-[12px] text-[hsl(var(--text-secondary))] mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Period tabs ──────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg w-fit">
          {([
            { mode: 'all'       as const, icon: BarChart3,   label: 'Overview'  },
            { mode: 'monthly'   as const, icon: Calendar,    label: 'Monthly'   },
            { mode: 'quarterly' as const, icon: CalendarDays, label: 'Quarterly' },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setPeriodMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-all',
                periodMode === mode
                  ? 'bg-[hsl(var(--accent))] text-white shadow-sm'
                  : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Period view ──────────────────────────────────── */}
        {periodMode !== 'all' && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[14px] font-semibold text-[hsl(var(--text-primary))]">
                {periodMode === 'monthly' ? 'Monthly Analysis' : 'Quarterly Analysis'}
              </h2>
              <span className="text-[12px] text-[hsl(var(--text-muted))]">
                — based on completed AI checks
              </span>
            </div>
            {periodLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-[hsl(var(--border-strong))] border-t-[hsl(var(--accent))]" />
              </div>
            ) : !periodData?.length ? (
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] py-10 text-center">
                <BarChart3 className="w-8 h-8 text-[hsl(var(--text-disabled))] mx-auto mb-2" />
                <p className="text-[13px] text-[hsl(var(--text-secondary))]">No completed analysis runs yet.</p>
                <p className="text-[12px] text-[hsl(var(--text-disabled))] mt-1">
                  Run an AI check to start building your {periodMode} history.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {periodData.map((item) => (
                  <PeriodCard key={item.period} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Detail panels (Overview only) ───────────────── */}
        {periodMode === 'all' && (
          <div className="grid gap-4 xl:grid-cols-2">

            {/* Recent Analysis Runs */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Recent AI Checks</CardTitle>
                  <button
                    onClick={() => navigate('/decisions')}
                    className="text-[11.5px] text-[hsl(var(--accent-hover))] hover:underline flex items-center gap-1"
                  >
                    View all <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <CardDescription>Every time you asked the AI to check your business data.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {analysisRuns?.items.length ? (
                  <div className="divide-y divide-[hsl(var(--border))]">
                    {analysisRuns.items.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => navigate(`/analysis-runs/${run.id}`)}
                        className="w-full flex items-center justify-between py-2.5 text-left hover:bg-[hsl(var(--surface-2))] -mx-5 px-5 transition-colors first:rounded-t-none last:rounded-b-md"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Clock className="w-3.5 h-3.5 text-[hsl(var(--text-disabled))] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium text-[hsl(var(--text-primary))] truncate">
                              {run.initiated_by_user_id ? 'Manual trigger' : 'Scheduled run'}
                            </p>
                            <p className="text-[11.5px] text-[hsl(var(--text-secondary))]">
                              {new Date(run.created_at).toLocaleString('en-US', {
                                month: 'short', day: 'numeric',
                                hour: 'numeric', minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <StatusBadge status={run.status} />
                          <span className="data-mono opacity-50">{run.id.slice(0, 8)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Activity className="w-8 h-8 text-[hsl(var(--text-disabled))] mx-auto mb-2" />
                    <p className="text-[13px] text-[hsl(var(--text-secondary))]">No checks done yet.</p>
                    <p className="text-[12px] text-[hsl(var(--text-disabled))] mt-0.5">
                      Click <strong>Check My Business</strong> to let the AI take a look.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Latest Decisions */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Things You Should Do</CardTitle>
                  <button
                    onClick={() => navigate('/decisions')}
                    className="text-[11.5px] text-[hsl(var(--accent-hover))] hover:underline flex items-center gap-1"
                  >
                    See all actions <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <CardDescription>The AI spotted these and thinks you should take a look.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {decisions?.items.length ? (
                  <div className="divide-y divide-[hsl(var(--border))]">
                    {decisions.items.map((decision) => (
                      <div key={decision.id} className="py-2.5 flex items-start gap-2.5">
                        <PriorityDot priority={decision.priority} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-medium text-[hsl(var(--text-primary))] truncate leading-tight">
                            {decision.title}
                          </p>
                          <p className="text-[11.5px] text-[hsl(var(--text-secondary))] mt-0.5 line-clamp-2 leading-snug">
                            {decision.recommendation}
                          </p>
                        </div>
                        <span className="text-[11px] text-[hsl(var(--text-disabled))] flex-shrink-0 mt-0.5">
                          {decision.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="w-8 h-8 text-[hsl(var(--text-disabled))] mx-auto mb-2" />
                    <p className="text-[13px] text-[hsl(var(--text-secondary))]">Nothing to do yet — great!</p>
                    <p className="text-[12px] text-[hsl(var(--text-disabled))] mt-0.5">
                      When the AI spots something, it'll show up here for you to act on.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </div>
  );
}
