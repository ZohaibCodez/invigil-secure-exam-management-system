import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Gavel, Loader2, LifeBuoy, ServerCog, MonitorSmartphone, Lock, ShieldCheck, Info } from 'lucide-react';
import {
  useGetIncidentDossier,
  useSubmitIncidentStatement,
  useReviewIncident,
  getGetIncidentDossierQueryKey,
  type IncidentDossier,
  type IncidentDecisionInputDisposition,
} from '@workspace/api-client-react';
import { ErrorState } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { errMsg, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const MIN = 10;
const MAX = 5000;

export const DISPOSITIONS: Record<IncidentDecisionInputDisposition, { label: string; body: string }> = {
  no_action: { label: 'No action', body: 'The recorded evidence does not support a remedy. The attempt stands as received.' },
  supervised_resit_recommended: { label: 'Supervised resit recommended', body: 'A recommendation only. A resit must be arranged separately; nothing is created automatically.' },
  referred_for_review: { label: 'Referred for further review', body: 'Passed to the institution’s wider review process. No mark or answer changes here.' },
};

const EVENT_LABEL: Record<string, string> = {
  'tab-hidden': 'Tab hidden',
  offline: 'Went offline',
  reconnected: 'Reconnected',
  recovery: 'Recovered local work',
  'late-recovery': 'Late local work found',
};

function Counter({ n }: { n: number }) {
  const bad = n > 0 && (n < MIN || n > MAX);
  return <span className={cn('font-mono text-[10.5px] tnum', bad ? 'text-accent' : 'text-muted-foreground')}>{n}/{MAX}{n > 0 && n < MIN ? ` · at least ${MIN}` : ''}</span>;
}

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground', className)}>{children}</div>;
}

function Decision({ d }: { d: IncidentDossier }) {
  const c = d.case;
  if (!c) return null;
  if (!c.reviewedAt || !c.disposition) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground" data-testid="status-incident-pending">
        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin [animation-duration:3s]" />
        Awaiting a human reviewer. A decision appears here once it is recorded; this panel refreshes on its own.
      </div>
    );
  }
  const meta = DISPOSITIONS[c.disposition];
  return (
    <div className="rounded-lg border border-primary/25 bg-primary/[0.04] p-4" data-testid="card-incident-decision">
      <div className="flex flex-wrap items-center gap-2">
        <Gavel className="h-4 w-4" />
        <span className="font-display text-xl" data-testid="text-incident-disposition">{meta.label}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{meta.body}</p>
      <Eyebrow className="mt-3">Recorded reason</Eyebrow>
      <p className="mt-1 whitespace-pre-wrap text-sm" data-testid="text-incident-reason">{c.reason}</p>
      <p className="mt-3 font-mono text-[10.5px] text-muted-foreground" data-testid="text-incident-reviewer">
        Decided by {c.reviewerName ?? 'a reviewer'} · {fmtDate(c.reviewedAt)} · final, cannot be edited
      </p>
    </div>
  );
}

function Evidence({ d }: { d: IncidentDossier }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border bg-card" data-testid="section-server-evidence">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <ServerCog className="h-3.5 w-3.5 text-[hsl(158_40%_32%)] dark:text-[hsl(158_40%_62%)]" />
          <span className="text-xs font-medium">Server record</span>
          <span className="ml-auto rounded bg-[hsl(158_40%_32%/0.1)] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-[hsl(158_40%_28%)] dark:text-[hsl(158_40%_62%)]">trusted</span>
        </header>
        <p className="border-b bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">Times the server accepted each save, and the answer revisions it acknowledged. Answer contents are not shown.</p>
        {d.serverSaves.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">No saves reached the server.</p>
        ) : (
          <ol className="max-h-64 divide-y overflow-y-auto">
            {d.serverSaves.map((s) => (
              <li key={s.operationId} className="px-3 py-2" data-testid={`row-save-${s.operationId}`}>
                <div className="flex justify-between gap-2 font-mono text-[11px]"><span className="tnum">{fmtDate(s.savedAt, 'd MMM HH:mm:ss')}</span><span className="truncate text-muted-foreground">{s.operationId.slice(0, 8)}</span></div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {s.revisions === null ? <em>Revision detail unavailable for this historical receipt (not zero)</em> : s.revisions.length === 0 ? 'No answer revisions (notes only)' : `${s.revisions.length} answer revision${s.revisions.length === 1 ? '' : 's'} acknowledged`}
                </div>
                {!!s.revisions?.length && (
                  <details className="mt-1 text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer">View persisted revisions</summary>
                    <ul className="mt-1 space-y-1 break-all font-mono">
                      {s.revisions.map(r => <li key={r.questionId}>{r.questionId} · revision {r.revision}</li>)}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="rounded-lg border border-dashed bg-card" data-testid="section-browser-evidence">
        <header className="flex items-center gap-2 border-b border-dashed px-3 py-2">
          <MonitorSmartphone className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Browser reports</span>
          <span className="ml-auto rounded bg-[hsl(38_80%_50%/0.12)] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-[hsl(30_70%_35%)] dark:text-[hsl(38_70%_65%)]">unverified</span>
        </header>
        <p className="border-b border-dashed bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">Claims sent by the candidate’s browser. Only the receipt time is the server’s; any time written inside a report is unverified. Context, not proof of anything.</p>
        {d.browserEvents.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">No browser reports received.</p>
        ) : (
          <ol className="max-h-64 divide-y divide-dashed overflow-y-auto">
            {d.browserEvents.map((e) => (
              <li key={e.id} className="px-3 py-2" data-testid={`row-browser-event-${e.id}`}>
                <div className="flex justify-between gap-2 text-[11px]"><span className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</span><span className="font-mono text-muted-foreground tnum">received {fmtDate(e.receivedAt, 'HH:mm:ss')}</span></div>
                {e.detail && <div className="mt-0.5 break-words text-[11px] italic text-muted-foreground">“{e.detail}”</div>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Policy({ d }: { d: IncidentDossier }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-[11.5px] leading-relaxed text-muted-foreground" data-testid="text-incident-policy">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        A review never changes the deadline ({fmtDate(d.deadline)}), answers, score or result publication, and never creates a resit by itself. Any recommendation needs separate supervised arrangements.
        {d.resultsPublished && <> <Lock className="mb-0.5 inline h-3 w-3" /> Results for this exam are already published, so this grade stays locked as published.</>}
      </span>
    </div>
  );
}

function StatementForm({ attemptId }: { attemptId: string }) {
  const qc = useQueryClient();
  const m = useSubmitIncidentStatement();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const n = text.trim().length;
  const ok = n >= MIN && n <= MAX;
  return (
    <div className="space-y-2">
      <Textarea aria-label="Candidate incident statement" data-testid="input-incident-statement" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX + 200}
        placeholder="What happened, roughly when, and what you saw on screen. Plain words are fine." />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Counter n={n} />
        <Button size="sm" disabled={!ok || m.isPending} data-testid="button-submit-statement"
          onClick={() => {
            setErr(null);
            m.mutate({ id: attemptId, data: { statement: text.trim() } }, {
              onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: getGetIncidentDossierQueryKey(attemptId) }); },
              onError: (e) => { setErr(errMsg(e)); qc.invalidateQueries({ queryKey: getGetIncidentDossierQueryKey(attemptId) }); },
            });
          }}>
          {m.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Send statement
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">One statement per attempt. Once sent it cannot be edited, so it reads exactly as you wrote it.</p>
      {err && <p role="alert" className="text-xs text-accent" data-testid="text-statement-error">{err}</p>}
    </div>
  );
}

function DecisionForm({ attemptId }: { attemptId: string }) {
  const qc = useQueryClient();
  const m = useReviewIncident();
  const [reason, setReason] = useState('');
  const [disp, setDisp] = useState<IncidentDecisionInputDisposition | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const n = reason.trim().length;
  const ok = n >= MIN && n <= MAX && !!disp;
  return (
    <div className="space-y-3 rounded-lg border p-4" data-testid="form-incident-decision">
      <Eyebrow>Your decision · final once recorded</Eyebrow>
      <div className="grid gap-2" role="radiogroup" aria-label="Review disposition">
        {(Object.keys(DISPOSITIONS) as IncidentDecisionInputDisposition[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={disp === k} onClick={() => setDisp(k)} data-testid={`radio-disposition-${k}`}
            className={cn('rounded-md border px-3 py-2 text-left transition', disp === k ? 'border-foreground bg-foreground/[0.04]' : 'hover:border-foreground/40')}>
            <div className="flex items-center gap-2 text-sm font-medium"><span className={cn('h-3 w-3 rounded-full border', disp === k && 'border-[4px] border-foreground')} />{DISPOSITIONS[k].label}</div>
            <div className="ml-5 text-[11px] text-muted-foreground">{DISPOSITIONS[k].body}</div>
          </button>
        ))}
      </div>
      <Textarea aria-label="Reason for incident decision" data-testid="input-incident-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={MAX + 200}
        placeholder="Reason, referring to the server record. The candidate will read this." />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Counter n={n} />
        <Button size="sm" disabled={!ok || m.isPending} data-testid="button-record-decision"
          onClick={() => {
            if (!disp) return;
            setErr(null);
            m.mutate({ id: attemptId, data: { reason: reason.trim(), disposition: disp } }, {
              onSuccess: () => qc.invalidateQueries({ queryKey: getGetIncidentDossierQueryKey(attemptId) }),
              onError: (e) => { setErr(errMsg(e)); qc.invalidateQueries({ queryKey: getGetIncidentDossierQueryKey(attemptId) }); },
            });
          }}>
          {m.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Gavel className="mr-1.5 h-3.5 w-3.5" />}Record decision
        </Button>
      </div>
      {err && <p role="alert" className="text-xs text-accent" data-testid="text-decision-error">{err}</p>}
    </div>
  );
}

function Body({ attemptId, mode }: { attemptId: string; mode: 'candidate' | 'staff' }) {
  const q = useGetIncidentDossier(attemptId, { query: { queryKey: getGetIncidentDossierQueryKey(attemptId), enabled: !!attemptId, refetchInterval: 10000 } });
  if (q.isLoading) return <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-32" /></div>;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const c = d.case;
  return (
    <div className="space-y-4">
      {c ? (
        <div className="rounded-lg border bg-card p-4" data-testid="card-incident-statement">
          <Eyebrow>Candidate statement · self-reported · received {fmtDate(c.submittedAt)}</Eyebrow>
          <p className="mt-2 whitespace-pre-wrap font-display text-lg leading-snug">“{c.statement}”</p>
        </div>
      ) : mode === 'candidate' ? (
        <StatementForm attemptId={attemptId} />
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground" data-testid="text-incident-no-case">
          The candidate has not filed a statement. A decision can only be recorded on a filed case.
        </p>
      )}
      {c && (mode === 'staff' && !c.reviewedAt ? <DecisionForm attemptId={attemptId} /> : <Decision d={d} />)}
      {mode === 'staff' || c ? <Evidence d={d} /> : null}
      <Policy d={d} />
    </div>
  );
}

/** Technical-incident review. Mount with key={attemptId} so local form state never crosses attempts. */
export function IncidentReview({ attemptId, mode, defaultOpen = false, className }: { attemptId: string; mode: 'candidate' | 'staff'; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const [visited, setVisited] = useState(defaultOpen);
  return (
    <div className={cn('rounded-xl border bg-card/80 text-left', className)} data-testid="panel-incident-review">
      <button type="button" onClick={() => { setVisited(true); setOpen((o) => !o); }} aria-expanded={open} data-testid="button-toggle-incident"
        className="flex w-full items-center gap-3 px-4 py-3 text-left">
        {mode === 'candidate' ? <LifeBuoy className="h-4 w-4 shrink-0 text-accent" /> : <ShieldCheck className="h-4 w-4 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{mode === 'candidate' ? 'Had a technical problem?' : 'Technical-incident dossier'}</span>
          <span className="block text-[11.5px] text-muted-foreground">
            {mode === 'candidate' ? 'Optional. A person reads it, alongside what the server recorded. It is not a cheating report.' : 'Server record versus browser claims, the candidate’s statement, and your decision.'}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {visited && <div hidden={!open} className="border-t p-4"><Body attemptId={attemptId} mode={mode} /></div>}
    </div>
  );
}
