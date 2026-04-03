import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, Trash2, GitBranch, Play, CheckCircle2, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  listRules, createRule, updateRule, deleteRule, testRule,
  type BusinessRule, type CreateRuleInput, type RuleActionType,
  type ConditionNode, type RuleConditionLeaf, type RuleConditionGroup,
  type ConditionOperator,
} from '@/services/rules.service';

// ─── Styled native select (matches design system) ─────────────────────────────

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
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OPERATOR_OPTIONS: { value: ConditionOperator; label: string }[] = [
  { value: 'eq',           label: '= equals' },
  { value: 'neq',          label: '≠ not equals' },
  { value: 'gt',           label: '> greater than' },
  { value: 'gte',          label: '≥ greater or equal' },
  { value: 'lt',           label: '< less than' },
  { value: 'lte',          label: '≤ less or equal' },
  { value: 'contains',     label: '∋ contains' },
  { value: 'not_contains',  label: '∌ not contains' },
  { value: 'is_null',      label: '∅ is empty' },
  { value: 'is_not_null',  label: '◉ is not empty' },
];

const ACTION_OPTIONS: { value: RuleActionType; label: string }[] = [
  { value: 'CREATE_DECISION',  label: 'Create Decision' },
  { value: 'TRIGGER_WORKFLOW', label: 'Trigger Workflow' },
  { value: 'SEND_ALERT',       label: 'Send Alert' },
  { value: 'SET_MEMORY',       label: 'Set Memory' },
];

const VALUE_HIDDEN = new Set<ConditionOperator>(['is_null', 'is_not_null']);

// ─── Default helpers ──────────────────────────────────────────────────────────

function defaultCondition(): ConditionNode {
  return {
    type: 'group',
    logic: 'AND',
    conditions: [{ type: 'condition', field: '', operator: 'eq', value: '' }],
  };
}

function defaultActionConfig(type: RuleActionType): Record<string, string> {
  switch (type) {
    case 'CREATE_DECISION':  return { title: '', recommendation: '', priority: 'MEDIUM' };
    case 'TRIGGER_WORKFLOW': return { workflow_key: '', payload: '' };
    case 'SEND_ALERT':       return { title: '', message: '', recipients: '' };
    case 'SET_MEMORY':       return { key: '', value: '', category: 'BUSINESS_RULE' };
  }
}

function configToRecord(type: RuleActionType, cfg: Record<string, string>): Record<string, unknown> {
  if (type === 'SEND_ALERT') {
    return {
      title: cfg.title,
      message: cfg.message,
      recipients: cfg.recipients ? cfg.recipients.split(',').map((s) => s.trim()).filter(Boolean) : [],
    };
  }
  if (type === 'TRIGGER_WORKFLOW') {
    let payload: unknown;
    try { if (cfg.payload?.trim()) payload = JSON.parse(cfg.payload); } catch { payload = undefined; }
    return { workflow_key: cfg.workflow_key, ...(payload !== undefined ? { payload } : {}) };
  }
  return cfg;
}

function recordToConfig(type: RuleActionType, cfg: Record<string, unknown>): Record<string, string> {
  if (type === 'SEND_ALERT') {
    const r = Array.isArray(cfg.recipients) ? (cfg.recipients as string[]).join(', ') : '';
    return {
      title:      String(cfg.title ?? ''),
      message:    String(cfg.message ?? ''),
      recipients: r,
    };
  }
  if (type === 'TRIGGER_WORKFLOW') {
    return {
      workflow_key: String(cfg.workflow_key ?? ''),
      payload:      cfg.payload !== undefined ? JSON.stringify(cfg.payload, null, 2) : '',
    };
  }
  return Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, String(v ?? '')]));
}

// ─── Condition tree editor ────────────────────────────────────────────────────

function ConditionLeaf({
  node,
  onChange,
  onRemove,
}: {
  node: RuleConditionLeaf;
  onChange: (n: RuleConditionLeaf) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Input
        placeholder="connector.field.path"
        value={node.field}
        onChange={(e) => onChange({ ...node, field: e.target.value })}
        className="w-48 font-mono text-xs"
      />
      <Sel
        value={node.operator}
        onChange={(v) => {
          const op = v as ConditionOperator;
          onChange({ ...node, operator: op, value: VALUE_HIDDEN.has(op) ? undefined : node.value });
        }}
        options={OPERATOR_OPTIONS}
        className="w-44"
      />
      {!VALUE_HIDDEN.has(node.operator) && (
        <Input
          placeholder="value"
          value={String(node.value ?? '')}
          onChange={(e) => onChange({ ...node, value: e.target.value })}
          className="w-32 text-xs"
        />
      )}
      <button
        onClick={onRemove}
        className="p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 text-[hsl(var(--text-disabled))] transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ConditionGroup({
  node,
  onChange,
  onRemove,
  depth = 0,
}: {
  node: RuleConditionGroup;
  onChange: (n: RuleConditionGroup) => void;
  onRemove?: () => void;
  depth?: number;
}) {
  function updateChild(index: number, updated: ConditionNode | null) {
    if (updated === null) {
      onChange({ ...node, conditions: node.conditions.filter((_, i) => i !== index) });
    } else {
      const next = [...node.conditions];
      next[index] = updated;
      onChange({ ...node, conditions: next });
    }
  }

  function addLeaf() {
    onChange({
      ...node,
      conditions: [...node.conditions, { type: 'condition', field: '', operator: 'eq', value: '' }],
    });
  }

  function addGroup() {
    onChange({
      ...node,
      conditions: [
        ...node.conditions,
        { type: 'group', logic: 'AND', conditions: [{ type: 'condition', field: '', operator: 'eq', value: '' }] },
      ],
    });
  }

  const borderColors = [
    'border-l-[hsl(var(--accent)/0.4)]',
    'border-l-emerald-400/50',
    'border-l-amber-400/50',
  ];

  return (
    <div className={cn(
      'rounded-lg border border-[hsl(var(--border))] border-l-2 pl-3 pr-3 py-3 space-y-3',
      borderColors[depth % borderColors.length],
      depth > 0 && 'bg-[hsl(var(--surface-2)/0.4)]'
    )}>
      {/* Logic toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[hsl(var(--text-secondary))]">Match</span>
        <Sel
          value={node.logic}
          onChange={(v) => onChange({ ...node, logic: v as 'AND' | 'OR' })}
          options={[
            { value: 'AND', label: 'ALL conditions (AND)' },
            { value: 'OR',  label: 'ANY condition (OR)' },
          ]}
          className="w-48"
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="ml-auto p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 text-[hsl(var(--text-disabled))] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Children */}
      <div className="space-y-2.5">
        {node.conditions.map((child, i) =>
          child.type === 'condition' ? (
            <ConditionLeaf
              key={i}
              node={child}
              onChange={(updated) => updateChild(i, updated)}
              onRemove={() => updateChild(i, null)}
            />
          ) : (
            <ConditionGroup
              key={i}
              node={child}
              onChange={(updated) => updateChild(i, updated)}
              onRemove={() => updateChild(i, null)}
              depth={depth + 1}
            />
          )
        )}
      </div>

      {/* Add buttons */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={addLeaf}
          className="flex items-center gap-1 text-xs text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add condition
        </button>
        {depth < 2 && (
          <button
            onClick={addGroup}
            className="flex items-center gap-1 text-xs text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
          >
            <GitBranch className="w-3 h-3" />
            Add group
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Action config editor ─────────────────────────────────────────────────────

function ActionConfigEditor({
  actionType,
  config,
  onChange,
}: {
  actionType: RuleActionType;
  config: Record<string, string>;
  onChange: (cfg: Record<string, string>) => void;
}) {
  const set = (key: string, val: string) => onChange({ ...config, [key]: val });

  if (actionType === 'CREATE_DECISION') {
    return (
      <div className="space-y-3">
        <div>
          <Label>Decision Title</Label>
          <Input
            value={config.title ?? ''}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Reorder stock for paracetamol"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Recommendation</Label>
          <Textarea
            value={config.recommendation ?? ''}
            onChange={(e) => set('recommendation', e.target.value)}
            placeholder="Describe the recommended action..."
            rows={2}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Priority</Label>
          <Sel
            value={config.priority ?? 'MEDIUM'}
            onChange={(v) => set('priority', v)}
            options={[
              { value: 'LOW',    label: 'Low' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HIGH',   label: 'High' },
              { value: 'URGENT', label: 'Urgent' },
            ]}
            className="mt-1 w-40"
          />
        </div>
      </div>
    );
  }

  if (actionType === 'TRIGGER_WORKFLOW') {
    return (
      <div className="space-y-3">
        <div>
          <Label>Workflow Key</Label>
          <Input
            value={config.workflow_key ?? ''}
            onChange={(e) => set('workflow_key', e.target.value)}
            placeholder="e.g. REMINDER_SCHEDULED"
            className="mt-1 font-mono"
          />
          <p className="text-xs text-[hsl(var(--text-disabled))] mt-1">
            Must match a workflow key configured in Settings → Automation.
          </p>
        </div>
        <div>
          <Label>Extra Payload (JSON, optional)</Label>
          <Textarea
            value={config.payload ?? ''}
            onChange={(e) => set('payload', e.target.value)}
            placeholder={'{\n  "key": "value"\n}'}
            rows={3}
            className="mt-1 font-mono text-xs"
          />
        </div>
      </div>
    );
  }

  if (actionType === 'SEND_ALERT') {
    return (
      <div className="space-y-3">
        <div>
          <Label>Alert Title</Label>
          <Input
            value={config.title ?? ''}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Low stock warning"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Message</Label>
          <Textarea
            value={config.message ?? ''}
            onChange={(e) => set('message', e.target.value)}
            placeholder="Alert message body..."
            rows={2}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Recipients</Label>
          <Input
            value={config.recipients ?? ''}
            onChange={(e) => set('recipients', e.target.value)}
            placeholder="admin@company.com, ops@company.com"
            className="mt-1"
          />
          <p className="text-xs text-[hsl(var(--text-disabled))] mt-1">Comma-separated email addresses.</p>
        </div>
      </div>
    );
  }

  // SET_MEMORY
  return (
    <div className="space-y-3">
      <div>
        <Label>Memory Key</Label>
        <Input
          value={config.key ?? ''}
          onChange={(e) => set('key', e.target.value)}
          placeholder="e.g. low_stock_threshold"
          className="mt-1 font-mono"
        />
      </div>
      <div>
        <Label>Value</Label>
        <Input
          value={config.value ?? ''}
          onChange={(e) => set('value', e.target.value)}
          placeholder="e.g. 50 units"
          className="mt-1"
        />
      </div>
      <div>
        <Label>Category</Label>
        <Input
          value={config.category ?? ''}
          onChange={(e) => set('category', e.target.value)}
          placeholder="e.g. BUSINESS_RULE"
          className="mt-1 font-mono"
        />
      </div>
    </div>
  );
}

// ─── Rule form ────────────────────────────────────────────────────────────────

interface RuleFormState {
  name: string;
  description: string;
  is_active: boolean;
  priority: number;
  condition: ConditionNode;
  action_type: RuleActionType;
  action_config: Record<string, string>;
}

function ruleToForm(rule: BusinessRule): RuleFormState {
  return {
    name:        rule.name,
    description: rule.description ?? '',
    is_active:   rule.is_active,
    priority:    rule.priority,
    condition:   rule.condition,
    action_type: rule.action_type,
    action_config: recordToConfig(rule.action_type, rule.action_config),
  };
}

function blankForm(): RuleFormState {
  return {
    name:         '',
    description:  '',
    is_active:    true,
    priority:     100,
    condition:    defaultCondition(),
    action_type:  'CREATE_DECISION',
    action_config: defaultActionConfig('CREATE_DECISION'),
  };
}

function RuleEditor({
  rule,
  onSave,
  onCancel,
  isSaving,
}: {
  rule: BusinessRule | null;
  onSave: (input: CreateRuleInput) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<RuleFormState>(rule ? ruleToForm(rule) : blankForm());

  function set<K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleActionTypeChange(type: RuleActionType) {
    setForm((prev) => ({
      ...prev,
      action_type:   type,
      action_config: rule?.action_type === type
        ? recordToConfig(type, rule.action_config)
        : defaultActionConfig(type),
    }));
  }

  function handleSubmit() {
    onSave({
      name:         form.name.trim(),
      description:  form.description.trim() || undefined,
      is_active:    form.is_active,
      priority:     form.priority,
      condition:    form.condition,
      action_type:  form.action_type,
      action_config: configToRecord(form.action_type, form.action_config),
    });
  }

  const isValid = form.name.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to rules
      </button>

      <div>
        <h1 className="text-xl font-semibold text-[hsl(var(--text-primary))]">
          {rule ? 'Edit Rule' : 'New Business Rule'}
        </h1>
        <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
          Define when this rule fires and what action it triggers automatically during analysis.
        </p>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rule Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Low stock alert"
                className="mt-1"
                maxLength={120}
              />
            </div>
            <div>
              <Label>
                Priority
                <span className="ml-1 text-xs font-normal text-[hsl(var(--text-disabled))]">(1 = first to run)</span>
              </Label>
              <Input
                type="number"
                min={1}
                max={999}
                value={form.priority}
                onChange={(e) => set('priority', Math.max(1, Math.min(999, parseInt(e.target.value) || 100)))}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What does this rule do and when should it fire?"
              rows={2}
              className="mt-1"
              maxLength={500}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] focus:ring-offset-1',
                form.is_active ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--border))]'
              )}
              role="switch"
              aria-checked={form.is_active}
            >
              <span
                className={cn(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
                  form.is_active ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </button>
            <span
              className="text-sm text-[hsl(var(--text-secondary))] cursor-pointer select-none"
              onClick={() => set('is_active', !form.is_active)}
            >
              {form.is_active ? 'Active — will run during every analysis' : 'Paused — will not run'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Condition builder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">When (Condition)</CardTitle>
          <CardDescription>
            Rule fires when these conditions match live connector data. Use dot-notation field paths,
            e.g. <code className="bg-[hsl(var(--surface-2))] px-1 rounded text-xs">ERP.stock.paracetamol</code>.
            Field paths must match the connector name and endpoint/query name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {form.condition.type === 'group' ? (
            <ConditionGroup
              node={form.condition}
              onChange={(updated) => set('condition', updated)}
              depth={0}
            />
          ) : (
            <ConditionGroup
              node={{ type: 'group', logic: 'AND', conditions: [form.condition] }}
              onChange={(updated) => set('condition', updated)}
              depth={0}
            />
          )}
        </CardContent>
      </Card>

      {/* Action */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Then (Action)</CardTitle>
          <CardDescription>What happens automatically when the condition is met.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Action Type</Label>
            <Sel
              value={form.action_type}
              onChange={(v) => handleActionTypeChange(v as RuleActionType)}
              options={ACTION_OPTIONS}
              className="mt-1 w-56"
            />
          </div>
          <Separator />
          <ActionConfigEditor
            actionType={form.action_type}
            config={form.action_config}
            onChange={(cfg) => set('action_config', cfg)}
          />
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!isValid || isSaving} loading={isSaving}>
          {rule ? 'Save changes' : 'Create rule'}
        </Button>
      </div>
    </div>
  );
}

// ─── Rule card ────────────────────────────────────────────────────────────────

const ACTION_BADGE: Record<RuleActionType, string> = {
  CREATE_DECISION:  'bg-blue-100 text-blue-700',
  TRIGGER_WORKFLOW: 'bg-purple-100 text-purple-700',
  SEND_ALERT:       'bg-amber-100 text-amber-700',
  SET_MEMORY:       'bg-emerald-100 text-emerald-700',
};

const ACTION_LABEL: Record<RuleActionType, string> = {
  CREATE_DECISION:  'Decision',
  TRIGGER_WORKFLOW: 'Workflow',
  SEND_ALERT:       'Alert',
  SET_MEMORY:       'Memory',
};

function RuleCard({
  rule,
  onEdit,
  onToggle,
  onDelete,
  onTest,
  isTesting,
  testResult,
}: {
  rule: BusinessRule;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onTest: () => void;
  isTesting: boolean;
  testResult: { matched: boolean; preview: string } | null;
}) {
  return (
    <div className={cn(
      'rounded-xl border border-[hsl(var(--border))] px-4 py-3 transition-opacity',
      !rule.is_active && 'opacity-55'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{rule.name}</p>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
              ACTION_BADGE[rule.action_type]
            )}>
              {ACTION_LABEL[rule.action_type]}
            </span>
            {!rule.is_active && (
              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] font-semibold">
                PAUSED
              </span>
            )}
          </div>
          {rule.description && (
            <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5 truncate">{rule.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-[hsl(var(--text-disabled))]">Priority {rule.priority}</span>
            <span className="text-[10px] text-[hsl(var(--text-disabled))]">Triggered {rule.trigger_count}×</span>
            {rule.last_triggered_at && (
              <span className="text-[10px] text-[hsl(var(--text-disabled))]">
                Last {new Date(rule.last_triggered_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="secondary" onClick={onTest} loading={isTesting} title="Test against live connector data">
            <Play className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button>
          <button
            onClick={onToggle}
            className="px-2.5 py-1 text-xs rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))] transition-colors"
          >
            {rule.is_active ? 'Pause' : 'Enable'}
          </button>
          <button
            onClick={() => { if (confirm(`Delete rule "${rule.name}"?`)) onDelete(); }}
            className="p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 text-[hsl(var(--text-disabled))] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline test result */}
      {testResult && (
        <div className={cn(
          'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs border',
          testResult.matched
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        )}>
          {testResult.matched
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            : <Zap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          }
          {testResult.preview}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type View = { mode: 'list' } | { mode: 'edit'; rule: BusinessRule | null };
type TestState = { ruleId: string; matched: boolean; preview: string };

export function RulesPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>({ mode: 'list' });
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: listRules,
  });

  const createMutation = useMutation({
    mutationFn: createRule,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rules'] });
      setView({ mode: 'list' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateRuleInput> }) =>
      updateRule(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rules'] });
      setView({ mode: 'list' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rules'] }),
  });

  const testMutation = useMutation({
    mutationFn: (ruleId: string) => testRule(ruleId),
    onSuccess: (result, ruleId) => {
      setTestStates((prev) => ({ ...prev, [ruleId]: { ruleId, ...result } }));
      setTimeout(() => {
        setTestStates((prev) => {
          const next = { ...prev };
          delete next[ruleId];
          return next;
        });
      }, 6000);
    },
  });

  if (view.mode === 'edit') {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <RuleEditor
            rule={view.rule}
            onCancel={() => setView({ mode: 'list' })}
            isSaving={createMutation.isPending || updateMutation.isPending}
            onSave={(input) => {
              if (view.rule) {
                updateMutation.mutate({ id: view.rule.id, input });
              } else {
                createMutation.mutate(input);
              }
            }}
          />
        </div>
      </div>
    );
  }

  const activeCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[hsl(var(--text-primary))]">Business Rules</h1>
            <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
              Deterministic rules that run before AI analysis. When conditions match live connector data,
              the action fires automatically — no LLM call required.
            </p>
          </div>
          <Button onClick={() => setView({ mode: 'edit', rule: null })}>
            <Plus className="w-4 h-4 mr-2" />
            New Rule
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rules
              <span className="ml-2 text-sm font-normal text-[hsl(var(--text-secondary))]">
                {activeCount} active · {rules.length} total
              </span>
            </CardTitle>
            <CardDescription>
              Rules run in priority order (lowest number first) before every analysis.
              Hit <strong>▶</strong> to test a rule against your current connector data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent" />
              </div>
            )}

            {!isLoading && rules.length === 0 && (
              <div className="py-12 text-center space-y-3">
                <GitBranch className="w-8 h-8 text-[hsl(var(--text-disabled))] mx-auto" />
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--text-primary))]">No rules yet</p>
                  <p className="text-xs text-[hsl(var(--text-secondary))] max-w-sm mx-auto mt-1">
                    Business rules let you encode domain logic directly. When data matches, the AI
                    automatically creates decisions, triggers workflows, or fires alerts —
                    without waiting for an LLM analysis cycle.
                  </p>
                </div>
                <Button onClick={() => setView({ mode: 'edit', rule: null })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first rule
                </Button>
              </div>
            )}

            {rules
              .slice()
              .sort((a, b) => a.priority - b.priority)
              .map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  testResult={testStates[rule.id] ?? null}
                  onEdit={() => setView({ mode: 'edit', rule })}
                  onToggle={() =>
                    updateMutation.mutate({ id: rule.id, input: { is_active: !rule.is_active } })
                  }
                  onDelete={() => deleteMutation.mutate(rule.id)}
                  onTest={() => testMutation.mutate(rule.id)}
                  isTesting={testMutation.isPending && testMutation.variables === rule.id}
                />
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
