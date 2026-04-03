import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, Lightbulb, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listAnalysisRuns, createAnalysisRun } from '@/services/analysis.service';
import { listInsights } from '@/services/insight.service';
import { listDecisions } from '@/services/decision.service';

export function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: analysisRuns } = useQuery({
    queryKey: ['analysis-runs', 'dashboard'],
    queryFn: () => listAnalysisRuns(1, 5),
  });
  const { data: insights } = useQuery({
    queryKey: ['insights', 'dashboard'],
    queryFn: () => listInsights(1, 5),
  });
  const { data: decisions } = useQuery({
    queryKey: ['decisions', 'dashboard'],
    queryFn: () => listDecisions(1, 5),
  });

  const createRunMutation = useMutation({
    mutationFn: () => createAnalysisRun({ source: 'manual_dashboard_trigger' }),
    onSuccess: (run) => {
      void qc.invalidateQueries({ queryKey: ['analysis-runs'] });
      navigate(`/analysis-runs/${run.id}`);
    },
  });

  const cards = [
    { label: 'Analysis Runs', value: analysisRuns?.total ?? 0, icon: Activity },
    { label: 'Insights', value: insights?.total ?? 0, icon: Lightbulb },
    { label: 'Decisions', value: decisions?.total ?? 0, icon: AlertTriangle },
    {
      label: 'Approved Decisions',
      value: decisions?.items.filter((decision) => decision.status === 'APPROVED').length ?? 0,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[hsl(var(--text-primary))]">Executive Dashboard</h1>
            <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
              Monitor analysis activity, emerging insights, and recommended decisions.
            </p>
          </div>
          <Button onClick={() => createRunMutation.mutate()} loading={createRunMutation.isPending}>
            <PlayCircle className="w-4 h-4 mr-2" />
            Run Analysis
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Icon className="w-5 h-5 text-[hsl(var(--accent-hover))]" />
                  {value}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Analysis Runs</CardTitle>
              <CardDescription>Manual and scheduled evaluation history.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysisRuns?.items.length ? analysisRuns.items.map((run) => (
                <button
                  key={run.id}
                  onClick={() => navigate(`/analysis-runs/${run.id}`)}
                  className="w-full flex items-center justify-between rounded-xl border border-[hsl(var(--border))] px-4 py-3 text-left hover:bg-[hsl(var(--surface-2))] transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{run.status}</p>
                    <p className="text-xs text-[hsl(var(--text-secondary))]">{new Date(run.created_at).toLocaleString()}</p>
                  </div>
                  <span className="text-xs text-[hsl(var(--text-secondary))]">{run.id.slice(0, 8)} →</span>
                </button>
              )) : <p className="text-sm text-[hsl(var(--text-secondary))]">No analysis runs yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest Decisions</CardTitle>
              <CardDescription>Newest recommended actions requiring review or execution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {decisions?.items.length ? decisions.items.map((decision) => (
                <div key={decision.id} className="rounded-xl border border-[hsl(var(--border))] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{decision.title}</p>
                    <span className="text-[11px] text-[hsl(var(--text-secondary))]">{decision.priority}</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">{decision.recommendation}</p>
                </div>
              )) : <p className="text-sm text-[hsl(var(--text-secondary))]">No decision points yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}