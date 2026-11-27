import { Link } from 'wouter';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, BookOpenText } from 'lucide-react';
import { Typewriter } from '@/components/motion';
import { LiveConsole } from './live-console';

const ease = [0.22, 1, 0.36, 1] as const;

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
        <LiveConsole />
      </div>
    </section>
  );
}
