import { useEffect, useState, type ReactNode } from 'react';
import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';

/**
 * Types a main heading once. Screen readers get the full text immediately; the animated
 * copy is aria-hidden. Respects prefers-reduced-motion. Use for page-level headings only.
 */
export function Typewriter({ text: lead, accent, accentClassName = 'text-accent', speed = 32, className }: { text: string; accent?: string; accentClassName?: string; speed?: number; className?: string }) {
  const reduce = useReducedMotion();
  const text = accent ? `${lead} ${accent}` : lead;
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) { setN(text.length); return; }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed, reduce]);
  const done = n >= text.length;
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {lead.slice(0, n)}
        <span className="invisible">{lead.slice(n)}</span>
        {accent && <>{' '}<span className={accentClassName}>{text.slice(lead.length + 1, Math.max(lead.length + 1, n))}</span><span className="invisible">{text.slice(Math.max(lead.length + 1, n))}</span></>}
        {!done && <span className="tw-caret" />}
      </span>
    </span>
  );
}

/** Fades and lifts content into place the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0, as = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'li' }) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  if (reduce) return <Comp className={className}>{children}</Comp>;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  );
}

/** Counts a number up from zero the first time it is visible. Non-numbers render as-is. */
export function CountUp({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce || !inView) { if (reduce) setShown(value); return; }
    const c = animate(0, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
    return () => c.stop();
  }, [value, inView, reduce]);
  return <span ref={ref}>{shown.toFixed(decimals)}{suffix}</span>;
}
