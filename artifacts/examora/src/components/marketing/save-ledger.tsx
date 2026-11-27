import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CloudOff, Cloud, HardDrive, ServerCog, RotateCcw, Clock } from 'lucide-react';
import { Reveal } from './chrome';

type Entry = { rev: number; state: 'device' | 'accepted' | 'unverified'; note: string };

/** Pure client-side simulation. Not connected to any attempt or API. */
export function SaveLedger() {
  const reduce = useReducedMotion();
  const [online, setOnline] = useState(true);
  const [rev, setRev] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [closed, setClosed] = useState(false);

  const type = () => {
    if (closed) return;
    const r = rev + 1;
    setRev(r);
    setEntries((e) => [{ rev: r, state: (online ? 'accepted' : 'device') as Entry['state'], note: online ? 'Server receipt issued' : 'Kept on this device, retry queued' }, ...e].slice(0, 6));
  };
  const toggle = () => {
    const next = !online;
    setOnline(next);
    if (next && !closed) setEntries((e) => e.map((x) => (x.state === 'device' ? { ...x, state: 'accepted', note: 'Retry succeeded before deadline' } : x)));
  };
  const deadline = () => {
    setClosed(true);
    setEntries((e) => e.map((x) => (x.state === 'device' ? { ...x, state: 'unverified', note: 'After deadline: retained, not credited' } : x)));
  };
  const reset = () => { setOnline(true); setRev(0); setEntries([]); setClosed(false); };

  const tone = { device: 'text-[hsl(var(--amber))]', accepted: 'text-[hsl(var(--sage))]', unverified: 'text-[hsl(var(--verm))]' };
  const label = { device: 'On device', accepted: 'Server accepted', unverified: 'Unverified' };

  return (
    <section id="ledger" className="ink ink-grid scroll-mt-16 py-24 md:py-32" aria-labelledby="ledger-title">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 md:px-8 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <h2 id="ledger-title" className="serif mt-4 text-5xl leading-[1] md:text-6xl">Two columns of truth, never blurred.</h2>
          <p className="mt-6 max-w-md text-[hsl(var(--paper)/.7)]">Every answer revision lives in one of two places. The candidate sees which. The examiner sees which. Nothing on a device is quietly promoted to an accepted answer.</p>
          <ul className="mt-8 space-y-3 text-sm text-[hsl(var(--paper)/.8)]">
            <li className="flex gap-3"><HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--amber))]" aria-hidden /> Per-device draft, written before any network call.</li>
            <li className="flex gap-3"><ServerCog className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--sage))]" aria-hidden /> Revisioned save with a server receipt once accepted.</li>
            <li className="flex gap-3"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--verm))]" aria-hidden /> The server deadline is fixed. Recovery never adds time.</li>
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-[hsl(var(--paper)/.15)] bg-[hsl(var(--ink-2))] p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="eyebrow rounded border border-[hsl(var(--amber)/.5)] px-2 py-1 text-[hsl(var(--amber))]">Simulation · not a real attempt</span>
              <span role="status" aria-live="polite" className="mono flex items-center gap-2 text-xs">
                {online ? <Cloud className="h-4 w-4 text-[hsl(var(--sage))]" aria-hidden /> : <CloudOff className="h-4 w-4 text-[hsl(var(--verm))]" aria-hidden />}
                {closed ? 'Deadline passed' : online ? 'Connected' : 'Connection lost'}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="button" onClick={type} disabled={closed} className="rounded-lg bg-[hsl(var(--paper))] px-3 py-2.5 text-sm font-medium text-[hsl(var(--ink))] transition hover:bg-[hsl(var(--paper)/.85)] disabled:opacity-40" data-testid="button-sim-type">Write answer</button>
              <button type="button" onClick={toggle} disabled={closed} aria-pressed={!online} className="rounded-lg border border-[hsl(var(--paper)/.25)] px-3 py-2.5 text-sm transition hover:bg-[hsl(var(--paper)/.08)] disabled:opacity-40" data-testid="button-sim-network">{online ? 'Drop network' : 'Restore network'}</button>
              <button type="button" onClick={deadline} disabled={closed} className="rounded-lg border border-[hsl(var(--verm)/.6)] px-3 py-2.5 text-sm text-[hsl(var(--verm))] transition hover:bg-[hsl(var(--verm)/.1)] disabled:opacity-40" data-testid="button-sim-deadline">Reach deadline</button>
              <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-[hsl(var(--paper)/.6)] transition hover:text-[hsl(var(--paper))]" data-testid="button-sim-reset"><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset</button>
            </div>
            <ol className="mt-5 min-h-[264px] space-y-2" aria-label="Simulated revisions">
              {entries.length === 0 && (
                <li className="grid h-[264px] place-items-center rounded-lg border border-dashed border-[hsl(var(--paper)/.15)] px-6 text-center text-sm text-[hsl(var(--paper)/.5)]">Press “Write answer”, then drop the network and try again.</li>
              )}
              <AnimatePresence initial={false}>
                {entries.map((e) => (
                  <motion.li key={e.rev} layout={!reduce} initial={reduce ? false : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="mono grid grid-cols-[3.5rem_1fr] items-center gap-3 rounded-lg border border-[hsl(var(--paper)/.1)] bg-[hsl(var(--ink))] px-3 py-2.5 text-xs sm:grid-cols-[3.5rem_9rem_1fr]">
                    <span className="opacity-60">rev {e.rev}</span>
                    <span className={tone[e.state]}>● {label[e.state]}</span>
                    <span className="col-span-2 text-[hsl(var(--paper)/.55)] sm:col-span-1">{e.note}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
