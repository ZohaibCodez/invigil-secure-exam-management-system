import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Play, Loader2, RefreshCw, Timer } from 'lucide-react';
import { useStartAttempt, getGetDashboardQueryKey, getListExamsQueryKey, type Exam } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PolicySummary } from '@/components/assistance-policy';
import { errMsg, errStatus } from '@/lib/format';

export function CandidateEntry({ exam }: { exam: Exam }) {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const start = useStartAttempt();
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState<{ msg: string; stale: boolean } | null>(null);
  const policy = exam.assistancePolicy ?? null;
  const ready = !policy || ack;

  const reload = () => {
    setErr(null);
    setAck(false);
    setOpen(false);
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
  };

  const begin = () => {
    setErr(null);
    start.mutate(
      { id: exam.id, data: { sandbox: false, policyVersion: policy?.version } },
      {
        onSuccess: (a) => {
          qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
          nav(`/attempts/${a.id}`);
        },
        onError: (e) => {
          const msg = errMsg(e);
          setErr({ msg, stale: errStatus(e) === 409 || /policy/i.test(msg) });
        },
      },
    );
  };

  return (
    <>
      <Button className="flex-1" onClick={() => { setOpen(true); setAck(false); setErr(null); }} data-testid={`button-start-${exam.id}`}>
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
        </DialogContent>
      </Dialog>
    </>
  );
}
