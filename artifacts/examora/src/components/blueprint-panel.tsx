import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, RotateCcw, Loader2, Lock, AlertTriangle, CheckCircle2, ChevronDown, Layers } from 'lucide-react';
import {
  useGetBlueprintReport,
  useSetBlueprint,
  getGetBlueprintReportQueryKey,
  getGetExamQueryKey,
  getListExamsQueryKey,
  getGetDashboardQueryKey,
  type BlueprintQuota,
  type BlueprintCheck,
  type ExamDetail,
  type FormComparison,
} from '@workspace/api-client-react';
import { Panel, ErrorState, SkeletonRows } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errMsg } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Row = { key: string; topic: string; difficulty: BlueprintQuota['difficulty']; type: BlueprintQuota['type']; marks: string; count: string };

let seq = 0;
const toRow = (q: BlueprintQuota): Row => ({ key: `r${++seq}`, topic: q.topic, difficulty: q.difficulty, type: q.type, marks: String(q.marks), count: String(q.count) });
const sig = (rows: { topic: string; difficulty: string; type: string; marks: string | number; count: string | number }[]) =>
  JSON.stringify(rows.map((r) => [r.topic.trim(), r.difficulty, r.type, Number(r.marks), Number(r.count)]));
const stratum = (r: { topic: string; difficulty: string; type: string; marks: string | number }) => JSON.stringify([r.topic.trim(), r.difficulty, r.type, Number(r.marks)]);

const selectCls = 'h-9 min-w-0 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60';
const mono = 'font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground';

function CheckLine({ c }: { c: BlueprintCheck }) {
  const ok = c.actualCount === c.count && c.actualMarks === c.marks * c.count;
  return (
    <tr className="border-t">
      <td className="py-1.5 pr-2">{c.topic} · {c.difficulty} · {c.type} · {c.marks}m</td>
      <td className="tnum py-1.5 pr-2 text-right">{c.count}</td>
      <td className={cn('tnum py-1.5 pr-2 text-right', !ok && 'text-destructive')}>{c.actualCount}</td>
      <td className="tnum py-1.5 pr-2 text-right">{c.marks * c.count}</td>
      <td className={cn('tnum py-1.5 text-right', !ok && 'text-destructive')}>{c.actualMarks}</td>
    </tr>
  );
}

function FormCard({ f, i }: { f: FormComparison; i: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border bg-background/60" data-testid={`card-form-${f.attemptId}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left" data-testid={`button-toggle-form-${f.attemptId}`}>
        <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[10px]', f.matches ? 'bg-secondary' : 'bg-destructive/10 text-destructive')}>{i + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{f.candidateName}{f.sandbox && <span className="ml-2 rounded border px-1 font-mono text-[9.5px] uppercase text-muted-foreground">sandbox</span>}</div>
          <div className={mono}>{f.attemptId.slice(0, 8)} · {f.status} · {f.questionCount} q · {f.totalMarks} marks</div>
        </div>
        <span className={cn('font-mono text-[10.5px] uppercase', f.matches ? 'text-muted-foreground' : 'text-destructive')}>{f.matches ? 'matches' : 'deviates'}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-3 border-t px-3 py-3">
            <div className={mono}>Checked against this attempt's own frozen quotas{f.sandbox ? ' (sandbox forms may predate the current draft)' : ''}</div>
            {f.checks.length === 0 ? <p className="text-xs text-muted-foreground">No quotas applied to this attempt (whole pool).</p> : (
              <div className="overflow-x-auto"><table className="w-full text-xs">
                <thead className={mono}><tr><th className="pb-1 text-left font-normal">Quota</th><th className="pb-1 text-right font-normal">Want</th><th className="pb-1 text-right font-normal">Got</th><th className="pb-1 text-right font-normal">Marks want</th><th className="pb-1 text-right font-normal">Got</th></tr></thead>
                <tbody>{f.checks.map((c, j) => <CheckLine key={j} c={c} />)}</tbody>
              </table></div>
            )}
            <div>
              <div className={cn(mono, 'mb-1')}>Snapshotted question IDs</div>
              <div className="flex flex-wrap gap-1" data-testid={`text-form-ids-${f.attemptId}`}>
                {f.questionIds.map((id) => <code key={id} className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{id}</code>)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function BlueprintPanel({ exam }: { exam: ExamDetail }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const report = useGetBlueprintReport(exam.id, { query: { queryKey: getGetBlueprintReportQueryKey(exam.id), refetchInterval: 20000 } });
  const save = useSetBlueprint();
  const r = report.data;
  const locked = exam.status !== 'draft' || !!r?.frozen;
  const editingDisabled = locked || save.isPending;

  const serverSig = useMemo(() => (r ? sig(r.quotas) : null), [r]);
  const [rows, setRows] = useState<Row[]>([]);
  const synced = useRef<string | null>(null);
  const dirty = synced.current !== null && sig(rows) !== synced.current;

  // Adopt server quotas on first load and on polls, but never over unsaved edits.
  useEffect(() => {
    if (!r || serverSig === null) return;
    if (synced.current === null || sig(rows) === synced.current) {
      synced.current = serverSig;
      setRows(r.quotas.map(toRow));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSig]);

  const pool = exam.questions;
  const topics = useMemo(() => Array.from(new Set(pool.map((q) => q.category))).sort(), [pool]);
  const avail = (row: Row) => pool.filter((q) => stratum({ topic: q.category, difficulty: q.difficulty, type: q.type, marks: q.marks }) === stratum(row)).length;
  const dupes = new Set(rows.map(stratum).filter((s, i, a) => a.indexOf(s) !== i));
  const totals = rows.reduce((t, x) => ({ count: t.count + (Number(x.count) || 0), marks: t.marks + (Number(x.count) || 0) * (Number(x.marks) || 0) }), { count: 0, marks: 0 });
  const rowBad = (x: Row) => !x.topic.trim() || x.topic.trim().length > 100 || !(Number(x.marks) >= 1 && Number(x.marks) <= 1000) || !(Number(x.count) >= 1 && Number(x.count) <= 200) || !Number.isInteger(Number(x.count));
  const invalid = rows.some(rowBad) || dupes.size > 0 || totals.count > 200;

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const add = () => setRows((rs) => [...rs, { key: `r${++seq}`, topic: topics[0] ?? '', difficulty: 'medium', type: 'single', marks: '1', count: '1' }]);
  const reset = () => {
    if (!r) return;
    synced.current = sig(r.quotas);
    setRows(r.quotas.map(toRow));
  };

  const submit = () => {
    const quotas: BlueprintQuota[] = rows.map((x) => ({ topic: x.topic.trim(), difficulty: x.difficulty, type: x.type, marks: Number(x.marks), count: Number(x.count) }));
    save.mutate(
      { id: exam.id, data: { quotas } },
      {
        onSuccess: (next) => {
          qc.setQueryData(getGetBlueprintReportQueryKey(exam.id), next);
          synced.current = sig(next.quotas);
          setRows(next.quotas.map(toRow));
          qc.invalidateQueries({ queryKey: getGetExamQueryKey(exam.id) });
          qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast({ title: quotas.length ? 'Blueprint saved' : 'Blueprint cleared', description: quotas.length ? `${totals.count} questions, ${totals.marks} marks per attempt` : 'Every attempt receives the whole pool.' });
        },
        onError: (e) => toast({ title: 'Blueprint refused', description: errMsg(e), variant: 'destructive' }),
      },
    );
  };

  if (report.isLoading) return <Panel title="Blueprint"><SkeletonRows rows={3} /></Panel>;
  if (report.isError || !r) return <Panel title="Blueprint"><ErrorState error={report.error} onRetry={() => report.refetch()} /></Panel>;

  const serverCheck = (x: Row) => r.checks.find((c) => stratum(c) === stratum(x));

  return (
    <div className="min-w-0 space-y-4">
      <Panel
        title={<span className="flex items-center gap-2"><Layers className="h-4 w-4 text-accent" />Blueprint</span>}
        action={
          <span className={cn('inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider', r.valid ? 'text-muted-foreground' : 'text-destructive')} data-testid="status-blueprint">
            {r.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {r.quotas.length === 0 ? 'Off · whole pool' : r.valid ? 'Valid' : 'Invalid'}
          </span>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          The selected questions form the eligible pool ({r.poolCount}). Each quota is an exact stratum — topic, difficulty, type and marks per question. Every attempt draws its own subset to these counts, independent of shuffle. Leave empty to give every candidate the same full pool.
        </p>
        <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
          {[['Pool', r.poolCount], ['Per attempt', r.questionCount], ['Marks / attempt', r.totalMarks]].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border bg-background/60 px-2 py-2"><dt className={mono}>{k}</dt><dd className="tnum mt-0.5 text-lg" data-testid={`text-blueprint-${String(k).toLowerCase().replace(/\W+/g, '-')}`}>{v}</dd></div>
          ))}
        </dl>

        {locked && <div className="mb-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Blueprint is frozen with the pool after publication. Editable only in draft.</div>}

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No quotas. Subset selection is off.</p>
        ) : (
          <div className="space-y-2">
            <div className={cn(mono, 'hidden grid-cols-[1.4fr_1fr_1fr_70px_70px_1.1fr_32px] gap-2 px-1 md:grid')}>
              <span>Topic</span><span>Difficulty</span><span>Type</span><span>Marks/q</span><span>Count</span><span>Pool check</span><span />
            </div>
            <AnimatePresence initial={false}>
              {rows.map((x, i) => {
                const sc = !dirty ? serverCheck(x) : undefined;
                 const a = sc?.available ?? avail(x);
                 const short = Math.max(0, (Number(x.count) || 0) - a);
                const dup = dupes.has(stratum(x));
                return (
                  <motion.div key={x.key} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    className={cn('grid grid-cols-2 gap-2 rounded-lg border p-2 md:grid-cols-[1.4fr_1fr_1fr_70px_70px_1.1fr_32px] md:items-center md:border-0 md:p-1', (short > 0 || dup || rowBad(x)) && 'md:bg-destructive/[0.04]')}
                    data-testid={`row-quota-${i}`}>
                     <Input className="col-span-2 min-w-0 md:col-span-1" aria-label="Topic (case-sensitive)" list={`topics-${exam.id}`} value={x.topic} disabled={editingDisabled} placeholder="Topic (exact)" onChange={(e) => patch(x.key, { topic: e.target.value })} data-testid={`input-quota-topic-${i}`} />
                     <select aria-label="Difficulty band" className={selectCls} value={x.difficulty} disabled={editingDisabled} onChange={(e) => patch(x.key, { difficulty: e.target.value as Row['difficulty'] })} data-testid={`select-quota-difficulty-${i}`}>
                      <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option>
                    </select>
                     <select aria-label="Question type" className={selectCls} value={x.type} disabled={editingDisabled} onChange={(e) => patch(x.key, { type: e.target.value as Row['type'] })} data-testid={`select-quota-type-${i}`}>
                      <option value="single">single</option><option value="multiple">multiple</option><option value="written">written</option>
                    </select>
                     <Input type="number" min={1} max={1000} className="min-w-0 tnum" value={x.marks} disabled={editingDisabled} onChange={(e) => patch(x.key, { marks: e.target.value })} data-testid={`input-quota-marks-${i}`} aria-label="Marks per question" />
                     <Input type="number" min={1} max={200} className="min-w-0 tnum" value={x.count} disabled={editingDisabled} onChange={(e) => patch(x.key, { count: e.target.value })} data-testid={`input-quota-count-${i}`} aria-label="Count" />
                    <div className="font-mono text-[11px] leading-tight tnum" data-testid={`text-quota-check-${i}`}>
                      <div><span className={short ? 'text-destructive' : 'text-foreground'}>{a}</span> avail · {(Number(x.count) || 0) * (Number(x.marks) || 0)}m</div>
                      <div className={short || dup || (sc && sc.shortage) ? 'text-destructive' : 'text-muted-foreground'}>
                        {dup ? 'duplicate stratum' : short ? `short ${short}` : sc && sc.shortage ? `server: short ${sc.shortage}` : 'covered'}
                      </div>
                    </div>
                     <Button variant="ghost" size="icon" className="h-8 w-8 justify-self-end" disabled={editingDisabled} onClick={() => setRows((rs) => rs.filter((y) => y.key !== x.key))} data-testid={`button-remove-quota-${i}`} aria-label="Remove quota"><Trash2 className="h-4 w-4" /></Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <datalist id={`topics-${exam.id}`}>{topics.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
          <Button variant="outline" size="sm" disabled={editingDisabled || totals.count >= 200} onClick={add} data-testid="button-add-quota"><Plus className="mr-1.5 h-3.5 w-3.5" />Add quota</Button>
          <span className="font-mono text-xs tnum text-muted-foreground" data-testid="text-quota-totals">{rows.length} rows · <span className="text-accent">{totals.count}</span> q · {totals.marks} marks{totals.count > 200 && <span className="text-destructive"> · over 200</span>}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" disabled={locked || !dirty || save.isPending} onClick={reset} data-testid="button-reset-blueprint"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reset</Button>
            <Button size="sm" disabled={locked || !dirty || invalid || save.isPending} onClick={submit} data-testid="button-save-blueprint">
              {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Save blueprint
            </Button>
          </div>
        </div>
        {dirty && <p className="mt-2 text-xs text-muted-foreground">Unsaved changes. Live refreshes will not replace your edits.</p>}

        {r.issues.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg border border-destructive/30 bg-destructive/[0.05] px-3 py-2 text-xs text-destructive" data-testid="list-blueprint-issues">
            {r.issues.map((s, i) => <li key={i} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{s}</li>)}
          </ul>
        )}
      </Panel>

      <Panel title={`Attempt forms · ${r.forms.length} · own quotas`}>
        {r.forms.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No attempts yet. Each attempt's selected subset is snapshotted here for comparison.</p>
        ) : (
          <ul className="space-y-2">{r.forms.map((f, i) => <FormCard key={f.attemptId} f={f} i={i} />)}</ul>
        )}
      </Panel>

      <Panel title={`Observed accuracy · ${r.items.length} item versions`} bodyClass="p-0">
        <p className="border-b px-4 py-2 text-xs text-muted-foreground">{r.caveat || 'Observed accuracy from completed real attempts, objective questions only. Each question version is listed separately. Not a calibrated difficulty.'}</p>
        {r.items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No completed real objective samples yet.</p>
        ) : (
          <ul className="max-h-[360px] divide-y overflow-y-auto">
            {r.items.map((it) => {
              return (
                <li key={it.id} className="grid grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-2 sm:flex sm:gap-3" data-testid={`row-item-${it.id}`}>
                  <code className="max-w-[140px] truncate font-mono text-[10px] text-muted-foreground" title={it.id}>{it.id}</code>
                  <p className="min-w-0 flex-1 truncate text-sm">{it.text}</p>
                  <span className="font-mono text-[11px] tnum text-muted-foreground">{it.samples} completed real</span>
                  <span className="w-28 text-right font-mono text-[11px] tnum">
                    {it.samples === 0 ? 'no data' : `${it.correct}/${it.samples} · ${Math.round(it.accuracy * 10) / 10}% observed`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
