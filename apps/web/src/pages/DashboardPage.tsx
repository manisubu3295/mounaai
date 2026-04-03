import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, Lightbulb, PlayCircle, ArrowRight, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listAnalysisRuns, createAnalysisRun } from '@/services/analysis.service';
import { listInsights } from '@/services/insight.service';
import { listDecisions } from '@/services/decision.service';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

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

const STAT_CARDS = [
  {
    label: 'Analysis Runs',
    icon: Activity,
    color: 'text-[hsl(var(--accent-hover))]',
    bg: 'bg-[hsl(var(--accent)/0.1)]',
    key: 'analysisRuns' as const,
  },
  {
    label: 'Insights',
    icon: Lightbulb,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    key: 'insights' as const,
  },
  {
    label: 'Decisions',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    key: 'decisions' as const,
  },
  {
    label: 'Approved',
    icon: CheckCircle2,
    color: 'text-[hsl(var(--success))]',
    bg: 'bg-[hsl(var(--success)/0.1)]',
    key: 'approved' as const,
  },
];

export function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();

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

  const createRunMutation = useMutation({
    mutationFn: () => createAnalysisRun({ source: 'manual_dashboard_trigger' }),
    onSuccess: (run) => {
      void qc.invalidateQueries({ queryKey: ['analysis-runs'] });
      navigate(`/analysis-runs/${run.id}`);
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
      <div className="max-w-6xl mx-auto px-6 py-7 space-y-6">

        {/* ── Page header ─────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-eyebrow mb-1">{dateStr}</p>
            <h1 className="text-[18px] font-semibold text-[hsl(var(--text-primary))] tracking-tight">
              {user?.full_name ? `Good day, ${user.full_name.split(' ')[0]}` : 'Executive Dashboard'}
            </h1>
            <p className="text-[13px] text-[hsl(var(--text-secondary))] mt-0.5">
              Monitor analysis activity, emerging insights, and pending decisions.
            </p>
          </div>
          <Button
            onClick={() => createRunMutation.mutate()}
            loading={createRunMutation.isPending}
            className="flex-shrink-0 shadow-sm"
          >
            <PlayCircle className="w-4 h-4" />
            Run Analysis
          </Button>
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

        {/* ── Detail panels ───────────────────────────────── */}
        <div className="grid gap-4 xl:grid-cols-2">

          {/* Recent Analysis Runs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Recent Analysis Runs</CardTitle>
                <button
                  onClick={() => navigate('/decisions')}
                  className="text-[11.5px] text-[hsl(var(--accent-hover))] hover:underline flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <CardDescription>Manual and scheduled evaluation history.</CardDescription>
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
                  <p className="text-[13px] text-[hsl(var(--text-secondary))]">No analysis runs yet.</p>
                  <p className="text-[12px] text-[hsl(var(--text-disabled))] mt-0.5">
                    Click <strong>Run Analysis</strong> to start your first evaluation.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latest Decisions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Latest Decisions</CardTitle>
                <button
                  onClick={() => navigate('/decisions')}
                  className="text-[11.5px] text-[hsl(var(--accent-hover))] hover:underline flex items-center gap-1"
                >
                  Decision center <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <CardDescription>Recommended actions requiring review or execution.</CardDescription>
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
                  <p className="text-[13px] text-[hsl(var(--text-secondary))]">No decision points yet.</p>
                  <p className="text-[12px] text-[hsl(var(--text-disabled))] mt-0.5">
                    Decisions surface after an analysis run detects action items.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
