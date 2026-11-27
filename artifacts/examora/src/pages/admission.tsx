import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X, Loader2, Info } from 'lucide-react';
import {
  useGetAdmission,
  useDecideAdmission,
  getGetAdmissionQueryKey,
  getListAdmissionsQueryKey,
} from '@workspace/api-client-react';
import { ErrorState, SkeletonRows, Seal } from '@/components/kit';
import { AdmissionBadge } from '@/components/admission-status';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMe, isStaff } from '@/lib/session';
import { ADMISSION_COPY } from '@/lib/delivery';
import { errMsg, fmtDate } from '@/lib/format';

export default function AdmissionPage() {
  const { id = '' } = useParams<{ id: string }>();
  const me = useMe();
  const staff = isStaff(me);
  const qc = useQueryClient();
  const decide = useDecideAdmission();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const q = useGetAdmission(id, {
    query: { queryKey: getGetAdmissionQueryKey(id), enabled: !!id, refetchInterval: (query) => (query.state.data?.status === 'pending' ? 4000 : false) },
  });
  const a = q.data;

  const act = async (decision: 'approve' | 'deny') => {
    if (!a) return;
    setErr(null);
    try {
      const next = await decide.mutateAsync({ id: a.id, data: { decision, ...(reason.trim() ? { reason: reason.trim() } : {}) } });
      qc.setQueryData(getGetAdmissionQueryKey(a.id), next);
      qc.invalidateQueries({ queryKey: getListAdmissionsQueryKey(a.examId) });
    } catch (e) {
      setErr(errMsg(e));
      qc.invalidateQueries({ queryKey: getGetAdmissionQueryKey(a.id) });
    }
  };

  if (q.isError) return <div className="mx-auto max-w-lg"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  if (q.isLoading || !a) return <div className="mx-auto max-w-lg"><SkeletonRows rows={5} /></div>;

  const rows: [string, string][] = [
    ['Candidate', a.candidateName],
    ['Exam', a.examTitle],
    ['Requested', fmtDate(a.requestedAt, 'd MMM yyyy, HH:mm:ss')],
    ['Expires', fmtDate(a.expiresAt, 'd MMM yyyy, HH:mm:ss')],
    ['Decision', a.decidedAt ? fmtDate(a.decidedAt, 'd MMM yyyy, HH:mm:ss') : 'Not yet decided'],
    ['Reviewer', a.reviewerName ?? '—'],
  ];

  return (
    <div className="mx-auto max-w-lg">
      <Link href={staff ? `/exams/${a.examId}` : '/'} className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent" data-testid="link-admission-back"><ArrowLeft className="h-3.5 w-3.5" />{staff ? 'Back to exam' : 'Back to overview'}</Link>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-card p-6" data-testid="card-admission">
        <div className="flex items-center gap-3">
          <Seal size={30} />
          <div className="flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Admission request</div>
            <h1 className="font-display text-3xl">{a.candidateName}</h1>
          </div>
          <AdmissionBadge status={a.status} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground" data-testid="text-admission-explainer">{ADMISSION_COPY[a.status].body}</p>
        <dl className="mt-5 divide-y rounded-lg border text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right tnum" data-testid={`text-admission-${k.toLowerCase()}`}>{v}</dd></div>
          ))}
          {a.reason && <div className="px-3 py-2"><dt className="text-muted-foreground">Reason</dt><dd className="mt-1" data-testid="text-admission-reason">{a.reason}</dd></div>}
        </dl>
        <div className="mt-4 flex gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>The code only locates this request. It is not proof of identity: compare the person with the registered name before deciding. Approval never starts the timer.</span>
        </div>
        {staff && a.status === 'pending' && (
          <div className="mt-5 space-y-3">
            <Textarea value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Optional note, recorded with your decision" data-testid="input-admission-reason" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={decide.isPending} onClick={() => act('deny')} data-testid="button-admission-deny"><X className="mr-1.5 h-4 w-4" />Deny</Button>
              <Button className="flex-1" disabled={decide.isPending} onClick={() => act('approve')} data-testid="button-admission-approve">{decide.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}Approve entry</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Only the owning examiner or an administrator can decide; the server checks this.</p>
          </div>
        )}
        {err && <p role="alert" className="mt-3 text-xs text-destructive" data-testid="text-admission-error">{err}</p>}
      </motion.div>
    </div>
  );
}
