import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, ArrowDownUp, AlertTriangle } from 'lucide-react';
import { useGetAnalytics, getGetAnalyticsQueryKey, type QuestionMetric } from '@workspace/api-client-react';
import { PageHeader, Stat, Panel, EmptyState, ErrorState, SkeletonRows } from '@/components/kit';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pct } from '@/lib/format';
import { cn } from '@/lib/utils';

const ALL = 'all';
const DIFF_TONE: Record<string, string> = {
  easy: 'bg-[hsl(158_35%_92%)] text-[hsl(158_45%_28%)] dark:bg-[hsl(158_25%_16%)] dark:text-[hsl(158_40%_70%)]',
  medium: 'bg-[hsl(38_85%_92%)] text-[hsl(30_70%_32%)] dark:bg-[hsl(38_40%_18%)] dark:text-[hsl(38_70%_70%)]',
  hard: 'bg-accent/10 text-accent',
};

function DifficultyChip({ label, value }: { label: string; value: string }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize', DIFF_TONE[value] ?? 'bg-muted')}>{label} {value}</span>;
}

function QuestionRow({ x }: { x: QuestionMetric }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3" data-testid={`row-metric-${x.id}`}>
      <div className="min-w-0">
        <p className="truncate text-sm">{x.text}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{x.category}</span><span>·</span><span>{x.attempts} responses</span><span>·</span><span>{x.skipped} skipped</span>
          <DifficultyChip label="Labelled" value={x.difficulty} />
          {x.observedDifficulty && <DifficultyChip label="Observed" value={x.observedDifficulty} />}
          {x.difficultyMismatch && (
            <span className="flex items-center gap-1 font-medium text-accent" data-testid={`flag-mismatch-${x.id}`} title="Candidates found this question noticeably easier or harder than its label. Review the wording or the label.">
              <AlertTriangle className="h-3 w-3" />Label mismatch
            </span>
          )}
        </div>
        {x.commonWrong && (
          <p className="mt-1.5 text-xs text-muted-foreground" data-testid={`text-common-wrong-${x.id}`}>
            Most chosen wrong answer: <span className="font-medium text-foreground">"{x.commonWrong.text}"</span> ({x.commonWrong.count}, {pct(x.commonWrong.share, 0)} of responses)
          </p>
        )}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: x.accuracy / 100 }} style={{ originX: 0 }} transition={{ duration: 0.6 }} className={cn('h-full', x.accuracy < 40 ? 'bg-accent' : x.accuracy < 70 ? 'bg-[hsl(38_78%_52%)]' : 'bg-[hsl(158_35%_40%)]')} />
        </div>
      </div>
      <div className="text-right"><div className="font-display text-2xl tnum">{pct(x.accuracy, 0)}</div><div className="text-[11px] text-muted-foreground tnum">{x.correct}/{x.attempts} correct</div></div>
    </li>
  );
}

export default function Analytics() {
  const [examId, setExamId] = useState<string>(ALL);
  const params = examId === ALL ? {} : { examId };
  const q = useGetAnalytics(params, { query: { queryKey: getGetAnalyticsQueryKey(params), refetchInterval: 60000 } });
  const [asc, setAsc] = useState(true);
  const d = q.data;
  const picker = (
    <Select value={examId} onValueChange={setExamId}>
      <SelectTrigger className="w-72 bg-card" data-testid="select-analytics-exam"><SelectValue placeholder="All examinations" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All examinations</SelectItem>
        {(d?.exams ?? []).map((e) => <SelectItem key={e.examId} value={e.examId}>{e.title}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const header = <PageHeader title="Analytics" description="Computed from real, graded submissions. Sandbox runs and voided attempts are excluded." actions={picker} />;
  if (q.isError) return <>{header}<ErrorState error={q.error} onRetry={() => q.refetch()} /></>;
  if (q.isLoading || !d) return <>{header}<SkeletonRows rows={8} /></>;
  const max = Math.max(1, ...d.distribution.map((b) => b.count));
  const qs = [...d.questions].sort((a, b) => (asc ? a.accuracy - b.accuracy : b.accuracy - a.accuracy));
  const mismatches = d.questions.filter((x) => x.difficultyMismatch).length;
  const summaries = (d.exams ?? []).filter((e) => e.submissions > 0);

  return (
    <div>
      {header}
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

          <Panel title="Examination summary" bodyClass="p-0">
            {summaries.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No graded submissions yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-exam-summary">
                  <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>{['Examination', 'Submitted', 'Graded', 'Mean', 'Median', 'Highest', 'Lowest', 'Pass rate'].map((h, i) => <th key={h} className={cn('px-4 py-2.5 font-medium', i > 0 && 'text-right')}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {summaries.map((e) => (
                      <tr key={e.examId} className={cn('cursor-pointer hover:bg-muted/40', e.examId === examId && 'bg-accent/[0.05]')} onClick={() => setExamId(e.examId)}>
                        <td className="max-w-[280px] truncate px-4 py-2.5 font-medium">{e.title}</td>
                        <td className="px-4 py-2.5 text-right tnum">{e.submissions}</td>
                        <td className="px-4 py-2.5 text-right tnum">{e.graded}</td>
                        {[e.mean, e.median, e.highest, e.lowest, e.passRate].map((v, i) => <td key={i} className="px-4 py-2.5 text-right tnum">{v == null ? '—' : pct(v)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
            <Panel title="Score distribution">
              <div className="flex h-56 items-end gap-2">
                {d.distribution.map((b, i) => (
                  <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-[11px] tnum text-muted-foreground">{b.count}</span>
                    <div className="relative w-full flex-1">
                      <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: b.count / max }} transition={{ delay: i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }} style={{ originY: 1 }}
                        className={cn('absolute inset-0 rounded-t-md', i === d.distribution.length - 1 ? 'bg-accent' : 'bg-primary/80')} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{b.label}</span>
                  </div>
                ))}
              </div>
              {mismatches > 0 && (
                <p className="mt-5 flex gap-2 border-t pt-4 text-sm text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {mismatches} question{mismatches === 1 ? '' : 's'} performed differently from {mismatches === 1 ? 'its' : 'their'} difficulty label. Review the wording, the key, or the label.
                </p>
              )}
            </Panel>
            <Panel title="Question performance" action={<button onClick={() => setAsc((a) => !a)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent" data-testid="button-sort-accuracy"><ArrowDownUp className="h-3.5 w-3.5" />{asc ? 'Weakest first' : 'Strongest first'}</button>} bodyClass="p-0">
              {qs.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No objective questions answered yet.</p> : (
                <ul className="max-h-[560px] divide-y overflow-y-auto">{qs.map((x) => <QuestionRow key={x.id} x={x} />)}</ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
