import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAnalysisRun } from '@/services/analysis.service';
import { updateDecisionStatus } from '@/services/decision.service';
import { cn } from '@/lib/utils';
import type { InsightSeverity, DecisionPriority, DecisionStatus, AnalysisRunStatus } from '@pocketcomputer/shared-types';

// ── Status label helpers ──────────────────────────────────────────────────────

const RUN_STATUS: Record<AnalysisRunStatus, { label: string; classes: string }> = {
  QUEUED:    { label: 'Getting ready…',  classes: 'bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))]' },
  RUNNING:   { label: 'Checking…',       classes: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  COMPLETED: { label: 'Done',            classes: 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.2)]' },
  FAILED:    { label: 'Something went wrong', classes: 'bg-[hsl(var(--error)/0.1)] text-[hsl(var(--error))] border border-[hsl(var(--error)/0.2)]' },
};

const SEVERITY: Record<InsightSeverity, { label: string; classes: string }> = {
  CRITICAL: { label: 'Must Know',    classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
  WARNING:  { label: 'Watch Out',    classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  INFO:     { label: 'Good to Know', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
};

const URGENCY: Record<DecisionPriority, { label: string; classes: string }> = {
  URGENT: { label: 'Do Now',     classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
  HIGH:   { label: 'Do Soon',    classes: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  MEDIUM: { label: 'Can Wait',   classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  LOW:    { label: 'Not Urgent', classes: 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.2)]' },
};

const DECISION_STATUS: Record<DecisionStatus, { label: string; color: string }> = {
  OPEN:               { label: 'New',               color: 'text-blue-400' },
  APPROVAL_REQUIRED:  { label: 'Needs Your Answer',  color: 'text-amber-400' },
  APPROVED:           { label: 'You Said Yes',        color: 'text-green-400' },
  REJECTED:           { label: 'You Said No',         color: 'text-red-400' },
  TRIGGERED:          { label: 'In Progress',         color: 'text-purple-400' },
  COMPLETED:          { label: 'Done',                color: 'text-[hsl(var(--text-disabled))]' },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export function AnalysisRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: run, isLoading, isError } = useQuery({
    queryKey: ['analysis-runs', id],
    queryFn: () => getAnalysisRun(id!),
    enabled: !!id,
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

  const runStatus = run ? RUN_STATUS[run.status] : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-7 space-y-5">

        {/* Back link */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1 text-[12.5px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </button>

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-semibold text-[hsl(var(--text-primary))] tracking-tight">
              AI Check Report
            </h1>
            {run && (
              <p className="text-[13px] text-[hsl(var(--text-secondary))] mt-0.5">
                {run.started_at
                  ? `Started ${new Date(run.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                  : 'Waiting to start'}
                {run.completed_at && ` · Finished ${new Date(run.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
              </p>
            )}
          </div>
          {runStatus && (
            <span className={cn('inline-flex items-center rounded px-[9px] py-[3px] text-[12px] font-medium flex-shrink-0', runStatus.classes)}>
              {runStatus.label}
            </span>
          )}
        </div>

        {/* Loading / error */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-[hsl(var(--border-strong))] border-t-[hsl(var(--accent))]" />
          </div>
        )}
        {isError && (
          <p className="text-[13px] text-[hsl(var(--error))]">
            Could not load this report. It may have been deleted or you may not have access.
          </p>
        )}

        {/* Still running */}
        {run && (run.status === 'QUEUED' || run.status === 'RUNNING') && (
          <Card>
            <CardContent className="flex items-center gap-4 py-8">
              <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-[1.5px] border-[hsl(var(--border-strong))] border-t-[hsl(var(--accent))]" />
              <div>
                <p className="text-[13px] font-semibold text-[hsl(var(--text-primary))]">
                  The AI is checking your business data…
                </p>
                <p className="text-[12.5px] text-[hsl(var(--text-secondary))] mt-0.5">
                  It's reading your connected data, looking for patterns, and figuring out what matters. This usually takes about 15–60 seconds.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No data connected yet */}
        {run?.status === 'COMPLETED' && run.insights.length === 0 &&
         typeof run.summary?.note === 'string' && run.summary.note.includes('No active connectors') && (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <p className="text-[13px] font-semibold text-[hsl(var(--text-primary))]">
                No data connected yet
              </p>
              <p className="text-[12.5px] text-[hsl(var(--text-secondary))] max-w-sm mx-auto">
                The AI needs access to your data to find anything. Go to <strong>Settings → Connectors</strong> to connect your first data source, then run another check.
              </p>
            </CardContent>
          </Card>
        )}

        {/* What the AI found */}
        {run?.status === 'COMPLETED' && (
          <Card>
            <CardHeader>
              <CardTitle>
                What the AI Noticed
                <span className="ml-2 text-[13px] font-normal text-[hsl(var(--text-secondary))]">
                  {run.insights.length === 0 ? 'nothing unusual' : `${run.insights.length} thing${run.insights.length !== 1 ? 's' : ''}`}
                </span>
              </CardTitle>
              <CardDescription>
                These are things the AI spotted in your data. They might need your attention.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {run.insights.length === 0 && (
                <p className="text-[13px] text-[hsl(var(--text-secondary))] py-4 text-center">
                  Everything looks fine! The AI didn't find anything unusual this time.
                </p>
              )}
              {run.insights.map((insight) => {
                const sev = SEVERITY[insight.severity];
                return (
                  <div key={insight.id} className="rounded-lg border border-[hsl(var(--border))] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[13px] font-semibold text-[hsl(var(--text-primary))] leading-snug">
                        {insight.title}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {sev && (
                          <span className={cn('inline-flex items-center rounded px-[7px] py-[2px] text-[11px] font-medium border', sev.classes)}>
                            {sev.label}
                          </span>
                        )}
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
                    {insight.explanation && (
                      <p className="text-[12px] text-[hsl(var(--text-secondary))] mt-2 border-t border-[hsl(var(--border))] pt-2 italic leading-relaxed">
                        {insight.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* What you should do */}
        {run?.status === 'COMPLETED' && (
          <Card>
            <CardHeader>
              <CardTitle>
                What You Should Do
                <span className="ml-2 text-[13px] font-normal text-[hsl(var(--text-secondary))]">
                  {run.decisions.length === 0 ? 'nothing needed' : `${run.decisions.length} suggestion${run.decisions.length !== 1 ? 's' : ''}`}
                </span>
              </CardTitle>
              <CardDescription>
                Based on what it found, the AI is suggesting these actions. You decide — say yes or no.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {run.decisions.length === 0 && run.insights.length === 0 && (
                <p className="text-[13px] text-[hsl(var(--text-secondary))] py-4 text-center">
                  No actions needed for this check.
                </p>
              )}
              {run.decisions.length === 0 && run.insights.length > 0 && (
                <p className="text-[13px] text-[hsl(var(--text-secondary))] py-4 text-center">
                  The AI noticed some things but doesn't think any action is needed right now.
                </p>
              )}
              {run.decisions.map((decision) => {
                const urg = URGENCY[decision.priority];
                const dst = DECISION_STATUS[decision.status];
                const canAct = decision.status === 'OPEN' || decision.status === 'APPROVAL_REQUIRED';
                return (
                  <div key={decision.id} className="rounded-lg border border-[hsl(var(--border))] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {urg && (
                            <span className={cn('inline-flex items-center rounded px-[7px] py-[2px] text-[11px] font-medium border', urg.classes)}>
                              {urg.label}
                            </span>
                          )}
                          {dst && (
                            <span className={cn('text-[11px] font-medium', dst.color)}>
                              {dst.label}
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] font-semibold text-[hsl(var(--text-primary))] leading-snug">
                          {decision.title}
                        </p>
                        <p className="text-[12.5px] text-[hsl(var(--text-secondary))] mt-1 leading-relaxed">
                          {decision.recommendation}
                        </p>
                      </div>
                      {decision.confidence != null && (
                        <div className="flex-shrink-0 text-right">
                          <p className="text-[11px] text-[hsl(var(--text-disabled))] leading-tight">AI is</p>
                          <p className="text-[15px] font-bold text-[hsl(var(--text-primary))] leading-tight">
                            {Math.round(decision.confidence * 100)}%
                          </p>
                          <p className="text-[11px] text-[hsl(var(--text-disabled))] leading-tight">sure</p>
                        </div>
                      )}
                    </div>
                    {decision.explanation && (
                      <p className="text-[12px] text-[hsl(var(--text-secondary))] mt-2 border-t border-[hsl(var(--border))] pt-2 italic leading-relaxed">
                        {decision.explanation}
                      </p>
                    )}
                    {decision.feedback_notes && (
                      <div className="mt-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2)/0.5)] px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[hsl(var(--text-disabled))]">
                          Feedback Note
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-[hsl(var(--text-secondary))]">
                          {decision.feedback_notes}
                        </p>
                      </div>
                    )}
                    {canAct && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => decisionMutation.mutate({ decisionId: decision.id, status: 'APPROVED' })}
                          loading={decisionMutation.isPending}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Yes, do it
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1.5"
                          onClick={() => decisionMutation.mutate({ decisionId: decision.id, status: 'REJECTED' })}
                          loading={decisionMutation.isPending}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          No, skip it
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
