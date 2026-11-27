import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowUpRight, CalendarClock, FileText, RotateCcw, Award, Activity as ActivityIcon, Plus } from 'lucide-react';
import {
  useGetDashboard,
  getGetDashboardQueryKey,
  type Exam,
} from '@workspace/api-client-react';
import { PageHeader, Stat, Panel, StatusPill, EmptyState, ErrorState, SkeletonRows, Meter } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/lib/session';
import { ago, fmtDate } from '@/lib/format';
import { CandidateEntry } from '@/components/candidate-entry';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function CandidateExamCard({ exam, index }: { exam: Exam; index: number }) {
  const [, nav] = useLocation();
  const now = Date.now();
  const opens = new Date(exam.startsAt).getTime();
  const closes = new Date(exam.endsAt).getTime();
  const inWindow = now >= opens && now <= closes;
  const st = exam.attemptStatus;
  const canStart = !st && inWindow && (exam.status === 'published' || exam.status === 'ongoing');
  const canResume = st === 'active' && exam.attemptId;
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      data-testid={`card-exam-${exam.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 transition hover:border-accent/40 hover:shadow-[0_18px_40px_-28px_hsl(222_40%_14%/0.5)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">{exam.subject || 'Examination'}</div>
        <StatusPill status={st ?? exam.status} />
      </div>
      <h3 className="mt-3 font-display text-2xl leading-tight">{exam.title}</h3>
      <div className="mt-4 grid grid-cols-3 gap-2 border-y py-3 text-xs">
        <div><div className="text-muted-foreground">Duration</div><div className="font-medium tnum">{exam.duration} min</div></div>
        <div><div className="text-muted-foreground">Questions</div><div className="font-medium tnum">{exam.questionCount}</div></div>
        <div><div className="text-muted-foreground">Marks</div><div className="font-medium tnum">{exam.totalMarks}</div></div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" /> {fmtDate(exam.startsAt)} — {fmtDate(exam.endsAt, 'HH:mm, d MMM')}
      </div>
      <div className="mt-5 flex items-center gap-2">
        {canResume ? (
          <Button data-testid={`button-resume-${exam.id}`} onClick={() => nav(`/attempts/${exam.attemptId}`)} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
            <RotateCcw className="mr-2 h-4 w-4" /> Resume attempt
          </Button>
        ) : canStart ? (
          <CandidateEntry exam={exam} />
        ) : st === 'submitted' || st === 'graded' ? (
          <Button variant="outline" asChild className="flex-1">
            <Link href="/results" data-testid={`link-results-${exam.id}`}><Award className="mr-2 h-4 w-4" /> {exam.resultsPublished ? 'View result' : 'Submitted — awaiting results'}</Link>
          </Button>
        ) : (
          <div className="flex-1 rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
            {now < opens ? `Opens ${fmtDate(exam.startsAt)}` : 'Window closed'}
          </div>
        )}
      </div>
      {(st === 'submitted' || st === 'graded') && exam.attemptId && (
        <Button variant="ghost" size="sm" asChild className="mt-2 h-auto w-full whitespace-normal text-center leading-relaxed">
          <Link href={`/attempts/${exam.attemptId}`} data-testid={`link-incident-review-${exam.id}`}>Authorship explanations, technical incidents and review decisions</Link>
        </Button>
      )}
    </motion.article>
  );
}

export default function Dashboard() {
  const me = useMe();
  const q = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), refetchInterval: 20000 } });
  const d = q.data;
  const isCandidate = me.role === 'candidate';
  const first = me.name.split(' ')[0];

  return (
    <div>
      <PageHeader
        eyebrow={fmtDate(new Date().toISOString(), 'EEEE, d MMMM')}
        title={`${greeting()}, ${first}.`}
        description={isCandidate ? 'Your examinations, in order. Answers are kept on this device the moment you type them.' : 'What needs your attention across examinations, grading and people.'}
        actions={
          !isCandidate && (
            <Button asChild data-testid="button-new-exam">
              <Link href="/exams?new=1"><Plus className="mr-1.5 h-4 w-4" /> New exam</Link>
            </Button>
          )
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading || !d ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          <SkeletonRows rows={5} />
        </div>
      ) : isCandidate ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat index={0} label="Assigned" value={d.totalExams} />
            <Stat index={1} label="Open now" value={d.activeExams} accent={d.activeExams > 0} />
            <Stat index={2} label="Submitted" value={d.submissions} />
            <Stat index={3} label="Average" value={d.submissions ? `${d.averageScore.toFixed(1)}%` : '—'} hint="Published results only" />
          </div>
          {d.exams.length === 0 ? (
            <EmptyState icon={<FileText className="h-5 w-5" />} title="No exams assigned yet" body="When an examiner enrolls you, the exam will appear here with its window and duration." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {d.exams.map((e, i) => <CandidateExamCard key={e.id} exam={e} index={i} />)}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat index={0} label="Exams" value={d.totalExams} hint={`${d.activeExams} published or live`} />
            <Stat index={1} label="Candidates" value={d.candidates} />
            <Stat index={2} label="Submissions" value={d.submissions} hint={`Avg ${d.averageScore.toFixed(1)}%`} />
            <Stat index={3} label="To grade" value={d.pendingGrading} accent={d.pendingGrading > 0} hint={<Link href="/results" className="hover:text-accent">Open grading queue</Link>} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Panel title="Examinations" action={<Link href="/exams" className="text-xs text-muted-foreground hover:text-accent">All exams</Link>} bodyClass="p-0">
              {d.exams.length === 0 ? (
                <div className="p-4"><EmptyState icon={<FileText className="h-5 w-5" />} title="No exams yet" body="Draft your first examination, then assign questions from the bank." action={<Button asChild><Link href="/exams?new=1">Draft an exam</Link></Button>} /></div>
              ) : (
                <ul className="divide-y">
                  {d.exams.map((e, i) => (
                    <motion.li key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                      <Link href={`/exams/${e.id}`} data-testid={`link-exam-${e.id}`} className="group grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 transition hover:bg-muted/50 md:grid-cols-[1fr_160px_auto]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{e.title}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                          </div>
                          <div className="text-xs text-muted-foreground">{e.subject || 'General'} · {fmtDate(e.startsAt, 'd MMM, HH:mm')}</div>
                        </div>
                        <div className="hidden md:block">
                          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground tnum"><span>Submitted</span><span>{e.submittedCount}/{e.enrolledCount}</span></div>
                          <Meter value={e.enrolledCount ? e.submittedCount / e.enrolledCount : 0} />
                        </div>
                        <StatusPill status={e.status} />
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title={<span className="flex items-center gap-2"><ActivityIcon className="h-4 w-4 text-accent" /> Activity</span>} bodyClass="p-0">
              {d.activity.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Quiet so far. Events will appear as exams run.</p>
              ) : (
                <ol className="relative max-h-[480px] overflow-y-auto px-4 py-3">
                  <span className="absolute bottom-4 left-[23px] top-4 w-px bg-border" />
                  {d.activity.map((a) => (
                    <li key={a.id} className="relative flex gap-3 py-2.5" data-testid={`row-activity-${a.id}`}>
                      <span className="relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-card bg-accent ring-1 ring-accent/30" style={{ marginLeft: 3 }} />
                      <div className="min-w-0">
                        <div className="text-sm">{a.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{a.detail}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">{ago(a.createdAt)}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
