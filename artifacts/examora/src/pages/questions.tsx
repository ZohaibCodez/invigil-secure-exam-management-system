import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Library, Pencil, Trash2, Loader2, X, CircleDot, ListChecks, PenLine } from 'lucide-react';
import {
  useListQuestions,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  getListQuestionsQueryKey,
  getGetDashboardQueryKey,
  type Question,
  type QuestionInput,
  type QuestionInputType,
  type QuestionInputDifficulty,
} from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, SkeletonRows, Field } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { errMsg } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export const TYPE_META = {
  single: { label: 'Single answer', icon: CircleDot },
  multiple: { label: 'Multiple answer', icon: ListChecks },
  written: { label: 'Written', icon: PenLine },
} as const;

const diffTone: Record<string, string> = {
  easy: 'text-[hsl(158_40%_34%)] dark:text-[hsl(158_40%_62%)]',
  medium: 'text-[hsl(30_70%_40%)] dark:text-[hsl(38_70%_62%)]',
  hard: 'text-accent',
};

let optSeq = 0;
const newOpt = (text = '') => ({ id: `o${Date.now().toString(36)}${(optSeq++).toString(36)}`, text });

function QuestionEditor({ initial, onDone }: { initial: Question | null; onDone: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateQuestion();
  const update = useUpdateQuestion();
  const [type, setType] = useState<QuestionInputType>(initial?.type ?? 'single');
  const [text, setText] = useState(initial?.text ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [difficulty, setDifficulty] = useState<QuestionInputDifficulty>(initial?.difficulty ?? 'medium');
  const [marks, setMarks] = useState(String(initial?.marks ?? 2));
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [options, setOptions] = useState(initial?.options?.length ? initial.options : [newOpt(), newOpt()]);
  const [correct, setCorrect] = useState<string[]>(initial?.correctAnswers ?? []);
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const toggleCorrect = (id: string) => {
    if (type === 'single') setCorrect([id]);
    else setCorrect((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };

  const submit = () => {
    const m = Number(marks);
    const opts = type === 'written' ? [] : options.map((o) => ({ ...o, text: o.text.trim() }));
    const corr = type === 'written' ? [] : correct.filter((c) => opts.some((o) => o.id === c));
    if (text.trim().length < 5) return setError('Question text needs at least 5 characters.');
    if (!category.trim()) return setError('Give it a category.');
    if (!Number.isFinite(m) || m < 1 || m > 1000) return setError('Marks must be between 1 and 1000.');
    if (type !== 'written') {
      if (opts.length < 2) return setError('Add at least two options.');
      if (opts.some((o) => !o.text)) return setError('Every option needs text.');
      if (type === 'single' && corr.length !== 1) return setError('Single-answer questions need exactly one correct option.');
      if (type === 'multiple' && corr.length < 1) return setError('Mark at least one correct option.');
    }
    setError(null);
    const data: QuestionInput = { text: text.trim(), type, category: category.trim(), difficulty, marks: m, options: opts, correctAnswers: corr, explanation: explanation.trim() };
    const opt = {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListQuestionsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        toast({ title: initial ? 'Question updated' : 'Question added to bank' });
        onDone();
      },
      onError: (e: unknown) => setError(errMsg(e)),
    };
    if (initial) update.mutate({ id: initial.id, data }, opt);
    else create.mutate({ data }, opt);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(TYPE_META) as QuestionInputType[]).map((t) => {
          const M = TYPE_META[t];
          return (
            <button
              key={t}
              type="button"
              data-testid={`button-type-${t}`}
              onClick={() => {
                setType(t);
                if (t === 'single') setCorrect((c) => c.slice(0, 1));
              }}
              className={cn('flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-xs transition', type === t ? 'border-accent bg-accent/[0.06] text-foreground' : 'text-muted-foreground hover:border-foreground/30')}
            >
              <M.icon className={cn('h-4 w-4', type === t && 'text-accent')} />
              {M.label}
            </button>
          );
        })}
      </div>
      <Field label="Question">
        <Textarea data-testid="input-question-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Which statement best describes the second law of thermodynamics?" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Category"><Input data-testid="input-question-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Entropy" /></Field>
        <Field label="Difficulty">
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as QuestionInputDifficulty)}>
            <SelectTrigger data-testid="select-difficulty"><SelectValue /></SelectTrigger>
            <SelectContent>{['easy', 'medium', 'hard'].map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Marks"><Input data-testid="input-question-marks" type="number" min={1} value={marks} onChange={(e) => setMarks(e.target.value)} /></Field>
      </div>
      {type !== 'written' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs"><span className="font-medium">Options <span className="text-muted-foreground">— tick the correct {type === 'single' ? 'one' : 'ones'}</span></span></div>
          <AnimatePresence initial={false}>
            {options.map((o, i) => (
              <motion.div key={o.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Mark option ${i + 1} correct`}
                  data-testid={`button-correct-${i}`}
                  onClick={() => toggleCorrect(o.id)}
                  className={cn('grid h-8 w-8 shrink-0 place-items-center border font-mono text-xs transition', type === 'single' ? 'rounded-full' : 'rounded-md', correct.includes(o.id) ? 'border-accent bg-accent text-accent-foreground' : 'hover:border-accent/60')}
                >
                  {String.fromCharCode(65 + i)}
                </button>
                <Input data-testid={`input-option-${i}`} value={o.text} onChange={(e) => setOptions((os) => os.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                <Button type="button" size="icon" variant="ghost" aria-label="Remove option" disabled={options.length <= 2} onClick={() => { setOptions((os) => os.filter((x) => x.id !== o.id)); setCorrect((c) => c.filter((x) => x !== o.id)); }}><X className="h-4 w-4" /></Button>
              </motion.div>
            ))}
          </AnimatePresence>
          {options.length < 10 && <Button type="button" variant="ghost" size="sm" onClick={() => setOptions((os) => [...os, newOpt()])} data-testid="button-add-option"><Plus className="mr-1 h-3.5 w-3.5" />Add option</Button>}
        </div>
      )}
      <Field label="Explanation / marking guide" hint={type === 'written' ? 'Shown to graders alongside the candidate answer.' : 'Optional rationale.'}>
        <Textarea data-testid="input-question-explanation" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </Field>
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button onClick={submit} disabled={pending} data-testid="button-save-question">{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{initial ? 'Save changes' : 'Add to bank'}</Button>
      </div>
    </div>
  );
}

export default function Questions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useListQuestions({ query: { queryKey: getListQuestionsQueryKey() } });
  const del = useDeleteQuestion();
  const [editing, setEditing] = useState<Question | null | 'new'>(null);
  const [toDelete, setToDelete] = useState<Question | null>(null);
  const [text, setText] = useState('');
  const [type, setType] = useState('all');
  const [cat, setCat] = useState('all');
  const cats = useMemo(() => Array.from(new Set((q.data ?? []).map((x) => x.category))).sort(), [q.data]);
  const rows = (q.data ?? []).filter((x) => (type === 'all' || x.type === type) && (cat === 'all' || x.category === cat) && x.text.toLowerCase().includes(text.toLowerCase()));

  return (
    <div>
      <PageHeader eyebrow="Question bank" title="Questions" description="Reusable across papers. Editing a bank question never alters a paper candidates have already received." actions={<Button onClick={() => setEditing('new')} data-testid="button-new-question"><Plus className="mr-1.5 h-4 w-4" />New question</Button>} />
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search question text" className="bg-card pl-9" data-testid="input-search-questions" /></div>
        <Select value={type} onValueChange={setType}><SelectTrigger className="bg-card md:w-44" data-testid="select-type-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{Object.entries(TYPE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
        <Select value={cat} onValueChange={setCat}><SelectTrigger className="bg-card md:w-48" data-testid="select-category-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
      </div>
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading ? <SkeletonRows rows={6} /> : rows.length === 0 ? (
        <EmptyState icon={<Library className="h-5 w-5" />} title={q.data?.length ? 'No matches' : 'The bank is empty'} body={q.data?.length ? 'Loosen a filter.' : 'Write a question or import a CSV of them.'} action={!q.data?.length && <Button onClick={() => setEditing('new')}>Write the first one</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {rows.map((x, i) => {
              const M = TYPE_META[x.type];
              return (
                <motion.article layout key={x.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: Math.min(i, 10) * 0.02 }} data-testid={`card-question-${x.id}`} className="group flex flex-col rounded-xl border bg-card p-4 transition hover:border-foreground/20">
                  <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <M.icon className="h-3.5 w-3.5" /> {M.label}<span>·</span>{x.category}<span>·</span><span className={diffTone[x.difficulty]}>{x.difficulty}</span>
                    <span className="ml-auto rounded bg-secondary px-1.5 py-0.5 text-foreground tnum">{x.marks}m</span>
                  </div>
                  <p className="line-clamp-3 text-sm">{x.text}</p>
                  {x.options.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs">
                      {x.options.slice(0, 4).map((o, k) => (
                        <li key={o.id} className={cn('flex gap-2', x.correctAnswers.includes(o.id) ? 'text-foreground' : 'text-muted-foreground')}>
                          <span className={cn('font-mono', x.correctAnswers.includes(o.id) && 'text-accent')}>{String.fromCharCode(65 + k)}</span><span className="truncate">{o.text}</span>
                        </li>
                      ))}
                      {x.options.length > 4 && <li className="text-muted-foreground">+{x.options.length - 4} more</li>}
                    </ul>
                  )}
                  <div className="mt-auto flex justify-end gap-1 pt-3 opacity-70 transition group-hover:opacity-100">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(x)} data-testid={`button-edit-question-${x.id}`}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                    <Button size="sm" variant="ghost" className="hover:text-destructive" onClick={() => setToDelete(x)} data-testid={`button-delete-question-${x.id}`}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-normal">{editing === 'new' ? 'New question' : 'Edit question'}</DialogTitle>
            <DialogDescription>Single: exactly one correct. Multiple: at least one. Written: graded by hand.</DialogDescription>
          </DialogHeader>
          {editing !== null && <QuestionEditor key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this question?</AlertDialogTitle><AlertDialogDescription>It will be removed from the bank. Papers already issued keep their frozen copy.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete-question" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toDelete && del.mutate({ id: toDelete.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListQuestionsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); toast({ title: 'Question deleted' }); }, onError: (e) => toast({ title: 'Delete failed', description: errMsg(e), variant: 'destructive' }) })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
