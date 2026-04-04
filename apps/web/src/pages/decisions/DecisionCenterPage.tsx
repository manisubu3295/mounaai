import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronUp,
  ClipboardList, Trash2, BarChart3, Calendar, CalendarDays,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { listDecisions, updateDecisionStatus, addDecisionFeedback } from '@/services/decision.service';
import { clearAnalysis, getPeriodicSummary } from '@/services/analysis.service';
import { useAuthStore } from '@/stores/auth.store';
import type { DecisionPoint, PeriodSummary } from '@pocketcomputer/shared-types';

type PeriodMode = 'all' | 'monthly' | 'quarterly';

const URGENCY_STYLE: Record<string, string> = {
  URGENT: 'text-red-400   bg-red-400/10   border-red-400/20',
  HIGH:   'text-orange-400 bg-orange-400/10 border-orange-400/20',
  MEDIUM: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  LOW:    'text-green-400  bg-green-400/10  border-green-400/20',
};
const URGENCY_LABEL: Record<string, string> = {
  URGENT: 'Do Now', HIGH: 'Do Soon', MEDIUM: 'Can Wait', LOW: 'Not Urgent',
};
const STATUS_LABEL: Record<string, string> = {
  OPEN: 'New', APPROVAL_REQUIRED: 'Needs Your Answer',
  APPROVED: 'You Said Yes', REJECTED: 'You Said No',
  TRIGGERED: 'In Progress', COMPLETED: 'Done',
};
const STATUS_COLOR: Record<string, string> = {
  OPEN: 'text-blue-400', APPROVAL_REQUIRED: 'text-amber-400',
  APPROVED: 'text-green-400', REJECTED: 'text-red-400',
  TRIGGERED: 'text-purple-400', COMPLETED: 'text-[hsl(var(--text-disabled))]',
};

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmClearDialog({ onConfirm, onCancel, isPending }: {
  onConfirm: () => void; onCancel: () => void; isPending: boolean;
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

// ── Note panel ────────────────────────────────────────────────────────────────
function NotePanel({ decision }: { decision: DecisionPoint }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(decision.feedback_notes ?? '');
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
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
        className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        {decision.feedback_notes ? 'Edit your note' : 'Add a note'}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write anything here — why you said yes or no, what happened next, etc."
            className="w-full resize-none rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px] text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-disabled))] outline-none focus:border-[hsl(var(--accent))]"
          />
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(notes)}
            loading={saveMutation.isPending}
            disabled={notes === (decision.feedback_notes ?? '')}
          >
            {saved ? 'Saved!' : 'Save note'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Single action card ────────────────────────────────────────────────────────
function ActionCard({ decision }: { decision: DecisionPoint }) {
  const qc = useQueryClient();
  const canAct = decision.status === 'OPEN' || decision.status === 'APPROVAL_REQUIRED';

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: 'APPROVED' | 'REJECTED' }) =>
      updateDecisionStatus(decision.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['decisions'] }),
  });

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={cn('text-[11px] font-semibold px-[7px] py-[2px] rounded border', URGENCY_STYLE[decision.priority] ?? 'text-[hsl(var(--text-secondary))]')}>
              {URGENCY_LABEL[decision.priority] ?? decision.priority}
            </span>
            <span className={cn('text-[11px] font-medium', STATUS_COLOR[decision.status] ?? '')}>
              {STATUS_LABEL[decision.status] ?? decision.status}
            </span>
          </div>
          <p className="text-[13px] font-semibold text-[hsl(var(--text-primary))] leading-snug">{decision.title}</p>
          <p className="text-[12.5px] text-[hsl(var(--text-secondary))] mt-1 leading-relaxed">{decision.recommendation}</p>
          {decision.explanation && (
            <p className="text-[12px] text-[hsl(var(--text-disabled))] mt-1 italic leading-relaxed">{decision.explanation}</p>
          )}
        </div>
        {decision.confidence != null && (
          <div className="flex-shrink-0 text-right">
            <p className="text-[11px] text-[hsl(var(--text-disabled))] leading-tight">AI is</p>
            <p className="text-[15px] font-bold text-[hsl(var(--text-primary))] leading-tight">{Math.round(decision.confidence * 100)}%</p>
            <p className="text-[11px] text-[hsl(var(--text-disabled))] leading-tight">sure</p>
          </div>
        )}
      </div>
      {canAct && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="gap-1.5"
            onClick={() => statusMutation.mutate({ status: 'APPROVED' })}
            loading={statusMutation.isPending && statusMutation.variables?.status === 'APPROVED'}
          >
            <CheckCircle className="w-3.5 h-3.5" /> Yes, do it
          </Button>
          <Button size="sm" variant="secondary" className="gap-1.5"
            onClick={() => statusMutation.mutate({ status: 'REJECTED' })}
            loading={statusMutation.isPending && statusMutation.variables?.status === 'REJECTED'}
          >
            <XCircle className="w-3.5 h-3.5" /> No, skip it
          </Button>
        </div>
      )}
      {(decision.status === 'APPROVED' || decision.status === 'REJECTED' || decision.status === 'COMPLETED') && (
        <NotePanel decision={decision} />
      )}
      {decision.feedback_notes && canAct && (
        <div className="mt-3 border-t border-[hsl(var(--border))] pt-3">
          <p className="text-[12px] text-[hsl(var(--text-disabled))] italic">Your note: {decision.feedback_notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Group decisions by period ─────────────────────────────────────────────────
function groupDecisionsByPeriod(
  decisions: DecisionPoint[],
  mode: 'monthly' | 'quarterly'
): Array<{ period: string; label: string; items: DecisionPoint[] }> {
  const map = new Map<string, DecisionPoint[]>();
  for (const d of decisions) {
    const dt = new Date(d.created_at);
    let key: string;
    if (mode === 'monthly') {
      key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    } else {
      const q = Math.floor(dt.getMonth() / 3) + 1;
      key = `${dt.getFullYear()}-Q${q}`;
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
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

// ── Period header card ─────────────────────────────────────────────────────────
function PeriodHeader({ label, items, psum }: {
  label: string;
  items: DecisionPoint[];
  psum?: PeriodSummary;
}) {
  const pending  = items.filter(d => d.status === 'OPEN' || d.status === 'APPROVAL_REQUIRED').length;
  const approved = items.filter(d => d.status === 'APPROVED').length;
  const rejected = items.filter(d => d.status === 'REJECTED').length;

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 mb-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-semibold text-[hsl(var(--text-primary))]">{label}</p>
        {psum && (
          <span className="text-[11px] text-[hsl(var(--text-disabled))]">{psum.run_count} run{psum.run_count !== 1 ? 's' : ''}</span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[12px] text-[hsl(var(--text-secondary))]">{items.length} actions total</span>
        {pending  > 0 && <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">{pending} pending</span>}
        {approved > 0 && <span className="text-[11px] font-medium text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">{approved} approved</span>}
        {rejected > 0 && <span className="text-[11px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">{rejected} skipped</span>}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function DecisionCenterPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'TENANT_ADMIN';

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['decisions'],
    queryFn: () => listDecisions(1, 200),
  });

  const { data: periodData } = useQuery({
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

  const all = data?.items ?? [];
  const filtered = statusFilter === 'all' ? all : all.filter((d) => d.status === statusFilter);
  const grouped = periodMode !== 'all' ? groupDecisionsByPeriod(all, periodMode) : [];

  const counts = {
    waiting: all.filter((d) => d.status === 'OPEN' || d.status === 'APPROVAL_REQUIRED').length,
    done:    all.filter((d) => d.status === 'APPROVED').length,
    skipped: all.filter((d) => d.status === 'REJECTED').length,
  };

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
              Actions to Take
            </h1>
            <p className="text-[13px] text-[hsl(var(--text-secondary))] mt-0.5">
              The AI found these things that might need your attention. Say yes or no to each one.
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

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Waiting for you', value: counts.waiting, color: 'text-amber-400' },
            { label: 'You said yes',    value: counts.done,    color: 'text-green-400' },
            { label: 'You said no',     value: counts.skipped, color: 'text-red-400'   },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-center">
              <p className={cn('text-[26px] font-bold leading-none', color)}>{value}</p>
              <p className="text-[12px] text-[hsl(var(--text-secondary))] mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-1 p-1 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg w-fit">
          {([
            { mode: 'all'       as const, icon: BarChart3,    label: 'All Actions' },
            { mode: 'monthly'   as const, icon: Calendar,     label: 'Monthly'     },
            { mode: 'quarterly' as const, icon: CalendarDays, label: 'Quarterly'   },
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

        {/* ── All Actions view ──────────────────────────── */}
        {periodMode === 'all' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-[hsl(var(--accent-hover))]" />
                    All Actions
                  </CardTitle>
                  <CardDescription>
                    Each action below was suggested by the AI. You can say yes, say no, or add a note.
                  </CardDescription>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-[12.5px] border border-[hsl(var(--border))] rounded-md px-2 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--text-primary))] outline-none focus:border-[hsl(var(--accent))]"
                >
                  <option value="all">Show all</option>
                  <option value="OPEN">New</option>
                  <option value="APPROVAL_REQUIRED">Needs your answer</option>
                  <option value="APPROVED">You said yes</option>
                  <option value="REJECTED">You said no</option>
                  <option value="COMPLETED">Done</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && (
                <div className="py-8 flex justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-[hsl(var(--border-strong))] border-t-[hsl(var(--accent))]" />
                </div>
              )}
              {!isLoading && filtered.length === 0 && (
                <div className="py-12 text-center">
                  <CheckCircle className="w-8 h-8 text-[hsl(var(--text-disabled))] mx-auto mb-2" />
                  <p className="text-[13px] text-[hsl(var(--text-secondary))]">
                    {statusFilter === 'all'
                      ? 'Nothing here yet. Run an AI check from the Home page to get started.'
                      : 'No actions match this filter.'}
                  </p>
                </div>
              )}
              {filtered.map((decision) => (
                <ActionCard key={decision.id} decision={decision} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Monthly / Quarterly view ───────────────────── */}
        {periodMode !== 'all' && (
          <div className="space-y-6">
            {!grouped.length ? (
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] py-10 text-center">
                <BarChart3 className="w-8 h-8 text-[hsl(var(--text-disabled))] mx-auto mb-2" />
                <p className="text-[13px] text-[hsl(var(--text-secondary))]">No actions found in any period yet.</p>
              </div>
            ) : (
              grouped.map(({ period, label, items }) => {
                const psum = periodData?.find(p => p.period === period);
                return (
                  <div key={period}>
                    <PeriodHeader label={label} items={items} psum={psum} />
                    <div className="space-y-2">
                      {items.map((decision) => (
                        <ActionCard key={decision.id} decision={decision} />
                      ))}
                    </div>
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
