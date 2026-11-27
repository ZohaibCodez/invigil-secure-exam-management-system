import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookLock, BookOpen, Sparkles, ShieldQuestion, Loader2, Lock, Check, Trash2 } from 'lucide-react';
import {
  useUpdateExam,
  getGetExamQueryKey,
  getListExamsQueryKey,
  getGetDashboardQueryKey,
  type ExamDetail,
  type AssistancePolicy,
  type AssistancePolicyInputMode,
} from '@workspace/api-client-react';
import { Panel } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { errMsg } from '@/lib/format';
import { cn } from '@/lib/utils';

export const POLICY_MODES: Record<AssistancePolicyInputMode, { label: string; body: string; Icon: typeof BookLock }> = {
  closed_book: { label: 'Closed book', body: 'Only the resources listed below. No notes, search or AI tools.', Icon: BookLock },
  open_book: { label: 'Open book', body: 'Notes and listed references allowed. No AI writing tools.', Icon: BookOpen },
  ai_disclosed: { label: 'AI with disclosure', body: 'AI tools allowed, provided the candidate describes how they were used.', Icon: Sparkles },
  ai_conditional: { label: 'AI under conditions', body: 'AI tools allowed only under the resources and conditions stated below.', Icon: ShieldQuestion },
};

export function PolicySummary({ policy, className }: { policy: AssistancePolicy; className?: string }) {
  const m = POLICY_MODES[policy.mode];
  return (
    <div className={cn('min-w-0 rounded-lg border bg-card p-4 [overflow-wrap:anywhere]', className)} data-testid="card-policy-summary">
      <div className="flex flex-wrap items-center gap-2">
        <m.Icon className="h-4 w-4 text-accent" />
        <span className="font-display text-xl" data-testid="text-policy-mode">{m.label}</span>
        <span className="ml-auto min-w-0 max-w-full break-all font-mono text-[10px] uppercase tracking-wider text-muted-foreground" data-testid="text-policy-version">v {policy.version}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{policy.mode === 'ai_disclosed' && !policy.requireDisclosure ? 'AI was permitted under this historical policy. Its original disclosure setting is retained below.' : m.body}</p>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Permitted resources</div>
      <p className="mt-1 whitespace-pre-wrap text-sm" data-testid="text-policy-resources">{policy.resources}</p>
      <p className="mt-3 text-[11.5px] text-muted-foreground">{policy.requireDisclosure ? 'A written disclosure of any assistance is required.' : 'A disclosure is optional under this recorded version.'}</p>
    </div>
  );
}

export function AssistancePolicyEditor({ exam }: { exam: ExamDetail }) {
  const qc = useQueryClient();
  const update = useUpdateExam();
  const p = exam.assistancePolicy ?? null;
  const [enabled, setEnabled] = useState(!!p);
  const [mode, setMode] = useState<AssistancePolicyInputMode>(p?.mode ?? 'closed_book');
  const [resources, setResources] = useState(p?.resources ?? '');
  const [requireDisclosure, setRequire] = useState(p?.requireDisclosure ?? false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const editable = exam.status === 'draft';
  const forced = mode === 'ai_disclosed';
  const effReq = forced || requireDisclosure;
  const n = resources.trim().length;
  const valid = !enabled || (n >= 5 && n <= 5000);
  const dirty = enabled !== !!p || (enabled && (mode !== p?.mode || resources.trim() !== (p?.resources ?? '') || effReq !== p?.requireDisclosure));

  if (!editable) {
    return (
      <Panel title="Assistance policy">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Locked once published. Candidates acknowledge this exact version.</div>
        {p ? <PolicySummary policy={p} /> : <p className="text-sm text-muted-foreground" data-testid="text-no-policy">No assistance policy. Candidates see the instructions only.</p>}
      </Panel>
    );
  }

  const save = (removing = false) => {
    setErr(null);
    setSaved(false);
    const policy = removing || !enabled ? null : { mode, resources: resources.trim(), requireDisclosure: effReq };
    update.mutate(
      {
        id: exam.id,
        data: {
          title: exam.title, subject: exam.subject, instructions: exam.instructions, duration: exam.duration,
          startsAt: exam.startsAt, endsAt: exam.endsAt, questionIds: exam.questions.map((q) => q.id),
          randomize: exam.randomize, passPercent: exam.passPercent, assistancePolicy: policy,
        },
      },
      {
        onSuccess: () => {
          if (removing) setEnabled(false);
          setSaved(true);
          qc.invalidateQueries({ queryKey: getGetExamQueryKey(exam.id) });
          qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        },
        onError: (e) => setErr(errMsg(e)),
      },
    );
  };

  return (
    <Panel title="Assistance policy">
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox checked={enabled} onCheckedChange={(c) => { setEnabled(!!c); setSaved(false); }} data-testid="checkbox-policy-enabled" className="mt-0.5" />
        <span className="text-sm">State what assistance is permitted<span className="block text-xs text-muted-foreground">Optional. Candidates must acknowledge it before their timer starts.</span></span>
      </label>
      {enabled && (
        <div className="mt-4 space-y-4">
          <div role="radiogroup" aria-label="Assistance mode" className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(POLICY_MODES) as AssistancePolicyInputMode[]).map((k) => {
              const M = POLICY_MODES[k];
              const on = mode === k;
              return (
                <button key={k} type="button" role="radio" aria-checked={on} onClick={() => { setMode(k); setSaved(false); }} data-testid={`radio-policy-${k}`}
                  className={cn('rounded-lg border p-3 text-left transition-colors motion-reduce:transition-none', on ? 'border-foreground bg-foreground/[0.04]' : 'hover:border-foreground/40')}>
                  <div className="flex items-center gap-2 text-sm font-medium"><M.Icon className={cn('h-4 w-4', on && 'text-accent')} />{M.label}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{M.body}</div>
                </button>
              );
            })}
          </div>
          <div>
            <label htmlFor="policy-resources" className="text-xs font-medium">{mode === 'ai_conditional' ? 'Permitted resources and conditions' : 'Permitted resources'}</label>
            <Textarea id="policy-resources" rows={3} value={resources} maxLength={5000} onChange={(e) => { setResources(e.target.value); setSaved(false); }} data-testid="input-policy-resources"
              placeholder="e.g. One double-sided A4 sheet of handwritten notes; scientific calculator." className="mt-1" />
            <div className={cn('mt-1 font-mono text-[10.5px] tnum', n > 0 && n < 5 ? 'text-accent' : 'text-muted-foreground')}>{n}/5000{n < 5 ? ' · at least 5 characters' : ''}</div>
          </div>
          <label className={cn('flex items-center gap-3 text-sm', forced ? 'cursor-not-allowed opacity-80' : 'cursor-pointer')}>
            <Checkbox checked={effReq} disabled={forced} onCheckedChange={(c) => { setRequire(!!c); setSaved(false); }} data-testid="checkbox-require-disclosure" />
            <span>Require a written disclosure of any assistance used{forced && <span className="block text-xs text-muted-foreground">Always required for AI with disclosure.</span>}</span>
          </label>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button disabled={!dirty || !valid || update.isPending} onClick={() => save()} data-testid="button-save-policy">
          {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save policy
        </Button>
        {p && (
          <Button variant="ghost" disabled={update.isPending} onClick={() => save(true)} data-testid="button-remove-policy">
            <Trash2 className="mr-1.5 h-4 w-4" />Remove policy
          </Button>
        )}
        <span aria-live="polite" className="text-xs text-muted-foreground" data-testid="status-policy-save">
          {saved && !dirty ? <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-[hsl(158_40%_32%)]" />Saved</span> : dirty ? 'Unsaved changes' : ''}
        </span>
      </div>
      {err && <p role="alert" className="mt-2 text-xs text-accent" data-testid="text-policy-error">{err}</p>}
    </Panel>
  );
}
