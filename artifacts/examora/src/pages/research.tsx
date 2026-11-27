import { Link } from 'wouter';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { researchSources, innovationDirections } from '@/content/research';
import { MarketingFooter, MarketingHeader, Reveal } from '@/components/marketing/chrome';

const byId = Object.fromEntries(researchSources.map((s, i) => [s.id, { ...s, n: i + 1 }]));

export default function Research() {
  return (
    <div className="mk min-h-[100dvh]">
      <MarketingHeader />
      <main id="main" className="pt-28 md:pt-36">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <Link href="/welcome" className="link-u inline-flex items-center gap-1.5 text-sm text-[hsl(var(--ink)/.65)]" data-testid="link-back-welcome"><ArrowLeft className="h-4 w-4" aria-hidden /> Overview</Link>
          <p className="eyebrow verm-text mt-8">Research & sources</p>
          <h1 className="serif mt-4 max-w-4xl text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95]">What the evidence says, and <span className="italic verm-text">what it does not.</span></h1>
          <p className="mt-6 max-w-2xl text-lg text-[hsl(var(--ink)/.7)]">Each source below shaped a design decision. Each also carries a stated limitation. None of these organisations endorse Examora.</p>

          <section aria-labelledby="dir-title" className="mt-20">
            <h2 id="dir-title" className="eyebrow text-[hsl(var(--ink)/.55)]">Directions</h2>
            <div className="mt-6 divide-y divide-[hsl(var(--ink)/.12)] border-y border-[hsl(var(--ink)/.12)]">
              {innovationDirections.map((d) => (
                <Reveal key={d.challenge}>
                  <article className="grid gap-4 py-8 md:grid-cols-[6rem_1fr_16rem]">
                    <span className="mono text-sm text-[hsl(var(--ink)/.45)]">{d.challenge}</span>
                    <div>
                      <h3 className="serif text-3xl">{d.title}</h3>
                      <p className="mt-3 text-[hsl(var(--ink)/.72)]">{d.body}</p>
                      <p className="mt-3 text-sm text-[hsl(var(--ink)/.55)]"><span className="font-medium text-[hsl(var(--ink)/.8)]">Limit: </span>{d.next}</p>
                    </div>
                    <div className="flex flex-col gap-3 md:items-end">
                      <span className="mono w-fit rounded-full border border-[hsl(var(--ink)/.2)] px-2.5 py-1 text-[10.5px] uppercase tracking-wider">{d.status}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {d.sources.map((sid) => (
                          <a key={sid} href={`#src-${sid}`} className="mono rounded bg-[hsl(var(--ink))] px-2 py-0.5 text-[11px] text-[hsl(var(--paper))] transition-colors hover:bg-[hsl(var(--verm))]" data-testid={`link-cite-${d.challenge}-${sid}`}>[{byId[sid].n}]</a>
                        ))}
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>

          <section aria-labelledby="src-title" className="mt-24 pb-28">
            <h2 id="src-title" className="eyebrow text-[hsl(var(--ink)/.55)]">Sources</h2>
            <ol className="mt-6 space-y-5">
              {researchSources.map((s, i) => (
                <li key={s.id} id={`src-${s.id}`} className="scroll-mt-24">
                  <Reveal>
                    <article className="card-lift rounded-2xl border border-[hsl(var(--ink)/.12)] bg-[hsl(40_40%_98%)] p-7 md:p-9">
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span className="serif verm-text text-4xl">[{i + 1}]</span>
                        <span className="mono text-xs uppercase tracking-wider text-[hsl(var(--ink)/.5)]">{s.kind} · {s.publisher} · {s.year}</span>
                      </div>
                      <h3 className="serif mt-3 text-3xl leading-tight">
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="link-u inline-flex items-start gap-1.5" data-testid={`link-source-${s.id}`}>{s.title}<ArrowUpRight className="mt-1.5 h-5 w-5 shrink-0" aria-hidden /><span className="sr-only">(opens in new tab)</span></a>
                      </h3>
                      <dl className="mt-6 grid gap-6 md:grid-cols-3">
                        <div><dt className="eyebrow text-[hsl(var(--ink)/.5)]">Finding</dt><dd className="mt-2 text-[hsl(var(--ink)/.8)]">{s.finding}</dd></div>
                        <div><dt className="eyebrow text-[hsl(var(--sage))]">Examora response</dt><dd className="mt-2 text-[hsl(var(--ink)/.8)]">{s.response}</dd></div>
                        <div className="rounded-lg border border-dashed border-[hsl(var(--verm)/.5)] p-4"><dt className="eyebrow verm-text">Limitation</dt><dd className="mt-2 text-sm text-[hsl(var(--ink)/.75)]">{s.limitation}</dd></div>
                      </dl>
                    </article>
                  </Reveal>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
