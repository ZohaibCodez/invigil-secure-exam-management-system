import { useParams, Link } from 'wouter';
import { motion } from 'framer-motion';
import { BadgeCheck, ShieldX } from 'lucide-react';
import { useVerifyReport, getVerifyReportQueryKey } from '@workspace/api-client-react';
import { Seal } from '@/components/kit';
import { Skeleton } from '@/components/ui/skeleton';
import { fmtDate } from '@/lib/format';

export default function Verify() {
  const { token = '' } = useParams<{ token: string }>();
  const q = useVerifyReport(token, { query: { queryKey: getVerifyReportQueryKey(token), enabled: !!token, retry: false } });
  const r = q.data;
  const ok = r?.valid;
  return (
    <div className="ruled flex min-h-[100dvh] items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-[0_30px_60px_-30px_hsl(222_40%_14%/0.35)]">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Seal size={26} />
            <span className="font-display text-2xl">Examora</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Report verification</span>
        </div>
        {q.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : q.isError || !r || !ok ? (
          <div className="text-center" data-testid="status-verify-invalid">
            <ShieldX className="mx-auto h-12 w-12 text-destructive" strokeWidth={1.4} />
            <h1 className="mt-4 font-display text-3xl">Not a valid report</h1>
            <p className="mt-2 text-sm text-muted-foreground">This verification code doesn't match any report Examora issued. Check the link against the printed document.</p>
          </div>
        ) : (
          <div data-testid="status-verify-valid">
            <motion.div initial={{ scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground">
              <BadgeCheck className="h-8 w-8" />
            </motion.div>
            <h1 className="mt-5 text-center font-display text-3xl">Authentic report</h1>
            <dl className="mt-6 divide-y rounded-xl border text-sm">
              {[
                ['Examination', r.examTitle],
                ['Candidate', r.candidateInitials],
                ['Score', `${r.score} / ${r.totalMarks}`],
                ['Issued', fmtDate(r.issuedAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium tnum">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-center text-xs text-muted-foreground">Only initials are shown to protect the candidate's privacy.</p>
          </div>
        )}
        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-muted-foreground underline-offset-4 hover:text-accent hover:underline">examora home</Link>
        </div>
      </motion.div>
    </div>
  );
}
