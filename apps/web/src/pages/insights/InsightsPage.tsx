import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Trash2, BarChart3, Calendar, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { listInsights } from '@/services/insight.service';
import { clearAnalysis, getPeriodicSummary } from '@/services/analysis.service';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import type { Insight, PeriodSummary } from '@pocketcomputer/shared-types';

type PeriodMode = 'all' | 'monthly' | 'quarterly';

const SEVERITY_STYLE: Record<string, { label: string; classes: string }> = {
  CRITICAL: { label: 'Must Know',    classes: 'bg-red-500/10 border-red-500/20 text-red-400' },
  WARNING:  { label: 'Watch Out',    classes: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' },
  INFO:     { label: 'Good to Know', classes: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
};

const TYPE_LABEL: Record<string, string> = {
  RISK:         'Risk',
  OPPORTUNITY:  'Opportunity',
  INEFFICIENCY: 'Inefficiency',
  WATCH:        'Watch',
};

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
          This will permanently delete all AI checks, insights, and suggested actions for your workspace.
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

// ── Group insights by month/quarter ──────────────────────────────────────────
function groupInsightsByPeriod(
  insights: Insight[],
  mode: 'monthly' | 'quarterly'
): Array<{ period: string; label: string; items: Insight[] }> {
  const map = new Map<string, Insight[]>();

  for (const insight of insights) {
    const d = new Date(insight.created_at);
    let key: string;
    if (mode === 'monthly') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else {
      const q = Math.floor(d.getMonth() / 3) + 1;
      key = `${d.getFullYear()}-Q${q}`;
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(insight);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      let label: string;
      if (mode === 'monthly') {
        const [y, m] = key.split('-');
        label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      } else {
        const [y, q] = key.split('-Q');
        label = `Q${q} ${y}`;
      }
      return { period: key, label, items };
    });
}

// ── Period summary card (reuses PeriodSummary from analysis service) ──────────
function PeriodSummaryBadge({ item }: { item: PeriodSummary }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 mb-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-semibold text-[hsl(var(--text-primary))]">{item.period_label}</p>
        <span className="text-[11px] text-[hsl(var(--text-disabled))]">{item.run_count} run{item.run_count !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] text-[hsl(var(--text-secondary))]">{item.insight_count} insights total</span>
        {item.critical_count > 0 && <span className="text-[11px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">{item.critical_count} critical</span>}
        {item.warning_count  > 0 && <span className="text-[11px] font-medium text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">{item.warning_count} warning</span>}
        {item.info_count     > 0 && <span className="text-[11px] font-medium text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">{item.info_count} info</span>}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function InsightsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'TENANT_ADMIN';

  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['insights'],
    queryFn: () => listInsights(1, 200),
  });

  const { data: periodData, isLoading: periodLoading } = useQuery({
    queryKey: ['periodic-summary', periodMode],
    queryFn: () => getPeriodicSummary(periodMode as 'monthly' | 'quarterly'),
    enabled: periodMode !== 'all',
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

  const allInsights = data?.items ?? [];
  const grouped = periodMode !== 'all'
    ? groupInsightsByPeriod(allInsights, periodMode)
    : [];

  return (
    <div className="flex-1 overflow-y-auto">
      {showClearConfirm && (
        <ConfirmClearDialog
          onConfirm={() => clearMutation.mutate()}
          onCancel={() => setShowClearConfirm(false)}
          isPending={clearMutation.isPending}
        />
      )}

      <div className="max-w-5xl mx-auto px-6 py-7 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-semibold text-[hsl(var(--text-primary))] tracking-tight">
              What the AI Found
            </h1>
            <p className="text-[13px] text-[hsl(var(--text-secondary))] mt-0.5">
              These are things your AI spotted while checking your business data.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-500 text-[12.5px] hover:bg-red-500/10 transition-colors flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Analysis
            </button>
          )}
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-1 p-1 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg w-fit">
          {([
            { mode: 'all'       as const, icon: BarChart3,    label: 'All Findings' },
            { mode: 'monthly'   as const, icon: Calendar,     label: 'Monthly'      },
            { mode: 'quarterly' as const, icon: CalendarDays, label: 'Quarterly'    },
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

        {/* ── All Findings view ─────────────────────────── */}
        {periodMode === 'all' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-400" />
                Findings
                {data?.total != null && (
                  <span className="text-[13px] font-normal text-[hsl(var(--text-secondary))]">
                    — {data.total} total
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Each finding below is something the AI noticed. The label shows how important it is.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-[hsl(var(--border-strong))] border-t-[hsl(var(--accent))]" />
                </div>
              )}
              {!isLoading && !allInsights.length && (
                <div className="py-10 text-center">
                  <Lightbulb className="w-8 h-8 text-[hsl(var(--text-disabled))] mx-auto mb-2" />
                  <p className="text-[13px] text-[hsl(var(--text-secondary))]">Nothing found yet.</p>
                  <p className="text-[12px] text-[hsl(var(--text-disabled))] mt-1">
                    Run an AI check from the Home page and findings will appear here.
                  </p>
                </div>
              )}
              {allInsights.map((insight) => {
                const sev = SEVERITY_STYLE[insight.severity] ?? { label: insight.severity, classes: 'bg-[hsl(var(--surface-2))] border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]' };
                return (
                  <div key={insight.id} className="rounded-lg border border-[hsl(var(--border))] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[13px] font-medium text-[hsl(var(--text-primary))] leading-snug">
                        {insight.title}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[11px] text-[hsl(var(--text-disabled))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded">
                          {TYPE_LABEL[insight.type] ?? insight.type}
                        </span>
                        <span className={cn('inline-flex items-center rounded px-[7px] py-[2px] text-[11px] font-medium border', sev.classes)}>
                          {sev.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-[12.5px] text-[hsl(var(--text-secondary))] mt-1.5 leading-relaxed">
                      {insight.summary}
                    </p>
                    {insight.confidence != null && (
                      <p className="text-[11.5px] text-[hsl(var(--text-disabled))] mt-1.5">
                        The AI is {Math.round(insight.confidence * 100)}% sure about this.
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* ── Monthly / Quarterly view ───────────────────── */}
        {periodMode !== 'all' && (
          <div className="space-y-6">
            {periodLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-[hsl(var(--border-strong))] border-t-[hsl(var(--accent))]" />
              </div>
            ) : !periodData?.length ? (
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] py-10 text-center">
                <BarChart3 className="w-8 h-8 text-[hsl(var(--text-disabled))] mx-auto mb-2" />
                <p className="text-[13px] text-[hsl(var(--text-secondary))]">No completed analysis runs yet.</p>
              </div>
            ) : (
              periodData.map((psum) => {
                const periodInsights = grouped.find(g => g.period === psum.period)?.items ?? [];
                return (
                  <div key={psum.period}>
                    <PeriodSummaryBadge item={psum} />
                    {periodInsights.length > 0 ? (
                      <div className="space-y-2 mt-2">
                        {periodInsights.map((insight) => {
                          const sev = SEVERITY_STYLE[insight.severity] ?? { label: insight.severity, classes: 'bg-[hsl(var(--surface-2))] border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]' };
                          return (
                            <div key={insight.id} className="rounded-lg border border-[hsl(var(--border))] px-4 py-3 ml-2">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-[13px] font-medium text-[hsl(var(--text-primary))] leading-snug">
                                  {insight.title}
                                </p>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[11px] text-[hsl(var(--text-disabled))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded">
                                    {TYPE_LABEL[insight.type] ?? insight.type}
                                  </span>
                                  <span className={cn('inline-flex items-center rounded px-[7px] py-[2px] text-[11px] font-medium border', sev.classes)}>
                                    {sev.label}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[12.5px] text-[hsl(var(--text-secondary))] mt-1.5 leading-relaxed">
                                {insight.summary}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[12px] text-[hsl(var(--text-disabled))] ml-2 mt-1">
                        No insights in this period (data may not be loaded — fetch more from All Findings view).
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
