import { useState } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check, Minus } from 'lucide-react';
import { innovationDirections } from '@/content/research';
import { Reveal } from './chrome';

export function Problem() {
  const items = [
    ['A lost connection', 'needs a visible saving status.'],
    ['A tab switch', 'is untrusted context, not a confession.'],
    ['A device clock', 'cannot grant extra examination time.'],
  ];
  return (
    <section id="problem" className="scroll-mt-16 border-y border-[hsl(var(--ink)/.1)] py-24 md:py-32" aria-labelledby="problem-title">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal><p className="eyebrow verm-text">01 · The quiet failures</p></Reveal>
        <Reveal delay={0.05}><h2 id="problem-title" className="serif mt-4 max-w-3xl text-5xl leading-[1] md:text-6xl">Exam interruptions need an explanation, not an assumption.</h2></Reveal>
        <div className="mt-14 divide-y divide-[hsl(var(--ink)/.12)] border-y border-[hsl(var(--ink)/.12)]">
          {items.map(([a, b], i) => (
            <Reveal key={a} delay={i * 0.06}>
              <div className="group grid gap-2 py-7 md:grid-cols-[5rem_1fr_1fr] md:items-baseline">
                <span className="mono text-xs text-[hsl(var(--ink)/.4)]">0{i + 1}</span>
                <span className="serif text-3xl md:text-4xl">{a}</span>
                <span className="serif text-3xl italic text-[hsl(var(--ink)/.45)] transition-colors duration-500 group-hover:text-[hsl(var(--verm))] md:text-4xl">{b}</span>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal><p className="mt-8 max-w-2xl text-[hsl(var(--ink)/.65)]">Connectivity loss during online exams is a documented operational problem, and universities run reporting routes for it. <Link href="/research" className="link-u font-medium text-[hsl(var(--ink))]">See the sources</Link>.</p></Reveal>
      </div>
    </section>
  );
}

const STEPS = [
  { role: 'Examiner', title: 'Compose', body: 'Build a question bank, assemble exams, import questions, enrol candidates. Questions are snapshotted when an attempt begins.' },
  { role: 'Candidate', title: 'Sit', body: 'Write with local drafts and a scratchpad. Order and choices can be shuffled. The server deadline is shown and enforced.' },
  { role: 'Proctor', title: 'Monitor', body: 'Watch progress, broadcast announcements, and see tab and network events as context for human review, never as verdicts.' },
  { role: 'Examiner', title: 'Grade', body: 'Objective items mark automatically; written answers are graded by people. Results are published deliberately, not instantly.' },
  { role: 'Anyone', title: 'Verify', body: 'Result PDFs carry a QR code that resolves to a verification page, so a printed slip can be checked against the record.' },
];

export function Workflow() {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  const s = STEPS[i];
  return (
    <section id="workflow" className="scroll-mt-16 py-24 md:py-32" aria-labelledby="workflow-title">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal><p className="eyebrow verm-text">03 · One room, three roles</p></Reveal>
        <Reveal delay={0.05}><h2 id="workflow-title" className="serif mt-4 max-w-3xl text-5xl leading-[1] md:text-6xl">From blank paper to a verifiable result.</h2></Reveal>
        <div className="mt-14 grid gap-8 lg:grid-cols-[22rem_1fr]">
          <div role="tablist" aria-label="Workflow stages" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {STEPS.map((st, k) => (
              <button key={st.title} role="tab" type="button" id={`wf-tab-${k}`} aria-selected={k === i} aria-controls="wf-panel" tabIndex={k === i ? 0 : -1} onClick={() => setI(k)}
                onKeyDown={(event) => {
                  const move = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
                  if (!move && event.key !== 'Home' && event.key !== 'End') return;
                  event.preventDefault();
                  const next = event.key === 'Home' ? 0 : event.key === 'End' ? STEPS.length - 1 : (k + move + STEPS.length) % STEPS.length;
                  setI(next);
                  document.getElementById(`wf-tab-${next}`)?.focus();
                }} data-testid={`tab-workflow-${k}`}
                className={`group flex shrink-0 items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-colors duration-300 ${k === i ? 'border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-[hsl(var(--paper))]' : 'border-[hsl(var(--ink)/.12)] hover:border-[hsl(var(--ink)/.4)]'}`}>
                <span className={`mono text-xs ${k === i ? 'verm-text' : 'opacity-40'}`}>0{k + 1}</span>
                <span className="serif text-2xl">{st.title}</span>
                <span className="mono ml-auto hidden text-[10px] uppercase tracking-wider opacity-60 sm:inline">{st.role}</span>
              </button>
            ))}
          </div>
          <div id="wf-panel" role="tabpanel" aria-labelledby={`wf-tab-${i}`} className="paper-rule relative min-h-[320px] overflow-hidden rounded-2xl border border-[hsl(var(--ink)/.12)] bg-[hsl(40_40%_98%)] p-8 md:p-12">
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                <span className="eyebrow text-[hsl(var(--ink)/.5)]">{s.role}</span>
                <p className="serif mt-3 text-[clamp(3rem,7vw,5.5rem)] leading-none">{s.title}<span className="verm-text">.</span></p>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-[hsl(var(--ink)/.72)]">{s.body}</p>
              </motion.div>
            </AnimatePresence>
            <div className="absolute bottom-6 right-8 flex gap-1.5" aria-hidden>
              {STEPS.map((_, k) => <span key={k} className={`h-1 rounded-full transition-all duration-500 ${k === i ? 'w-8 bg-[hsl(var(--verm))]' : 'w-3 bg-[hsl(var(--ink)/.2)]'}`} />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Capabilities() {
  const caps = ['Three roles', 'Question bank', 'Enrollment', 'Server deadlines', 'Local drafts & retries', 'Monitoring', 'Announcements', 'Objective grading', 'Written grading', 'Published results', 'PDF + QR verification', 'Imports', 'Analytics', 'Workspace preferences', 'Scratchpad'];
  const row = [...caps, ...caps];
  return (
    <section aria-labelledby="caps-title" className="overflow-hidden bg-[hsl(var(--verm))] py-10 text-[hsl(var(--paper))]">
      <h2 id="caps-title" className="sr-only">Built capabilities</h2>
      <ul className="sr-only">{caps.map((c) => <li key={c}>{c}</li>)}</ul>
      <div className="marquee flex w-max gap-10 whitespace-nowrap" aria-hidden>
        {row.map((c, k) => <span key={k} className="serif flex items-center gap-10 text-4xl md:text-5xl">{c}<span className="text-xl opacity-50">✱</span></span>)}
      </div>
    </section>
  );
}

export function Integrity() {
  const does = ['Versioned resource and AI policies with acknowledgement', 'Assistance disclosures with missing entries visible', 'Question-linked human explanations, separate review window', 'Frozen papers, coverage quotas and controlled results', 'Untrusted browser context and reasoned advisory reviews'];
  const doesnt = ['Face scanning or webcam recording', 'Automated cheating scores', 'Detection of external AI assistants', 'Identity verification', 'Automatic mark deductions'];
  return (
    <section id="integrity" className="scroll-mt-16 py-24 md:py-32" aria-labelledby="integrity-title">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal><p className="eyebrow verm-text">04 · Integrity, stated plainly</p></Reveal>
        <Reveal delay={0.05}><h2 id="integrity-title" className="serif mt-4 max-w-3xl text-5xl leading-[1] md:text-6xl">Evidence for a human, not a verdict from a machine.</h2></Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-[1.15fr_1fr]">
          <Reveal>
            <div className="card-lift h-full rounded-2xl bg-[hsl(var(--ink))] p-8 text-[hsl(var(--paper))]">
              <p className="eyebrow text-[hsl(var(--sage))]">What it does</p>
              <ul className="mt-6 space-y-4">{does.map((d) => <li key={d} className="flex gap-3 text-lg"><Check className="mt-1 h-4 w-4 shrink-0 text-[hsl(var(--sage))]" aria-hidden />{d}</li>)}</ul>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="card-lift h-full rounded-2xl border border-dashed border-[hsl(var(--ink)/.3)] p-8">
              <p className="eyebrow verm-text">What it does not do</p>
              <ul className="mt-6 space-y-4">{doesnt.map((d) => <li key={d} className="flex gap-3 text-lg text-[hsl(var(--ink)/.7)]"><Minus className="mt-1 h-4 w-4 shrink-0 text-[hsl(var(--verm))]" aria-hidden />{d}</li>)}</ul>
            </div>
          </Reveal>
        </div>
        <Reveal><p className="mt-8 max-w-2xl text-sm text-[hsl(var(--ink)/.6)]">These are safeguards, not guarantees. Browser events are untrusted context; neither logs nor a human explanation prove independent authorship. Coverage quotas do not establish calibrated paper equivalence. See the research assessment for verification scope and remaining limitations.</p></Reveal>
      </div>
    </section>
  );
}

export function Directions() {
  return (
    <section id="limits" className="scroll-mt-16 border-t border-[hsl(var(--ink)/.1)] bg-[hsl(38_30%_91%)] py-24 md:py-32" aria-labelledby="limits-title">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal><p className="eyebrow verm-text">05 · Built, partial, proposed</p></Reveal>
            <Reveal delay={0.05}><h2 id="limits-title" className="serif mt-4 max-w-2xl text-5xl leading-[1] md:text-6xl">We label our own limits.</h2></Reveal>
          </div>
          <Link href="/research" className="link-u inline-flex items-center gap-1.5 font-medium" data-testid="link-limits-research">All directions & sources <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {innovationDirections.map((d, k) => {
            const built = d.status.startsWith('Implemented');
            return (
              <Reveal key={d.challenge} delay={k * 0.05}>
                <article className="card-lift flex h-full flex-col rounded-2xl border border-[hsl(var(--ink)/.12)] bg-[hsl(var(--paper))] p-7">
                  <div className="flex items-center justify-between gap-3">
                    <span className="mono text-xs text-[hsl(var(--ink)/.45)]">Challenge {d.challenge}</span>
                    <span className={`mono rounded-full px-2.5 py-1 text-[10.5px] uppercase tracking-wider ${built ? 'bg-[hsl(var(--sage)/.14)] text-[hsl(var(--sage))]' : 'border border-dashed border-[hsl(var(--ink)/.3)] text-[hsl(var(--ink)/.6)]'}`}>{d.status}</span>
                  </div>
                  <h3 className="serif mt-5 text-3xl leading-tight">{d.title}</h3>
                  <p className="mt-3 text-[hsl(var(--ink)/.7)]">{d.body}</p>
                  <p className="mt-auto border-t border-[hsl(var(--ink)/.1)] pt-4 text-sm text-[hsl(var(--ink)/.55)]"><span className="font-medium text-[hsl(var(--ink)/.8)]">Limit: </span>{d.next}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className="ink relative overflow-hidden py-28 md:py-36" aria-labelledby="cta-title">
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[hsl(var(--verm))] opacity-90" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <Reveal>
          <h2 id="cta-title" className="serif max-w-4xl text-[clamp(3rem,8vw,6.5rem)] leading-[0.95]">Calm exams. <span className="italic text-[hsl(var(--paper)/.55)]">Accountable records.</span></h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/login" className="btn-verm group inline-flex items-center gap-2 rounded-full px-7 py-4 font-medium" data-testid="link-cta-signin">Sign in to Examora <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></Link>
            <Link href="/research" className="btn-ghost inline-flex items-center rounded-full px-7 py-4 font-medium hover:bg-[hsl(var(--paper))] hover:text-[hsl(var(--ink))]" data-testid="link-cta-research">Review the research</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
