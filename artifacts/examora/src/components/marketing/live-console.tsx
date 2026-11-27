import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, CloudOff, HardDrive, Laptop, Lock, Radio, Server, ShieldCheck, Wifi } from 'lucide-react';

const ease = [0.22, 1, 0.36, 1] as const;
const ANSWER = 'The server clock is the only clock both sides trust, so every answer it accepted before the deadline counts, and nothing after.';

/** The loop the console plays: write, save locally, send, receipt, network drop, recover. */
type Stage = 'typing' | 'device' | 'sending' | 'receipt' | 'offline' | 'resend' | 'recovered';
const SCRIPT: { stage: Stage; ms: number }[] = [
  { stage: 'typing', ms: 3800 },
  { stage: 'device', ms: 1100 },
  { stage: 'sending', ms: 1300 },
  { stage: 'receipt', ms: 2200 },
  { stage: 'offline', ms: 2600 },
  { stage: 'resend', ms: 1300 },
  { stage: 'recovered', ms: 2600 },
];

const STATUS: Record<Stage, { label: string; tone: string; icon: typeof Check }> = {
  typing: { label: 'Writing…', tone: 'text-[hsl(var(--ink)/.55)]', icon: Laptop },
  device: { label: 'Saved on this device', tone: 'text-[hsl(var(--amber))]', icon: HardDrive },
  sending: { label: 'Sending to server', tone: 'text-[hsl(var(--ink)/.7)]', icon: Radio },
  receipt: { label: 'Server confirmed · rev 14', tone: 'text-[hsl(var(--sage))]', icon: Check },
  offline: { label: 'Offline · kept on device', tone: 'text-[hsl(var(--verm))]', icon: CloudOff },
  resend: { label: 'Reconnected · resending', tone: 'text-[hsl(var(--ink)/.7)]', icon: Wifi },
  recovered: { label: 'Server confirmed · 0 answers lost', tone: 'text-[hsl(var(--sage))]', icon: ShieldCheck },
};

function useScript(reduce: boolean | null) {
  const [i, setI] = useState(reduce ? 3 : 0);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % SCRIPT.length), SCRIPT[i]!.ms);
    return () => window.clearTimeout(t);
  }, [i, reduce]);
  return SCRIPT[i]!.stage;
}

function useCountdown(start: number, reduce: boolean | null) {
  const [s, setS] = useState(start);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setS((v) => (v <= 1 ? start : v - 1)), 1000);
    return () => window.clearInterval(t);
  }, [start, reduce]);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function Node({ icon: Icon, label, active, danger }: { icon: typeof Laptop; label: string; active: boolean; danger?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        animate={{ scale: active ? 1.08 : 1, boxShadow: active ? `0 0 0 6px hsl(var(--${danger ? 'verm' : 'sage'}) / .15)` : '0 0 0 0px transparent' }}
        transition={{ duration: 0.35 }}
        className={`grid h-10 w-10 place-items-center rounded-xl border bg-white ${danger ? 'border-[hsl(var(--verm)/.5)] text-[hsl(var(--verm))]' : active ? 'border-[hsl(var(--sage)/.5)] text-[hsl(var(--sage))]' : 'border-[hsl(var(--ink)/.12)] text-[hsl(var(--ink)/.6)]'}`}
      >
        <Icon className="h-4 w-4" />
      </motion.div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink)/.5)]">{label}</span>
    </div>
  );
}

function Link({ state }: { state: 'idle' | 'flow' | 'down' }) {
  return (
    <div className="relative mx-1 mb-5 h-[2px] flex-1 overflow-visible">
      <div className={`absolute inset-0 rounded-full ${state === 'down' ? 'bg-[repeating-linear-gradient(90deg,hsl(var(--verm))_0_6px,transparent_6px_11px)]' : 'bg-[hsl(var(--ink)/.12)]'}`} />
      {state === 'flow' && (
        <motion.span
          className="absolute -top-[3px] h-2 w-2 rounded-full bg-[hsl(var(--verm))] shadow-[0_0_12px_hsl(var(--verm))]"
          initial={{ left: '0%' }}
          animate={{ left: '100%' }}
          transition={{ duration: 0.6, ease: 'easeInOut', repeat: Infinity }}
        />
      )}
    </div>
  );
}

function Chip({ show, className, children }: { show: boolean; className: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.4, ease }}
          className={`float-bob absolute z-20 flex items-center gap-2 rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-xs font-medium shadow-[0_18px_40px_-18px_hsl(var(--ink)/.45)] backdrop-blur-md ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Animated illustration of Examora's save ledger. Purely decorative; not a live attempt. */
export function LiveConsole() {
  const reduce = useReducedMotion();
  const stage = useScript(reduce);
  const clock = useCountdown(41 * 60 + 7, reduce);
  const [typed, setTyped] = useState(reduce ? ANSWER.length : 0);

  useEffect(() => {
    if (reduce) return;
    if (stage !== 'typing') return;
    setTyped(0);
    const t = window.setInterval(() => setTyped((n) => (n >= ANSWER.length ? n : n + 2)), 3400 / (ANSWER.length / 2));
    return () => window.clearInterval(t);
  }, [stage, reduce]);

  const st = STATUS[stage];
  const deviceActive = stage !== 'typing';
  const serverActive = stage === 'receipt' || stage === 'recovered';
  const link1 = stage === 'sending' || stage === 'resend' ? 'flow' : stage === 'offline' ? 'down' : 'idle';
  const link2 = stage === 'sending' || stage === 'resend' ? 'flow' : stage === 'offline' ? 'down' : 'idle';

  return (
    <div className="relative isolate mx-auto w-full max-w-[480px] py-8" aria-hidden>
      {/* Ambient glow */}
      <div className="absolute -inset-10 -z-10">
        <div className="glow-a absolute right-0 top-6 h-72 w-72 rounded-full bg-[hsl(var(--verm)/.35)] blur-[80px]" />
        <div className="glow-b absolute bottom-0 left-0 h-72 w-72 rounded-full bg-[hsl(var(--ink)/.25)] blur-[90px]" />
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24, rotateX: 12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease, delay: 0.15 }}
        className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-[0_50px_90px_-40px_hsl(var(--ink)/.55),0_0_0_1px_hsl(var(--ink)/.04)] backdrop-blur-xl"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-[hsl(var(--ink)/.07)] bg-[hsl(var(--paper))]/70 px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--verm)/.8)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--amber)/.8)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--sage)/.8)]" />
          <span className="ml-3 flex items-center gap-1.5 text-[11px] font-medium text-[hsl(var(--ink)/.55)]"><Lock className="h-3 w-3" />Paper 2 · Section B</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[hsl(var(--ink))] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--verm))]" />{clock}
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[hsl(var(--ink)/.5)]">
            <span>Question 7 of 12</span><span>8 marks</span>
          </div>
          <p className="mt-2 text-[15px] font-semibold leading-snug text-[hsl(var(--ink))]">Why should a server deadline, not the device clock, decide which answers count?</p>
          <div className="mt-3 min-h-[92px] rounded-xl border border-[hsl(var(--ink)/.1)] bg-[hsl(var(--paper))] p-3 text-[13px] leading-relaxed text-[hsl(var(--ink)/.8)]">
            {ANSWER.slice(0, typed)}
            {stage === 'typing' && <span className="tw-caret" />}
          </div>

          {/* Status line */}
          <div className="mt-3 flex h-6 items-center">
            <AnimatePresence mode="wait">
              <motion.span key={stage} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }} transition={{ duration: 0.25 }} className={`flex items-center gap-1.5 text-xs font-semibold ${st.tone}`}>
                <st.icon className="h-3.5 w-3.5" />{st.label}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Sync pipeline */}
          <div className="mt-4 flex items-center rounded-2xl border border-[hsl(var(--ink)/.07)] bg-gradient-to-b from-white to-[hsl(var(--paper))] px-4 pt-4">
            <Node icon={Laptop} label="Device" active={deviceActive} />
            <Link state={link1} />
            <Node icon={stage === 'offline' ? CloudOff : Wifi} label="Network" active={link1 === 'flow'} danger={stage === 'offline'} />
            <Link state={link2} />
            <Node icon={Server} label="Server" active={serverActive} />
          </div>

          {/* Question map */}
          <div className="mt-4 grid grid-cols-12 gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-colors duration-500 ${i < 6 || (i === 6 && serverActive) ? 'bg-[hsl(var(--sage))]' : i === 6 ? 'bg-[hsl(var(--amber))]' : i === 8 ? 'bg-[hsl(var(--verm)/.6)]' : 'bg-[hsl(var(--ink)/.1)]'}`} />
            ))}
          </div>
          <div className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink)/.35)]">Illustration · not a live attempt</div>
        </div>
      </motion.div>

      {/* Floating context chips */}
      <Chip show={stage === 'receipt' || stage === 'recovered'} className="-top-1 right-2 text-[hsl(var(--sage))]">
        <ShieldCheck className="h-4 w-4" /><span className="text-[hsl(var(--ink))]">Receipt <b className="font-semibold tabular-nums">#A93F</b> · 10:09:03</span>
      </Chip>
      <Chip show={stage === 'offline'} className="-top-1 left-2 text-[hsl(var(--verm))]">
        <CloudOff className="h-4 w-4" /><span className="text-[hsl(var(--ink))]">Network dropped. Writing continues.</span>
      </Chip>
      <Chip show className="-left-10 -bottom-1 text-[hsl(var(--ink)/.7)]">
        <Server className="h-4 w-4" /><span className="text-[hsl(var(--ink))]">Deadline set by <b className="font-semibold">server clock</b></span>
      </Chip>
    </div>
  );
}
