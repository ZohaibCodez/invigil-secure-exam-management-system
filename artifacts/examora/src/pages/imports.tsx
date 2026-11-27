import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileUp, CheckCircle2, XCircle, Loader2, ScanSearch, Library, Users } from 'lucide-react';
import {
  useImportData,
  getListQuestionsQueryKey,
  getListUsersQueryKey,
  getGetDashboardQueryKey,
  type ImportResult,
} from '@workspace/api-client-react';
import { PageHeader, Panel } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { normalise, parseInput, SAMPLES, type Kind, type ParsedRow } from '@/lib/import-parse';
import { errMsg } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Imports() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const imp = useImportData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>('questions');
  const [text, setText] = useState('');
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [server, setServer] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);

  const serverErr = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const e of server?.errors ?? []) m.set(e.row, [...(m.get(e.row) ?? []), e.message]);
    return m;
  }, [server]);
  const valid = (rows ?? []).filter((r) => r.errors.length === 0);
  const anyInvalid = (rows ?? []).some((r) => r.errors.length > 0) || (server?.errors.length ?? 0) > 0;

  const reset = () => {
    setRows(null);
    setServer(null);
    setDone(null);
  };

  const preview = () => {
    reset();
    setParseErr(null);
    let raw: Record<string, unknown>[];
    try {
      raw = parseInput(text);
    } catch (e) {
      return setParseErr(`Could not parse: ${errMsg(e)}`);
    }
    if (!raw.length) return setParseErr('No rows found. Include a header row for CSV.');
    if (raw.length > 200) return setParseErr(`${raw.length} rows — the limit per import is 200. Split the file.`);
    const parsed = normalise(kind, raw);
    setRows(parsed);
    const ok = parsed.filter((r) => !r.errors.length);
    if (!ok.length) return;
    imp.mutate(
      { data: { kind, rows: ok.map((r) => r.data), commit: false } },
      {
        onSuccess: (res) => {
          // map server row numbers (1-based over sent rows) back to file rows
          setServer({ ...res, errors: res.errors.map((e) => ({ ...e, row: ok[e.row - 1]?.row ?? e.row })) });
        },
        onError: (e) => setParseErr(`Server validation failed: ${errMsg(e)}`),
      },
    );
  };

  const commit = () => {
    if (!rows || anyInvalid) return;
    imp.mutate(
      { data: { kind, rows: valid.map((r) => r.data), commit: true } },
      {
        onSuccess: (res) => {
          setDone(res);
          qc.invalidateQueries({ queryKey: kind === 'questions' ? getListQuestionsQueryKey() : getListUsersQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast({ title: `Imported ${res.imported} ${kind}` });
        },
        onError: (e) => toast({ title: 'Import failed', description: errMsg(e), variant: 'destructive' }),
      },
    );
  };

  const cols = kind === 'questions' ? ['text', 'type', 'category', 'marks', 'options'] : ['name', 'email', 'role'];

  return (
    <div>
      <PageHeader eyebrow="Bulk" title="Imports" description="Preview first. Nothing is written until every row validates on both this page and the server." />
      <div className="mb-5 grid grid-cols-2 gap-2 sm:w-[420px]">
        {(['questions', 'candidates'] as const).map((k) => {
          const I = k === 'questions' ? Library : Users;
          return (
            <button key={k} data-testid={`button-kind-${k}`} onClick={() => { setKind(k); reset(); setText(''); setParseErr(null); }} className={cn('relative flex items-center gap-2 rounded-lg border px-4 py-3 text-sm capitalize transition', kind === k ? 'border-accent' : 'text-muted-foreground hover:border-foreground/30')}>
              {kind === k && <motion.span layoutId="kind" className="absolute inset-0 rounded-lg bg-accent/[0.07]" />}
              <I className={cn('relative h-4 w-4', kind === k && 'text-accent')} /><span className="relative">{k}</span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-6 [&>*]:min-w-0 xl:grid-cols-[1fr_1.3fr]">
        <Panel title="Source" action={<button className="text-xs text-muted-foreground hover:text-accent" onClick={() => { setText(SAMPLES[kind]); reset(); }} data-testid="button-load-sample">Load example</button>}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) { setText(await f.text()); reset(); }
            }}
            className="mb-3 flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center"
          >
            <FileUp className="mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm">Drop a .csv or .json file, or <button className="text-accent underline-offset-2 hover:underline" onClick={() => fileRef.current?.click()} data-testid="button-choose-file">choose one</button></p>
            <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); reset(); } e.target.value = ''; }} />
          </div>
          <Textarea data-testid="input-import-text" rows={12} value={text} onChange={(e) => { setText(e.target.value); reset(); }} className="font-mono text-xs" placeholder={kind === 'questions' ? 'text,type,category,difficulty,marks,options,correctAnswers,explanation' : 'name,email,password'} />
          <div className="mt-3 text-xs text-muted-foreground">
            {kind === 'questions' ? 'options: JSON [{id,text}] or "A|B|C" (ids a, b, c…). correctAnswers: JSON ids or "a|c". Written rows leave both empty.' : 'Columns name, email, password. Every row is created as a candidate regardless of any role column.'}
          </div>
          {parseErr && <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{parseErr}</p>}
          <Button className="mt-4 w-full" variant="outline" disabled={!text.trim() || imp.isPending} onClick={preview} data-testid="button-preview-import">
            {imp.isPending && !rows ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}Validate &amp; preview
          </Button>
        </Panel>

        <Panel title="Preview" bodyClass="p-0">
          {!rows ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center text-sm text-muted-foreground"><Upload className="mb-3 h-6 w-6" />Rows appear here after validation.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4 border-b px-4 py-3 text-sm">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[hsl(158_40%_40%)]" /><span className="tnum">{valid.length - (server?.errors.length ?? 0)}</span> ready</span>
                <span className="flex items-center gap-1.5"><XCircle className="h-4 w-4 text-destructive" /><span className="tnum">{rows.length - valid.length + (server?.errors.length ?? 0)}</span> with problems</span>
                {imp.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Button size="sm" className="ml-auto" disabled={anyInvalid || imp.isPending || !server || !!done} onClick={commit} data-testid="button-commit-import">
                  Import {valid.length} {kind}
                </Button>
              </div>
              {anyInvalid && <div className="border-b bg-destructive/5 px-4 py-2 text-xs text-destructive">Fix every flagged row before importing — partial imports are blocked so the bank stays consistent.</div>}
              <AnimatePresence>
                {done && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="border-b bg-[hsl(158_30%_94%)] px-4 py-3 text-sm text-[hsl(158_40%_24%)] dark:bg-[hsl(158_25%_14%)] dark:text-[hsl(158_40%_70%)]" data-testid="text-import-done">
                    Imported {done.imported} of {done.valid} valid rows.
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card"><tr className="border-b text-left font-mono uppercase tracking-wider text-muted-foreground"><th className="px-3 py-2">#</th>{cols.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}<th className="px-3 py-2">Check</th></tr></thead>
                  <tbody className="divide-y">
                    {rows.map((r) => {
                      const errs = [...r.errors, ...(serverErr.get(r.row) ?? [])];
                      return (
                        <tr key={r.row} className={cn(errs.length && 'bg-destructive/[0.04]')} data-testid={`row-import-${r.row}`}>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{r.row}</td>
                          {cols.map((c) => {
                            const v = r.data[c];
                            return <td key={c} className="max-w-[220px] truncate px-3 py-2">{Array.isArray(v) ? v.map((o) => (typeof o === 'object' && o ? (o as { text: string }).text : String(o))).join(' | ') : String(v ?? '')}</td>;
                          })}
                          <td className="px-3 py-2">{errs.length ? <span className="text-destructive">{errs.join('; ')}</span> : <CheckCircle2 className="h-4 w-4 text-[hsl(158_40%_40%)]" />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
