import { Link } from 'wouter';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, BookOpenText } from 'lucide-react';
import { Typewriter } from '@/components/motion';

const ease = [0.22, 1, 0.36, 1] as const;

function SheetStack() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 600], [0, reduce ? 0 : -60]);
  const y2 = useTransform(scrollY, [0, 600], [0, reduce ? 0 : -25]);
  const rows = [
    { q: 'Q1', s: 'accepted', t: '10:02:14' },
    { q: 'Q2', s: 'accepted', t: '10:06:51' },
    { q: 'Q3', s: 'on device', t: '10:09:03' },
    { q: 'Q4', s: 'retrying', t: '10:09:40' },
  ];
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[440px] [perspective:1400px]" aria-hidden>
      <svg className="orbit absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] opacity-40" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="96" fill="none" stroke="hsl(var(--ink))" strokeWidth=".3" strokeDasharray="1 3" />
      </svg>
      <motion.div style={{ y: y2 }} className="absolute inset-0 translate-x-6 translate-y-6 rotate-[4deg] rounded-2xl bg-[hsl(var(--verm))]" />
      <motion.div style={{ y: y1 }} initial={reduce ? false : { rotateX: 18, rotateZ: -6, opacity: 0 }} animate={{ rotateX: 0, rotateZ: -2, opacity: 1 }} transition={{ duration: 1.1, ease, delay: 0.2 }} className="paper-rule absolute inset-0 rounded-2xl border border-[hsl(var(--ink)/.15)] bg-[hsl(40_40%_98%)] p-6 shadow-[0_40px_60px_-30px_hsl(var(--ink)/.5)]">
        <div className="flex items-center justify-between border-b border-[hsl(var(--ink)/.12)] pb-3">
          <span className="eyebrow text-[hsl(var(--ink)/.55)]">Paper 2 · Section B</span>
          <span className="mono text-sm tabular-nums">00:41:07</span>
        </div>
        <p className="serif mt-5 text-2xl leading-snug">Explain why a server deadline, not the device clock, decides which answers count.</p>
        <div className="mt-6 space-y-2">
          {rows.map((r, i) => (
            <motion.div key={r.q} initial={reduce ? false : { x: -10 }} animate={{ x: 0 }} transition={{ delay: i * 0.08, duration: 0.4, ease }} className="flex items-center justify-between rounded-md border border-[hsl(var(--ink)/.1)] bg-[hsl(var(--paper))] px-3 py-2 mono text-xs">
              <span>{r.q}</span>
              <span className={r.s === 'accepted' ? 'text-[hsl(var(--sage))]' : r.s === 'retrying' ? 'text-[hsl(var(--verm))]' : 'text-[hsl(var(--amber))]'}>
                <span className={r.s === 'retrying' ? 'blink' : ''}>●</span> {r.s}
              </span>
              <span className="opacity-50 tabular-nums">{r.t}</span>
            </motion.div>
          ))}
        </div>
        <div className="mono absolute bottom-5 left-6 right-6 text-[10px] uppercase tracking-widest text-[hsl(var(--ink)/.4)]">Illustration · not a live attempt</div>
      </motion.div>
    </div>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const words = ['Saved', 'is', 'not', 'the', 'same', 'as'];
  return (
    <section className="relative min-h-[100dvh] pt-28 pb-16 md:pt-32" aria-labelledby="hero-title">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 md:px-8 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <h1 id="hero-title" className="serif text-[clamp(2.5rem,6vw,4.75rem)] leading-[1.02]">
            <Typewriter text={words.join(' ')} accent="submitted." accentClassName="verm-text" speed={38} />
          </h1>
          <motion.p initial={reduce ? false : { y: 8 }} animate={{ y: 0 }} transition={{ duration: 0.5, ease }} className="mt-7 max-w-xl text-lg leading-relaxed text-[hsl(var(--ink)/.72)]">
            Examora keeps candidates writing when the network drops, and keeps examiners honest about what actually reached the server. Local drafts, revisioned saves, server receipts, and one fixed deadline.
          </motion.p>
          <motion.div initial={reduce ? false : { y: 8 }} animate={{ y: 0 }} transition={{ duration: 0.5, ease }} className="mt-9 flex flex-wrap gap-3">
            <Link href="/login" className="btn-verm group inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-medium" data-testid="link-hero-signin">
              Open the workspace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link href="/research" className="btn-ghost inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-medium hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]" data-testid="link-hero-research">
              <BookOpenText className="h-4 w-4" aria-hidden /> Read the evidence
            </Link>
          </motion.div>
          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-[hsl(var(--ink)/.12)] pt-6">
            {[['3', 'roles'], ['1', 'server deadline'], ['0', 'webcam feeds']].map(([n, l]) => (
              <div key={l}><dt className="sr-only">{l}</dt><dd className="serif text-4xl">{n}</dd><dd className="mono mt-1 text-[11px] uppercase tracking-wider text-[hsl(var(--ink)/.55)]">{l}</dd></div>
            ))}
          </dl>
        </div>
        <SheetStack />
      </div>
    </section>
  );
}
