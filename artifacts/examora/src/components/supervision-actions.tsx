import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, Ban, RotateCcw, Loader2, ShieldAlert } from 'lucide-react';
import {
  useSuperviseAttempt,
  getGetMonitorQueryKey,
  getGetAttemptQueryKey,
  getListResultsQueryKey,
  type MonitoredAttempt,
  type SupervisionInputAction,
} from '@workspace/api-client-react';
import { Panel } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { errMsg, fmtDate } from '@/lib/format';

const COPY: Record<SupervisionInputAction, { label: string; done: string; confirm?: string }> = {
  lock: { label: 'Lock attempt', done: 'Attempt locked' },
  resume: { label: 'Resume attempt', done: 'Attempt resumed' },
  void: { label: 'Void (score 0)', done: 'Attempt voided', confirm: 'Voiding sets every mark to 0. It cannot be undone, only replaced by a retake.' },
  retake: { label: 'Allow retake', done: 'Retake authorized', confirm: 'The current attempt is archived for audit and the candidate can start a fresh paper while the exam window is open.' },
};

/** Examiner/admin decisions on a supervised attempt. Indicators inform the decision; they never make it. */
export function SupervisionActions({ examId, attempt, resultsPublished }: { examId: string; attempt: MonitoredAttempt; resultsPublished: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const supervise = useSuperviseAttempt();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState<SupervisionInputAction | null>(null);
  const active = attempt.status === 'active';
  const locked = !!attempt.lockedAt;
  const voided = !!attempt.voidedAt;

  const run = (action: SupervisionInputAction) => {
    if (COPY[action].confirm && confirming !== action) { setConfirming(action); return; }
    supervise.mutate({ id: attempt.id, data: { action, reason: reason.trim() } }, {
      onSuccess: () => {
        setReason(''); setConfirming(null);
        qc.invalidateQueries({ queryKey: getGetMonitorQueryKey(examId) });
        qc.invalidateQueries({ queryKey: getGetAttemptQueryKey(attempt.id) });
        qc.invalidateQueries({ queryKey: getListResultsQueryKey() });
        toast({ title: COPY[action].done, description: 'Recorded in the incident log with your name and reason.' });
      },
      onError: (e) => toast({ title: 'Not applied', description: errMsg(e), variant: 'destructive' }),
    });
  };

  const available: SupervisionInputAction[] = [
    ...(active && !locked ? ['lock' as const] : []),
    ...(active && locked ? ['resume' as const] : []),
    ...(!voided && !resultsPublished ? ['void' as const, 'retake' as const] : []),
  ];

  return (
    <Panel title="Supervision decision" className="mb-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs" data-testid="text-supervision-state">
        <ShieldAlert className="h-4 w-4 text-accent" />
        {attempt.requireFullscreen ? <span>Violations: <b className="tnum">{attempt.violationCount ?? 0}/{attempt.maxViolations ?? 3}</b></span> : <span className="text-muted-foreground">Fullscreen supervision off for this exam</span>}
        {locked && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">Locked {attempt.lockedAt && fmtDate(attempt.lockedAt, 'HH:mm:ss')}</span>}
        {voided && <span className="rounded-full bg-muted px-2 py-0.5">Voided</span>}
      </div>
      {attempt.lockReason && <p className="mb-3 text-xs text-muted-foreground">{attempt.lockReason}</p>}
      {available.length === 0 ? (
        <p className="text-xs text-muted-foreground">{resultsPublished ? 'Results are published, so the record is final.' : 'No decision is pending for this attempt.'}</p>
      ) : (
        <>
          <Textarea rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, recorded with your name). Review the incidents and the candidate's statement first." data-testid="input-supervision-reason" />
          {confirming && <p className="mt-2 rounded-lg bg-accent/5 p-2 text-xs text-accent">{COPY[confirming].confirm} Press again to confirm.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {available.map((action) => {
              const Icon = { lock: Lock, resume: Unlock, void: Ban, retake: RotateCcw }[action];
              return (
                <Button key={action} size="sm" variant={action === 'void' ? 'destructive' : action === 'resume' ? 'default' : 'outline'}
                  disabled={reason.trim().length < 3 || supervise.isPending} onClick={() => run(action)} data-testid={`button-supervise-${action}`}>
                  {supervise.isPending && supervise.variables?.data.action === action ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Icon className="mr-1.5 h-3.5 w-3.5" />}
                  {confirming === action ? `Confirm: ${COPY[action].label}` : COPY[action].label}
                </Button>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
