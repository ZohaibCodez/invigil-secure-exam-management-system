import { MarketingFooter, MarketingHeader } from '@/components/marketing/chrome';
import { Hero } from '@/components/marketing/hero';
import { SaveLedger } from '@/components/marketing/save-ledger';
import { Capabilities, ClosingCta, Directions, Integrity, Problem, Workflow } from '@/components/marketing/sections';

export default function Landing() {
  return (
    <div className="mk min-h-[100dvh]">
      <MarketingHeader />
      <main id="main">
        <Hero />
        <Problem />
        <SaveLedger />
        <Workflow />
        <Capabilities />
        <Integrity />
        <Directions />
        <ClosingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
