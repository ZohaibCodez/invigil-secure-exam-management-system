import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, ArrowDownUp } from 'lucide-react';
import { useGetAnalytics, getGetAnalyticsQueryKey } from '@workspace/api-client-react';
import { PageHeader, Stat, Panel, EmptyState, ErrorState, SkeletonRows } from '@/components/kit';
import { pct } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function Analytics() {
  const q = useGetAnalytics({ query: { queryKey: getGetAnalyticsQueryKey(), refetchInterval: 60000 } });
  const [asc, setAsc] = useState(true);
  const d = q.data;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading || !d) return <><PageHeader eyebrow="Insight" title="Analytics" /><SkeletonRows rows={8} /></>;
  const max = Math.max(1, ...d.distribution.map((b) => b.count));
  const qs = [...d.questions].sort((a, b) => (asc ? a.accuracy - b.accuracy : b.accuracy - a.accuracy));
  const weakest = d.questions.filter((x) => x.attempts > 0).sort((a, b) => a.accuracy - b.accuracy)[0];

  return (
    <div>
      <PageHeader eyebrow="Insight" title="Analytics" description="Computed from real, non-sandbox submissions. Sandbox runs by examiners are excluded." />
      {d.totalAttempts === 0 ? (
        <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No submissions to analyse" body="Once candidates submit, accuracy and score distribution appear here." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat index={0} label="Submissions" value={d.totalAttempts} />
            <Stat index={1} label="Mean score" value={pct(d.averageScore)} />
            <Stat index={2} label="Pass rate" value={pct(d.passRate)} accent />
            <Stat index={3} label="Completion" value={pct(d.completionRate)} hint="Submitted of started" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
            <Panel title="Score distribution">
              <div className="flex h-56 items-end gap-2">
                {d.distribution.map((b, i) => (
                  <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
                    <span className="font-mono text-[11px] tnum text-muted-foreground">{b.count}</span>
                    <div className="relative w-full flex-1">
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: b.count / max }}
                        transition={{ delay: i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        style={{ originY: 1 }}
                        className={cn('absolute inset-0 rounded-t-md', i === d.distribution.length - 1 ? 'bg-accent' : 'bg-primary/80')}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{b.label}</span>
                  </div>
                ))}
              </div>
              {weakest && (
                <p className="mt-5 border-t pt-4 text-sm text-muted-foreground">
                  Hardest in practice: <span className="text-foreground">"{weakest.text.slice(0, 80)}{weakest.text.length > 80 ? '…' : ''}"</span> at {pct(weakest.accuracy)} accuracy.
                </p>
              )}
            </Panel>
            <Panel title="Question performance" action={<button onClick={() => setAsc((a) => !a)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent" data-testid="button-sort-accuracy"><ArrowDownUp className="h-3.5 w-3.5" />{asc ? 'Weakest first' : 'Strongest first'}</button>} bodyClass="p-0">
              <ul className="max-h-[520px] divide-y overflow-y-auto">
                {qs.map((x) => (
                  <li key={x.id} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3" data-testid={`row-metric-${x.id}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm">{x.text}</p>
                      <div className="mt-1 flex gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span>{x.category}</span><span>{x.difficulty}</span><span>{x.attempts} seen</span><span>{x.skipped} skipped</span></div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: x.accuracy / 100 }} style={{ originX: 0 }} transition={{ duration: 0.6 }} className={cn('h-full', x.accuracy < 40 ? 'bg-accent' : x.accuracy < 70 ? 'bg-[hsl(38_78%_52%)]' : 'bg-[hsl(158_35%_40%)]')} />
                      </div>
                    </div>
                    <div className="text-right"><div className="font-display text-2xl tnum">{pct(x.accuracy, 0)}</div><div className="font-mono text-[10px] text-muted-foreground tnum">{x.correct}/{x.attempts}</div></div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
