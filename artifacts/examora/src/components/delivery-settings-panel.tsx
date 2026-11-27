import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, Loader2, ShieldCheck, RotateCcw } from 'lucide-react';
import {
  useUpdateExam,
  getGetExamQueryKey,
  getListExamsQueryKey,
  getGetDashboardQueryKey,
  type DeliverySettings,
  type ExamDetail,
} from '@workspace/api-client-react';
import { Panel } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { errMsg } from '@/lib/format';
import { DEFAULT_DELIVERY, SUPERVISED_PRESET, withDefaults, minimumRequired } from '@/lib/delivery';
import { cn } from '@/lib/utils';

type BoolKey = 'requireFullscreen' | 'requireReadiness' | 'confirmSubjects' | 'requireProctorApproval' | 'lockOnSave';
const TOGGLES: { key: BoolKey; title: string; body: string }[] = [
  { key: 'requireFullscreen', title: 'Fullscreen supervision', body: 'The exam runs in fullscreen. Leaving fullscreen or switching tabs blocks the paper and counts as a violation. At the limit the attempt locks for your decision: resume, void or allow a retake. Never scored automatically.' },
  { key: 'requireReadiness', title: 'Readiness check', body: 'Candidate confirms instructions read and their device is ready. A human statement, not hardware certification.' },
  { key: 'confirmSubjects', title: 'Confirm name and subjects', body: 'Candidate confirms their registered name, reference and the subjects listed before starting.' },
  { key: 'requireProctorApproval', title: 'Staff approval by code', body: 'Candidate shows a five-minute code; an owning examiner or admin approves. Approval never starts the timer.' },
  { key: 'lockOnSave', title: 'Save and lock answers', body: 'Pressing Save makes that answer immutable on the server. Read-only review stays available; blank questions can be revisited.' },
];

export function DeliverySettingsPanel({ exam }: { exam: ExamDetail }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const update = useUpdateExam();
  const saved = withDefaults(exam.deliverySettings);
  const [s, setS] = useState<DeliverySettings>(saved);
  const editable = exam.status === 'draft';
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const set = <K extends keyof DeliverySettings>(k: K, v: DeliverySettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const min = minimumRequired(exam.questionCount, s.minimumAttemptPercent);

  const save = () => {
    const p = exam.assistancePolicy;
    update.mutate(
      {
        id: exam.id,
        data: {
          title: exam.title, subject: exam.subject, instructions: exam.instructions, duration: exam.duration,
          startsAt: exam.startsAt, endsAt: exam.endsAt, questionIds: exam.questions.map((q) => q.id),
          randomize: exam.randomize, passPercent: exam.passPercent,
          ...(p !== undefined ? { assistancePolicy: p ? { mode: p.mode, resources: p.resources, requireDisclosure: p.requireDisclosure } : null } : {}),
          deliverySettings: { ...s, venue: s.venue.trim(), sessionLabel: s.sessionLabel.trim() },
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetExamQueryKey(exam.id) });
          qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast({ title: 'Delivery rules saved' });
        },
        onError: (e) => toast({ title: 'Delivery rules not saved', description: errMsg(e), variant: 'destructive' }),
      },
    );
  };

  return (
    <Panel title="Delivery rules">
      {!editable && <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />Frozen at publication and copied into every attempt.</div>}
      {editable && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setS((p) => ({ ...p, ...SUPERVISED_PRESET }))} data-testid="button-preset-supervised"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Supervised preset</Button>
          <Button size="sm" variant="ghost" onClick={() => setS((p) => ({ ...DEFAULT_DELIVERY, venue: p.venue, sessionLabel: p.sessionLabel }))} data-testid="button-preset-reviewable"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reviewable (default)</Button>
        </div>
      )}
      <div className="space-y-2">
        {TOGGLES.map((t) => (
          <label key={t.key} className={cn('flex items-start gap-3 rounded-lg border p-3 transition-colors', !!s[t.key] && 'border-accent/40 bg-accent/[0.04]', editable && 'cursor-pointer')}>
            <Switch checked={!!s[t.key]} disabled={!editable} onCheckedChange={(c) => set(t.key, c)} data-testid={`switch-${t.key}`} className="mt-0.5" />
            <span className="text-sm"><span className="font-medium">{t.title}</span><span className="block text-xs text-muted-foreground">{t.body}</span></span>
          </label>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs">
          <span className="text-muted-foreground">Minimum attempted for manual submit (%)</span>
          <Input type="number" min={0} max={100} value={s.minimumAttemptPercent} disabled={!editable} onChange={(e) => set('minimumAttemptPercent', Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} data-testid="input-minimum-attempt" className="mt-1" />
          <span className="mt-1 block text-muted-foreground">{s.minimumAttemptPercent > 0 ? `${min} of ${exam.questionCount} pool questions. Expiry always submits.` : 'Off'}</span>
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">Venue (optional)</span>
          <Input value={s.venue} maxLength={200} disabled={!editable} onChange={(e) => set('venue', e.target.value)} data-testid="input-venue" className="mt-1" />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">Session label (optional)</span>
          <Input value={s.sessionLabel} maxLength={100} disabled={!editable} onChange={(e) => set('sessionLabel', e.target.value)} data-testid="input-session-label" className="mt-1" />
        </label>
      </div>
      {s.requireFullscreen && (
        <label className="mt-3 flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Violations before the attempt locks</span>
          <Input type="number" min={1} max={10} value={s.maxViolations ?? 3} disabled={!editable} onChange={(e) => set('maxViolations', Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1))))} data-testid="input-max-violations" className="w-20" />
        </label>
      )}
      {s.lockOnSave && <p className="mt-3 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">In lock mode a saved answer cannot be changed by anyone. Candidates can still read locked answers, and unanswered questions stay open until submission or expiry.</p>}
      {editable && (
        <div className="mt-4 flex justify-end">
          <Button disabled={!dirty || update.isPending} onClick={save} data-testid="button-save-delivery">{update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save delivery rules</Button>
        </div>
      )}
    </Panel>
  );
}
