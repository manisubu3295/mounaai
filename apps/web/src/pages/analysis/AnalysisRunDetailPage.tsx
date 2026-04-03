import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAnalysisRun } from '@/services/analysis.service';
import { updateDecisionStatus } from '@/services/decision.service';
import type { InsightSeverity, DecisionPriority, DecisionStatus, AnalysisRunStatus } from '@pocketcomputer/shared-types';

// ── Colour helpers ────────────────────────────────────────────────────────────

function statusBadge(status: AnalysisRunStatus) {
  const map: Record<AnalysisRunStatus, string> = {
    QUEUED:    'bg-slate-100 text-slate-600',
    RUNNING:   'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    FAILED:    'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-slate-100 text-slate-600';
}

function severityBadge(sev: InsightSeverity) {
  const map: Record<InsightSeverity, string> = {
    CRITICAL: 'bg-red-100 text-red-700',
    WARNING:  'bg-amber-100 text-amber-700',
    INFO:     'bg-blue-100 text-blue-700',
  };
  return map[sev] ?? 'bg-slate-100 text-slate-600';
}

function priorityBadge(p: DecisionPriority) {
  const map: Record<DecisionPriority, string> = {
    URGENT: 'bg-red-100 text-red-700',
    HIGH:   'bg-orange-100 text-orange-700',
    MEDIUM: 'bg-amber-100 text-amber-700',
    LOW:    'bg-emerald-100 text-emerald-700',
  };
  return map[p] ?? 'bg-slate-100 text-slate-600';
}

function decisionStatusBadge(s: DecisionStatus) {
  const map: Record<DecisionStatus, string> = {
    OPEN:               'bg-blue-100 text-blue-700',
    APPROVAL_REQUIRED:  'bg-amber-100 text-amber-700',
    APPROVED:           'bg-emerald-100 text-emerald-700',
    REJECTED:           'bg-red-100 text-red-700',
    TRIGGERED:          'bg-purple-100 text-purple-700',
    COMPLETED:          'bg-slate-100 text-slate-600',
  };
  return map[s] ?? 'bg-slate-100 text-slate-600';
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AnalysisRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: run, isLoading, isError } = useQuery({
    queryKey: ['analysis-runs', id],
    queryFn: () => getAnalysisRun(id!),
    enabled: !!id,
    // Poll every 3 s while the job is still queued or running in the background
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'QUEUED' || status === 'RUNNING' ? 3000 : false;
    },
  });

  const decisionMutation = useMutation({
    mutationFn: ({ decisionId, status }: { decisionId: string; status: 'APPROVED' | 'REJECTED' }) =>
      updateDecisionStatus(decisionId, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['analysis-runs', id] });
      void qc.invalidateQueries({ queryKey: ['decisions'] });
    },
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1 text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Dashboard
          </button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[hsl(var(--text-primary))]">
              Analysis Run
              {run && <span className="ml-2 font-mono text-base text-[hsl(var(--text-secondary))]">#{run.id.slice(0, 8)}</span>}
            </h1>
            {run && (
              <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
                Started {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                {run.completed_at && <> · Completed {new Date(run.completed_at).toLocaleString()}</>}
              </p>
            )}
          </div>
          {run && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(run.status)}`}>
              {run.status}
            </span>
          )}
        </div>

        {/* Loading / error states */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent" />
          </div>
        )}
        {isError && (
          <p className="text-sm text-red-600">Failed to load analysis run. It may have been deleted or you don't have access.</p>
        )}

        {/* In-progress state */}
        {run && (run.status === 'QUEUED' || run.status === 'RUNNING') && (
          <Card>
            <CardContent className="flex items-center gap-4 py-8">
              <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent" />
              <div>
                <p className="text-sm font-medium text-[hsl(var(--text-primary))]">Analysis in progress</p>
                <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5">
                  Fetching connector data, evaluating rules, and running AI analysis. This usually takes 15–60 seconds.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No connectors / KPIs configured */}
        {run && run.status === 'COMPLETED' && run.insights.length === 0 &&
         typeof run.summary?.note === 'string' && run.summary.note.includes('No active connectors') && (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <p className="text-sm font-medium text-[hsl(var(--text-primary))]">Nothing to analyse yet</p>
              <p className="text-xs text-[hsl(var(--text-secondary))] max-w-sm mx-auto">
                Add at least one active connector (Settings → Connectors) so the AI has data to work with.
                KPI definitions help it spot threshold violations faster.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Insights */}
        {run && run.status === 'COMPLETED' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Insights
                <span className="ml-2 text-sm font-normal text-[hsl(var(--text-secondary))]">
                  {run.insights.length} found
                </span>
              </CardTitle>
              <CardDescription>Signals extracted from your connected data sources.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {run.insights.length === 0 && !(typeof run.summary?.note === 'string' && run.summary.note.includes('No active connectors')) && (
                <p className="text-sm text-[hsl(var(--text-secondary))]">
                  No notable insights were found in this run — your data looks healthy against the current KPI thresholds.
                </p>
              )}
              {run.insights.map((insight) => (
                <div key={insight.id} className="rounded-xl border border-[hsl(var(--border))] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{insight.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${severityBadge(insight.severity)}`}>
                        {insight.severity}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--text-secondary))]">
                        {insight.type}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[hsl(var(--text-secondary))] mt-1.5">{insight.summary}</p>
                  {insight.confidence !== null && (
                    <p className="text-[11px] text-[hsl(var(--text-disabled))] mt-1">
                      Confidence: {Math.round(insight.confidence * 100)}%
                    </p>
                  )}
                  {insight.explanation && (
                    <p className="text-xs text-[hsl(var(--text-secondary))] mt-2 border-t border-[hsl(var(--border))] pt-2 italic">
                      {insight.explanation}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Decisions */}
        {run && run.status === 'COMPLETED' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Decisions
                <span className="ml-2 text-sm font-normal text-[hsl(var(--text-secondary))]">
                  {run.decisions.length} recommended
                </span>
              </CardTitle>
              <CardDescription>Recommended actions derived from the insights above.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {run.decisions.length === 0 && run.insights.length === 0 && (
                <p className="text-sm text-[hsl(var(--text-secondary))]">No decisions generated for this run.</p>
              )}
              {run.decisions.length === 0 && run.insights.length > 0 && (
                <p className="text-sm text-[hsl(var(--text-secondary))]">
                  No action decisions were generated — the insights identified don't require immediate intervention.
                </p>
              )}
              {run.decisions.map((decision) => (
                <div key={decision.id} className="rounded-xl border border-[hsl(var(--border))] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{decision.title}</p>
                      <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">{decision.recommendation}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityBadge(decision.priority)}`}>
                        {decision.priority}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${decisionStatusBadge(decision.status)}`}>
                        {decision.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  {decision.explanation && (
                    <p className="text-xs text-[hsl(var(--text-secondary))] mt-2 border-t border-[hsl(var(--border))] pt-2 italic">
                      {decision.explanation}
                    </p>
                  )}
                  {(decision.status === 'OPEN' || decision.status === 'APPROVAL_REQUIRED') && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => decisionMutation.mutate({ decisionId: decision.id, status: 'APPROVED' })}
                        loading={decisionMutation.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => decisionMutation.mutate({ decisionId: decision.id, status: 'REJECTED' })}
                        loading={decisionMutation.isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
