import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { listInsights } from '@/services/insight.service';

export function InsightsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['insights'],
    queryFn: () => listInsights(1, 20),
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <CardDescription>Signals identified from analysis runs, ready for review and decisioning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <p className="text-sm text-[hsl(var(--text-secondary))]">Loading insights...</p>}
            {!isLoading && !data?.items.length && (
              <p className="text-sm text-[hsl(var(--text-secondary))]">No insights have been generated yet.</p>
            )}
            {data?.items.map((insight) => (
              <div key={insight.id} className="rounded-xl border border-[hsl(var(--border))] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{insight.title}</p>
                  <span className="text-[11px] text-[hsl(var(--text-secondary))]">{insight.severity}</span>
                </div>
                <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">{insight.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}