import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Plus, Globe, Database, CheckCircle, XCircle, Clock,
  Trash2, ChevronDown, ChevronRight, Eye, EyeOff, FileText, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  listApiConnectors, createApiConnector, testApiConnector, addApiEndpoint, deleteApiConnector,
  listDbConnectors, createDbConnector, testDbConnector, addQueryTemplate, deleteDbConnector,
  listMaskingRules, createMaskingRule, deleteMaskingRule,
} from '@/services/connector.service';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { listFileConnectors, createFileConnector, deleteFileConnector, type FileConnector } from '@/services/file-connector.service';

type View = 'list' | 'add-api' | 'add-db' | 'api-detail' | 'db-detail';

function TestStatusBadge({ status }: { status: string }) {
  if (status === 'OK') return (
    <span className="flex items-center gap-1 text-[11px] text-[hsl(var(--success))]">
      <CheckCircle className="w-3 h-3" /> OK
    </span>
  );
  if (status === 'FAILED') return (
    <span className="flex items-center gap-1 text-[11px] text-[hsl(var(--error))]">
      <XCircle className="w-3 h-3" /> Failed
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[11px] text-[hsl(var(--text-disabled))]">
      <Clock className="w-3 h-3" /> Untested
    </span>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ApiConnectorCard({ connector, onTest, onDelete, onSelect }: { connector: any; onTest: () => void; onDelete: () => void; onSelect: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] hover:border-[hsl(var(--accent)/0.4)] transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
          <Globe className="w-4 h-4 text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[hsl(var(--text-primary))] truncate">{connector.name}</p>
          <p className="text-[11px] text-[hsl(var(--text-secondary))] truncate">{connector.base_url}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
        <TestStatusBadge status={connector.test_status} />
        <div className="hidden group-hover:flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onTest} className="h-7 px-2 text-xs">Test</Button>
          <Button size="sm" variant="ghost" onClick={onSelect} className="h-7 px-2 text-xs">Configure</Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 w-7 p-0 text-[hsl(var(--error))]">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DbConnectorCard({ connector, onTest, onDelete, onSelect }: { connector: any; onTest: () => void; onDelete: () => void; onSelect: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] hover:border-[hsl(var(--accent)/0.4)] transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Database className="w-4 h-4 text-purple-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[hsl(var(--text-primary))] truncate">{connector.name}</p>
          <p className="text-[11px] text-[hsl(var(--text-secondary))] truncate">{connector.db_type} · {connector.host}:{connector.port}/{connector.database_name}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
        <TestStatusBadge status={connector.test_status} />
        <div className="hidden group-hover:flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onTest} className="h-7 px-2 text-xs">Test</Button>
          <Button size="sm" variant="ghost" onClick={onSelect} className="h-7 px-2 text-xs">Configure</Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 w-7 p-0 text-[hsl(var(--error))]">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddApiForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { openUpgradeModal } = useUIStore();

  interface ApiForm {
    name: string; base_url: string; auth_type: string;
    auth_token: string; description: string;
  }
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ApiForm>();

  const createMutation = useMutation({
    mutationFn: (data: ApiForm) => createApiConnector({
      name: data.name,
      base_url: data.base_url,
      auth_type: data.auth_type,
      ...(data.auth_token ? { auth_config: { token: data.auth_token } } : {}),
      ...(data.description ? { description: data.description } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-connectors'] });
      onClose();
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 402) openUpgradeModal('MULTIPLE_CONNECTORS');
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Connector Name</Label>
        <Input placeholder="CRM API" {...register('name', { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label>Base URL</Label>
        <Input placeholder="https://api.example.com" type="url" {...register('base_url', { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label>Auth Type</Label>
        <select {...register('auth_type')} className="w-full h-9 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--text-primary))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]">
          <option value="NONE">None</option>
          <option value="BEARER">Bearer Token</option>
          <option value="API_KEY">API Key</option>
          <option value="BASIC">Basic Auth</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Auth Token / Key <span className="text-[hsl(var(--text-disabled))]">(optional)</span></Label>
        <Input type="password" placeholder="Token or API key" {...register('auth_token')} />
      </div>
      <div className="space-y-1.5">
        <Label>Description <span className="text-[hsl(var(--text-disabled))]">(optional)</span></Label>
        <Input placeholder="What does this API provide?" {...register('description')} />
      </div>
      <div className="flex gap-3 pt-1">
        <Button type="submit" loading={isSubmitting || createMutation.isPending}>Add Connector</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
      {user?.plan === 'FREE' && (
        <p className="text-[11px] text-[hsl(var(--warning))]">Free plan: 1 connector total. <button type="button" onClick={() => openUpgradeModal()} className="underline">Upgrade for unlimited.</button></p>
      )}
    </form>
  );
}

function AddDbForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { openUpgradeModal } = useUIStore();
  const [showPw, setShowPw] = useState(false);

  interface DbForm {
    name: string; db_type: string; host: string; port: number;
    database_name: string; username: string; password: string;
  }
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<DbForm>({
    defaultValues: { db_type: 'POSTGRESQL', port: 5432 },
  });

  const createMutation = useMutation({
    mutationFn: (data: DbForm) => createDbConnector(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['db-connectors'] });
      onClose();
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 402) openUpgradeModal('MULTIPLE_CONNECTORS');
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Connector Name</Label>
        <Input placeholder="Orders DB" {...register('name', { required: true })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <select {...register('db_type')} className="w-full h-9 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--text-primary))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]">
            <option value="POSTGRESQL">PostgreSQL</option>
            <option value="MYSQL">MySQL</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Port</Label>
          <Input type="number" {...register('port', { required: true })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Host</Label>
        <Input placeholder="localhost or db.internal.com" {...register('host', { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label>Database Name</Label>
        <Input placeholder="mydb" {...register('database_name', { required: true })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Username</Label>
          <Input {...register('username', { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <div className="relative">
            <Input type={showPw ? 'text' : 'password'} className="pr-9" {...register('password', { required: true })} />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-disabled))]">
              {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <Button type="submit" loading={isSubmitting || createMutation.isPending}>Add Database</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
      {user?.plan === 'FREE' && (
        <p className="text-[11px] text-[hsl(var(--warning))]">Free plan: 1 connector total. <button type="button" onClick={() => openUpgradeModal()} className="underline">Upgrade for unlimited.</button></p>
      )}
    </form>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AddEndpointForm({ connectorId, onClose }: { connectorId: string; onClose: () => void }) {
  const qc = useQueryClient();
  interface EndpointForm { name: string; method: string; path_template: string; description: string; }
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<EndpointForm>({ defaultValues: { method: 'GET' } });
  const mutation = useMutation({
    mutationFn: (data: EndpointForm) => addApiEndpoint(connectorId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-connectors'] }),
  });
  return (
    <form onSubmit={handleSubmit((d) => { mutation.mutate(d); onClose(); })} className="space-y-3 p-4 rounded-xl bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))]">
      <p className="text-xs font-semibold text-[hsl(var(--text-secondary))]">Add Endpoint</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Method</Label>
          <select {...register('method')} className="w-full h-8 px-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--text-primary))] text-xs focus:outline-none">
            <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option>
          </select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Name</Label>
          <Input className="h-8 text-xs" placeholder="Get Customer" {...register('name', { required: true })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Path Template</Label>
        <Input className="h-8 text-xs font-mono" placeholder="/customers/{{customer_id}}" {...register('path_template', { required: true })} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" type="submit" loading={isSubmitting || mutation.isPending}>Add</Button>
        <Button size="sm" variant="secondary" type="button" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AddQueryForm({ connectorId, onClose }: { connectorId: string; onClose: () => void }) {
  const qc = useQueryClient();
  interface QueryForm { name: string; sql_template: string; description: string; }
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<QueryForm>();
  const mutation = useMutation({
    mutationFn: (data: QueryForm) => addQueryTemplate(connectorId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['db-connectors'] }),
  });
  return (
    <form onSubmit={handleSubmit((d) => { mutation.mutate(d); onClose(); })} className="space-y-3 p-4 rounded-xl bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))]">
      <p className="text-xs font-semibold text-[hsl(var(--text-secondary))]">Add Query Template</p>
      <div className="space-y-1">
        <Label className="text-xs">Name</Label>
        <Input className="h-8 text-xs" placeholder="Get customer orders" {...register('name', { required: true })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">SQL (SELECT only, use $1 $2 for params)</Label>
        <textarea
          rows={3}
          placeholder="SELECT order_id, amount FROM orders WHERE customer_id = $1"
          className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--text-primary))] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] resize-none"
          {...register('sql_template', { required: true })}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" type="submit" loading={isSubmitting || mutation.isPending}>Add</Button>
        <Button size="sm" variant="secondary" type="button" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

function MaskingSection() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: rules = [] } = useQuery({ queryKey: ['masking-rules'], queryFn: listMaskingRules });
  const deleteMutation = useMutation({ mutationFn: deleteMaskingRule, onSuccess: () => qc.invalidateQueries({ queryKey: ['masking-rules'] }) });

  interface MaskForm { name: string; match_type: string; match_pattern: string; strategy: string; }
  const { register, handleSubmit, reset } = useForm<MaskForm>({ defaultValues: { match_type: 'FIELD_NAME', strategy: 'FULL_REDACT' } });
  const createMutation = useMutation({
    mutationFn: (data: MaskForm) => createMaskingRule(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['masking-rules'] }); setAdding(false); reset(); },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">Masking Rules</p>
          <p className="text-xs text-[hsl(var(--text-secondary))]">Fields matching these rules are redacted before reaching the AI</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding(!adding)}>
          <Plus className="w-3.5 h-3.5" /> Add Rule
        </Button>
      </div>

      {adding && (
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-3 p-4 rounded-xl bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))]">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Rule Name</Label><Input className="h-8 text-xs" placeholder="Email Redaction" {...register('name', { required: true })} /></div>
            <div className="space-y-1"><Label className="text-xs">Match Type</Label>
              <select {...register('match_type')} className="w-full h-8 px-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--text-primary))] text-xs focus:outline-none">
                <option value="FIELD_NAME">Field Name</option>
                <option value="REGEX">Regex</option>
                <option value="GLOB">Glob</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Pattern</Label><Input className="h-8 text-xs font-mono" placeholder="email or *email* or .*email.*" {...register('match_pattern', { required: true })} /></div>
            <div className="space-y-1"><Label className="text-xs">Strategy</Label>
              <select {...register('strategy')} className="w-full h-8 px-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--text-primary))] text-xs focus:outline-none">
                <option value="FULL_REDACT">Full Redact</option>
                <option value="PARTIAL_MASK">Partial Mask</option>
                <option value="TOKENIZE">Tokenize</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2"><Button size="sm" type="submit" loading={createMutation.isPending}>Save Rule</Button><Button size="sm" variant="secondary" type="button" onClick={() => setAdding(false)}>Cancel</Button></div>
        </form>
      )}

      {rules.length === 0 && !adding && (
        <p className="text-xs text-[hsl(var(--text-disabled))] px-1">No masking rules configured. System defaults (password, secret, token, api_key) are always applied.</p>
      )}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {rules.map((rule: any) => (
        <div key={rule.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-[10px] font-mono">{rule.strategy}</Badge>
            <span className="text-xs text-[hsl(var(--text-primary))]">{rule.name}</span>
            <span className="text-[11px] text-[hsl(var(--text-disabled))] font-mono">{rule.match_pattern}</span>
          </div>
          <button onClick={() => deleteMutation.mutate(rule.id)} className="p-1 rounded text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--error))]">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function FileConnectorSection() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: fileConnectors = [] } = useQuery({
    queryKey: ['file-connectors'],
    queryFn: listFileConnectors,
  });

  const createMutation = useMutation({
    mutationFn: createFileConnector,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-connectors'] });
      setShowUpload(false);
      setName('');
      setDescription('');
      setCsvText('');
      setFileName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFileConnector,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['file-connectors'] }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (!name) setName(file.name.replace(/\.csv$/i, ''));
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string ?? '');
    reader.readAsText(file);
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] hover:bg-[hsl(var(--surface-2))] transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-green-400" />
          <span className="text-sm font-semibold">File / CSV Connectors</span>
          <Badge variant="outline">{fileConnectors.length}</Badge>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-[hsl(var(--text-secondary))]" /> : <ChevronRight className="w-4 h-4 text-[hsl(var(--text-secondary))]" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 pl-2">
          {fileConnectors.length === 0 && !showUpload && (
            <p className="text-xs text-[hsl(var(--text-disabled))] px-4 py-2">No file connectors yet. Upload a CSV to let AI query your data.</p>
          )}
          {fileConnectors.map((fc: FileConnector) => (
            <div key={fc.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--text-primary))] truncate">{fc.name}</p>
                  <p className="text-[11px] text-[hsl(var(--text-secondary))]">{fc.file_name} · {fc.row_count} rows · {fc.headers.length} columns</p>
                </div>
              </div>
              <button
                onClick={() => { if (confirm(`Delete "${fc.name}"?`)) deleteMutation.mutate(fc.id); }}
                className="hidden group-hover:flex p-1.5 rounded text-[hsl(var(--error))] hover:bg-[hsl(var(--error)/0.1)]"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {showUpload ? (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 space-y-3">
              <p className="text-sm font-medium">Upload CSV File</p>

              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-[hsl(var(--border))] rounded-lg p-6 text-center cursor-pointer hover:border-[hsl(var(--accent)/0.5)] transition-colors"
              >
                <Upload className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--text-disabled))]" />
                <p className="text-xs text-[hsl(var(--text-secondary))]">
                  {fileName ? fileName : 'Click to select a CSV file'}
                </p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Connector name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-disabled))] outline-none focus:border-[hsl(var(--accent))]"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-disabled))] outline-none focus:border-[hsl(var(--accent))]"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!name || !csvText}
                  loading={createMutation.isPending}
                  onClick={() => createMutation.mutate({ name, description, file_name: fileName, csv_text: csvText })}
                >
                  Upload
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowUpload(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-2))] rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Upload CSV
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ConnectorsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>('list');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedConnector, setSelectedConnector] = useState<any>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('api');
  const [addingEndpoint, setAddingEndpoint] = useState(false);
  const [addingQuery, setAddingQuery] = useState(false);

  const { data: apiConnectors = [] } = useQuery({ queryKey: ['api-connectors'], queryFn: listApiConnectors });
  const { data: dbConnectors = [] } = useQuery({ queryKey: ['db-connectors'], queryFn: listDbConnectors });

  const testApiMutation = useMutation({
    mutationFn: testApiConnector,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-connectors'] }),
  });

  const testDbMutation = useMutation({
    mutationFn: testDbConnector,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['db-connectors'] }),
  });

  const deleteApiMutation = useMutation({
    mutationFn: deleteApiConnector,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-connectors'] }),
  });

  const deleteDbMutation = useMutation({
    mutationFn: deleteDbConnector,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['db-connectors'] }),
  });

  if (view === 'add-api') return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button onClick={() => setView('list')} className="text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] mb-6 flex items-center gap-1">
          ← Back to Connectors
        </button>
        <h1 className="text-xl font-semibold mb-6">Add API Connector</h1>
        <Card><CardContent className="pt-6"><AddApiForm onClose={() => setView('list')} /></CardContent></Card>
      </div>
    </div>
  );

  if (view === 'add-db') return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button onClick={() => setView('list')} className="text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] mb-6 flex items-center gap-1">
          ← Back to Connectors
        </button>
        <h1 className="text-xl font-semibold mb-6">Add Database Connector</h1>
        <Card><CardContent className="pt-6"><AddDbForm onClose={() => setView('list')} /></CardContent></Card>
      </div>
    </div>
  );

  if (view === 'api-detail' && selectedConnector) return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button onClick={() => setView('list')} className="text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] mb-6 flex items-center gap-1">
          ← Back to Connectors
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">{selectedConnector.name}</h1>
            <p className="text-sm text-[hsl(var(--text-secondary))] font-mono">{selectedConnector.base_url}</p>
          </div>
          <TestStatusBadge status={selectedConnector.test_status} />
        </div>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center justify-between">
            Endpoints
            <Button size="sm" variant="secondary" onClick={() => setAddingEndpoint(!addingEndpoint)}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {addingEndpoint && <AddEndpointForm connectorId={selectedConnector.id} onClose={() => setAddingEndpoint(false)} />}
            {(selectedConnector.endpoints ?? []).length === 0 && !addingEndpoint && (
              <p className="text-xs text-[hsl(var(--text-disabled))]">No endpoints defined. Add one to enable AI-powered queries.</p>
            )}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(selectedConnector.endpoints ?? []).map((ep: any) => (
              <div key={ep.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
                <Badge variant="outline" className="text-[10px] font-mono">{ep.method}</Badge>
                <span className="text-xs font-medium">{ep.name}</span>
                <span className="text-[11px] text-[hsl(var(--text-disabled))] font-mono flex-1 truncate">{ep.path_template}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (view === 'db-detail' && selectedConnector) return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button onClick={() => setView('list')} className="text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] mb-6 flex items-center gap-1">
          ← Back to Connectors
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">{selectedConnector.name}</h1>
            <p className="text-sm text-[hsl(var(--text-secondary))]">{selectedConnector.db_type} · {selectedConnector.host}</p>
          </div>
          <TestStatusBadge status={selectedConnector.test_status} />
        </div>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center justify-between">
            Query Templates
            <Button size="sm" variant="secondary" onClick={() => setAddingQuery(!addingQuery)}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {addingQuery && <AddQueryForm connectorId={selectedConnector.id} onClose={() => setAddingQuery(false)} />}
            {(selectedConnector.query_templates ?? []).length === 0 && !addingQuery && (
              <p className="text-xs text-[hsl(var(--text-disabled))]">No query templates defined. Add SELECT queries for the AI to use.</p>
            )}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(selectedConnector.query_templates ?? []).map((qt: any) => (
              <div key={qt.id} className="px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
                <p className="text-xs font-medium mb-1">{qt.name}</p>
                <p className="text-[11px] text-[hsl(var(--text-disabled))] font-mono truncate">{qt.sql_template}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Main list view
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-[hsl(var(--text-primary))]">Connectors</h1>
            <p className="text-sm text-[hsl(var(--text-secondary))] mt-0.5">Connect your APIs and databases to enable data-powered AI responses.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setView('add-api'); }}>
              <Plus className="w-3.5 h-3.5" /> API
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setView('add-db'); }}>
              <Plus className="w-3.5 h-3.5" /> Database
            </Button>
          </div>
        </div>

        {/* API Connectors section */}
        <div className="mb-4">
          <button
            onClick={() => setExpandedSection(expandedSection === 'api' ? null : 'api')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] hover:bg-[hsl(var(--surface-2))] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold">API Connectors</span>
              <Badge variant="outline">{apiConnectors.length}</Badge>
            </div>
            {expandedSection === 'api' ? <ChevronDown className="w-4 h-4 text-[hsl(var(--text-secondary))]" /> : <ChevronRight className="w-4 h-4 text-[hsl(var(--text-secondary))]" />}
          </button>
          {expandedSection === 'api' && (
            <div className="mt-2 space-y-2 pl-2">
              {apiConnectors.length === 0 && (
                <p className="text-xs text-[hsl(var(--text-disabled))] px-4 py-2">No API connectors yet.</p>
              )}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {apiConnectors.map((c: any) => (
                <ApiConnectorCard
                  key={c.id}
                  connector={c}
                  onTest={() => testApiMutation.mutate(c.id)}
                  onDelete={() => { if (confirm(`Delete "${c.name}"?`)) deleteApiMutation.mutate(c.id); }}
                  onSelect={() => { setSelectedConnector(c); setView('api-detail'); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* DB Connectors section */}
        <div className="mb-6">
          <button
            onClick={() => setExpandedSection(expandedSection === 'db' ? null : 'db')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] hover:bg-[hsl(var(--surface-2))] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold">Database Connectors</span>
              <Badge variant="outline">{dbConnectors.length}</Badge>
            </div>
            {expandedSection === 'db' ? <ChevronDown className="w-4 h-4 text-[hsl(var(--text-secondary))]" /> : <ChevronRight className="w-4 h-4 text-[hsl(var(--text-secondary))]" />}
          </button>
          {expandedSection === 'db' && (
            <div className="mt-2 space-y-2 pl-2">
              {dbConnectors.length === 0 && (
                <p className="text-xs text-[hsl(var(--text-disabled))] px-4 py-2">No database connectors yet.</p>
              )}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {dbConnectors.map((c: any) => (
                <DbConnectorCard
                  key={c.id}
                  connector={c}
                  onTest={() => testDbMutation.mutate(c.id)}
                  onDelete={() => { if (confirm(`Delete "${c.name}"?`)) deleteDbMutation.mutate(c.id); }}
                  onSelect={() => { setSelectedConnector(c); setView('db-detail'); }}
                />
              ))}
            </div>
          )}
        </div>

        <FileConnectorSection />

        {/* Masking Rules */}
        <Separator className="mb-6" />
        <MaskingSection />
      </div>
    </div>
  );
}
