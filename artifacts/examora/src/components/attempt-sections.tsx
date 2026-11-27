import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Flag, Lock, Check, Minus, HelpCircle } from 'lucide-react';
import type { Question } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type QState = 'unvisited' | 'unanswered' | 'answered' | 'locked';
export interface Section { name: string; indices: number[] }

export function buildSections(questions: Question[]): Section[] {
  const map = new Map<string, number[]>();
  questions.forEach((q, i) => {
    const k = q.category?.trim() || 'General';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(i);
  });
  return [...map.entries()].map(([name, indices]) => ({ name, indices }));
}

const STATE_LABEL: Record<QState, string> = { unvisited: 'not yet opened', unanswered: 'opened, no answer', answered: 'answered', locked: 'saved and locked' };

export function QuestionTile({ n, state, flagged, current, unsynced, onClick }: { n: number; state: QState; flagged: boolean; current: boolean; unsynced: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      data-testid={`button-nav-q-${n}`}
      data-state={state}
      aria-label={`Question ${n}, ${STATE_LABEL[state]}${flagged ? ', flagged' : ''}${unsynced ? ', not server-confirmed' : ''}`}
      aria-current={current}
      className={cn(
        'relative grid aspect-square place-items-center rounded-md border font-mono text-xs transition-[transform,background-color,border-color] duration-150 hover:-translate-y-px motion-reduce:hover:translate-y-0',
        current ? 'border-foreground bg-foreground text-background' :
        state === 'locked' ? 'border-primary bg-primary/85 text-primary-foreground' :
        state === 'answered' ? 'border-primary/40 bg-primary/10' :
        state === 'unanswered' ? 'border-foreground/35' : 'border-dashed border-muted-foreground/40 text-muted-foreground',
      )}
    >
      {n}
      {state === 'locked' && <Lock className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5" aria-hidden />}
      {state === 'answered' && !current && <Check className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-primary" aria-hidden />}
      {state === 'unanswered' && !current && <Minus className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-muted-foreground" aria-hidden />}
      {flagged && <Flag className="absolute -right-1 -top-1 h-3 w-3 fill-accent text-accent" aria-hidden />}
      {unsynced && <span className="absolute bottom-0.5 left-0.5 h-1 w-1 rounded-full bg-[hsl(38_80%_50%)]" aria-hidden />}
    </button>
  );
}

export function Legend({ lockMode }: { lockMode: boolean }) {
  const item = (el: ReactNode, text: string) => <div className="flex items-center gap-2">{el}<span>{text}</span></div>;
  const box = 'relative grid h-4 w-4 place-items-center rounded-[3px] border';
  return (
    <div className="space-y-1 text-[11px] text-muted-foreground" data-testid="legend-question-states">
      {item(<span className={cn(box, 'border-dashed border-muted-foreground/50')} />, 'Not opened')}
      {item(<span className={cn(box, 'border-foreground/40')}><Minus className="h-2.5 w-2.5" /></span>, 'Opened, no answer')}
      {item(<span className={cn(box, 'border-primary/40 bg-primary/10')}><Check className="h-2.5 w-2.5 text-primary" /></span>, lockMode ? 'Answer drafted, not locked' : 'Answered')}
      {lockMode && item(<span className={cn(box, 'border-primary bg-primary/85 text-primary-foreground')}><Lock className="h-2.5 w-2.5" /></span>, 'Saved and locked by server')}
      {item(<Flag className="h-3.5 w-3.5 fill-accent text-accent" />, 'Flagged for review')}
      {item(<span className="mx-[5px] h-1.5 w-1.5 rounded-full bg-[hsl(38_80%_50%)]" />, 'Not server-confirmed yet')}
    </div>
  );
}

export function SectionBar({ sections, active, current, onJump, answeredIn }: { sections: Section[]; active: number; current: number; onJump: (questionIndex: number) => void; answeredIn: (s: Section) => number }) {
  if (sections.length < 2) return null;
  const go = (si: number) => onJump(sections[Math.max(0, Math.min(sections.length - 1, si))].indices[0]);
  const btn = 'rounded-md border p-1.5 transition hover:bg-muted disabled:opacity-40';
  return (
    <nav aria-label="Sections" className="mb-4 flex items-center gap-1.5 rounded-xl border bg-card p-1.5" data-testid="nav-sections">
      <button className={btn} disabled={active === 0} onClick={() => go(0)} aria-label="First section" data-testid="button-section-first"><ChevronsLeft className="h-4 w-4" /></button>
      <button className={btn} disabled={active === 0} onClick={() => go(active - 1)} aria-label="Previous section" data-testid="button-section-prev"><ChevronLeft className="h-4 w-4" /></button>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {sections.map((s, i) => (
          <button
            key={s.name}
            onClick={() => go(i)}
            aria-current={i === active}
            data-testid={`button-section-${i}`}
            className={cn('relative shrink-0 rounded-md px-3 py-1.5 text-xs transition-colors', i === active ? 'text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
          >
            {i === active && <motion.span layoutId="section-pill" className="absolute inset-0 rounded-md bg-foreground" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative">{s.name} <span className="font-mono tnum opacity-75">{answeredIn(s)}/{s.indices.length}</span></span>
          </button>
        ))}
      </div>
      <button className={btn} disabled={active === sections.length - 1} onClick={() => go(active + 1)} aria-label="Next section" data-testid="button-section-next"><ChevronRight className="h-4 w-4" /></button>
      <button className={btn} disabled={active === sections.length - 1} onClick={() => go(sections.length - 1)} aria-label="Last section" data-testid="button-section-last"><ChevronsRight className="h-4 w-4" /></button>
      <span className="sr-only" aria-live="polite">Section {active + 1} of {sections.length}, question {current + 1}</span>
    </nav>
  );
}

export function HelpButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="rounded-lg border p-2 transition hover:bg-muted" aria-label="Help" data-testid="button-help"><HelpCircle className="h-4 w-4" /></button>;
}

export function HelpDialog({ open, onOpenChange, lockMode, minimum, night }: { open: boolean; onOpenChange: (o: boolean) => void; lockMode: boolean; minimum: number; night: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[90dvh] overflow-y-auto sm:max-w-md', night && 'dark')} data-testid="dialog-help">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">How this paper works</DialogTitle>
          <DialogDescription>Everything here describes what the server has, not what we hope it has.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <Legend lockMode={lockMode} />
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>The timer is kept by the server. It keeps running if you close the tab.</li>
            {lockMode ? (
              <>
                <li>Choosing an option only drafts it. Press <strong className="text-foreground">Save</strong> to lock that answer on the server; it then cannot be changed.</li>
                <li>Locked answers stay readable. Unanswered questions can be skipped and revisited.</li>
                <li>To skip a question you have drafted, clear it first, or you will be asked before leaving.</li>
              </>
            ) : (
              <li>Answers are stored on this device as you work and sent to the server automatically. You can change them until you submit.</li>
            )}
            {minimum > 0 && <li>You need {minimum} answered questions before submitting early. When time ends, the server submits whatever it has.</li>}
            <li>Use the section bar to move between subjects, and the grid to jump to any question.</li>
            <li>Text size, night paper, layout and scratchpad controls are in the header.</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
