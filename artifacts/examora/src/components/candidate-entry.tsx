import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Play, Loader2, RefreshCw, Timer, Printer, QrCode, WifiOff, CheckCircle2 } from 'lucide-react';
import {
  useStartAttempt,
  useGetEntryInformation,
  useRequestAdmission,
  useGetAdmission,
  getGetEntryInformationQueryKey,
  getGetAdmissionQueryKey,
  getGetDashboardQueryKey,
  getListExamsQueryKey,
  type Exam,
  type EntryInformation,
  type Admission,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PolicySummary } from '@/components/assistance-policy';
import { AdmissionBadge } from '@/components/admission-status';
import { useOnline } from '@/hooks/use-online';
import { errMsg, errStatus, fmtDate, clock } from '@/lib/format';
import { isStrict, minimumRequired, admissionUrl, ADMISSION_COPY } from '@/lib/delivery';
import { cn } from '@/lib/utils';

function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors', checked && 'border-[hsl(158_40%_40%/.45)] bg-[hsl(158_40%_40%/.06)]')}>
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(!!c)} className="mt-0.5" data-testid={`checkbox-${id}`} />
      <span>{children}</span>
    </label>
  );
}

function PrintableEntry({ info, admission }: { info: EntryInformation; admission: Admission | null }) {
  const s = info.settings;
  const rows: [string, string][] = [
    ['Candidate', info.candidateName],
    ['Reference', info.candidateId],
    ['Examination', info.examTitle],
    ['Subjects', info.subjects.join(', ') || '—'],
    ['Window', `${fmtDate(info.startsAt)} to ${fmtDate(info.endsAt)}`],
    ['Duration', `${info.duration} minutes`],
    ['Questions', `${info.questionCount} · ${info.totalMarks} marks`],
  ];
  if (s.venue) rows.push(['Venue', s.venue]);
  if (s.sessionLabel) rows.push(['Session', s.sessionLabel]);
  return (
    <div className="entry-print" aria-hidden>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Examora entry information</h1>
      <p style={{ fontSize: 11, marginBottom: 16 }}>Printed {fmtDate(new Date().toISOString())}. Contains no passwords or questions.</p>
      <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>{rows.map(([k, v]) => <tr key={k}><td style={{ padding: '4px 16px 4px 0', fontWeight: 600 }}>{k}</td><td>{v}</td></tr>)}</tbody>
      </table>
      {admission && admission.status === 'pending' && (
        <div style={{ marginTop: 20 }}>
          <QRCodeSVG value={admissionUrl(admission.id)} size={140} />
          <p style={{ fontSize: 12, marginTop: 6 }}>Admission code expires {fmtDate(admission.expiresAt, 'HH:mm:ss')}. It locates a request only and is not proof of identity.</p>
        </div>
      )}
    </div>
  );
}

function AdmissionStep({ examId, open, admissionId, setAdmissionId, onAdmission }: { examId: string; open: boolean; admissionId: string | null; setAdmissionId: (id: string) => void; onAdmission: (a: Admission | null) => void }) {
  const online = useOnline();
  const request = useRequestAdmission();
  const [err, setErr] = useState<string | null>(null);
  const expiredRef = useRef(false);
  const q = useGetAdmission(admissionId ?? '', {
    query: {
      queryKey: getGetAdmissionQueryKey(admissionId ?? ''),
      enabled: open && !!admissionId,
      refetchInterval: (query) => {
        const st = query.state.data?.status;
        if (!open || expiredRef.current) return false;
        return st === 'pending' ? 3000 : st === 'approved' || st === 'denied' ? 10000 : false;
      },
    },
  });
  const a = q.data && q.data.id === admissionId ? q.data : null;
  const [now, setNow] = useState(() => performance.now());
  const [anchor, setAnchor] = useState<{ left: number; perf: number } | null>(null);
  useEffect(() => {
    if (a) setAnchor({ left: Date.parse(a.expiresAt) - Date.parse(a.serverNow), perf: performance.now() });
  }, [a?.expiresAt, a?.serverNow]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!a || !(a.status === 'pending' || a.status === 'approved' || a.status === 'denied')) return;
    const t = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(t);
  }, [a?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = anchor ? Math.max(0, anchor.left - (now - anchor.perf)) : null;
  const locallyExpired = !!a && a.status !== 'consumed' && a.status !== 'expired' && left === 0;
  const status = a ? (locallyExpired ? 'expired' : a.status) : null;
  expiredRef.current = status === 'expired';
  // Report the normalized status to the parent only when id/status change (no loops).
  const aRef = useRef(a);
  aRef.current = a;
  useEffect(() => {
    const cur = aRef.current;
    onAdmission(cur && status ? { ...cur, status } : null);
  }, [a?.id, status, onAdmission]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async () => {
    setErr(null);
    try {
      const r = await request.mutateAsync({ id: examId });
      setAdmissionId(r.id);
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <section className="rounded-xl border p-4" data-testid="section-admission">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Staff approval</div>
        {status && <AdmissionBadge status={status} />}
      </div>
      {!admissionId ? (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-muted-foreground">Request a code and show it to the supervisor. Approval does not start your timer.</p>
          <Button size="sm" variant="outline" disabled={request.isPending || !online} onClick={ask} data-testid="button-request-admission">
            {request.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <QrCode className="mr-1.5 h-3.5 w-3.5" />}Request approval code
          </Button>
        </div>
      ) : !a ? (
        q.isError ? (
          <div className="mt-2 text-xs text-accent" role="alert">{errMsg(q.error)} <button className="underline" onClick={() => q.refetch()}>Retry</button></div>
        ) : (
          <Skeleton className="mt-3 h-40 w-full" />
        )
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3">
            {status === 'pending' && (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <div className="rounded-lg border bg-[hsl(40_40%_98%)] p-2" data-testid="img-admission-qr"><QRCodeSVG value={admissionUrl(a.id)} size={132} /></div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="text-sm text-foreground">Show this to the supervisor.</p>
                  <p>Expires in <span className="font-mono tnum text-foreground" data-testid="text-admission-expiry">{left === null ? '--:--' : clock(left)}</span>. Checking for a decision every few seconds.</p>
                  <p>Request ID <span className="font-mono text-foreground">{a.id}</span></p>
                  <p>The code locates your request. Staff confirm who you are in person.</p>
                </div>
              </div>
            )}
            {status === 'approved' && <p className="flex items-center gap-2 text-sm" data-testid="text-admission-approved"><CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(158_45%_32%)]" /><span>Approved{a.reviewerName ? ` by ${a.reviewerName}` : ''}. Press Start before it expires in <span className="font-mono tnum" data-testid="text-admission-expiry">{left === null ? '--:--' : clock(left)}</span>; your timer has not started.</span></p>}
            {(status === 'denied' || status === 'expired' || status === 'consumed') && (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">{ADMISSION_COPY[status].body}{a.reason ? ` Reason: ${a.reason}` : ''}</p>
                {status === 'denied' && left !== null && <p className="text-xs text-muted-foreground">A new request is possible in <span className="font-mono tnum">{clock(left)}</span>.</p>}
                {status === 'expired' && <Button size="sm" variant="outline" disabled={request.isPending || !online} onClick={ask} data-testid="button-refresh-admission"><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Request a fresh code</Button>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
      {!online && <p className="mt-2 flex items-center gap-1.5 text-xs text-accent" data-testid="text-admission-offline"><WifiOff className="h-3.5 w-3.5" />Offline. Approval status cannot be checked until you reconnect.</p>}
      {err && <p role="alert" className="mt-2 text-xs text-accent" data-testid="text-admission-error">{err}</p>}
    </section>
  );
}

export function CandidateEntry({ exam }: { exam: Exam }) {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const start = useStartAttempt();
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [instructionsRead, setInstructionsRead] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);
  const [subjectsConfirmed, setSubjectsConfirmed] = useState(false);
  const [admissionId, setAdmissionId] = useState<string | null>(null);
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [err, setErr] = useState<{ msg: string; stale: boolean } | null>(null);
  const policy = exam.assistancePolicy ?? null;

  const info = useGetEntryInformation(exam.id, { query: { queryKey: getGetEntryInformationQueryKey(exam.id), enabled: open, staleTime: 0 } });
  const e = info.data;
  const s = e?.settings ?? exam.deliverySettings;
  const strict = isStrict(s);
  const needsInfo = strict || isStrict(exam.deliverySettings);

  const ready =
    (!policy || ack) &&
    (!needsInfo || !!e) &&
    (!strict || instructionsRead) &&
    (!s?.requireReadiness || deviceReady) &&
    (!s?.confirmSubjects || subjectsConfirmed) &&
    (!s?.requireProctorApproval || admission?.status === 'approved');

  const resetChecks = () => {
    setAck(false); setInstructionsRead(false); setDeviceReady(false); setSubjectsConfirmed(false); setErr(null);
  };

  const reload = () => {
    resetChecks();
    setOpen(false);
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetEntryInformationQueryKey(exam.id) });
  };

  const begin = () => {
    setErr(null);
    start.mutate(
      {
        id: exam.id,
        data: {
          sandbox: false,
          policyVersion: policy?.version,
          ...(policy && ack ? { policyAcknowledged: true } : {}),
          ...(e ? { entryVersion: e.entryVersion } : {}),
          ...(s?.requireProctorApproval && admission ? { admissionId: admission.id } : {}),
          ...(strict ? { instructionsRead, deviceReady: !!s?.requireReadiness && deviceReady, subjectsConfirmed: !!s?.confirmSubjects && subjectsConfirmed } : {}),
        },
      },
      {
        onSuccess: (a) => {
          qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
          nav(`/attempts/${a.id}`);
        },
        onError: (er) => {
          const msg = errMsg(er);
          setErr({ msg, stale: errStatus(er) === 409 || /policy|version/i.test(msg) });
          if (admissionId) qc.invalidateQueries({ queryKey: getGetAdmissionQueryKey(admissionId) });
        },
      },
    );
  };

  return (
    <>
      <Button className="flex-1" onClick={() => { setOpen(true); resetChecks(); }} data-testid={`button-start-${exam.id}`}>
        <Play className="mr-2 h-4 w-4" /> Begin exam
      </Button>
      <Dialog open={open} onOpenChange={(o) => !start.isPending && setOpen(o)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-testid="dialog-candidate-entry">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">{exam.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" /> {exam.duration} minutes. Your timer starts only when you press Start below.
            </DialogDescription>
          </DialogHeader>
          <section>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Instructions</div>
            <p className="mt-1 whitespace-pre-wrap text-sm" data-testid="text-entry-instructions">{exam.instructions}</p>
          </section>

          {needsInfo && !e && (info.isError ? (
            <div role="alert" className="rounded-lg border border-accent/40 p-3 text-xs" data-testid="text-entry-info-error">{errMsg(info.error)} <button className="underline" onClick={() => info.refetch()}>Retry</button></div>
          ) : <Skeleton className="h-28 w-full" />)}

          {e && (
            <section className="rounded-xl border bg-muted/30 p-4 text-sm" data-testid="section-entry-information">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Entry information</div>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => window.print()} data-testid="button-print-entry"><Printer className="mr-1.5 h-3.5 w-3.5" />Print</Button>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Name</dt><dd data-testid="text-entry-name">{e.candidateName}</dd>
                <dt className="text-muted-foreground">Reference</dt><dd className="font-mono break-all" data-testid="text-entry-reference">{e.candidateId}</dd>
                <dt className="text-muted-foreground">Subjects</dt><dd data-testid="text-entry-subjects">{e.subjects.join(', ') || '—'}</dd>
                <dt className="text-muted-foreground">Paper</dt><dd>{e.questionCount} questions · {e.totalMarks} marks · {e.duration} min</dd>
                <dt className="text-muted-foreground">Window</dt><dd>{fmtDate(e.startsAt)} to {fmtDate(e.endsAt)}</dd>
                {e.settings.venue && <><dt className="text-muted-foreground">Venue</dt><dd>{e.settings.venue}</dd></>}
                {e.settings.sessionLabel && <><dt className="text-muted-foreground">Session</dt><dd>{e.settings.sessionLabel}</dd></>}
              </dl>
              {(e.settings.lockOnSave || e.settings.minimumAttemptPercent > 0 || e.settings.requireFullscreen) && (
                <ul className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                  {e.settings.requireFullscreen && <li>Fullscreen supervision: the paper runs in fullscreen. Leaving fullscreen or switching tabs counts as a violation; after {e.settings.maxViolations ?? 3} the attempt locks until an examiner reviews it. Your saved answers are always kept.</li>}
                  {e.settings.lockOnSave && <li>Save and lock: pressing Save makes that answer final. You can still read it later.</li>}
                  {e.settings.minimumAttemptPercent > 0 && <li>Answer at least {minimumRequired(e.questionCount, e.settings.minimumAttemptPercent)} of {e.questionCount} before submitting early. When time ends, the server submits automatically.</li>}
                </ul>
              )}
            </section>
          )}

          {e && strict && (
            <div className="space-y-2" data-testid="section-entry-checks">
              <Check id="instructions-read" checked={instructionsRead} onChange={setInstructionsRead}>I have read the instructions above.</Check>
              {e.settings.confirmSubjects && <Check id="subjects-confirmed" checked={subjectsConfirmed} onChange={setSubjectsConfirmed}>I am {e.candidateName} and the subjects listed are the ones I registered for.</Check>}
              {e.settings.requireReadiness && <Check id="device-ready" checked={deviceReady} onChange={setDeviceReady}>My device is charged, connected and ready. <span className="text-muted-foreground">This is my own check; Examora does not test hardware.</span></Check>}
            </div>
          )}

          {e?.settings.requireProctorApproval && (
            <AdmissionStep examId={exam.id} open={open} admissionId={admissionId} setAdmissionId={setAdmissionId} onAdmission={setAdmission} />
          )}

          {policy && (
            <>
              <PolicySummary policy={policy} />
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
                <Checkbox checked={ack} onCheckedChange={(c) => setAck(!!c)} className="mt-0.5" data-testid="checkbox-acknowledge-policy" />
                <span>I have read this assistance policy and will follow it. My acknowledgement is recorded with this version.</span>
              </label>
            </>
          )}
          {err && (
            <div role="alert" className="rounded-lg border border-accent/40 bg-accent/[0.06] p-3 text-xs" data-testid="text-entry-error">
              <p>{err.msg}</p>
              {err.stale && (
                <Button size="sm" variant="outline" className="mt-2" onClick={reload} data-testid="button-reload-policy">
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />The policy changed. Reload and read again
                </Button>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={start.isPending} onClick={() => setOpen(false)} data-testid="button-cancel-entry">Not yet</Button>
            <Button disabled={!ready || start.isPending} onClick={begin} data-testid="button-confirm-start">
              {start.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Start timer
            </Button>
          </DialogFooter>
          {e && <PrintableEntry info={e} admission={admission} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
