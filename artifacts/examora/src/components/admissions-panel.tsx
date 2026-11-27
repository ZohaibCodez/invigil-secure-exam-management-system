import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, Loader2, ScanLine, ExternalLink, Inbox } from 'lucide-react';
import {
  useListAdmissions,
  useDecideAdmission,
  getListAdmissionsQueryKey,
  getGetAdmissionQueryKey,
  type Admission,
  type ExamDetail,
} from '@workspace/api-client-react';
import { Panel, ErrorState, SkeletonRows, EmptyState } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { AdmissionBadge } from '@/components/admission-status';
import { QrScannerDialog } from '@/components/qr-scanner-dialog';
import { useToast } from '@/hooks/use-toast';
import { errMsg, fmtDate, ago } from '@/lib/format';
import { withDefaults } from '@/lib/delivery';

function Row({ a, examId }: { a: Admission; examId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const decide = useDecideAdmission();
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);
  const act = async (decision: 'approve' | 'deny') => {
    setBusy(decision);
    try {
      await decide.mutateAsync({ id: a.id, data: { decision } });
      toast({ title: decision === 'approve' ? `Approved ${a.candidateName}` : `Denied ${a.candidateName}` });
    } catch (e) {
      toast({ title: 'Decision not recorded', description: errMsg(e), variant: 'destructive' });
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: getListAdmissionsQueryKey(examId) });
      qc.invalidateQueries({ queryKey: getGetAdmissionQueryKey(a.id) });
    }
  };
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`row-admission-${a.id}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{a.candidateName}</div>
        <div className="font-mono text-[10.5px] text-muted-foreground">
          requested {ago(a.requestedAt)} · expires {fmtDate(a.expiresAt, 'HH:mm:ss')}
          {a.reviewerName && <> · {a.reviewerName}</>}
        </div>
      </div>
      <AdmissionBadge status={a.status} />
      {a.status === 'pending' && (
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act('deny')} data-testid={`button-deny-${a.id}`}>
            {busy === 'deny' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}<span className="ml-1">Deny</span>
          </Button>
          <Button size="sm" disabled={!!busy} onClick={() => act('approve')} data-testid={`button-approve-${a.id}`}>
            {busy === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}<span className="ml-1">Approve</span>
          </Button>
        </div>
      )}
      <Link href={`/admissions/${a.id}`} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Open request for ${a.candidateName}`} data-testid={`link-admission-${a.id}`}>
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </motion.li>
  );
}

export function AdmissionsPanel({ exam }: { exam: ExamDetail }) {
  const [, nav] = useLocation();
  const [scan, setScan] = useState(false);
  const required = withDefaults(exam.deliverySettings).requireProctorApproval;
  const list = useListAdmissions(exam.id, { query: { queryKey: getListAdmissionsQueryKey(exam.id), refetchInterval: 5000 } });
  const rows = list.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-medium">Staff admission</div>
          <p className="text-xs text-muted-foreground">
            {required ? 'Candidates must show a short-lived code. Approving never starts their timer.' : 'Staff approval is off for this exam. Requests appear here only if it was enabled before publication.'}
            {' '}A code locates a request; it does not prove identity. Check the person against the registered name.
          </p>
        </div>
        <Button variant="outline" onClick={() => setScan(true)} data-testid="button-scan-qr"><ScanLine className="mr-1.5 h-4 w-4" />Scan code</Button>
      </div>
      <Panel title={`Recent requests · ${rows.length}`} bodyClass="p-0">
        {list.isLoading ? (
          <SkeletonRows rows={3} className="p-3" />
        ) : list.isError ? (
          <div className="p-3"><ErrorState error={list.error} onRetry={() => list.refetch()} /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Inbox className="h-5 w-5" />} title="No requests yet" body="When a candidate asks for entry, their request shows here and refreshes every few seconds." />
        ) : (
          <ul className="divide-y" data-testid="list-admissions">
            <AnimatePresence initial={false}>{rows.map((a) => <Row key={a.id} a={a} examId={exam.id} />)}</AnimatePresence>
          </ul>
        )}
      </Panel>
      <QrScannerDialog open={scan} onOpenChange={setScan} onAdmission={(id) => { setScan(false); nav(`/admissions/${id}`); }} />
    </div>
  );
}
