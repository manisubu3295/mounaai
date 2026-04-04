import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  FlaskConical, TrendingUp, TrendingDown, Minus,
  ArrowRight, AlertTriangle, Sparkles, RotateCcw,
  CheckCircle2, ShieldAlert, Lightbulb, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { runSimulation } from '@/services/simulate.service';
import type { SimulationResult, SimulationImpact, SimulationDirection } from '@pocketcomputer/shared-types';

// ── Scenario templates ────────────────────────────────────────────────────────

const TEMPLATES = [
  { emoji: '👥', label: 'Hire 2 more staff',          text: 'What if I hire 2 more staff members?' },
  { emoji: '📦', label: 'Cut stock in half',           text: 'What if I reduce my stock levels by 50%?' },
  { emoji: '💰', label: 'Drop prices by 10%',          text: 'What if I reduce my prices by 10%?' },
  { emoji: '📣', label: 'Double marketing spend',      text: 'What if I double my marketing budget?' },
  { emoji: '🏪', label: 'Open a second location',      text: 'What if I open a second store location?' },
  { emoji: '⏰', label: 'Extend opening hours',        text: 'What if I extend my business hours by 2 hours each day?' },
  { emoji: '🔧', label: 'Stop one product line',       text: 'What if I stop selling my lowest-selling product line?' },
  { emoji: '🤝', label: 'Add a delivery service',      text: 'What if I start offering home delivery?' },
];

// ── Visual helpers ────────────────────────────────────────────────────────────

function impactConfig(impact: SimulationImpact) {
  const map = {
    positive:  { label: 'Looks Good',    color: 'text-[hsl(var(--success))]',  bg: 'bg-[hsl(var(--success)/0.1)]  border-[hsl(var(--success)/0.25)]', icon: ThumbsUp },
    negative:  { label: 'Watch Out',     color: 'text-[hsl(var(--error))]',    bg: 'bg-[hsl(var(--error)/0.1)]    border-[hsl(var(--error)/0.25)]',   icon: ThumbsDown },
    neutral:   { label: 'Roughly Even',  color: 'text-[hsl(var(--text-secondary))]', bg: 'bg-[hsl(var(--surface-2))]    border-[hsl(var(--border))]',       icon: Minus },
    mixed:     { label: 'Mixed Results', color: 'text-[hsl(var(--warning))]',  bg: 'bg-[hsl(var(--warning)/0.1)]  border-[hsl(var(--warning)/0.25)]', icon: AlertTriangle },
  };
  return map[impact] ?? map.neutral;
}

function DirectionIcon({ d, size = 'sm' }: { d: SimulationDirection; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  if (d === 'up')   return <TrendingUp   className={cn(cls, 'text-[hsl(var(--success))]')} />;
  if (d === 'down') return <TrendingDown className={cn(cls, 'text-[hsl(var(--error))]')} />;
  return <Minus className={cn(cls, 'text-[hsl(var(--text-disabled))]')} />;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-[hsl(var(--success))]' : pct >= 45 ? 'bg-[hsl(var(--warning))]' : 'bg-[hsl(var(--error))]';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[hsl(var(--surface-2))] rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] font-semibold text-[hsl(var(--text-secondary))] tabular-nums w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

// ── Result display ────────────────────────────────────────────────────────────

function SimulationResultView({
  result,
  onReset,
}: {
  result: SimulationResult;
  onReset: () => void;
}) {
  const impact = impactConfig(result.overall_impact);
  const ImpactIcon = impact.icon;

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Impact banner ────────────────────────────────────── */}
      <div className={cn('rounded-lg border px-5 py-4 flex items-start gap-4', impact.bg)}>
        <div className={cn('w-9 h-9 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5', impact.bg)}>
          <ImpactIcon className={cn('w-4.5 h-4.5', impact.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[13px] font-bold', impact.color)}>{impact.label}</span>
            <span className="text-[12px] text-[hsl(var(--text-disabled))]">·</span>
            <span className="text-[12px] text-[hsl(var(--text-secondary))]">AI confidence</span>
            <ConfidenceBar value={result.confidence} />
          </div>
          <p className="text-[13px] text-[hsl(var(--text-secondary))] mt-1 italic">
            "{result.scenario_plain}"
          </p>
        </div>
      </div>

      {/* ── Summary + headline ───────────────────────────────── */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-5 py-4 space-y-2">
        <p className="label-eyebrow">30-day prediction</p>
        <p className="text-[15px] font-semibold text-[hsl(var(--text-primary))] leading-snug">
          {result.month_headline}
        </p>
        <p className="text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed">
          {result.summary}
        </p>
        {!result.has_live_data && (
          <p className="text-[11.5px] text-[hsl(var(--warning))] mt-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            No live data connected — this prediction uses general business knowledge. Connect your data for a more accurate simulation.
          </p>
        )}
      </div>

      {/* ── Week-by-week timeline ────────────────────────────── */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <p className="label-eyebrow">Week by week</p>
        </div>
        <div className="divide-y divide-[hsl(var(--border))]">
          {result.weeks.map((week) => (
            <div key={week.week} className="flex items-start gap-4 px-5 py-3">
              {/* Week number + direction */}
              <div className="flex flex-col items-center gap-1 w-12 flex-shrink-0 pt-0.5">
                <span className="text-[11px] font-bold text-[hsl(var(--text-disabled))] uppercase tracking-wider">
                  Wk {week.week}
                </span>
                <DirectionIcon d={week.direction} />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[hsl(var(--text-primary))] leading-snug">
                    {week.headline}
                  </p>
                  {week.key_metric && (
                    <span className={cn(
                      'text-[12px] font-bold tabular-nums flex-shrink-0',
                      week.direction === 'up'   ? 'text-[hsl(var(--success))]' :
                      week.direction === 'down' ? 'text-[hsl(var(--error))]'   :
                      'text-[hsl(var(--text-secondary))]'
                    )}>
                      {week.key_metric}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[hsl(var(--text-secondary))] mt-0.5 leading-relaxed">
                  {week.dates} &nbsp;·&nbsp; {week.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Best / Worst case ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success)/0.07)] px-4 py-3">
          <p className="label-eyebrow mb-1.5 text-[hsl(var(--success))]">If it all goes well</p>
          <p className="text-[12.5px] text-[hsl(var(--text-primary))] leading-relaxed">{result.best_case}</p>
        </div>
        <div className="rounded-lg border border-[hsl(var(--error)/0.25)] bg-[hsl(var(--error)/0.07)] px-4 py-3">
          <p className="label-eyebrow mb-1.5 text-[hsl(var(--error))]">If things go wrong</p>
          <p className="text-[12.5px] text-[hsl(var(--text-primary))] leading-relaxed">{result.worst_case}</p>
        </div>
      </div>

      {/* ── Risks + Opportunities ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {result.risks.length > 0 && (
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3">
            <p className="label-eyebrow mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-[hsl(var(--error))]" />
              Things to watch out for
            </p>
            <ul className="space-y-1.5">
              {result.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-[hsl(var(--text-secondary))]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--error))] flex-shrink-0 mt-[5px]" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.opportunities.length > 0 && (
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3">
            <p className="label-eyebrow mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3 text-yellow-400" />
              Hidden opportunities
            </p>
            <ul className="space-y-1.5">
              {result.opportunities.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-[hsl(var(--text-secondary))]">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0 mt-[5px]" />
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Recommendation ──────────────────────────────────── */}
      <div className="rounded-lg border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.07)] px-5 py-4">
        <p className="label-eyebrow mb-1.5 flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-[hsl(var(--accent-hover))]" />
          What the AI recommends
        </p>
        <p className="text-[13.5px] text-[hsl(var(--text-primary))] leading-relaxed font-medium">
          {result.recommendation}
        </p>
      </div>

      {/* ── Data basis ──────────────────────────────────────── */}
      <p className="text-[11.5px] text-[hsl(var(--text-disabled))] px-1 leading-relaxed">
        <span className="font-semibold">Based on:</span> {result.data_basis}
      </p>

      {/* ── Reset button ────────────────────────────────────── */}
      <div className="pt-1">
        <Button variant="secondary" onClick={onReset} className="gap-2">
          <RotateCcw className="w-3.5 h-3.5" />
          Try a different scenario
        </Button>
      </div>

    </div>
  );
}

// ── Loading state ─────────────────────────────────────────────────────────────

function SimulationLoader() {
  const steps = [
    'Reading your business data…',
    'Thinking through the change…',
    'Calculating week-by-week impact…',
    'Writing up the prediction…',
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-6 py-10 text-center space-y-4">
      <div className="flex items-center justify-center gap-2">
        <FlaskConical className="w-5 h-5 text-[hsl(var(--accent-hover))] animate-pulse" />
        <span className="text-[14px] font-semibold text-[hsl(var(--text-primary))]">
          Running your simulation…
        </span>
      </div>
      <p className="text-[13px] text-[hsl(var(--text-secondary))]">
        {steps[step]}
      </p>
      <div className="flex justify-center gap-1.5 pt-1">
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all duration-500',
              i === step
                ? 'w-6 bg-[hsl(var(--accent))]'
                : 'w-1.5 bg-[hsl(var(--border-strong))]'
            )}
          />
        ))}
      </div>
      <p className="text-[11.5px] text-[hsl(var(--text-disabled))]">
        This usually takes 20–40 seconds. The AI is reading your data and running the scenario.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SimulatePage() {
  const [scenario, setScenario] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mutation = useMutation({
    mutationFn: runSimulation,
    onSuccess: (data) => setResult(data),
  });

  const handleSubmit = () => {
    const trimmed = scenario.trim();
    if (trimmed.length < 5) return;
    mutation.mutate(trimmed);
  };

  const handleTemplate = (text: string) => {
    setScenario(text);
    textareaRef.current?.focus();
  };

  const handleReset = () => {
    setResult(null);
    setScenario('');
    mutation.reset();
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-7 space-y-5">

        {/* ── Header ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-md bg-[hsl(var(--accent)/0.12)] border border-[hsl(var(--accent)/0.25)] flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-[hsl(var(--accent-hover))]" />
            </div>
            <h1 className="text-[18px] font-semibold text-[hsl(var(--text-primary))] tracking-tight">
              What-If Simulator
            </h1>
          </div>
          <p className="text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed">
            Describe a business change you're thinking about. The AI will read your live data and tell you what would likely happen over the next 30 days — week by week.
          </p>
        </div>

        {/* ── Input area (hidden when result is shown) ────────── */}
        {!result && !mutation.isPending && (
          <div className="space-y-3">
            {/* Quick templates */}
            <p className="label-eyebrow">Quick scenarios — click to use</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TEMPLATES.map(({ emoji, label, text }) => (
                <button
                  key={label}
                  onClick={() => handleTemplate(text)}
                  className={cn(
                    'flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border text-left transition-colors text-[12px]',
                    scenario === text
                      ? 'border-[hsl(var(--accent)/0.6)] bg-[hsl(var(--accent)/0.08)] text-[hsl(var(--text-primary))]'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--border-strong))] hover:text-[hsl(var(--text-primary))]'
                  )}
                >
                  <span className="text-[16px] leading-none">{emoji}</span>
                  <span className="leading-snug">{label}</span>
                </button>
              ))}
            </div>

            {/* Freeform input */}
            <div className="space-y-2">
              <p className="label-eyebrow">Or describe your own scenario</p>
              <div className="relative">
                <div className="absolute left-3 top-3 text-[hsl(var(--text-disabled))] pointer-events-none">
                  <Sparkles className="w-4 h-4" />
                </div>
                <textarea
                  ref={textareaRef}
                  rows={3}
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
                  }}
                  placeholder="e.g. What if I increase my staff by 3 people and move to a bigger shop?"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[13px] text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-disabled))] resize-none outline-none focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent)/0.2)] transition-colors"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11.5px] text-[hsl(var(--text-disabled))]">
                  Tip: be specific. "Hire 2 staff for ₹25k/month each" gives a better prediction than "hire more staff".
                </p>
                <Button
                  onClick={handleSubmit}
                  disabled={scenario.trim().length < 5}
                  className="gap-2 flex-shrink-0"
                >
                  <FlaskConical className="w-4 h-4" />
                  Simulate
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Error state ─────────────────────────────────────── */}
        {mutation.isError && (
          <div className="rounded-lg border border-[hsl(var(--error)/0.3)] bg-[hsl(var(--error)/0.08)] px-4 py-3 space-y-2">
            <p className="text-[13px] font-semibold text-[hsl(var(--error))]">Simulation failed</p>
            <p className="text-[12.5px] text-[hsl(var(--text-secondary))]">
              {(mutation.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? (mutation.error as Error)?.message ?? 'Something went wrong. Please try again.'}
            </p>
            <Button variant="secondary" size="sm" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Try again
            </Button>
          </div>
        )}

        {/* ── Loading ──────────────────────────────────────────── */}
        {mutation.isPending && <SimulationLoader />}

        {/* ── Result ──────────────────────────────────────────── */}
        {result && (
          <SimulationResultView result={result} onReset={handleReset} />
        )}

      </div>
    </div>
  );
}
