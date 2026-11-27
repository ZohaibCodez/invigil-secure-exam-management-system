import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import type { ExamInput } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/kit';
import { toLocalInput } from '@/lib/format';

export interface ExamFormValues {
  title: string;
  subject: string;
  instructions: string;
  duration: string;
  startsAt: string;
  endsAt: string;
  randomize: boolean;
  passPercent: string;
}

export function examDefaults(e?: Partial<{ title: string; subject: string; instructions: string; duration: number; startsAt: string; endsAt: string; randomize: boolean; passPercent: number }>): ExamFormValues {
  const s = new Date(Date.now() + 3600_000);
  s.setMinutes(0, 0, 0);
  const en = new Date(s.getTime() + 3 * 3600_000);
  return {
    title: e?.title ?? '',
    subject: e?.subject ?? '',
    instructions: e?.instructions ?? 'Answer all questions. Your work is saved continuously; the timer is kept by the server.',
    duration: String(e?.duration ?? 60),
    startsAt: toLocalInput(e?.startsAt ?? s.toISOString()),
    endsAt: toLocalInput(e?.endsAt ?? en.toISOString()),
    randomize: e?.randomize ?? false,
    passPercent: String(e?.passPercent ?? 50),
  };
}

export function ExamForm({
  initial,
  questionIds,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ExamFormValues;
  questionIds: string[];
  pending: boolean;
  submitLabel: string;
  onSubmit: (input: ExamInput) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = <K extends keyof ExamFormValues>(k: K, val: ExamFormValues[K]) => setV((o) => ({ ...o, [k]: val }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    const dur = Number(v.duration);
    const pass = Number(v.passPercent);
    if (v.title.trim().length < 3) er.title = 'At least 3 characters.';
    if (v.instructions.trim().length < 5) er.instructions = 'At least 5 characters.';
    if (!Number.isInteger(dur) || dur < 1 || dur > 480) er.duration = 'Whole minutes, 1–480.';
    if (isNaN(pass) || pass < 0 || pass > 100) er.passPercent = '0–100.';
    const s = new Date(v.startsAt);
    const en = new Date(v.endsAt);
    if (isNaN(s.getTime())) er.startsAt = 'Pick a start.';
    if (isNaN(en.getTime()) || en <= s) er.endsAt = 'Must close after it opens.';
    setErrs(er);
    if (Object.keys(er).length) return;
    onSubmit({
      title: v.title.trim(),
      subject: v.subject.trim(),
      instructions: v.instructions.trim(),
      duration: dur,
      startsAt: s.toISOString(),
      endsAt: en.toISOString(),
      questionIds,
      randomize: v.randomize,
      passPercent: pass,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Title" error={errs.title}>
          <Input data-testid="input-exam-title" value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="Thermodynamics II — Midterm" />
        </Field>
        <Field label="Subject">
          <Input data-testid="input-exam-subject" value={v.subject} onChange={(e) => set('subject', e.target.value)} placeholder="PHYS 2210" />
        </Field>
      </div>
      <Field label="Instructions for candidates" error={errs.instructions}>
        <Textarea data-testid="input-exam-instructions" rows={3} value={v.instructions} onChange={(e) => set('instructions', e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Window opens" error={errs.startsAt}>
          <Input data-testid="input-exam-starts" type="datetime-local" value={v.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
        </Field>
        <Field label="Window closes" error={errs.endsAt}>
          <Input data-testid="input-exam-ends" type="datetime-local" value={v.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Duration (minutes)" error={errs.duration}>
          <Input data-testid="input-exam-duration" type="number" min={1} max={480} value={v.duration} onChange={(e) => set('duration', e.target.value)} />
        </Field>
        <Field label="Pass mark (%)" error={errs.passPercent}>
          <Input data-testid="input-exam-pass" type="number" min={0} max={100} value={v.passPercent} onChange={(e) => set('passPercent', e.target.value)} />
        </Field>
        <div className="flex items-end">
          <label className="flex h-9 w-full cursor-pointer items-center justify-between rounded-md border px-3 text-sm">
            Shuffle questions
            <Switch data-testid="switch-randomize" checked={v.randomize} onCheckedChange={(c) => set('randomize', c)} />
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={pending} data-testid="button-save-exam">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {submitLabel}
        </Button>
      </div>
    </form>
  );
}
