import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, Gavel, MessageSquareText, Info, Clock, FlaskConical, FileWarning } from 'lucide-react';
import {
  useGetIntegrityRecord,
  useSaveDisclosure,
  useRequestAuthorshipReview,
  useRespondToAuthorship,
  useDecideAuthorship,
  getGetIntegrityRecordQueryKey,
  type AuthorshipReview,
  type AuthorshipDecisionInputOutcome,
  type IntegrityRecord,
} from '@workspace/api-client-react';
import { ErrorState } from '@/components/kit';
import { PolicySummary } from '@/components/assistance-policy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { errMsg, errStatus, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Q = { id: string; text: string };

const OUTCOMES: Record<AuthorshipDecisionInputOutcome, { label: string; body: string }> = {
  satisfactory: { label: 'Satisfactory', body: 'The explanation is consistent with the submitted answer.' },
  further_review: { label: 'Further review', body: 'Advisory referral to the institution’s existing incident process. Not a grade or misconduct decision; marks are unchanged.' },
};

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground', className)}>{children}</div>;
}
function Count({ n, min, max }: { n: number; min: number; max: number }) {
  return <span className={cn('font-mono text-[10.5px] tnum', n > 0 && (n < min || n > max) ? 'text-accent' : 'text-muted-foreground')}>{n}/{max}{n < min ? ` · at least ${min}` : ''}</span>;
}

function useInvalidate(attemptId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: getGetIntegrityRecordQueryKey(attemptId) });
}

function DisclosureBlock({ rec, staff }: { rec: IntegrityRecord; staff: boolean }) {
  const inv = useInvalidate(rec.attemptId);
  const m = useSaveDisclosure();
  const [text, setText] = useState(rec.disclosure);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const edited = useRef(false);
  useEffect(() => { if (!edited.current) setText(rec.disclosure); }, [rec.disclosure]);
  const active = rec.attemptStatus === 'active';
  const canEdit = !staff && active && !rec.sandbox;
  const dirty = text !== rec.disclosure;
  if (!canEdit) {
    return (
      <section className="rounded-lg border bg-card p-4" data-testid="section-disclosure">
        <Eyebrow>Assistance disclosure · self-reported</Eyebrow>
        {rec.disclosure ? <p className="mt-2 whitespace-pre-wrap text-sm" data-testid="text-disclosure">{rec.disclosure}</p>
          : <p className="mt-2 text-sm text-muted-foreground">{rec.sandbox ? 'Sandbox attempts do not record disclosures.' : 'No disclosure was written.'}</p>}
        {rec.disclosureStatus === 'missing_required' && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-dashed border-accent/50 p-2.5 text-[11.5px]" data-testid="status-disclosure-missing">
            <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <span>Required disclosure not provided. Recorded as a fact only; it is not a finding of misconduct and did not block finalising the attempt at its deadline.</span>
          </p>
        )}
        {!staff && !active && !rec.sandbox && <p className="mt-2 text-[11px] text-muted-foreground">Closed when the attempt ended.</p>}
      </section>
    );
  }
  return (
    <section className="space-y-2 rounded-lg border bg-card p-4" data-testid="section-disclosure">
      <label htmlFor="disclosure" className="block"><Eyebrow>Assistance disclosure{rec.policy?.requireDisclosure ? ' · required' : ' · optional'}</Eyebrow></label>
      <Textarea id="disclosure" rows={4} maxLength={5000} value={text} onChange={(e) => { edited.current = true; setText(e.target.value); setSaved(false); }} data-testid="input-disclosure"
        placeholder="Which tools or resources you used, and for what. Saving does not pause your timer." />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Count n={text.length} min={0} max={5000} />
        <div className="flex items-center gap-2">
          <span aria-live="polite" className="text-[11px] text-muted-foreground" data-testid="status-disclosure">
            {m.isPending ? 'Saving' : saved && !dirty ? <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" />Saved</span> : dirty ? 'Unsaved' : ''}
          </span>
          <Button size="sm" disabled={!dirty || m.isPending} data-testid="button-save-disclosure"
            onClick={() => { setErr(null); const sent = text; m.mutate({ id: rec.attemptId, data: { disclosure: sent, version: rec.disclosureVersion } }, { onSuccess: () => { setSaved(true); setText((t) => { if (t === sent) edited.current = false; return t; }); inv(); }, onError: (e) => { setErr(errStatus(e) === 409 ? 'Your disclosure changed elsewhere (another tab or device). Your text is kept here; review it and save again.' : errMsg(e)); inv(); } }); }}>
            {m.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Save disclosure
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">You can revise this until your original deadline. The deadline never pauses.</p>
      <p className="text-[11px] text-muted-foreground">Save explicitly while online. Unsaved disclosures are not included in answer or scratchpad recovery.</p>
      {err && dirty && rec.disclosure && (
        <details className="rounded-md border p-2 text-xs">
          <summary className="cursor-pointer">Compare the currently saved disclosure</summary>
          <p className="mt-2 whitespace-pre-wrap">{rec.disclosure}</p>
        </details>
      )}
      {err && <p role="alert" className="text-xs text-accent" data-testid="text-disclosure-error">{err}</p>}
    </section>
  );
}

function RequestForm({ rec, questions }: { rec: IntegrityRecord; questions?: Q[] }) {
  const inv = useInvalidate(rec.attemptId);
  const m = useRequestAuthorshipReview();
  const [qid, setQid] = useState(questions?.[0]?.id ?? '');
  useEffect(() => {
    if (questions?.length && !questions.some((q) => q.id === qid)) setQid(questions[0].id);
  }, [questions, qid]);
  const [prompt, setPrompt] = useState('');
  const [hours, setHours] = useState('24');
  const [err, setErr] = useState<string | null>(null);
  const h = Number(hours);
  const hOk = Number.isInteger(h) && h >= 1 && h <= 168;
  const n = prompt.trim().length;
  const ok = !!qid.trim() && n >= 10 && n <= 5000 && hOk;
  return (
    <section className="space-y-3 rounded-lg border p-4" data-testid="form-request-review">
      <Eyebrow>Ask the candidate to explain an answer</Eyebrow>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div>
          <label htmlFor="rv-q" className="text-xs font-medium">Question</label>
          {questions?.length ? (
            <select id="rv-q" value={qid} onChange={(e) => setQid(e.target.value)} data-testid="select-review-question"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              {questions.map((q, i) => <option key={q.id} value={q.id}>Q{i + 1}. {q.text.slice(0, 80)}</option>)}
            </select>
          ) : (
            <Input id="rv-q" className="mt-1" value={qid} onChange={(e) => setQid(e.target.value)} placeholder="Question ID" data-testid="input-review-question" />
          )}
        </div>
        <div>
          <label htmlFor="rv-h" className="text-xs font-medium">Window (hours)</label>
          <Input id="rv-h" className="mt-1" type="number" min={1} max={168} value={hours} onChange={(e) => setHours(e.target.value)} data-testid="input-review-hours" aria-invalid={!hOk} />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">A separate response window. It never reopens or edits the original answers and never extends the exam deadline.</p>
      {!hOk && <p className="text-[11px] text-accent">Choose a whole number of hours from 1 to 168.</p>}
      <Textarea rows={3} aria-label="Prompt for the candidate" value={prompt} maxLength={5200} onChange={(e) => setPrompt(e.target.value)} data-testid="input-review-prompt"
        placeholder="Walk me through how you reached your answer to this question. The candidate will read this exactly." />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Count n={n} min={10} max={5000} />
        <Button size="sm" disabled={!ok || m.isPending} data-testid="button-request-review"
          onClick={() => { setErr(null); m.mutate({ id: rec.attemptId, data: { questionId: qid.trim(), prompt: prompt.trim(), hours: h } }, { onSuccess: () => { setPrompt(''); inv(); }, onError: (e) => { setErr(errMsg(e)); inv(); } }); }}>
          {m.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <MessageSquareText className="mr-1.5 h-3.5 w-3.5" />}Send request
        </Button>
      </div>
      {err && <p role="alert" className="text-xs text-accent" data-testid="text-request-error">{err}</p>}
    </section>
  );
}

function RespondForm({ r, inv }: { r: AuthorshipReview; inv: () => void }) {
  const m = useRespondToAuthorship();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const n = text.trim().length;
  return (
    <div className="mt-3 space-y-2">
      <Textarea rows={4} aria-label="Your explanation" value={text} maxLength={10200} onChange={(e) => setText(e.target.value)} data-testid={`input-response-${r.id}`}
        placeholder="Explain your reasoning in your own words." />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Count n={n} min={10} max={10000} />
        <Button size="sm" disabled={n < 10 || n > 10000 || m.isPending} data-testid={`button-respond-${r.id}`}
          onClick={() => { setErr(null); m.mutate({ id: r.id, data: { response: text.trim() } }, { onSuccess: () => { setText(''); inv(); }, onError: (e) => { setErr(errMsg(e)); inv(); } }); }}>
          {m.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Send explanation
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">One explanation per request. It cannot be edited once sent.</p>
      {err && <p role="alert" className="text-xs text-accent" data-testid={`text-response-error-${r.id}`}>{err}</p>}
    </div>
  );
}

function DecideForm({ r, inv }: { r: AuthorshipReview; inv: () => void }) {
  const m = useDecideAuthorship();
  const [outcome, setOutcome] = useState<AuthorshipDecisionInputOutcome | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const n = reason.trim().length;
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <Eyebrow>Advisory decision · final once recorded</Eyebrow>
      <div role="radiogroup" aria-label="Outcome" className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(OUTCOMES) as AuthorshipDecisionInputOutcome[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={outcome === k} onClick={() => setOutcome(k)} data-testid={`radio-outcome-${k}-${r.id}`}
            className={cn('rounded-md border px-3 py-2 text-left transition-colors motion-reduce:transition-none', outcome === k ? 'border-foreground bg-foreground/[0.04]' : 'hover:border-foreground/40')}>
            <div className="text-sm font-medium">{OUTCOMES[k].label}</div>
            <div className="text-[11px] text-muted-foreground">{OUTCOMES[k].body}</div>
          </button>
        ))}
      </div>
      <Textarea rows={3} aria-label="Reason" value={reason} maxLength={5200} onChange={(e) => setReason(e.target.value)} data-testid={`input-decision-reason-${r.id}`} placeholder="Reason. The candidate will read this." />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Count n={n} min={10} max={5000} />
        <Button size="sm" disabled={!outcome || n < 10 || n > 5000 || m.isPending} data-testid={`button-decide-${r.id}`}
          onClick={() => { if (!outcome) return; setErr(null); m.mutate({ id: r.id, data: { outcome, reason: reason.trim() } }, { onSuccess: inv, onError: (e) => { setErr(errMsg(e)); inv(); } }); }}>
          {m.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Gavel className="mr-1.5 h-3.5 w-3.5" />}Record decision
        </Button>
      </div>
      {err && <p role="alert" className="text-xs text-accent" data-testid={`text-decision-error-${r.id}`}>{err}</p>}
    </div>
  );
}

function ReviewCard({ r, rec, staff, questions, index }: { r: AuthorshipReview; rec: IntegrityRecord; staff: boolean; questions?: Q[]; index: number }) {
  const inv = useInvalidate(rec.attemptId);
  const now = new Date(rec.serverNow).getTime();
  const expired = now > new Date(r.responseDeadline).getTime();
  const qi = questions?.findIndex((q) => q.id === r.questionId) ?? -1;
  const qLabel = qi >= 0 ? `Q${qi + 1}. ${questions![qi].text}` : `Question ${r.questionId}`;
  const status = r.reviewedAt ? 'Decided' : r.respondedAt ? 'Explanation received' : expired ? 'Window closed, no response' : 'Awaiting explanation';
  return (
    <li className="rounded-lg border bg-card p-4" data-testid={`card-review-${r.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>Request {index + 1} · {r.requesterName} · {fmtDate(r.requestedAt)}</Eyebrow>
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider" data-testid={`status-review-${r.id}`}>{status}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{qLabel}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm">{r.prompt}</p>
      <p className="mt-2 flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground"><Clock className="h-3 w-3" />Respond by {fmtDate(r.responseDeadline)}</p>
      {r.response && (
        <div className="mt-3 border-l-2 border-accent/50 pl-3">
          <Eyebrow>Candidate explanation · {fmtDate(r.respondedAt)}</Eyebrow>
          <p className="mt-1 whitespace-pre-wrap font-display text-lg leading-snug">{r.response}</p>
        </div>
      )}
      {!staff && !r.respondedAt && !expired && <RespondForm r={r} inv={inv} />}
      {r.reviewedAt ? (
        <div className="mt-3 rounded-md border border-primary/25 bg-primary/[0.04] p-3" data-testid={`card-decision-${r.id}`}>
          <div className="flex items-center gap-2"><Gavel className="h-4 w-4" /><span className="font-display text-lg">{OUTCOMES[r.outcome as AuthorshipDecisionInputOutcome]?.label ?? r.outcome}</span></div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{r.reason}</p>
          <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">{r.reviewerName ? `${r.reviewerName} · ` : ''}{fmtDate(r.reviewedAt)} · advisory, does not change marks · final</p>
        </div>
      ) : staff && (r.respondedAt || expired) ? (
        <DecideForm r={r} inv={inv} />
      ) : staff ? (
        <p className="mt-3 text-[11px] text-muted-foreground">A decision can be recorded after the candidate responds or the window closes.</p>
      ) : null}
    </li>
  );
}

export function IntegrityReview({ attemptId, staff, questions }: { attemptId: string; staff: boolean; questions?: Q[] }) {
  const q = useGetIntegrityRecord(attemptId, { query: { queryKey: getGetIntegrityRecordQueryKey(attemptId), refetchInterval: 15000 } });
  if (q.isLoading) return <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-28" /></div>;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const rec = q.data;
  const submitted = rec.attemptStatus !== 'active';
  return (
    <div className="space-y-4" data-testid="panel-integrity-review">
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Human review only. Examora does not run AI detection and cannot verify authorship. Explanations and decisions are advisory, never change marks automatically, and cannot be edited once recorded.</span>
      </div>
      {rec.sandbox && <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground"><FlaskConical className="h-3.5 w-3.5" />Sandbox attempt. No real disclosures or reviews are recorded.</p>}
      {rec.policy ? (
        <div>
          <PolicySummary policy={rec.policy} />
          <p className="mt-1 font-mono text-[10.5px] text-muted-foreground" data-testid="text-acknowledged">{rec.acknowledgedAt ? `Acknowledged ${fmtDate(rec.acknowledgedAt)}` : rec.sandbox ? 'Sandbox attempt: no candidate attestation recorded' : 'Not acknowledged'}</p>
        </div>
      ) : <p className="text-xs text-muted-foreground">No assistance policy applied to this exam.</p>}
      <DisclosureBlock key={rec.attemptId} rec={rec} staff={staff} />
      {staff && !rec.sandbox && (submitted ? <RequestForm rec={rec} questions={questions} /> : <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Explanation requests open after the candidate submits.</p>)}
      <section>
        <Eyebrow className="mb-2">Explanation requests · {rec.reviews.length}</Eyebrow>
        {rec.reviews.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No explanation has been requested.</p> : (
          <ol className="space-y-3">{rec.reviews.map((r, i) => <ReviewCard key={r.id} r={r} rec={rec} staff={staff} questions={questions} index={i} />)}</ol>
        )}
      </section>
    </div>
  );
}
