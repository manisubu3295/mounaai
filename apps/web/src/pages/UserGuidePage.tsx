import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Lightbulb, ClipboardList, FlaskConical,
  MessageSquare, Bell, Database, Target, GitBranch,
  Mail, ChevronRight, CheckCircle2, AlertTriangle,
  Info, PlayCircle, Zap, BookOpen, ChevronDown, ChevronUp,
  Globe, FileText, LogIn, HelpCircle, TrendingUp,
} from 'lucide-react';

// ── Simple callout boxes ──────────────────────────────────────────────────────

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 rounded-xl bg-[hsl(var(--accent)/0.08)] border border-[hsl(var(--accent)/0.2)] my-4">
      <Lightbulb className="w-4 h-4 text-[hsl(var(--accent))] flex-shrink-0 mt-0.5" />
      <p className="text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed">{children}</p>
    </div>
  );
}

function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 rounded-xl bg-[hsl(var(--warning)/0.08)] border border-[hsl(var(--warning)/0.2)] my-4">
      <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))] flex-shrink-0 mt-0.5" />
      <p className="text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed">{children}</p>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 rounded-xl bg-blue-500/[0.07] border border-blue-500/20 my-4">
      <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
      <p className="text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed">{children}</p>
    </div>
  );
}

// ── Numbered step ─────────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-5">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[hsl(var(--accent))] text-white flex items-center justify-center text-[12px] font-bold mt-0.5">
        {n}
      </div>
      <div className="flex-1">
        <p className="text-[13.5px] font-semibold text-[hsl(var(--text-primary))] mb-1">{title}</p>
        <p className="text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// ── Screen mockup wrapper ─────────────────────────────────────────────────────

function ScreenMock({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="my-5 rounded-xl border border-[hsl(var(--border))] overflow-hidden shadow-sm">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-[hsl(var(--surface-2))] border-b border-[hsl(var(--border))]">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
        {label && <span className="ml-3 text-[11px] text-[hsl(var(--text-disabled))] font-mono">{label}</span>}
      </div>
      <div className="bg-[hsl(var(--background))] p-4">{children}</div>
    </div>
  );
}

// ── Card mini mockup ──────────────────────────────────────────────────────────

function MockCard({ title, value, sub, color }: { title: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3 flex-1 min-w-0">
      <p className="text-[10px] text-[hsl(var(--text-disabled))] uppercase tracking-wide mb-1">{title}</p>
      <p className={cn('text-[18px] font-bold', color)}>{value}</p>
      <p className="text-[10px] text-[hsl(var(--text-secondary))] mt-0.5">{sub}</p>
    </div>
  );
}

// ── Badge mini ────────────────────────────────────────────────────────────────

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border', color)}>
      {label}
    </span>
  );
}

// ── Collapsible FAQ item ──────────────────────────────────────────────────────

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[hsl(var(--surface-2))] transition-colors text-left"
      >
        <span className="text-[13.5px] font-medium text-[hsl(var(--text-primary))]">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-[hsl(var(--text-disabled))] flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-[hsl(var(--text-disabled))] flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed border-t border-[hsl(var(--border))] pt-3 bg-[hsl(var(--surface))]">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({
  id, icon: Icon, title, sub, color,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  sub: string;
  color: string;
}) {
  return (
    <div id={id} className="flex items-start gap-4 pt-10 pb-4 border-b border-[hsl(var(--border))] mb-6">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h2 className="text-[18px] font-bold text-[hsl(var(--text-primary))] leading-tight">{title}</h2>
        <p className="text-[13px] text-[hsl(var(--text-secondary))] mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ── TOC link ──────────────────────────────────────────────────────────────────

function TocItem({ href, label, icon: Icon, color }: { href: string; label: string; icon: React.ElementType; color: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[hsl(var(--surface-2))] transition-colors group"
    >
      <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="text-[13px] text-[hsl(var(--text-secondary))] group-hover:text-[hsl(var(--text-primary))] transition-colors">{label}</span>
      <ChevronRight className="w-3 h-3 text-[hsl(var(--text-disabled))] ml-auto flex-shrink-0 group-hover:text-[hsl(var(--text-secondary))] transition-colors" />
    </a>
  );
}

// ── Main guide page ────────────────────────────────────────────────────────────

export function UserGuidePage() {
  return (
    <div className="flex-1 overflow-y-auto bg-[hsl(var(--background))]">
      <div className="max-w-3xl mx-auto px-6 py-8 pb-20">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-gradient-to-br from-[hsl(var(--accent)/0.15)] to-[hsl(var(--accent)/0.04)] border border-[hsl(var(--accent)/0.2)] p-8 mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--accent))] flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-[24px] font-bold text-[hsl(var(--text-primary))] mb-2">Mouna AI — User Guide</h1>
          <p className="text-[14px] text-[hsl(var(--text-secondary))] max-w-lg mx-auto leading-relaxed">
            Welcome! This guide walks you through every feature in plain English — no technical knowledge needed.
            Read it from top to bottom or jump straight to any section.
          </p>
        </div>

        {/* ── Table of Contents ────────────────────────────────────── */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 mb-8">
          <p className="text-[12px] font-semibold text-[hsl(var(--text-disabled))] uppercase tracking-widest mb-3">Contents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
            <TocItem href="#getting-started"   label="Getting Started"         icon={LogIn}            color="bg-emerald-500" />
            <TocItem href="#home"              label="Home (Dashboard)"        icon={LayoutDashboard}  color="bg-[hsl(var(--accent))]" />
            <TocItem href="#insights"          label="What AI Found"           icon={Lightbulb}        color="bg-yellow-500" />
            <TocItem href="#decisions"         label="Actions To Take"         icon={ClipboardList}    color="bg-purple-500" />
            <TocItem href="#simulate"          label="Simulate"                icon={FlaskConical}     color="bg-teal-500" />
            <TocItem href="#chat"              label="Ask AI"                  icon={MessageSquare}    color="bg-sky-500" />
            <TocItem href="#alerts"            label="Alerts"                  icon={Bell}             color="bg-red-500" />
            <TocItem href="#connectors"        label="Connectors (Data Setup)" icon={Database}         color="bg-indigo-500" />
            <TocItem href="#kpis"              label="KPIs (Goals)"            icon={Target}           color="bg-orange-500" />
            <TocItem href="#rules"             label="Business Rules"          icon={GitBranch}        color="bg-pink-500" />
            <TocItem href="#communication"     label="Email Notifications"     icon={Mail}             color="bg-green-500" />
            <TocItem href="#faq"               label="FAQ"                     icon={HelpCircle}       color="bg-[hsl(var(--text-secondary))]" />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 1 — GETTING STARTED
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="getting-started"
          icon={LogIn}
          title="Getting Started"
          sub="How to log in and understand the layout"
          color="bg-emerald-500"
        />

        <p className="text-[13.5px] text-[hsl(var(--text-secondary))] leading-relaxed mb-5">
          Mouna AI is your business assistant. It connects to your data (sales systems, spreadsheets, databases),
          reads it automatically every day, and tells you what's going well, what you need to fix, and what decisions to make.
          Think of it as a smart advisor that never sleeps.
        </p>

        <Step n={1} title="Open the login page">
          Go to your company's Mouna AI web address. You will see a simple sign-in form asking for your email and password.
        </Step>
        <Step n={2} title="Enter your credentials">
          Type the email and password that your administrator gave you. Click <strong>Sign In</strong>.
        </Step>
        <Step n={3} title="You land on the Home page">
          After logging in you are taken to the <strong>Home</strong> dashboard. This is your control centre.
        </Step>

        <InfoBox>
          If you forget your password, ask your company administrator to reset it — there is no self-service password reset at this time.
        </InfoBox>

        {/* Layout overview */}
        <h3 className="text-[15px] font-semibold text-[hsl(var(--text-primary))] mt-7 mb-3">Understanding the layout</h3>

        <ScreenMock label="Main layout">
          <div className="flex gap-3 min-h-[120px]">
            {/* Sidebar mockup */}
            <div className="w-[130px] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-2 flex flex-col gap-1 flex-shrink-0">
              <div className="flex items-center gap-1.5 px-1 mb-1">
                <div className="w-5 h-5 rounded-md bg-[hsl(var(--accent))]" />
                <span className="text-[10px] font-bold text-[hsl(var(--text-primary))]">Mouna AI</span>
              </div>
              {['Home','What AI Found','Actions','Simulate','Ask AI','Alerts'].map(l => (
                <div key={l} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[hsl(var(--surface-2))]">
                  <div className="w-2 h-2 rounded-sm bg-[hsl(var(--accent)/0.5)]" />
                  <span className="text-[9px] text-[hsl(var(--text-secondary))]">{l}</span>
                </div>
              ))}
              <div className="flex-1" />
              <div className="flex items-center gap-1 px-1 mt-1">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[hsl(var(--accent)/0.9)] to-blue-400" />
                <div>
                  <div className="w-14 h-1.5 bg-[hsl(var(--surface-3))] rounded mb-0.5" />
                  <div className="w-10 h-1 bg-[hsl(var(--surface-3))] rounded" />
                </div>
              </div>
            </div>
            {/* Main content mockup */}
            <div className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3 flex flex-col gap-2">
              <div className="w-32 h-4 bg-[hsl(var(--surface-2))] rounded" />
              <div className="grid grid-cols-3 gap-2 mt-1">
                {['green','orange','red'].map(c => (
                  <div key={c} className="h-12 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]" />
                ))}
              </div>
              <div className="w-full h-16 rounded-lg bg-[hsl(var(--surface-2))] mt-1" />
            </div>
          </div>
        </ScreenMock>

        <div className="space-y-3 mb-4">
          {[
            { label: 'Sidebar (left panel)', desc: 'Your navigation menu. Click any item to go to that section.' },
            { label: 'Main area (right)', desc: "This is where each page's content appears." },
            { label: 'Your avatar (bottom-left)', desc: 'Click it to open a menu with Profile and Log Out options.' },
            { label: 'Sun/Moon icon (bottom-left)', desc: 'Toggles between light and dark mode.' },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))] flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-[hsl(var(--text-secondary))]"><strong className="text-[hsl(var(--text-primary))]">{label}</strong> — {desc}</p>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 2 — HOME DASHBOARD
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="home"
          icon={LayoutDashboard}
          title="Home (Dashboard)"
          sub="Your daily command centre — see everything at a glance"
          color="bg-[hsl(var(--accent))]"
        />

        <p className="text-[13.5px] text-[hsl(var(--text-secondary))] leading-relaxed mb-5">
          The Home page is the first thing you see when you log in. It shows a summary of recent AI checks,
          pending actions, and key numbers — all in one place.
        </p>

        <ScreenMock label="/dashboard">
          <div className="space-y-3">
            {/* Stat row */}
            <div className="flex gap-2">
              <MockCard title="AI Checks Done"   value="12"  sub="Since you started"        color="text-[hsl(var(--accent))]" />
              <MockCard title="Things Found"     value="7"   sub="Insights waiting"          color="text-yellow-400" />
              <MockCard title="Actions to Take"  value="3"   sub="Need your decision"        color="text-purple-400" />
            </div>
            {/* Run button */}
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
              <div className="w-7 h-7 rounded-lg bg-[hsl(var(--accent))] flex items-center justify-center">
                <PlayCircle className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-[hsl(var(--text-primary))]">Run AI Check Now</p>
                <p className="text-[10px] text-[hsl(var(--text-secondary))]">Analyse all your data right now</p>
              </div>
              <Pill label="Go" color="bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))] border-[hsl(var(--accent)/0.3)]" />
            </div>
            {/* Recent runs */}
            <div className="rounded-lg border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
              {[
                { time: '2 hours ago', status: 'Completed', color: 'text-emerald-400' },
                { time: 'Yesterday',   status: 'Completed', color: 'text-emerald-400' },
                { time: '2 days ago',  status: 'Completed', color: 'text-emerald-400' },
              ].map(r => (
                <div key={r.time} className="flex items-center justify-between px-3 py-2">
                  <span className="text-[11px] text-[hsl(var(--text-secondary))]">{r.time}</span>
                  <span className={cn('text-[10px] font-semibold', r.color)}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        </ScreenMock>

        <h3 className="text-[15px] font-semibold text-[hsl(var(--text-primary))] mt-6 mb-3">How to use it</h3>
        <Step n={1} title="Run an AI Check">
          Click the big <strong>Run AI Check Now</strong> button. Mouna AI will fetch your latest data from all connected sources and analyse it. This takes about 30–60 seconds.
        </Step>
        <Step n={2} title="See the summary numbers">
          The three cards at the top show: how many times the AI has run, how many findings are waiting, and how many actions need your decision.
        </Step>
        <Step n={3} title="Check recent runs">
          Below the stats is a list of previous AI checks with their status. Click any row to see exactly what was found in that run.
        </Step>

        <TipBox>
          The AI runs automatically every day at a scheduled time. You don't have to do anything — just check in each morning to see what's new.
        </TipBox>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 3 — INSIGHTS
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="insights"
          icon={Lightbulb}
          title="What AI Found (Insights)"
          sub="Plain-English findings from your business data"
          color="bg-yellow-500"
        />

        <p className="text-[13.5px] text-[hsl(var(--text-secondary))] leading-relaxed mb-5">
          After each AI check, Mouna AI writes a list of things it noticed in your data. These are called
          <strong> Insights</strong>. Think of them as a report card written in plain English — not charts or
          spreadsheets, just sentences like "Your stock of Product X is getting low" or "Sales this week are 20% higher than usual."
        </p>

        <ScreenMock label="/insights">
          <div className="space-y-2.5">
            {[
              {
                badge: 'Must Know', badgeColor: 'bg-red-500/10 text-red-400 border-red-500/20',
                title: 'Stock for Product A is critically low (3 units left)',
                desc:  'At the current sales rate you will run out in 2 days.',
                type:  'Risk',
              },
              {
                badge: 'Watch Out', badgeColor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                title: 'Cart abandonment rate is 34% — higher than last month',
                desc:  'Customers are adding items but not completing purchase.',
                type:  'Watch',
              },
              {
                badge: 'Good to Know', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                title: 'Overall sales are up 12% compared to last week',
                desc:  'Product B is driving most of the growth.',
                type:  'Opportunity',
              },
            ].map(i => (
              <div key={i.title} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Pill label={i.badge} color={i.badgeColor} />
                  <Pill label={i.type}  color="bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))] border-[hsl(var(--border))]" />
                </div>
                <p className="text-[12px] font-semibold text-[hsl(var(--text-primary))] mb-0.5">{i.title}</p>
                <p className="text-[11px] text-[hsl(var(--text-secondary))]">{i.desc}</p>
              </div>
            ))}
          </div>
        </ScreenMock>

        <h3 className="text-[15px] font-semibold text-[hsl(var(--text-primary))] mt-6 mb-3">Understanding the labels</h3>

        <div className="overflow-hidden rounded-xl border border-[hsl(var(--border))] mb-5">
          {[
            { badge: 'Must Know', badgeColor: 'bg-red-500/10 text-red-400 border-red-500/20', desc: 'Something serious needs attention today. Do not ignore these.' },
            { badge: 'Watch Out', badgeColor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', desc: 'Not urgent, but keep an eye on it this week.' },
            { badge: 'Good to Know', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20', desc: 'Useful background information — no action needed.' },
          ].map((row, i) => (
            <div key={row.badge} className={cn('flex items-start gap-3 px-4 py-3', i > 0 && 'border-t border-[hsl(var(--border))]')}>
              <Pill label={row.badge} color={row.badgeColor} />
              <p className="text-[12.5px] text-[hsl(var(--text-secondary))]">{row.desc}</p>
            </div>
          ))}
        </div>

        <TipBox>
          Use the <strong>Monthly</strong> and <strong>Quarterly</strong> tabs to see insights grouped by time period — great for spotting trends over months.
        </TipBox>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 4 — DECISIONS
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="decisions"
          icon={ClipboardList}
          title="Actions to Take (Decisions)"
          sub="The AI's suggested actions — you approve or reject each one"
          color="bg-purple-500"
        />

        <p className="text-[13.5px] text-[hsl(var(--text-secondary))] leading-relaxed mb-5">
          When the AI finds something important, it won't act on its own — it creates an <strong>Action</strong> and
          waits for <em>you</em> to say yes or no. This keeps you in control at all times.
        </p>

        <ScreenMock label="/decisions">
          <div className="space-y-2.5">
            {[
              {
                urgency: 'Do Now',   urgencyColor: 'bg-red-400/10 text-red-400 border-red-400/20',
                status:  'Needs Your Answer', statusColor: 'text-amber-400',
                title:  'Reorder Product A — stock is critically low',
                desc:   'Stock has dropped to 3 units. Suggested action: place a reorder for 50 units.',
              },
              {
                urgency: 'Do Soon',  urgencyColor: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
                status:  'New',      statusColor: 'text-blue-400',
                title:  'Review pricing on Product C',
                desc:   'Competitor price dropped 8% — you may be losing sales.',
              },
            ].map(d => (
              <div key={d.title} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Pill label={d.urgency} color={d.urgencyColor} />
                  <span className={cn('text-[10px] font-semibold', d.statusColor)}>{d.status}</span>
                </div>
                <p className="text-[12px] font-semibold text-[hsl(var(--text-primary))] mb-0.5">{d.title}</p>
                <p className="text-[11px] text-[hsl(var(--text-secondary))] mb-2">{d.desc}</p>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-semibold">Yes, do it</span>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                    <span className="text-[10px] text-red-400 font-semibold">No, skip</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScreenMock>

        <h3 className="text-[15px] font-semibold text-[hsl(var(--text-primary))] mt-6 mb-3">How to respond to actions</h3>
        <Step n={1} title="Open the Actions to Take page">
          Click <strong>Actions to Take</strong> in the left menu.
        </Step>
        <Step n={2} title="Read each action card">
          Each card shows what the AI wants to do and why. Read the description carefully.
        </Step>
        <Step n={3} title="Click Yes or No">
          Click <strong>Yes, do it</strong> (green) to approve, or <strong>No, skip</strong> (red) to reject. You can also add a note explaining your decision.
        </Step>

        <div className="overflow-hidden rounded-xl border border-[hsl(var(--border))] mb-5 mt-4">
          <div className="px-4 py-2 bg-[hsl(var(--surface-2))] border-b border-[hsl(var(--border))]">
            <p className="text-[11px] font-semibold text-[hsl(var(--text-disabled))] uppercase tracking-wide">Urgency levels explained</p>
          </div>
          {[
            { label: 'Do Now',     color: 'text-red-400',    desc: 'Act today — delay will cost you.' },
            { label: 'Do Soon',    color: 'text-orange-400', desc: 'Ideally this week.' },
            { label: 'Can Wait',   color: 'text-yellow-400', desc: 'Not urgent, do it when you have time.' },
            { label: 'Not Urgent', color: 'text-green-400',  desc: 'Low priority — informational only.' },
          ].map((row, i) => (
            <div key={row.label} className={cn('flex items-center gap-3 px-4 py-2.5', i > 0 && 'border-t border-[hsl(var(--border))]')}>
              <span className={cn('w-20 text-[12px] font-semibold', row.color)}>{row.label}</span>
              <p className="text-[12.5px] text-[hsl(var(--text-secondary))]">{row.desc}</p>
            </div>
          ))}
        </div>

        <WarnBox>
          Actions marked <strong>Needs Your Answer</strong> are waiting for you. The AI will not do anything until you respond — so check this page regularly.
        </WarnBox>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 5 — SIMULATE
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="simulate"
          icon={FlaskConical}
          title="Simulate"
          sub="Test 'what if' ideas before you commit to them"
          color="bg-teal-500"
        />

        <p className="text-[13.5px] text-[hsl(var(--text-secondary))] leading-relaxed mb-5">
          Simulate lets you ask "what would happen if…?" questions before you actually do anything.
          It's like a safe playground to test ideas — no real changes happen, it's all imaginary.
        </p>

        <ScreenMock label="/simulate">
          <div className="space-y-3">
            <p className="text-[11px] text-[hsl(var(--text-secondary))]">Try a quick scenario:</p>
            <div className="grid grid-cols-2 gap-2">
              {['👥 Hire 2 more staff', '📦 Cut stock in half', '💰 Drop prices by 10%', '📣 Double marketing'].map(t => (
                <div key={t} className="px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[11px] text-[hsl(var(--text-secondary))] cursor-pointer hover:border-[hsl(var(--accent)/0.4)]">
                  {t}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-[12px] font-semibold text-emerald-400">Looks Good</span>
                <span className="ml-auto text-[10px] text-[hsl(var(--text-disabled))]">Confidence 72%</span>
              </div>
              <p className="text-[11px] text-[hsl(var(--text-secondary))]">Adding 2 staff would reduce wait times by ~25% and likely increase customer satisfaction scores.</p>
            </div>
          </div>
        </ScreenMock>

        <Step n={1} title="Pick a ready-made scenario or type your own">
          Click one of the scenario buttons (e.g. "Hire 2 more staff") or type your own question in the text box.
        </Step>
        <Step n={2} title="Click Simulate">
          Press the <strong>Simulate</strong> button. In a few seconds the AI will respond.
        </Step>
        <Step n={3} title="Read the result">
          You'll see an overall verdict (Looks Good / Watch Out / Mixed Results) with a confidence percentage and a plain-English explanation.
        </Step>

        <TipBox>
          Don't like a scenario's result? Click <strong>Try Another</strong> to start fresh with a different question.
        </TipBox>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 6 — CHAT
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="chat"
          icon={MessageSquare}
          title="Ask AI (Chat)"
          sub="Have a conversation with your AI about your business"
          color="bg-sky-500"
        />

        <p className="text-[13.5px] text-[hsl(var(--text-secondary))] leading-relaxed mb-5">
          Ask AI is like having a business expert available 24/7. You can type any question about your business and
          get a thoughtful, data-aware answer. It knows your connected data, so answers are relevant to <em>your</em> situation.
        </p>

        <ScreenMock label="/chat">
          <div className="space-y-3">
            {[
              { from: 'you', text: 'Which products are selling fastest this month?' },
              { from: 'ai',  text: 'Based on your sales data, Product B is your fastest-moving item with 47 units sold this month — up 18% from last month. Product D is second with 31 units.' },
            ].map(m => (
              <div key={m.text} className={cn('max-w-[85%] px-3 py-2 rounded-xl text-[11px]',
                m.from === 'you'
                  ? 'ml-auto bg-[hsl(var(--accent))] text-white rounded-br-sm'
                  : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--text-primary))] rounded-bl-sm'
              )}>
                {m.text}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))]" />
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--accent))] flex items-center justify-center flex-shrink-0">
                <ChevronRight className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        </ScreenMock>

        <Step n={1} title='Click "Ask AI" in the sidebar'>
          You'll see a chat window — similar to WhatsApp or iMessage.
        </Step>
        <Step n={2} title="Type your question">
          Examples: "Why are sales down this week?", "What should I focus on today?", "Is my stock level healthy?"
        </Step>
        <Step n={3} title="Read the reply">
          The AI replies in plain English. You can ask follow-up questions in the same conversation.
        </Step>
        <Step n={4} title="Start a new conversation any time">
          Click the <strong>+</strong> button at the top of the conversations list to start a fresh chat.
        </Step>

        <InfoBox>
          Each conversation is saved. You can scroll back through old chats to find previous answers.
        </InfoBox>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 7 — ALERTS
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="alerts"
          icon={Bell}
          title="Alerts"
          sub="Notifications whenever something important happens"
          color="bg-red-500"
        />

        <p className="text-[13.5px] text-[hsl(var(--text-secondary))] leading-relaxed mb-5">
          The Alerts page collects every notification the AI has sent you — important findings, actions waiting for
          your response, completed checks, and any errors. A red dot on the bell icon means you have unread alerts.
        </p>

        <ScreenMock label="/notifications">
          <div className="space-y-2">
            {[
              { badge: 'Urgent Alert', badgeColor: 'bg-red-500/10 text-red-500 border-red-500/20', text: 'Stock for Product A is critically low — 3 units remaining', time: '2m ago', unread: true },
              { badge: 'Needs Your Answer', badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20', text: 'Action waiting: Reorder Product A?', time: '2m ago', unread: true },
              { badge: 'AI Check Done', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20', text: 'AI analysis completed — 4 new insights found', time: '1h ago', unread: false },
            ].map(n => (
              <div key={n.text} className={cn('flex items-start gap-3 px-3 py-2.5 rounded-lg border', n.unread ? 'border-[hsl(var(--accent)/0.25)] bg-[hsl(var(--accent)/0.04)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))]')}>
                {n.unread && <span className="w-2 h-2 rounded-full bg-[hsl(var(--accent))] flex-shrink-0 mt-1.5" />}
                {!n.unread && <span className="w-2 h-2 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Pill label={n.badge} color={n.badgeColor} />
                    <span className="text-[10px] text-[hsl(var(--text-disabled))]">{n.time}</span>
                  </div>
                  <p className="text-[11.5px] text-[hsl(var(--text-primary))]">{n.text}</p>
                </div>
              </div>
            ))}
          </div>
        </ScreenMock>

        <Step n={1} title="Click Alerts in the left menu">
          You'll see a list of recent notifications, newest first. Unread ones are highlighted with a blue left border.
        </Step>
        <Step n={2} title="Tap an alert to mark it as read">
          Clicking any alert marks it as read and the blue dot disappears.
        </Step>
        <Step n={3} title="Mark all as read">
          Click the <strong>Mark all read</strong> button at the top right to clear everything at once.
        </Step>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 8 — CONNECTORS
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="connectors"
          icon={Database}
          title="Connectors (Data Setup)"
          sub="Tell Mouna AI where your business data lives"
          color="bg-indigo-500"
        />

        <p className="text-[13.5px] text-[hsl(var(--text-secondary))] leading-relaxed mb-5">
          Before the AI can analyse anything, it needs to know where your data is. Connectors are the
          bridges between Mouna AI and your data sources — things like your sales system, database, or
          a spreadsheet/CSV file.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {[
            { icon: Globe,    color: 'bg-blue-500/10 border-blue-500/20 text-blue-400',    label: 'API Connector',      desc: 'Connect any web service (e.g. Shopify, WooCommerce, your own system).' },
            { icon: Database, color: 'bg-purple-500/10 border-purple-500/20 text-purple-400', label: 'Database Connector', desc: 'Connect directly to a PostgreSQL, MySQL or other database.' },
            { icon: FileText, color: 'bg-orange-500/10 border-orange-500/20 text-orange-400', label: 'File Connector',     desc: 'Upload a CSV or Excel file.' },
          ].map(({ icon: Icon, color, label, desc }) => (
            <div key={label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4">
              <div className={cn('w-9 h-9 rounded-lg border flex items-center justify-center mb-3', color)}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-[13px] font-semibold text-[hsl(var(--text-primary))] mb-1">{label}</p>
              <p className="text-[11.5px] text-[hsl(var(--text-secondary))] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-[15px] font-semibold text-[hsl(var(--text-primary))] mt-4 mb-3">How to add an API Connector</h3>
        <Step n={1} title="Go to Administration → Connectors">
          In the left sidebar, scroll to the Administration section and click <strong>Connectors</strong>. (Only admins can see this section.)
        </Step>
        <Step n={2} title='Click "Add API Connector"'>
          Fill in the name and the base URL of your system (e.g. <code className="text-[11px] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded">https://api.yourshop.com</code>).
        </Step>
        <Step n={3} title="Add your API key if needed">
          If your system requires a password/key to access, enable the <strong>Requires Auth</strong> option and paste your API key.
        </Step>
        <Step n={4} title='Click "Test Connection"'>
          The system will check the connection is working. You should see a green <strong>OK</strong> badge.
        </Step>
        <Step n={5} title="Add Endpoints">
          An Endpoint is a specific data point from your system. For example: <em>/products</em> to get your product list, or <em>/orders</em> to get sales. Add each one separately.
        </Step>

        <WarnBox>
          After adding connectors, run an AI Check from the Home page so the AI can read the new data for the first time.
        </WarnBox>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 9 — KPIs
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="kpis"
          icon={Target}
          title="KPIs (Goals & Targets)"
          sub="Set the numbers your business is aiming for"
          color="bg-orange-500"
        />

        <p className="text-[13.5px] text-[hsl(var(--text-secondary))] leading-relaxed mb-5">
          A KPI (Key Performance Indicator) is a goal you set for your business — like "I want monthly sales
          above £10,000" or "Stock should never drop below 20 units." Mouna AI watches these numbers and
          alerts you when they go off-track.
        </p>

        <ScreenMock label="/settings/kpis">
          <div className="space-y-2.5">
            {[
              { name: 'Monthly Sales Target', value: '£12,450 / £15,000', bar: 83, color: 'bg-emerald-400' },
              { name: 'Stock — Product A',    value: '3 / 20 min',         bar: 15, color: 'bg-red-400' },
              { name: 'Customer Rating',      value: '4.2 / 4.5 target',   bar: 93, color: 'bg-emerald-400' },
            ].map(k => (
              <div key={k.name} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[12px] font-semibold text-[hsl(var(--text-primary))]">{k.name}</p>
                  <p className="text-[11px] text-[hsl(var(--text-secondary))]">{k.value}</p>
                </div>
                <div className="h-1.5 w-full bg-[hsl(var(--surface-2))] rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', k.color)} style={{ width: `${k.bar}%` }} />
                </div>
              </div>
            ))}
          </div>
        </ScreenMock>

        <h3 className="text-[15px] font-semibold text-[hsl(var(--text-primary))] mt-6 mb-3">How to create a KPI</h3>
        <Step n={1} title="Go to Administration → KPIs">
          Admins only. Click <strong>KPIs</strong> in the Administration section of the sidebar.
        </Step>
        <Step n={2} title='Click "Add KPI"'>
          Fill in:
          <ul className="mt-1 ml-4 space-y-1 list-disc">
            <li><strong>Name</strong> — e.g. "Monthly Sales"</li>
            <li><strong>Unit</strong> — e.g. "£" or "units" or "%"</li>
            <li><strong>Target</strong> — the number you want to reach</li>
            <li><strong>Warning</strong> — alert me when below this number</li>
            <li><strong>Critical</strong> — very bad if below this number</li>
          </ul>
        </Step>
        <Step n={3} title="Save and let the AI track it automatically">
          From now on, every AI check will measure this KPI and flag it if it's off-track.
        </Step>

        <InfoBox>
          You don't have to set all three numbers (Target, Warning, Critical). Even just a Target is useful.
        </InfoBox>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 10 — BUSINESS RULES
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="rules"
          icon={GitBranch}
          title="Business Rules"
          sub="Automate decisions with 'if this happens, then do that' logic"
          color="bg-pink-500"
        />

        <p className="text-[13.5px] text-[hsl(var(--text-secondary))] leading-relaxed mb-5">
          Business Rules let you set automatic triggers. For example: <em>"If stock of Product A drops below 10,
          automatically create an action to reorder it."</em> You write the rule once and the AI applies it
          every time it analyses your data.
        </p>

        <ScreenMock label="/settings/rules">
          <div className="space-y-3">
            {/* Rule example */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-pink-400" />
                  <p className="text-[12px] font-semibold text-[hsl(var(--text-primary))]">Low Stock Alert</p>
                </div>
                <Pill label="Active" color="bg-emerald-500/10 text-emerald-400 border-emerald-500/20" />
              </div>
              <div className="rounded-lg bg-[hsl(var(--surface-2))] p-2.5 text-[11px] text-[hsl(var(--text-secondary))] font-mono space-y-1">
                <div><span className="text-pink-400">WHEN</span> SalesData.Products.stock <span className="text-yellow-400">&lt;</span> 10</div>
                <div><span className="text-blue-400">THEN</span> Create action: "Reorder stock"</div>
              </div>
            </div>
          </div>
        </ScreenMock>

        <h3 className="text-[15px] font-semibold text-[hsl(var(--text-primary))] mt-6 mb-3">How to create a rule</h3>
        <Step n={1} title="Go to Administration → Business Rules">
          Click <strong>Business Rules</strong> in the Administration section.
        </Step>
        <Step n={2} title='Click "New Rule"'>
          Give the rule a clear name, e.g. "Low Stock Alert" or "Sales Drop Warning."
        </Step>
        <Step n={3} title="Set the WHEN condition">
          Use the <strong>Field</strong> dropdown to pick a data point from your connected systems
          (e.g. <code className="text-[11px] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded">SalesAPI.Products.stock</code>),
          then choose a comparison like <em>"less than"</em> and enter a value like <code className="text-[11px] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded">10</code>.
        </Step>
        <Step n={4} title="Set the THEN action">
          Choose what should happen: usually <strong>Create Decision</strong> which creates an action card on the Actions page for you to approve.
        </Step>
        <Step n={5} title="Save and turn it on">
          Save the rule and make sure the toggle shows <strong>Active</strong>. It will run automatically on the next AI check.
        </Step>

        <TipBox>
          Start with simple rules (one condition). You can always add more conditions later. A rule with too many conditions can be hard to understand.
        </TipBox>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 11 — COMMUNICATION
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="communication"
          icon={Mail}
          title="Email Notifications"
          sub="Get emailed when something important happens"
          color="bg-green-500"
        />

        <p className="text-[13.5px] text-[hsl(var(--text-secondary))] leading-relaxed mb-5">
          Mouna AI can send you an email whenever a business rule triggers, a new action needs your decision,
          or a data connection has a problem. You control which emails you receive.
        </p>

        <Step n={1} title="Go to Administration → Communication">
          Click <strong>Communication</strong> in the Administration section of the sidebar.
        </Step>
        <Step n={2} title="Enter your email address">
          Type the email address where you want to receive alerts.
        </Step>
        <Step n={3} title="Turn on the types of emails you want">
          There are three toggles:
          <ul className="mt-1 ml-4 space-y-1 list-disc">
            <li><strong>Rule Triggered</strong> — email when a business rule fires</li>
            <li><strong>Action Needs Approval</strong> — email when the AI needs your decision</li>
            <li><strong>Data Problem</strong> — email when a connector has an error</li>
          </ul>
        </Step>
        <Step n={4} title='Click "Save"'>
          Your preferences are saved immediately.
        </Step>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 12 — FAQ
        ════════════════════════════════════════════════════════════ */}
        <SectionHeading
          id="faq"
          icon={HelpCircle}
          title="Frequently Asked Questions"
          sub="Common questions answered in plain English"
          color="bg-[hsl(var(--text-secondary))]"
        />

        <FaqItem q="How often does the AI analyse my data?">
          By default, once a day at a scheduled time. You can also trigger a check any time by clicking
          <strong> Run AI Check Now</strong> on the Home page.
        </FaqItem>

        <FaqItem q="My data is private — is it safe?">
          Yes. Mouna AI only reads your data to perform analysis. Your data is not shared with anyone else.
          The AI processes your data securely and does not store raw data permanently.
        </FaqItem>

        <FaqItem q="I approved an action — what happens next?">
          Approving an action records your decision. If an email notification is configured,
          a confirmation email is sent. Some actions (like reordering stock) may also trigger
          an automated workflow if your admin set one up.
        </FaqItem>

        <FaqItem q="The AI Check failed — what should I do?">
          Go to <strong>Alerts</strong> — there will be a notification explaining what went wrong. Usually
          it means a connector (data source) has a connection problem. Go to Administration → Connectors and
          click <strong>Test</strong> next to each connector to find the broken one.
        </FaqItem>

        <FaqItem q="I can't see the Administration section in the sidebar">
          The Administration section is only visible to users with the <strong>Admin</strong> role.
          Contact your company administrator to get admin access.
        </FaqItem>

        <FaqItem q="Can I use Mouna AI on my phone?">
          Yes — the website works on mobile browsers. Open it in Safari, Chrome, or any browser on your phone.
          There is no separate app to download.
        </FaqItem>

        <FaqItem q="What is a Connector and do I need technical knowledge to add one?">
          A Connector is the bridge between Mouna AI and your data. For API connectors you need the URL and
          API key of your system (usually provided by your software vendor). For CSV files, you just upload
          the file — no technical knowledge needed.
        </FaqItem>

        <FaqItem q="How do I log out?">
          Click your avatar/name at the bottom-left of the sidebar. A menu will appear with a
          <strong> Log out</strong> option — click it.
        </FaqItem>

        <FaqItem q="Can I change my email or password?">
          Go to Profile (click your avatar → Profile). Currently you can view your profile details
          there. To change your password, contact your administrator.
        </FaqItem>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="mt-12 pt-6 border-t border-[hsl(var(--border))] text-center">
          <p className="text-[12px] text-[hsl(var(--text-disabled))]">
            Mouna AI User Guide · Still stuck? Use <strong className="text-[hsl(var(--text-secondary))]">Ask AI</strong> to ask any question about your business.
          </p>
        </div>

      </div>
    </div>
  );
}
