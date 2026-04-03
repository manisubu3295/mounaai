import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { listDecisions, updateDecisionStatus, addDecisionFeedback } from '@/services/decision.service';
import type { DecisionPoint } from '@pocketcomputer/shared-types';

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: 'text-red-400 bg-red-400/10 border-red-400/20',
  HIGH: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  MEDIUM: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  LOW: 'text-green-400 bg-green-400/10 border-green-400/20',
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'text-blue-400',
  APPROVAL_REQUIRED: 'text-amber-400',
  APPROVED: 'text-green-400',
  REJECTED: 'text-red-400',
  TRIGGERED: 'text-purple-400',
  COMPLETED: 'text-[hsl(var(--text-disabled))]',
};

function FeedbackPanel({ decision }: { decision: DecisionPoint }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(decision.feedback_notes ?? '');
  const [saved, setSaved] = useState(false);

  const feedbackMutation = useMutation({
    mutationFn: (n: string) => addDecisionFeedback(decision.id, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decisions'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="mt-3 border-t border-[hsl(var(--border))] pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        {decision.feedback_notes ? 'Edit feedback' : 'Add feedback'}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add context, outcome notes, or reasons for your decision…"
            className="w-full resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-sm text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-disabled))] outline-none focus:border-[hsl(var(--accent))]"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => feedbackMutation.mutate(notes)}
              loading={feedbackMutation.isPending}
              disabled={notes === (decision.feedback_notes ?? '')}
            >
              {saved ? 'Saved!' : 'Save feedback'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DecisionCard({ decision }: { decision: DecisionPoint }) {
  const qc = useQueryClient();
  const canAct = decision.status === 'OPEN' || decision.status === 'APPROVAL_REQUIRED';

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: 'APPROVED' | 'REJECTED' }) =>
      updateDecisionStatus(decision.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['decisions'] }),
  });

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', PRIORITY_COLOR[decision.priority] ?? 'text-[hsl(var(--text-secondary))]')}>
              {decision.priority}
            </span>
            <span className={cn('text-[10px] font-medium', STATUS_COLOR[decision.status] ?? '')}>
              {decision.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{decision.title}</p>
          <p className="text-xs text-[hsl(var(--text-secondary))] mt-1 leading-relaxed">{decision.recommendation}</p>
          {decision.explanation && (
            <p className="text-xs text-[hsl(var(--text-disabled))] mt-1 italic">{decision.explanation}</p>
          )}
        </div>
        {decision.confidence != null && (
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-[hsl(var(--text-disabled))]">Confidence</p>
            <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">{Math.round(decision.confidence * 100)}%</p>
          </div>
        )}
      </div>

      {canAct && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => statusMutation.mutate({ status: 'APPROVED' })}
            loading={statusMutation.isPending && statusMutation.variables?.status === 'APPROVED'}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => statusMutation.mutate({ status: 'REJECTED' })}
            loading={statusMutation.isPending && statusMutation.variables?.status === 'REJECTED'}
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </Button>
        </div>
      )}

      {(decision.status === 'APPROVED' || decision.status === 'REJECTED' || decision.status === 'COMPLETED') && (
        <FeedbackPanel decision={decision} />
      )}

      {decision.feedback_notes && decision.status !== 'APPROVED' && decision.status !== 'REJECTED' && decision.status !== 'COMPLETED' && (
        <div className="mt-3 border-t border-[hsl(var(--border))] pt-3">
          <p className="text-xs text-[hsl(var(--text-disabled))] italic">Feedback: {decision.feedback_notes}</p>
        </div>
      )}
    </div>
  );
}

export function DecisionCenterPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['decisions'],
    queryFn: () => listDecisions(1, 50),
  });

  const allDecisions = data?.items ?? [];
  const filtered = statusFilter === 'all'
    ? allDecisions
    : allDecisions.filter((d) => d.status === statusFilter);

  const counts = {
    open: allDecisions.filter((d) => d.status === 'OPEN' || d.status === 'APPROVAL_REQUIRED').length,
    approved: allDecisions.filter((d) => d.status === 'APPROVED').length,
    rejected: allDecisions.filter((d) => d.status === 'REJECTED').length,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pending', value: counts.open, color: 'text-amber-400' },
            { label: 'Approved', value: counts.approved, color: 'text-green-400' },
            { label: 'Rejected', value: counts.rejected, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-center">
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
              <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Decision Center</CardTitle>
                <CardDescription>Review, approve, or reject operational recommendations.</CardDescription>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--text-primary))] outline-none"
              >
                <option value="all">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="APPROVAL_REQUIRED">Approval Required</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && (
              <div className="py-8 flex justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent" />
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="py-12 text-center">
                <CheckCircle className="w-8 h-8 text-[hsl(var(--text-disabled))] mx-auto mb-2" />
                <p className="text-sm text-[hsl(var(--text-secondary))]">
                  {statusFilter === 'all' ? 'No decisions yet. Run an analysis to generate recommendations.' : 'No decisions match this filter.'}
                </p>
              </div>
            )}
            {filtered.map((decision) => (
              <DecisionCard key={decision.id} decision={decision} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
