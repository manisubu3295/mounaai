import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  listKpis, createKpi, updateKpi, deleteKpi,
  type KpiDefinition, type KpiStatus, type CreateKpiInput,
} from '@/services/kpi.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function Sel({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'flex h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] focus:border-transparent cursor-pointer appearance-none',
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Threshold visualiser ─────────────────────────────────────────────────────

function ThresholdBar({
  target,
  warning,
  critical,
  unit,
}: {
  target: number | null;
  warning: number | null;
  critical: number | null;
  unit: string | null;
}) {
  const values = [target, warning, critical].filter((v): v is number => v !== null);
  if (values.length === 0) return null;

  const max = Math.max(...values) * 1.2;
  const pct = (v: number) => Math.min(100, Math.round((v / max) * 100));

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] font-medium text-[hsl(var(--text-disabled))] uppercase tracking-wide">
        Thresholds{unit ? ` (${unit})` : ''}
      </p>
      <div className="relative h-2 w-full rounded-full bg-[hsl(var(--surface-2))]">
        {/* Green zone up to warning */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-emerald-400/70"
          style={{ width: `${warning ? pct(warning) : critical ? pct(critical) : 100}%` }}
        />
        {/* Amber zone: warning → critical */}
        {warning !== null && critical !== null && critical > warning && (
          <div
            className="absolute top-0 h-full bg-amber-400/70"
            style={{ left: `${pct(warning)}%`, width: `${pct(critical) - pct(warning)}%` }}
          />
        )}
        {/* Red zone: beyond critical */}
        {critical !== null && (
          <div
            className="absolute top-0 h-full rounded-r-full bg-red-400/70"
            style={{ left: `${pct(critical)}%`, right: 0 }}
          />
        )}
        {/* Target marker */}
        {target !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[hsl(var(--accent))] rounded-full"
            style={{ left: `${pct(target)}%` }}
          />
        )}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-[hsl(var(--text-disabled))]">
        {target   !== null && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] mr-1" />Target: {target}</span>}
        {warning  !== null && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1" />Warning: {warning}</span>}
        {critical !== null && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1" />Critical: {critical}</span>}
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<KpiStatus, string> = {
  ACTIVE:   'bg-emerald-100 text-emerald-700',
  DRAFT:    'bg-slate-100 text-slate-500',
  ARCHIVED: 'bg-stone-100 text-stone-500',
};

// ─── KPI form ─────────────────────────────────────────────────────────────────

interface KpiFormState {
  name: string;
  slug: string;
  description: string;
  formula: string;
  unit: string;
  target_value: string;
  warning_threshold: string;
  critical_threshold: string;
  owner_role: string;
  status: KpiStatus;
  slugTouched: boolean;
}

function blankForm(): KpiFormState {
  return {
    name: '', slug: '', description: '', formula: '',
    unit: '', target_value: '', warning_threshold: '', critical_threshold: '',
    owner_role: '', status: 'DRAFT', slugTouched: false,
  };
}

function kpiToForm(kpi: KpiDefinition): KpiFormState {
  return {
    name:               kpi.name,
    slug:               kpi.slug,
    description:        kpi.description ?? '',
    formula:            kpi.formula,
    unit:               kpi.unit ?? '',
    target_value:       kpi.target_value !== null ? String(kpi.target_value) : '',
    warning_threshold:  kpi.warning_threshold !== null ? String(kpi.warning_threshold) : '',
    critical_threshold: kpi.critical_threshold !== null ? String(kpi.critical_threshold) : '',
    owner_role:         kpi.owner_role ?? '',
    status:             kpi.status,
    slugTouched:        true,
  };
}

function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function formToInput(form: KpiFormState): CreateKpiInput {
  return {
    name:               form.name.trim(),
    slug:               form.slug.trim(),
    description:        form.description.trim() || undefined,
    formula:            form.formula.trim(),
    unit:               form.unit.trim() || undefined,
    target_value:       parseNum(form.target_value),
    warning_threshold:  parseNum(form.warning_threshold),
    critical_threshold: parseNum(form.critical_threshold),
    owner_role:         (form.owner_role as CreateKpiInput['owner_role']) || null,
    status:             form.status,
  };
}

function KpiEditor({
  kpi,
  onSave,
  onCancel,
  isSaving,
}: {
  kpi: KpiDefinition | null;
  onSave: (input: CreateKpiInput) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<KpiFormState>(kpi ? kpiToForm(kpi) : blankForm());

  function set<K extends keyof KpiFormState>(key: K, value: KpiFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slugTouched ? prev.slug : toSlug(name),
    }));
  }

  const isValid =
    form.name.trim().length > 0 &&
    form.slug.trim().length > 0 &&
    /^[a-z0-9-]+$/.test(form.slug.trim()) &&
    form.formula.trim().length > 0;

  const slugInvalid = form.slug.length > 0 && !/^[a-z0-9-]+$/.test(form.slug);

  return (
    <div className="space-y-6">
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to KPIs
      </button>

      <div>
        <h1 className="text-xl font-semibold text-[hsl(var(--text-primary))]">
          {kpi ? 'Edit KPI' : 'New KPI'}
        </h1>
        <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
          KPIs give the AI a frame of reference during analysis — it uses your thresholds to identify when something is off.
        </p>
      </div>

      {/* Core fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">KPI Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Monthly Revenue"
                className="mt-1"
                maxLength={255}
              />
            </div>
            <div>
              <Label>
                Slug <span className="text-red-500">*</span>
                <span className="ml-1 text-xs font-normal text-[hsl(var(--text-disabled))]">(lowercase, hyphens only)</span>
              </Label>
              <Input
                value={form.slug}
                onChange={(e) => { set('slug', e.target.value); set('slugTouched', true); }}
                placeholder="monthly-revenue"
                className={cn('mt-1 font-mono', slugInvalid && 'border-red-400 focus:ring-red-400')}
                maxLength={255}
              />
              {slugInvalid && (
                <p className="text-xs text-red-500 mt-1">Only lowercase letters, numbers, and hyphens.</p>
              )}
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What does this KPI measure and why does it matter?"
              rows={2}
              className="mt-1"
              maxLength={1000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>
                Unit
                <span className="ml-1 text-xs font-normal text-[hsl(var(--text-disabled))]">(optional)</span>
              </Label>
              <Input
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                placeholder="e.g. ₹ or % or units"
                className="mt-1"
                maxLength={50}
              />
            </div>
            <div>
              <Label>Owner Role</Label>
              <Sel
                value={form.owner_role}
                onChange={(v) => set('owner_role', v)}
                options={[
                  { value: '',             label: 'Any role' },
                  { value: 'TENANT_ADMIN', label: 'Admin' },
                  { value: 'ANALYST',      label: 'Analyst' },
                  { value: 'VIEWER',       label: 'Viewer' },
                ]}
                className="mt-1 w-full"
              />
            </div>
          </div>

          <div>
            <Label>
              Status
            </Label>
            <div className="mt-2 flex gap-2">
              {(['DRAFT', 'ACTIVE', 'ARCHIVED'] as KpiStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status', s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    form.status === s
                      ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--text-primary))]'
                      : 'border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))]'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-[hsl(var(--text-disabled))] mt-1.5">
              Only <strong>ACTIVE</strong> KPIs are included in analysis runs.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Formula */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formula</CardTitle>
          <CardDescription>
            Describe how this KPI is calculated — in plain language or as a formula referencing your connector data.
            Example: <code className="bg-[hsl(var(--surface-2))] px-1 rounded text-xs">SUM(ERP.sales.monthly_revenue)</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.formula}
            onChange={(e) => set('formula', e.target.value)}
            placeholder="e.g. Total revenue from all active products in the current month"
            rows={3}
            className="font-mono text-sm"
            maxLength={2000}
          />
        </CardContent>
      </Card>

      {/* Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thresholds</CardTitle>
          <CardDescription>
            The AI uses these to classify severity. When a value crosses a threshold, it generates a{' '}
            <strong>WARNING</strong> or <strong>CRITICAL</strong> insight automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[hsl(var(--accent))]" />
                Target
              </Label>
              <Input
                type="number"
                value={form.target_value}
                onChange={(e) => set('target_value', e.target.value)}
                placeholder="e.g. 100000"
                className="mt-1"
              />
              <p className="text-[10px] text-[hsl(var(--text-disabled))] mt-1">Goal value — for context.</p>
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Warning threshold
              </Label>
              <Input
                type="number"
                value={form.warning_threshold}
                onChange={(e) => set('warning_threshold', e.target.value)}
                placeholder="e.g. 70000"
                className="mt-1"
              />
              <p className="text-[10px] text-[hsl(var(--text-disabled))] mt-1">Below this → WARNING insight.</p>
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                Critical threshold
              </Label>
              <Input
                type="number"
                value={form.critical_threshold}
                onChange={(e) => set('critical_threshold', e.target.value)}
                placeholder="e.g. 50000"
                className="mt-1"
              />
              <p className="text-[10px] text-[hsl(var(--text-disabled))] mt-1">Below this → CRITICAL insight.</p>
            </div>
          </div>

          {/* Live preview */}
          <ThresholdBar
            target={parseNum(form.target_value)}
            warning={parseNum(form.warning_threshold)}
            critical={parseNum(form.critical_threshold)}
            unit={form.unit || null}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pb-8">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(formToInput(form))} disabled={!isValid || isSaving} loading={isSaving}>
          {kpi ? 'Save changes' : 'Create KPI'}
        </Button>
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  kpi,
  onEdit,
  onArchive,
  onDelete,
}: {
  kpi: KpiDefinition;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn(
      'rounded-xl border border-[hsl(var(--border))] px-4 py-3',
      kpi.status === 'ARCHIVED' && 'opacity-50'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{kpi.name}</p>
            <span className="font-mono text-[10px] text-[hsl(var(--text-disabled))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded">
              {kpi.slug}
            </span>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
              STATUS_STYLES[kpi.status]
            )}>
              {kpi.status}
            </span>
            {kpi.unit && (
              <span className="text-[10px] text-[hsl(var(--text-disabled))]">{kpi.unit}</span>
            )}
          </div>

          {kpi.description && (
            <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5 truncate">{kpi.description}</p>
          )}

          <p className="text-xs text-[hsl(var(--text-disabled))] mt-1 font-mono truncate">
            {kpi.formula}
          </p>

          <ThresholdBar
            target={kpi.target_value}
            warning={kpi.warning_threshold}
            critical={kpi.critical_threshold}
            unit={kpi.unit}
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button>
          {kpi.status !== 'ARCHIVED' && (
            <button
              onClick={onArchive}
              className="px-2.5 py-1 text-xs rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))] transition-colors"
            >
              Archive
            </button>
          )}
          <button
            onClick={() => { if (confirm(`Delete KPI "${kpi.name}"?`)) onDelete(); }}
            className="p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 text-[hsl(var(--text-disabled))] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type View = { mode: 'list' } | { mode: 'edit'; kpi: KpiDefinition | null };

export function KPIsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>({ mode: 'list' });

  const { data, isLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => listKpis(1, 100),
  });

  const kpis = data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: createKpi,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kpis'] });
      setView({ mode: 'list' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateKpiInput> }) =>
      updateKpi(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kpis'] });
      setView({ mode: 'list' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteKpi,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kpis'] }),
  });

  if (view.mode === 'edit') {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <KpiEditor
            kpi={view.kpi}
            onCancel={() => setView({ mode: 'list' })}
            isSaving={createMutation.isPending || updateMutation.isPending}
            onSave={(input) => {
              if (view.kpi) {
                updateMutation.mutate({ id: view.kpi.id, input });
              } else {
                createMutation.mutate(input);
              }
            }}
          />
        </div>
      </div>
    );
  }

  const active   = kpis.filter((k) => k.status === 'ACTIVE');
  const draft    = kpis.filter((k) => k.status === 'DRAFT');
  const archived = kpis.filter((k) => k.status === 'ARCHIVED');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[hsl(var(--text-primary))]">KPI Definitions</h1>
            <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
              Define what "good" looks like for your business. The AI uses these thresholds during
              analysis to detect when metrics breach warning or critical levels.
            </p>
          </div>
          <Button onClick={() => setView({ mode: 'edit', kpi: null })} className="whitespace-nowrap flex-shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            New KPI
          </Button>
        </div>

        {/* Summary strip */}
        {kpis.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active',   count: active.length,   color: 'text-emerald-600' },
              { label: 'Draft',    count: draft.length,    color: 'text-slate-500' },
              { label: 'Archived', count: archived.length, color: 'text-stone-400' },
            ].map(({ label, count, color }) => (
              <div key={label} className="rounded-xl border border-[hsl(var(--border))] px-4 py-3">
                <p className={cn('text-2xl font-semibold', color)}>{count}</p>
                <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent" />
          </div>
        )}

        {!isLoading && kpis.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Target className="w-8 h-8 text-[hsl(var(--text-disabled))] mx-auto" />
              <div>
                <p className="text-sm font-medium text-[hsl(var(--text-primary))]">No KPIs defined yet</p>
                <p className="text-xs text-[hsl(var(--text-secondary))] max-w-sm mx-auto mt-1">
                  Without KPI definitions, the AI analyses your data in open-ended mode. Add KPIs
                  to give it a benchmark — it will flag breaches as WARNING or CRITICAL insights automatically.
                </p>
              </div>
              <Button onClick={() => setView({ mode: 'edit', kpi: null })}>
                <Plus className="w-4 h-4 mr-2" />
                Create your first KPI
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Active */}
        {active.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active KPIs</CardTitle>
              <CardDescription>Used in every analysis run.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {active.map((kpi) => (
                <KpiCard
                  key={kpi.id}
                  kpi={kpi}
                  onEdit={() => setView({ mode: 'edit', kpi })}
                  onArchive={() => updateMutation.mutate({ id: kpi.id, input: { status: 'ARCHIVED' } })}
                  onDelete={() => deleteMutation.mutate(kpi.id)}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Draft */}
        {draft.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Drafts</CardTitle>
              <CardDescription>Not yet active — won't appear in analysis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.map((kpi) => (
                <KpiCard
                  key={kpi.id}
                  kpi={kpi}
                  onEdit={() => setView({ mode: 'edit', kpi })}
                  onArchive={() => updateMutation.mutate({ id: kpi.id, input: { status: 'ARCHIVED' } })}
                  onDelete={() => deleteMutation.mutate(kpi.id)}
                />
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (confirm(`Activate all ${draft.length} draft KPI(s)?`)) {
                    draft.forEach((k) =>
                      updateMutation.mutate({ id: k.id, input: { status: 'ACTIVE' } })
                    );
                  }
                }}
              >
                Activate all drafts
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Archived */}
        {archived.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Archived</CardTitle>
              <CardDescription>Excluded from analysis. Edit to restore.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {archived.map((kpi) => (
                <KpiCard
                  key={kpi.id}
                  kpi={kpi}
                  onEdit={() => setView({ mode: 'edit', kpi })}
                  onArchive={() => {}}
                  onDelete={() => deleteMutation.mutate(kpi.id)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
