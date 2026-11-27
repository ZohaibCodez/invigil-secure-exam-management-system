import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Logo } from '@/components/kit';
import './marketing.css';

const NAV = [
  { href: '/welcome#ledger', label: 'Save ledger' },
  { href: '/welcome#workflow', label: 'Workflow' },
  { href: '/welcome#integrity', label: 'Integrity' },
  { href: '/welcome#limits', label: 'Limits' },
];

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${scrolled || open ? 'bg-[hsl(var(--paper)/.88)] backdrop-blur-md border-b border-[hsl(var(--ink)/.1)]' : ''}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-[hsl(var(--ink))] focus:px-3 focus:py-2 focus:text-[hsl(var(--paper))]">Skip to content</a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/welcome" className="flex items-center gap-2.5" data-testid="link-home">
          <Logo height={38} />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 text-sm md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="link-u text-[hsl(var(--ink)/.75)] hover:text-[hsl(var(--ink))]" data-testid={`link-nav-${n.label.toLowerCase().replace(/\s/g, '-')}`}>{n.label}</a>
          ))}
          <Link href="/research" className="link-u text-[hsl(var(--ink)/.75)] hover:text-[hsl(var(--ink))]" data-testid="link-nav-research">Research</Link>
          <Link href="/login" className="btn-verm inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-medium" data-testid="link-nav-signin">
            Sign in <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </nav>
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-[hsl(var(--ink)/.2)] md:hidden" aria-expanded={open} aria-controls="mk-mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)} data-testid="button-mobile-menu">
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav id="mk-mobile-nav" aria-label="Mobile" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="border-t border-[hsl(var(--ink)/.1)] px-5 pb-6 pt-2 md:hidden">
            {[...NAV, { href: '/research', label: 'Research' }].map((n, i) => (
              n.href === '/research'
                ? <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="flex items-baseline justify-between border-b border-[hsl(var(--ink)/.08)] py-3.5 serif text-2xl" data-testid="link-mobile-research"><span>{n.label}</span><span className="mono text-xs opacity-50">0{i + 1}</span></Link>
                : <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="flex items-baseline justify-between border-b border-[hsl(var(--ink)/.08)] py-3.5 serif text-2xl" data-testid={`link-mobile-${i}`}><span>{n.label}</span><span className="mono text-xs opacity-50">0{i + 1}</span></a>
            ))}
            <Link href="/login" onClick={() => setOpen(false)} className="btn-verm mt-5 flex justify-center rounded-full py-3 font-medium" data-testid="link-mobile-signin">Sign in</Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="ink ink-grid">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div>
          <Logo tone="dark" height={44} />
          <p className="mt-4 max-w-sm text-sm text-[hsl(var(--paper)/.65)]">An examination workspace that tells you what was saved on a device and what the server accepted. A hackathon project with documented safeguards and limitations.</p>
        </div>
        <nav aria-label="Footer: product" className="flex flex-col gap-2.5 text-sm">
          <span className="eyebrow text-[hsl(var(--paper)/.45)]">Product</span>
          <a href="/welcome#ledger" className="link-u w-fit">Save ledger</a>
          <a href="/welcome#workflow" className="link-u w-fit">Workflow</a>
          <a href="/welcome#integrity" className="link-u w-fit">Integrity</a>
          <a href="/welcome#limits" className="link-u w-fit">Known limits</a>
        </nav>
        <nav aria-label="Footer: pages" className="flex flex-col gap-2.5 text-sm">
          <span className="eyebrow text-[hsl(var(--paper)/.45)]">Pages</span>
          <Link href="/welcome" className="link-u w-fit" data-testid="link-footer-welcome">Overview</Link>
          <Link href="/research" className="link-u w-fit" data-testid="link-footer-research">Research & sources</Link>
          <Link href="/login" className="link-u w-fit" data-testid="link-footer-login">Sign in</Link>
        </nav>
      </div>
      <div className="border-t border-[hsl(var(--paper)/.1)]">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-5 py-5 mono text-[11px] text-[hsl(var(--paper)/.45)] md:px-8">
          <span>Examora · examination workspace</span>
          <span>No biometrics. No automated cheating scores.</span>
        </div>
      </div>
    </footer>
  );
}
