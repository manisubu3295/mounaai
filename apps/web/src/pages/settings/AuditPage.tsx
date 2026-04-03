import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';

interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  payload: unknown;
  status: 'SUCCESS' | 'FAILURE';
  created_at: string;
}

function getLogSummary(log: AuditLog): string {
  if (log.payload && typeof log.payload === 'object' && 'summary' in log.payload) {
    const summary = (log.payload as { summary?: unknown }).summary;
    if (typeof summary === 'string' && summary.trim().length > 0) return summary;
  }

  if (log.status === 'FAILURE') return 'Operation failed';
  return 'Operation completed';
}

interface AuditResponse {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

async function fetchAuditLogs(params: {
  page: number;
  action?: string;
  from_date?: string;
  to_date?: string;
}): Promise<AuditResponse> {
  const res = await apiClient.get<{ data: AuditResponse }>('/audit', { params: { ...params, limit: 25 } });
  return res.data.data;
}

function ActionBadge({ action }: { action: string }) {
  const color = action.includes('fail') || action.includes('error')
    ? 'text-[hsl(var(--error))] bg-[hsl(var(--error)/0.1)] border-[hsl(var(--error)/0.3)]'
    : action.startsWith('auth')
    ? 'text-blue-400 bg-blue-400/10 border-blue-400/30'
    : action.startsWith('llm')
    ? 'text-[hsl(var(--accent-hover))] bg-[hsl(var(--accent)/0.1)] border-[hsl(var(--accent)/0.3)]'
    : action.startsWith('connector')
    ? 'text-purple-400 bg-purple-400/10 border-purple-400/30'
    : 'text-[hsl(var(--text-secondary))] bg-[hsl(var(--surface-2))] border-[hsl(var(--border))]';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono border ${color}`}>
      {action}
    </span>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasPayload = Boolean(log.payload && typeof log.payload === 'object' && Object.keys(log.payload as object).length > 0);

  return (
    <>
      <tr
        className={`border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))] transition-colors cursor-pointer ${expanded ? 'bg-[hsl(var(--surface-2))]' : ''}`}
        onClick={() => hasPayload && setExpanded(!expanded)}
      >
        <td className="px-4 py-3 text-[11px] text-[hsl(var(--text-secondary))] whitespace-nowrap">
          {formatRelativeTime(log.created_at)}
        </td>
        <td className="px-4 py-3">
          <ActionBadge action={log.action} />
        </td>
        <td className="px-4 py-3 text-xs text-[hsl(var(--text-secondary))] max-w-[200px] truncate">
          {log.user_email ?? log.user_id ?? '—'}
        </td>
        <td className="px-4 py-3 text-[11px] text-[hsl(var(--text-disabled))]">
          {log.resource_type ?? '—'}
        </td>
        <td className="px-4 py-3 text-[11px] text-[hsl(var(--text-disabled))]">
          {log.ip_address ?? '—'}
        </td>
        <td className="px-4 py-3 text-xs text-[hsl(var(--text-secondary))] max-w-[320px] truncate">
          {getLogSummary(log)}
        </td>
        <td className="px-4 py-3">
          {log.status === 'SUCCESS'
            ? <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
            : <XCircle className="w-3.5 h-3.5 text-[hsl(var(--error))]" />}
        </td>
        <td className="px-4 py-3">
          {hasPayload && (
            expanded ? <ChevronUp className="w-3.5 h-3.5 text-[hsl(var(--text-disabled))]" />
                     : <ChevronDown className="w-3.5 h-3.5 text-[hsl(var(--text-disabled))]" />
          )}
        </td>
      </tr>
      {expanded && hasPayload && (
        <tr className="bg-[hsl(var(--background))] border-b border-[hsl(var(--border))]">
          <td colSpan={8} className="px-4 py-3">
            <pre className="text-[11px] text-[hsl(var(--text-secondary))] font-mono overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action: '', from_date: '', to_date: '' });
  const [applied, setApplied] = useState<typeof filters>({ action: '', from_date: '', to_date: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, applied],
    queryFn: () => fetchAuditLogs({
      page,
      ...(applied.action ? { action: applied.action } : {}),
      ...(applied.from_date ? { from_date: applied.from_date } : {}),
      ...(applied.to_date ? { to_date: applied.to_date } : {}),
    }),
  });

  const applyFilters = () => {
    setPage(1);
    setApplied({ ...filters });
  };

  const clearFilters = () => {
    setFilters({ action: '', from_date: '', to_date: '' });
    setApplied({ action: '', from_date: '', to_date: '' });
    setPage(1);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[hsl(var(--text-primary))]">Audit Logs</h1>
          <p className="text-sm text-[hsl(var(--text-secondary))] mt-0.5">
            Immutable record of all significant actions in your workspace.
            {data && <span className="ml-2 text-[hsl(var(--text-disabled))]">{data.total.toLocaleString()} events total</span>}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-4 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
          <div className="space-y-1 flex-1 min-w-[150px]">
            <Label className="text-xs">Action filter</Label>
            <Input
              className="h-8 text-xs"
              placeholder="e.g. llm, connector, auth"
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From date</Label>
            <Input
              className="h-8 text-xs"
              type="date"
              value={filters.from_date}
              onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To date</Label>
            <Input
              className="h-8 text-xs"
              type="date"
              value={filters.to_date}
              onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={applyFilters}>Apply</Button>
            <Button size="sm" variant="secondary" onClick={clearFilters}>Clear</Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[hsl(var(--surface-2))] border-b border-[hsl(var(--border))]">
                {['Time', 'Action', 'User', 'Resource', 'IP', 'Summary', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[hsl(var(--text-secondary))] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--text-secondary))] mx-auto" />
                  </td>
                </tr>
              )}
              {!isLoading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-[hsl(var(--text-disabled))]">
                    No audit logs found.
                  </td>
                </tr>
              )}
              {data?.items.map((log) => <LogRow key={log.id} log={log} />)}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-[hsl(var(--text-secondary))]">
              Page {data.page} · {data.items.length} of {data.total} events
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="secondary" disabled={!data.has_more} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
