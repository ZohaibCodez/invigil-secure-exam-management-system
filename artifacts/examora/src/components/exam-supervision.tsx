import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Maximize, ShieldAlert, Lock } from 'lucide-react';
import { recordViolation, recordEvent, getGetAttemptQueryKey, type Attempt, type Supervision, type ViolationInputType } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const isFullscreen = () => !!document.fullscreenElement;
// One user action (Alt+Tab, Esc) can fire blur, visibilitychange and fullscreenchange
// together. Count them as a single violation.
const DEDUPE_MS = 2000;

/**
 * Fullscreen supervision for an active attempt. A browser cannot lock the whole computer:
 * Esc always leaves fullscreen. So every exit blocks the paper, is reported to the server
 * as a violation, and at the exam's limit the server locks the attempt for an examiner's
 * decision. Nothing here changes a score.
 */
export function ExamSupervision({ attempt, night }: { attempt: Attempt; night: boolean }) {
  const qc = useQueryClient();
  const server = attempt.supervision;
  const enabled = !!server?.requireFullscreen && attempt.status === 'active';
  const [state, setState] = useState<Supervision | undefined>(server);
  const [inFullscreen, setInFullscreen] = useState(isFullscreen());
  const [error, setError] = useState<string | null>(null);
  const lastReport = useRef(0);
  const armed = useRef(false); // only count exits after the candidate has entered fullscreen once

  // Server state wins whenever the attempt is refetched (for example after an examiner resumes it).
  useEffect(() => setState(server), [server?.violationCount, server?.lockedAt, server?.voidedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = !!state?.lockedAt;

  const report = useCallback(async (type: ViolationInputType) => {
    if (!enabled || locked || !armed.current) return;
    const now = Date.now();
    if (now - lastReport.current < DEDUPE_MS) return;
    lastReport.current = now;
    const operationId = crypto.randomUUID();
    // One retry with the same operation id; the server counts it once.
    for (let i = 0; i < 2; i++) {
      try {
        const next = await recordViolation(attempt.id, { operationId, type });
        setState(next);
        if (next.lockedAt) qc.invalidateQueries({ queryKey: getGetAttemptQueryKey(attempt.id) });
        return;
      } catch {
        if (i === 1) setError('This violation could not be reported because the connection failed. It will be visible to your examiner on reconnect.');
      }
    }
  }, [enabled, locked, attempt.id, qc]);

  useEffect(() => {
    if (!enabled) return;
    const onFs = () => {
      const fs = isFullscreen();
      setInFullscreen(fs);
      if (fs) armed.current = true;
      else void report('fullscreen-exit');
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') void report('tab-hidden'); };
    const onBlur = () => void report('window-blur');
    const noMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('contextmenu', noMenu);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('contextmenu', noMenu);
    };
  }, [enabled, report]);

  // Returning to the page (refresh, crash, closed browser) is logged for the examiner,
  // but not counted as a violation: it cannot be told apart from a power or network failure.
  const returnLogged = useRef(false);
  useEffect(() => {
    if (!enabled || returnLogged.current) return;
    returnLogged.current = true;
    if (Date.now() - Date.parse(attempt.startedAt) > 15_000)
      recordEvent(attempt.id, { type: 'page-return', detail: `Candidate re-opened the supervised exam page at ${new Date().toISOString()}. Context only.` }).catch(() => {});
  }, [enabled, attempt.id, attempt.startedAt]);

  // Leave fullscreen once the attempt ends or is locked.
  useEffect(() => {
    if ((!enabled || locked) && isFullscreen()) document.exitFullscreen().catch(() => {});
  }, [enabled, locked]);

  const enter = async () => {
    setError(null);
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      armed.current = true;
    } catch {
      setError('Your browser refused fullscreen. Allow fullscreen for this site, or use a desktop browser such as Chrome, Edge or Firefox.');
    }
  };

  if (!enabled || (!locked && inFullscreen)) return null;

  const count = state?.violationCount ?? 0;
  const max = state?.maxViolations ?? 3;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="supervision-title" data-testid="overlay-supervision"
      className={cn('fixed inset-0 z-[60] grid place-items-center bg-background p-6', night && 'dark')}>
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center text-foreground">
        {locked ? (
          <>
            <Lock className="mx-auto h-10 w-10 text-accent" />
            <h1 id="supervision-title" className="mt-4 font-display text-3xl">Attempt locked</h1>
            <p className="mt-2 text-sm text-muted-foreground">Your examiner has been notified and will review it. They can resume your attempt, void it, or allow a retake.</p>
            {state?.lockReason && <p className="mt-3 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground" data-testid="text-lock-reason">{state.lockReason}</p>}
            <p className="mt-3 text-xs text-muted-foreground">Every answer the server confirmed is kept. The examination timer keeps running. This page updates automatically.</p>
          </>
        ) : (
          <>
            {count > 0 ? <ShieldAlert className="mx-auto h-10 w-10 text-accent" /> : <Maximize className="mx-auto h-10 w-10 text-accent" />}
            <h1 id="supervision-title" className="mt-4 font-display text-3xl">{count > 0 ? 'Return to fullscreen' : 'Fullscreen required'}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This examination is supervised. Leaving fullscreen or switching to another tab or window counts as a violation.
              After {max} violations the attempt locks until your examiner reviews it.
            </p>
            {count > 0 && <p className="mt-3 font-mono text-sm text-accent" data-testid="text-violations">Violation {count} of {max} recorded</p>}
            <Button size="lg" className="mt-6 w-full" onClick={enter} data-testid="button-enter-fullscreen"><Maximize className="mr-2 h-4 w-4" />{count > 0 ? 'Return to fullscreen' : 'Enter fullscreen and continue'}</Button>
          </>
        )}
        {error && <p className="mt-3 text-xs text-accent">{error}</p>}
      </div>
    </div>
  );
}
