import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search, FileText, Trash2, ArrowUpRight, Settings2 } from 'lucide-react';
import {
  useListExams,
  useCreateExam,
  useDeleteExam,
  getListExamsQueryKey,
  getGetDashboardQueryKey,
  type Exam,
} from '@workspace/api-client-react';
import { PageHeader, StatusPill, EmptyState, ErrorState, SkeletonRows, Meter } from '@/components/kit';
import { ExamForm, examDefaults } from '@/components/exam-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { fmtDate, errMsg } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const FILTERS = ['all', 'draft', 'published', 'ongoing', 'completed'] as const;

export default function Exams() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const search = useSearch();
  const [open, setOpen] = useState(() => new URLSearchParams(search).get('new') === '1');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [text, setText] = useState('');
  const [toDelete, setToDelete] = useState<Exam | null>(null);
  const q = useListExams({ query: { queryKey: getListExamsQueryKey(), refetchInterval: 30000 } });
  const create = useCreateExam();
  const del = useDeleteExam();

  const rows = useMemo(() => {
    const t = text.toLowerCase();
    return (q.data ?? []).filter((e) => (filter === 'all' || e.status === filter) && (`${e.title} ${e.subject}`.toLowerCase().includes(t)));
  }, [q.data, filter, text]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: q.data?.length ?? 0 };
    for (const e of q.data ?? []) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [q.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Examinations"
        title="Exams"
        description="Drafts are editable. Once published, the paper is frozen for candidates — schedule and status move forward only."
        actions={<Button data-testid="button-create-exam" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> New draft</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              data-testid={`filter-${f}`}
              onClick={() => setFilter(f)}
              className={cn('relative rounded-md px-3 py-1.5 text-xs capitalize transition', filter === f ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {filter === f && <motion.span layoutId="exam-filter" className="absolute inset-0 rounded-md bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <span className="relative">{f} <span className="tnum opacity-60">{counts[f] ?? 0}</span></span>
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-search-exams" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search title or subject" className="bg-card pl-9" />
        </div>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title={q.data?.length ? 'Nothing matches' : 'No exams yet'} body={q.data?.length ? 'Try a different filter or search.' : 'Start a draft. You can add questions and candidates afterwards.'} action={!q.data?.length && <Button onClick={() => setOpen(true)}>New draft</Button>} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[1.8fr_1fr_0.7fr_1fr_110px_90px] gap-4 border-b bg-muted/40 px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground md:grid">
            <span>Exam</span><span>Window</span><span>Paper</span><span>Submissions</span><span>Status</span><span />
          </div>
          <ul className="divide-y">
            <AnimatePresence initial={false}>
              {rows.map((e) => (
                <motion.li key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} data-testid={`row-exam-${e.id}`} className="group grid grid-cols-1 gap-3 px-4 py-3.5 transition hover:bg-muted/40 md:grid-cols-[1.8fr_1fr_0.7fr_1fr_110px_90px] md:items-center md:gap-4">
                  <Link href={`/exams/${e.id}`} className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium group-hover:text-accent">{e.title}<ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" /></div>
                    <div className="text-xs text-muted-foreground">{e.subject || 'General'}</div>
                  </Link>
                  <div className="text-xs text-muted-foreground tnum">{fmtDate(e.startsAt, 'd MMM HH:mm')}<br />{fmtDate(e.endsAt, 'd MMM HH:mm')}</div>
                  <div className="text-xs tnum">{e.questionCount} q · {e.totalMarks} marks<br /><span className="text-muted-foreground">{e.duration} min</span></div>
                  <div>
                    <div className="mb-1 text-xs tnum text-muted-foreground">{e.submittedCount} of {e.enrolledCount}</div>
                    <Meter value={e.enrolledCount ? e.submittedCount / e.enrolledCount : 0} />
                  </div>
                  <div className="flex items-center gap-2"><StatusPill status={e.status} />{e.resultsPublished && <span className="font-mono text-[9px] uppercase text-muted-foreground">res</span>}</div>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" aria-label="Configure" data-testid={`button-configure-${e.id}`} onClick={() => nav(`/exams/${e.id}`)}><Settings2 className="h-4 w-4" /></Button>
                    {e.status === 'draft' && (
                      <Button size="icon" variant="ghost" aria-label="Delete draft" data-testid={`button-delete-${e.id}`} onClick={() => setToDelete(e)} className="hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-normal">New draft</DialogTitle>
            <DialogDescription>Set the frame. Questions and candidates come next on the configuration page.</DialogDescription>
          </DialogHeader>
          <ExamForm
            initial={examDefaults()}
            questionIds={[]}
            pending={create.isPending}
            submitLabel="Create draft"
            onCancel={() => setOpen(false)}
            onSubmit={(data) =>
              create.mutate(
                { data },
                {
                  onSuccess: (ex) => {
                    invalidate();
                    setOpen(false);
                    toast({ title: 'Draft created', description: ex.title });
                    nav(`/exams/${ex.id}`);
                  },
                  onError: (er) => toast({ title: 'Could not create', description: errMsg(er), variant: 'destructive' }),
                },
              )
            }
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{toDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>Only drafts can be deleted. Bank questions are kept; enrollments for this draft are removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                toDelete &&
                del.mutate(
                  { id: toDelete.id },
                  {
                    onSuccess: () => {
                      invalidate();
                      toast({ title: 'Draft deleted' });
                    },
                    onError: (er) => toast({ title: 'Delete failed', description: errMsg(er), variant: 'destructive' }),
                  },
                )
              }
            >
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
