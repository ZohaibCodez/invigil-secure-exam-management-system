import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Award, Download, FileDown, PenLine, ShieldCheck, Loader2, Send, Clock } from 'lucide-react';
import {
  useListResults,
  useGetAttempt,
  useGradeAttempt,
  useExamAction,
  getListResultsQueryKey,
  getGetAttemptQueryKey,
  getGetDashboardQueryKey,
  getListExamsQueryKey,
  getGetAnalyticsQueryKey,
  type Result,
} from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, SkeletonRows, StatusPill, Stat } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMe, isStaff } from '@/lib/session';
import { errMsg, fmtDate, pct, parseSelected } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const pdfUrl = (id: string) => `${base}/api/reports/${id}/pdf`;

function GradeDialog({ result, onClose }: { result: Result; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useGetAttempt(result.id, { query: { queryKey: getGetAttemptQueryKey(result.id), enabled: !!result.id } });
  const grade = useGradeAttempt();
  const [edits, setEdits] = useState<Record<string, { score: string; feedback: string }>>({});
  const a = q.data;
  const ansBy = useMemo(() => new Map((a?.answers ?? []).map((x) => [x.questionId, x])), [a]);
  const get = (qid: string) => edits[qid] ?? { score: ansBy.get(qid)?.score != null ? String(ansBy.get(qid)?.score) : '', feedback: ansBy.get(qid)?.feedback ?? '' };

  const save = () => {
    if (!a) return;
    const grades = [];
    for (const qu of a.questions) {
      const e = get(qu.id);
      if (e.score === '' && qu.type !== 'written') continue;
      const s = Number(e.score);
      if (e.score === '' || !Number.isFinite(s) || s < 0 || s > qu.marks) {
        toast({ title: 'Check the scores', description: `Each score must be between 0 and the question's marks.`, variant: 'destructive' });
        return;
      }
      grades.push({ questionId: qu.id, score: s, feedback: e.feedback });
    }
    grade.mutate(
      { id: a.id, data: { grades } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListResultsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetAttemptQueryKey(a.id) });
          qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          qc.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() });
          toast({ title: 'Grades saved', description: result.candidateName });
          onClose();
        },
        onError: (e) => toast({ title: 'Grades not saved', description: errMsg(e), variant: 'destructive' }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">{result.candidateName}</DialogTitle>
          <DialogDescription>{result.examTitle} · submitted {fmtDate(result.submittedAt)}</DialogDescription>
        </DialogHeader>
        {q.isLoading ? <SkeletonRows rows={4} /> : q.isError || !a ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <div className="space-y-4">
            {a.questions.map((qu, i) => {
              const ans = ansBy.get(qu.id);
              const e = get(qu.id);
              const selected = qu.type === 'written' ? [] : parseSelected(ans?.value ?? '');
              return (
                <div key={qu.id} className={cn('rounded-xl border p-4', qu.type === 'written' && 'border-accent/30')}>
                  <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground"><span>Q{i + 1}</span><span>{qu.type}</span><span className="ml-auto">{qu.marks} marks</span></div>
                  <p className="text-sm font-medium">{qu.text}</p>
                  {qu.type === 'written' ? (
                    <div className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{ans?.value?.trim() ? ans.value : <span className="italic text-muted-foreground">No answer</span>}</div>
                  ) : (
                    <ul className="mt-3 space-y-1 text-sm">
                      {qu.options.map((o) => {
                        const picked = selected.includes(o.id);
                        const right = qu.correctAnswers.includes(o.id);
                        return <li key={o.id} className={cn('flex items-center gap-2 rounded px-2 py-1', picked && (right ? 'bg-[hsl(158_30%_92%)] dark:bg-[hsl(158_25%_16%)]' : 'bg-destructive/10'))}><span className={cn('h-2 w-2 rounded-full', right ? 'bg-[hsl(158_40%_40%)]' : 'bg-muted-foreground/30')} />{o.text}{picked && <span className="ml-auto font-mono text-[10px] text-muted-foreground">chosen</span>}</li>;
                      })}
                    </ul>
                  )}
                  {qu.explanation && <p className="mt-2 text-xs text-muted-foreground">Guide: {qu.explanation}</p>}
                  <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr]">
                    <Input data-testid={`input-score-${qu.id}`} type="number" min={0} max={qu.marks} step="0.5" placeholder={`/ ${qu.marks}`} value={e.score} onChange={(ev) => setEdits((s) => ({ ...s, [qu.id]: { ...e, score: ev.target.value } }))} />
                    <Textarea data-testid={`input-feedback-${qu.id}`} rows={1} placeholder="Feedback for the candidate" value={e.feedback} onChange={(ev) => setEdits((s) => ({ ...s, [qu.id]: { ...e, feedback: ev.target.value } }))} />
                  </div>
                </div>
              );
            })}
            <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background/95 pt-3 backdrop-blur">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={save} disabled={grade.isPending} data-testid="button-save-grades">{grade.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save grades</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function exportCsv(rows: Result[]) {
  const head = ['exam', 'candidate', 'email', 'score', 'total', 'percentage', 'status', 'published', 'submitted_at'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((r) => [r.examTitle, r.candidateName, r.candidateEmail, r.score, r.totalMarks, r.percentage, r.status, r.published, r.submittedAt].map(esc).join(','));
  const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `examora-results-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Results() {
  const me = useMe();
  const staff = isStaff(me);
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useListResults({ query: { queryKey: getListResultsQueryKey(), refetchInterval: staff ? 15000 : 30000 } });
  const act = useExamAction();
  const [exam, setExam] = useState('all');
  const [grading, setGrading] = useState<Result | null>(null);
  const all = q.data ?? [];
  const exams = useMemo(() => Array.from(new Map(all.map((r) => [r.examId, r.examTitle])).entries()), [all]);
  const rows = all.filter((r) => exam === 'all' || r.examId === exam);
  const graded = rows.filter((r) => r.percentage != null);
  const avg = graded.length ? graded.reduce((s, r) => s + (r.percentage ?? 0), 0) / graded.length : null;
  const pending = rows.filter((r) => r.status === 'submitted').length;
  const selExamUnpublished = exam !== 'all' && rows.some((r) => !r.published);

  return (
    <div>
      <PageHeader
        eyebrow={staff ? 'Grading' : 'Your record'}
        title="Results"
        description={staff ? 'Objective answers are auto-scored by the server. Written answers wait for you. Nothing is visible to candidates until you publish.' : 'Scores appear once your examiner publishes them. Each report carries a verification link.'}
        actions={
          staff && (
            <>
              <Select value={exam} onValueChange={setExam}>
                <SelectTrigger className="w-64 bg-card" data-testid="select-results-exam"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All exams</SelectItem>{exams.map(([id, t]) => <SelectItem key={id} value={id}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" disabled={!rows.length} onClick={() => exportCsv(rows)} data-testid="button-export-csv"><Download className="mr-1.5 h-4 w-4" />CSV</Button>
              {selExamUnpublished && (
                <Button
                  data-testid="button-publish-results"
                  disabled={act.isPending}
                  onClick={() =>
                    act.mutate(
                      { id: exam, data: { action: 'publish-results' } },
                      {
                        onSuccess: () => {
                          qc.invalidateQueries({ queryKey: getListResultsQueryKey() });
                          qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
                          toast({ title: 'Results published to candidates' });
                        },
                        onError: (e) => toast({ title: 'Cannot publish yet', description: errMsg(e), variant: 'destructive' }),
                      },
                    )
                  }
                >
                  {act.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}Publish results
                </Button>
              )}
            </>
          )
        }
      />
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading ? <SkeletonRows rows={6} /> : all.length === 0 ? (
        <EmptyState icon={<Award className="h-5 w-5" />} title="No results yet" body={staff ? 'Submitted attempts will queue here for review.' : 'Once you submit an exam, its status will show here.'} action={!staff && <Button asChild variant="outline"><Link href="/">Back to overview</Link></Button>} />
      ) : (
        <>
          {staff && (
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat index={0} label="Attempts" value={rows.length} />
              <Stat index={1} label="Need grading" value={pending} accent={pending > 0} />
              <Stat index={2} label="Mean score" value={pct(avg)} />
              <Stat index={3} label="Published" value={`${rows.filter((r) => r.published).length}/${rows.length}`} />
            </div>
          )}
          <div className="overflow-hidden rounded-xl border bg-card">
            <ul className="divide-y">
              {rows.map((r, i) => {
                const show = staff || r.published;
                return (
                  <motion.li key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.02 }} data-testid={`row-result-${r.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 md:grid-cols-[1.5fr_1fr_150px_120px_auto]">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{staff ? r.candidateName : r.examTitle}</div>
                      <div className="truncate text-xs text-muted-foreground">{staff ? `${r.examTitle} · ${r.candidateEmail}` : `Submitted ${fmtDate(r.submittedAt)}`}</div>
                    </div>
                    <div className="hidden md:block">
                      {show && r.percentage != null ? (
                        <div className="flex items-baseline gap-2"><span className="font-display text-3xl tnum">{r.score}</span><span className="text-xs text-muted-foreground tnum">/ {r.totalMarks} · {pct(r.percentage)}</span></div>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{staff ? 'Awaiting grading' : 'Not yet released'}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2"><StatusPill status={r.status} />{staff && <span className={cn('font-mono text-[10px] uppercase', r.published ? 'text-accent' : 'text-muted-foreground')}>{r.published ? 'public' : 'held'}</span>}</div>
                    <div className="col-span-2 flex gap-1 md:col-span-1 md:justify-end">
                      {show && r.verificationToken && <Button asChild size="sm" variant="ghost"><Link href={`/verify/${r.verificationToken}`} data-testid={`link-verify-${r.id}`}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Verify</Link></Button>}
                    </div>
                    <div className="col-span-2 flex gap-1 md:col-span-1 md:justify-end">
                      {staff && r.status !== 'active' && <Button size="sm" variant={r.status === 'submitted' ? 'default' : 'outline'} onClick={() => setGrading(r)} data-testid={`button-grade-${r.id}`}><PenLine className="mr-1 h-3.5 w-3.5" />{r.status === 'submitted' ? 'Grade' : 'Review'}</Button>}
                      {show && r.percentage != null && <Button asChild size="sm" variant="outline"><a href={pdfUrl(r.id)} target="_blank" rel="noreferrer" data-testid={`link-pdf-${r.id}`}><FileDown className="mr-1 h-3.5 w-3.5" />PDF</a></Button>}
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </>
      )}
      {grading && <GradeDialog result={grading} onClose={() => setGrading(null)} />}
    </div>
  );
}
