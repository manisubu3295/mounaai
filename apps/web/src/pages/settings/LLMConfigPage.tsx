import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { Zap, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getLlmConfig, getProviders, upsertLlmConfig, testLlmConfig } from '@/services/config.service';

interface LLMFormValues {
  provider_id: string;
  api_key: string;
  base_url: string;
  model: string;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
}

export function LLMConfigPage() {
  const [searchParams] = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === 'true';
  const qc = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'OK' | 'FAILED'; message?: string } | null>(null);

  const { data: providers = [] } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: getProviders,
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ['llm-config'],
    queryFn: getLlmConfig,
  });

  const { register, handleSubmit, control, watch, reset, formState: { isSubmitting, isDirty } } = useForm<LLMFormValues>({
    defaultValues: {
      provider_id: '',
      api_key: '',
      base_url: '',
      model: 'gemini-1.5-pro',
      temperature: 0.7,
      max_tokens: 2048,
      timeout_ms: 30000,
    },
  });

  const selectedProviderId = watch('provider_id');
  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  // Populate form when config loads
  useEffect(() => {
    if (config) {
      reset({
        provider_id: config.provider_id,
        api_key: '',
        base_url: config.base_url ?? '',
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        timeout_ms: config.timeout_ms ?? 30000,
      });
    } else if (providers.length > 0) {
      const gemini = providers.find((p) => p.name === 'gemini');
      if (gemini) reset((v) => ({ ...v, provider_id: gemini.id }));
    }
  }, [config, providers, reset]);

  const saveMutation = useMutation({
    mutationFn: (data: LLMFormValues) => {
      return upsertLlmConfig({
        provider_id: data.provider_id,
        api_key: data.api_key || undefined,
        base_url: data.base_url || null,
        model: data.model,
        temperature: Number(data.temperature),
        max_tokens: Number(data.max_tokens),
        timeout_ms: Number(data.timeout_ms),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-config'] });
      setTestResult(null);
      reset(undefined, { keepValues: true, keepDirty: false });
    },
  });

  const testMutation = useMutation({
    mutationFn: testLlmConfig,
    onSuccess: (result) => setTestResult(result),
    onError: () => setTestResult({ status: 'FAILED', message: 'Could not reach provider.' }),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--text-secondary))]" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[hsl(var(--text-primary))]">LLM Configuration</h1>
          {isOnboarding && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-[hsl(var(--accent)/0.1)] border border-[hsl(var(--accent)/0.3)] text-sm text-[hsl(var(--accent-hover))]">
              Welcome! Add your Gemini API key to activate your AI assistant.
            </div>
          )}
          {!isOnboarding && (
            <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
              Configure the AI provider that powers your assistant.
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-[hsl(var(--accent-hover))]" />
              Provider Settings
            </CardTitle>
            <CardDescription>
              {config
                ? `Active: ${selectedProvider?.name ?? 'Unknown'} · Model: ${config.model}`
                : 'No provider configured yet.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-5">
              {/* Provider */}
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <select
                  {...register('provider_id', { required: true })}
                  className="w-full h-9 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--text-primary))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] focus:border-transparent"
                >
                  <option value="">Select provider</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name.charAt(0).toUpperCase() + p.name.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <Label htmlFor="api_key">
                  API Key
                  {config && <span className="ml-1.5 text-[hsl(var(--text-disabled))]">(leave blank to keep existing)</span>}
                </Label>
                <div className="relative">
                  <Input
                    id="api_key"
                    type={showKey ? 'text' : 'password'}
                    placeholder={config ? '••••••••••••' : 'Enter your API key'}
                    className="pr-10"
                    {...register('api_key')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))]"
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Base URL override */}
              <div className="space-y-1.5">
                <Label htmlFor="base_url">
                  Base URL
                  <span className="ml-1.5 text-[hsl(var(--text-disabled))]">(optional override)</span>
                </Label>
                <Input
                  id="base_url"
                  type="url"
                  placeholder={selectedProvider?.default_url ?? 'https://...'}
                  {...register('base_url')}
                />
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="gemini-1.5-pro"
                  {...register('model', { required: true })}
                />
              </div>

              {/* Temperature + Max Tokens */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Temperature</Label>
                  <Controller
                    name="temperature"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={field.value}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          className="w-full accent-[hsl(var(--accent))]"
                        />
                        <p className="text-xs text-[hsl(var(--text-secondary))] text-right">{field.value}</p>
                      </div>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max_tokens">Max Tokens</Label>
                  <Input
                    id="max_tokens"
                    type="number"
                    min={256}
                    max={8192}
                    {...register('max_tokens', { min: 256, max: 8192 })}
                  />
                </div>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                  testResult.status === 'OK'
                    ? 'bg-[hsl(var(--success)/0.1)] border border-[hsl(var(--success)/0.3)] text-[hsl(var(--success))]'
                    : 'bg-[hsl(var(--error)/0.1)] border border-[hsl(var(--error)/0.3)] text-[hsl(var(--error))]'
                }`}>
                  {testResult.status === 'OK'
                    ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                  {testResult.status === 'OK' ? 'Connection successful' : (testResult.message ?? 'Connection failed')}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" loading={isSubmitting || saveMutation.isPending} disabled={!isDirty}>
                  Save Configuration
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => testMutation.mutate()}
                  loading={testMutation.isPending}
                  disabled={!config}
                >
                  Test Connection
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
