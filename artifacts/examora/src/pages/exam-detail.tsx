import { useEffect, useMemo, useState } from 'react';
import { AssistancePolicyEditor } from '@/components/assistance-policy';
import { Link, useLocation, useParams } from 'wouter';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Megaphone,
  FlaskConical,
  Loader2,
  Search,
  UserPlus,
  Lock,
  Radio,
  Award,
  Check,
} from 'lucide-react';
import {
  useGetExam,
  useUpdateExam,
  useExamAction,
  useEnrollCandidates,
  useStartAttempt,
  useCreateAnnouncement,
  useListQuestions,
  useListUsers,
  getGetExamQueryKey,
  getListExamsQueryKey,
  getGetDashboardQueryKey,
  getListQuestionsQueryKey,
  getListUsersQueryKey,
  getListResultsQueryKey,
  getGetMonitorQueryKey,
  type ExamDetail as ExamDetailT,
  type ExamActionInputAction,
} from '@workspace/api-client-react';
import { PageHeader, StatusPill, ErrorState, SkeletonRows, Panel, EmptyState } from '@/components/kit';
import { ExamForm, examDefaults } from '@/components/exam-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fmtDate, ago, errMsg, initials } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STEPS = ['draft', 'published', 'ongoing', 'completed'] as const;

const ACTION_COPY: Record<ExamActionInputAction, { title: string; body: string; cta: string }> = {
  publish: { title: 'Publish this exam?', body: 'The paper is frozen and enrolled candidates can start inside the window. Questions and schedule can no longer be edited.', cta: 'Publish' },
  complete: { title: 'Close this exam?', body: 'No new attempts can start. Active attempts are finalised by the server at their deadlines.', cta: 'Complete exam' },
  'publish-results': { title: 'Release results to candidates?', body: 'Candidates will see scores and feedback. Make sure written answers are graded first.', cta: 'Publish results' },
};

function Lifecycle({ exam }: { exam: ExamDetailT }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const act = useExamAction();
  const [pending, setPending] = useState<ExamActionInputAction | null>(null);
  const idx = STEPS.indexOf(exam.status);
  const next: ExamActionInputAction | null =
    exam.status === 'draft' ? 'publish' : exam.status === 'published' || exam.status === 'ongoing' ? 'complete' : !exam.resultsPublished ? 'publish-results' : null;
  const blocked = next === 'publish' && (exam.questionCount === 0 || exam.enrolledCount === 0);
  return (
    <Panel title="Lifecycle">
      <ol className="mb-5 grid grid-cols-5 gap-1">
        {[...STEPS, 'results' as const].map((s, i) => {
          const done = s === 'results' ? exam.resultsPublished : i <= idx;
          return (
            <li key={s} className="space-y-1.5">
              <motion.div className={cn('h-1 rounded-full', done ? 'bg-accent' : 'bg-muted')} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.07 }} style={{ originX: 0 }} />
              <div className={cn('font-mono text-[9.5px] uppercase tracking-wider', done ? 'text-foreground' : 'text-muted-foreground')}>{s}</div>
            </li>
          );
        })}
      </ol>
      {next ? (
        <>
          <Button data-testid={`button-action-${next}`} className="w-full" disabled={act.isPending || blocked} onClick={() => setPending(next)}>
            {act.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : next === 'publish' ? <Send className="mr-2 h-4 w-4" /> : next === 'complete' ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Award className="mr-2 h-4 w-4" />}
            {ACTION_COPY[next].cta}
          </Button>
          {blocked && <p className="mt-2 text-xs text-muted-foreground">Assign at least one question and enroll at least one candidate before publishing.</p>}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Finished. Results are visible to candidates.</p>
      )}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending && ACTION_COPY[pending].title}</AlertDialogTitle>
            <AlertDialogDescription>{pending && ACTION_COPY[pending].body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-action"
              onClick={() =>
                pending &&
                act.mutate(
                  { id: exam.id, data: { action: pending } },
                  {
                    onSuccess: () => {
                      qc.invalidateQueries({ queryKey: getGetExamQueryKey(exam.id) });
                      qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
                      qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
                      qc.invalidateQueries({ queryKey: getListResultsQueryKey() });
                      toast({ title: `${ACTION_COPY[pending].cta} — done` });
                    },
                    onError: (e) => toast({ title: 'Action refused', description: errMsg(e), variant: 'destructive' }),
                  },
                )
              }
            >
              {pending && ACTION_COPY[pending].cta}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

function PaperTab({ exam }: { exam: ExamDetailT }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const bank = useListQuestions({ query: { queryKey: getListQuestionsQueryKey() } });
  const update = useUpdateExam();
  const editable = exam.status === 'draft';
  const examQIds = useMemo(() => exam.questions.map((q) => q.id), [exam.questions]);
  const [sel, setSel] = useState<string[]>(examQIds);
  const [text, setText] = useState('');
  useEffect(() => setSel(examQIds), [examQIds]);
  const dirty = sel.length !== examQIds.length || sel.some((id, i) => examQIds[i] !== id);
  const byId = useMemo(() => new Map((bank.data ?? []).map((q) => [q.id, q])), [bank.data]);
  const marks = sel.reduce((s, id) => s + (byId.get(id)?.marks ?? exam.questions.find((q) => q.id === id)?.marks ?? 0), 0);
  const list = (bank.data ?? []).filter((q) => `${q.text} ${q.category}`.toLowerCase().includes(text.toLowerCase()));

  const save = () =>
    update.mutate(
      {
        id: exam.id,
        data: {
          title: exam.title,
          subject: exam.subject,
          instructions: exam.instructions,
          duration: exam.duration,
          startsAt: exam.startsAt,
          endsAt: exam.endsAt,
          randomize: exam.randomize,
          passPercent: exam.passPercent,
          questionIds: sel,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetExamQueryKey(exam.id) });
          qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
          toast({ title: 'Paper saved', description: `${sel.length} questions, ${marks} marks` });
        },
        onError: (e) => toast({ title: 'Could not save paper', description: errMsg(e), variant: 'destructive' }),
      },
    );

  if (!editable)
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Paper is frozen after publication.</div>
        {exam.questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border bg-card p-4">
            <div className="mb-1 flex gap-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground"><span>Q{i + 1}</span><span>{q.type}</span><span>{q.marks} marks</span></div>
            <p className="text-sm">{q.text}</p>
          </div>
        ))}
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-card/95 p-3 backdrop-blur lg:top-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Filter the bank" className="pl-9" data-testid="input-filter-bank" />
        </div>
        <div className="font-mono text-xs tnum"><span className="text-accent">{sel.length}</span> selected · {marks} marks</div>
        <Button disabled={!dirty || update.isPending} onClick={save} data-testid="button-save-paper">
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save paper
        </Button>
      </div>
      {bank.isLoading ? (
        <SkeletonRows rows={6} />
      ) : bank.isError ? (
        <ErrorState error={bank.error} onRetry={() => bank.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={<Search className="h-5 w-5" />} title="No bank questions" body="Write questions in the question bank or import them from CSV." action={<Button asChild variant="outline"><Link href="/questions">Open bank</Link></Button>} />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {list.map((q) => {
            const on = sel.includes(q.id);
            return (
              <li key={q.id}>
                <label className={cn('flex cursor-pointer items-start gap-3 px-4 py-3 transition', on ? 'bg-accent/[0.05]' : 'hover:bg-muted/40')}>
                  <Checkbox
                    data-testid={`checkbox-question-${q.id}`}
                    checked={on}
                    onCheckedChange={(c) => setSel((s) => (c ? [...s, q.id] : s.filter((x) => x !== q.id)))}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">{q.text}</p>
                    <div className="mt-1 flex flex-wrap gap-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      <span>{q.type}</span><span>{q.category}</span><span>{q.difficulty}</span>
                    </div>
                  </div>
                  <span className="font-mono text-xs tnum">{q.marks}m</span>
                  {on && <span className="font-mono text-[10px] text-accent">#{sel.indexOf(q.id) + 1}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CandidatesTab({ exam }: { exam: ExamDetailT }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const users = useListUsers({ query: { queryKey: getListUsersQueryKey() } });
  const enroll = useEnrollCandidates();
  const [sel, setSel] = useState<string[]>([]);
  const [text, setText] = useState('');
  const enrolled = new Set(exam.candidates.map((c) => c.id));
  const avail = (users.data ?? []).filter((u) => u.role === 'candidate' && u.active && !enrolled.has(u.id) && `${u.name} ${u.email}`.toLowerCase().includes(text.toLowerCase()));
  const closed = exam.status === 'completed';
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title={`Enrolled · ${exam.candidates.length}`} bodyClass="p-0">
        {exam.candidates.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No one enrolled yet.</p>
        ) : (
          <ul className="max-h-[460px] divide-y overflow-y-auto">
            {exam.candidates.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5" data-testid={`row-enrolled-${c.id}`}>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary font-mono text-[10px]">{initials(c.name)}</span>
                <div className="min-w-0"><div className="truncate text-sm">{c.name}</div><div className="truncate text-xs text-muted-foreground">{c.email}</div></div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel
        title="Add candidates"
        action={
          <Button
            size="sm"
            disabled={!sel.length || enroll.isPending || closed}
            data-testid="button-enroll"
            onClick={() =>
              enroll.mutate(
                { id: exam.id, data: { candidateIds: sel } },
                {
                  onSuccess: () => {
                    toast({ title: `Enrolled ${sel.length} candidate${sel.length > 1 ? 's' : ''}` });
                    setSel([]);
                    qc.invalidateQueries({ queryKey: getGetExamQueryKey(exam.id) });
                    qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
                  },
                  onError: (e) => toast({ title: 'Enrollment failed', description: errMsg(e), variant: 'destructive' }),
                },
              )
            }
          >
            {enroll.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" />}Enroll {sel.length || ''}
          </Button>
        }
        bodyClass="p-0"
      >
        <div className="flex gap-2 border-b p-3">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search candidates" data-testid="input-search-candidates" />
          <Button variant="outline" size="sm" className="h-9" onClick={() => setSel(sel.length === avail.length ? [] : avail.map((u) => u.id))} data-testid="button-select-all">
            {sel.length === avail.length && avail.length ? 'None' : 'All'}
          </Button>
        </div>
        {users.isLoading ? (
          <SkeletonRows rows={4} className="p-3" />
        ) : users.isError ? (
          <div className="p-3"><ErrorState error={users.error} onRetry={() => users.refetch()} /></div>
        ) : avail.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Everyone available is enrolled. Import more on the <Link href="/imports" className="text-accent underline">imports</Link> page.</p>
        ) : (
          <ul className="max-h-[400px] divide-y overflow-y-auto">
            {avail.map((u) => (
              <li key={u.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                  <Checkbox data-testid={`checkbox-candidate-${u.id}`} checked={sel.includes(u.id)} onCheckedChange={(c) => setSel((s) => (c ? [...s, u.id] : s.filter((x) => x !== u.id)))} />
                  <div className="min-w-0"><div className="truncate text-sm">{u.name}</div><div className="truncate text-xs text-muted-foreground">{u.email}</div></div>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AnnouncementsTab({ exam }: { exam: ExamDetailT }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateAnnouncement();
  const [msg, setMsg] = useState('');
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Panel title="Broadcast to candidates">
        <Textarea data-testid="input-announcement" rows={4} value={msg} maxLength={2000} onChange={(e) => setMsg(e.target.value)} placeholder="Clarification for Q4: assume ideal gas behaviour." />
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground tnum">{msg.length}/2000</span>
          <Button
            data-testid="button-send-announcement"
            disabled={!msg.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                { id: exam.id, data: { message: msg.trim() } },
                {
                  onSuccess: () => {
                    setMsg('');
                    toast({ title: 'Announcement sent' });
                    qc.invalidateQueries({ queryKey: getGetExamQueryKey(exam.id) });
                    qc.invalidateQueries({ queryKey: getGetMonitorQueryKey(exam.id) });
                  },
                  onError: (e) => toast({ title: 'Not sent', description: errMsg(e), variant: 'destructive' }),
                },
              )
            }
          >
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}Send
          </Button>
        </div>
      </Panel>
      <Panel title="History" bodyClass="p-0">
        {exam.announcements.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No announcements.</p>
        ) : (
          <ul className="divide-y">
            {exam.announcements.map((a) => (
              <li key={a.id} className="px-4 py-3"><p className="text-sm">{a.message}</p><div className="mt-1 font-mono text-[10.5px] text-muted-foreground">{fmtDate(a.createdAt)} · {ago(a.createdAt)}</div></li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default function ExamDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useGetExam(id, { query: { queryKey: getGetExamQueryKey(id), enabled: !!id, refetchInterval: 20000 } });
  const update = useUpdateExam();
  const sandbox = useStartAttempt();
  const exam = q.data;

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading || !exam) return <SkeletonRows rows={8} />;

  return (
    <div>
      <Link href="/exams" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent"><ArrowLeft className="h-3.5 w-3.5" /> All exams</Link>
      <PageHeader
        eyebrow={exam.subject || 'Examination'}
        title={exam.title}
        description={<span className="flex flex-wrap items-center gap-3"><StatusPill status={exam.status} /> {fmtDate(exam.startsAt)} → {fmtDate(exam.endsAt)} · {exam.duration} min · {exam.totalMarks} marks · pass {exam.passPercent}%</span>}
        actions={
          <>
            <Button
              variant="outline"
              data-testid="button-sandbox"
              disabled={sandbox.isPending || exam.questionCount === 0}
              onClick={() =>
                sandbox.mutate(
                  { id: exam.id, data: { sandbox: true } },
                  { onSuccess: (a) => nav(`/attempts/${a.id}`), onError: (e) => toast({ title: 'Sandbox unavailable', description: errMsg(e), variant: 'destructive' }) },
                )
              }
            >
              {sandbox.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}Try in sandbox
            </Button>
            {(exam.status === 'published' || exam.status === 'ongoing') && (
              <Button asChild variant="outline"><Link href={`/monitor?exam=${exam.id}`}><Radio className="mr-2 h-4 w-4" />Monitor</Link></Button>
            )}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Tabs defaultValue={exam.status === 'draft' ? 'paper' : 'candidates'}>
          <TabsList className="mb-5">
            <TabsTrigger value="paper" data-testid="tab-paper">Paper · {exam.questionCount}</TabsTrigger>
            <TabsTrigger value="candidates" data-testid="tab-candidates">Candidates · {exam.enrolledCount}</TabsTrigger>
            <TabsTrigger value="announce" data-testid="tab-announcements">Announcements</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="paper"><PaperTab exam={exam} /></TabsContent>
          <TabsContent value="candidates"><CandidatesTab exam={exam} /></TabsContent>
          <TabsContent value="announce"><AnnouncementsTab exam={exam} /></TabsContent>
          <TabsContent value="settings">
            <div className="mb-5"><AssistancePolicyEditor exam={exam} /></div>
            <Panel title="Exam settings">
              {exam.status !== 'draft' ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Settings are locked once published.</div>
              ) : (
                <ExamForm
                  key={exam.id + exam.title + exam.startsAt}
                  initial={examDefaults(exam)}
                  questionIds={exam.questions.map((x) => x.id)}
                  pending={update.isPending}
                  submitLabel="Save settings"
                  onSubmit={(data) =>
                    update.mutate(
                      { id: exam.id, data },
                      {
                        onSuccess: () => {
                          qc.invalidateQueries({ queryKey: getGetExamQueryKey(exam.id) });
                          qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
                          toast({ title: 'Settings saved' });
                        },
                        onError: (e) => toast({ title: 'Not saved', description: errMsg(e), variant: 'destructive' }),
                      },
                    )
                  }
                />
              )}
            </Panel>
          </TabsContent>
        </Tabs>
        <div className="space-y-4">
          <Lifecycle exam={exam} />
          <Panel title="At a glance">
            <dl className="space-y-2 text-sm">
              {[
                ['Questions', exam.questionCount],
                ['Total marks', exam.totalMarks],
                ['Enrolled', exam.enrolledCount],
                ['Submitted', exam.submittedCount],
                ['Shuffle', exam.randomize ? 'On' : 'Off'],
                ['Results', exam.resultsPublished ? 'Published' : 'Withheld'],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="tnum">{v}</dd></div>
              ))}
            </dl>
            {exam.resultsPublished || exam.submittedCount > 0 ? (
              <Button asChild variant="ghost" size="sm" className="mt-3 w-full"><Link href="/results"><Check className="mr-1.5 h-3.5 w-3.5" />Grade &amp; results</Link></Button>
            ) : null}
          </Panel>
          <Panel title="Instructions"><p className="whitespace-pre-wrap text-sm text-muted-foreground">{exam.instructions}</p></Panel>
        </div>
      </div>
    </div>
  );
}
