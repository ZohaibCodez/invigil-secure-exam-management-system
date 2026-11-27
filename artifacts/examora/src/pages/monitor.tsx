import { useEffect, useState } from 'react';
import { useSearch, Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Radio, Megaphone, Loader2, EyeOff, WifiOff, Wifi, History, AlertTriangle, Info, ShieldAlert, Gavel, RefreshCcw, ScanLine } from 'lucide-react';
import {
  useListExams,
  useGetMonitor,
  useCreateAnnouncement,
  useGetAttempt,
  getGetAttemptQueryKey,
  getListExamsQueryKey,
  getGetMonitorQueryKey,
  getGetExamQueryKey,
  getGetIntegrityRecordQueryKey,
  getGetIncidentDossierQueryKey,
} from '@workspace/api-client-react';
import { IncidentReview } from '@/components/incident-review';
import { SupervisionActions } from '@/components/supervision-actions';
import { QrScannerDialog } from '@/components/qr-scanner-dialog';
import { IntegrityReview } from '@/components/integrity-review';
import { PageHeader, Panel, EmptyState, ErrorState, SkeletonRows, StatusPill, Meter, Stat } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ago, clock, errMsg, fmtDate } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

const INC: Record<string, { icon: typeof EyeOff; label: string }> = {
  'tab-hidden': { icon: EyeOff, label: 'Left the exam tab' },
  offline: { icon: WifiOff, label: 'Went offline' },
  reconnected: { icon: Wifi, label: 'Reconnected' },
  recovery: { icon: History, label: 'Recovered local work' },
  'late-recovery': { icon: AlertTriangle, label: 'Late local work found' },
  violation: { icon: ShieldAlert, label: 'Supervision violation' },
  supervision: { icon: Gavel, label: 'Staff decision' },
  'page-return': { icon: RefreshCcw, label: 'Re-opened the exam page' },
};

function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

export default function Monitor() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const search = useSearch();
  const exams = useListExams({ query: { queryKey: getListExamsQueryKey(), refetchInterval: 30000 } });
  const live = (exams.data ?? []).filter((e) => e.status !== 'draft');
  const [examId, setExamId] = useState<string>(() => new URLSearchParams(search).get('exam') ?? '');
  useEffect(() => {
    if (!examId && live.length) setExamId((live.find((e) => e.status === 'ongoing') ?? live[0]).id);
  }, [examId, live]);
  const m = useGetMonitor(examId, { query: { queryKey: getGetMonitorQueryKey(examId), enabled: !!examId, refetchInterval: 5000 } });
  const announce = useCreateAnnouncement();
  const [msg, setMsg] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const [, nav] = useLocation();
  const selectedAttempt = useGetAttempt(picked ?? '', { query: { queryKey: getGetAttemptQueryKey(picked ?? ''), enabled: !!picked } });
  useEffect(() => setPicked(null), [examId]);
  const now = useNow();
  const exam = live.find((e) => e.id === examId);
  const data = m.data;
  const active = data?.attempts.filter((a) => a.status === 'active').length ?? 0;
  const submitted = data?.attempts.filter((a) => a.status !== 'active').length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Live"
        title="Monitor"
        description="Refreshes every five seconds. Incidents are context for the examiner — a hidden tab or dropped connection is not evidence of misconduct."
        actions={
          <>
          <Button variant="outline" onClick={() => setScan(true)} data-testid="button-monitor-scan"><ScanLine className="mr-2 h-4 w-4" />Scan entry QR</Button>
          <Select value={examId} onValueChange={setExamId}>
            <SelectTrigger className="w-72 bg-card" data-testid="select-monitor-exam"><SelectValue placeholder="Choose an exam" /></SelectTrigger>
            <SelectContent>{live.map((e) => <SelectItem key={e.id} value={e.id}>{e.title} · {e.status}</SelectItem>)}</SelectContent>
          </Select>
          </>
        }
      />
      <QrScannerDialog open={scan} onOpenChange={setScan} onAdmission={(id) => { setScan(false); nav(`/admissions/${id}`); }} />
      {exams.isLoading ? <SkeletonRows rows={5} /> : exams.isError ? <ErrorState error={exams.error} onRetry={() => exams.refetch()} /> : live.length === 0 ? (
        <EmptyState icon={<Radio className="h-5 w-5" />} title="Nothing to watch" body="Publish an exam and the monitor will follow its candidates here." action={<Button asChild variant="outline"><Link href="/exams">Go to exams</Link></Button>} />
      ) : !examId ? null : m.isError ? <ErrorState error={m.error} onRetry={() => m.refetch()} /> : m.isLoading || !data ? <SkeletonRows rows={6} /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat index={0} label="Writing now" value={active} accent={active > 0} />
            <Stat index={1} label="Finished" value={submitted} hint={exam ? `${exam.enrolledCount} enrolled` : undefined} />
            <Stat index={2} label="Incidents" value={data.incidents.length} />
            <div className="flex flex-col justify-between rounded-xl border bg-card p-4">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">Exam</div>
              {exam && <StatusPill status={exam.status} className="self-start" />}
              <div className="flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
                <span className="relative h-1.5 w-1.5 rounded-full bg-accent pulse-dot text-accent" />{m.isFetching ? 'refreshing' : `updated ${ago(new Date(m.dataUpdatedAt).toISOString())}`}
              </div>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Panel title="Candidates" bodyClass="p-0">
              {data.attempts.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No one has started yet.</p>
              ) : (
                <ul className="divide-y">
                  {data.attempts.map((a) => {
                    const left = new Date(a.deadline).getTime() - now;
                    return (
                      <li key={a.id} role="button" tabIndex={0} aria-label={`Review technical incidents for ${a.candidateName}`} aria-pressed={picked === a.id} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked(a.id); } }} data-testid={`row-attempt-${a.id}`} onClick={() => setPicked(a.id)} className={`cursor-pointer transition-colors hover:bg-muted/40 ${picked === a.id ? 'bg-muted/60 shadow-[inset_3px_0_0_hsl(var(--accent))]' : ''} grid grid-cols-[1fr_auto] gap-3 px-4 py-3 md:grid-cols-[1.4fr_1.2fr_90px_110px_auto] md:items-center`}>
                        <div className="min-w-0"><div className="truncate text-sm font-medium">{a.candidateName}</div><div className="truncate text-xs text-muted-foreground">{a.email}</div></div>
                        <div className="order-last col-span-2 md:order-none md:col-span-1">
                          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground tnum"><span>Answered</span><span>{a.answered}/{a.questionCount}</span></div>
                          <Meter value={a.questionCount ? a.answered / a.questionCount : 0} />
                        </div>
                        <div className="hidden font-mono text-xs tnum md:block">{a.status === 'active' ? (left > 0 ? clock(left) : 'expired') : '—'}</div>
                        <div className="hidden text-xs text-muted-foreground md:block" title={fmtDate(a.lastSavedAt)}>saved {ago(a.lastSavedAt)}</div>
                        <div className="flex items-center gap-2 justify-self-end">
                          {a.voidedAt ? <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px]" data-testid={`badge-voided-${a.id}`}>voided</span>
                            : a.lockedAt ? <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] text-accent-foreground" data-testid={`badge-locked-${a.id}`}>locked</span>
                            : a.requireFullscreen && (a.violationCount ?? 0) > 0 ? <span className="rounded-full bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">{a.violationCount}/{a.maxViolations} viol</span> : null}
                          {a.incidents > 0 && <span className="rounded-full bg-[hsl(38_80%_92%)] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(30_70%_30%)] dark:bg-[hsl(38_40%_18%)] dark:text-[hsl(38_70%_70%)]">{a.incidents} inc</span>}
                          <StatusPill status={a.status} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
            {data.attempts.length > 0 && (
              <div className="xl:col-span-2">
                {picked && data.attempts.some((a) => a.id === picked) ? (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground" data-testid="text-review-candidate">Reviewing · {data.attempts.find((a) => a.id === picked)?.candidateName}</div>
                      <Button size="sm" variant="outline" data-testid="button-refresh-reviews" onClick={() => {
                        void qc.invalidateQueries({ queryKey: getGetIntegrityRecordQueryKey(picked) });
                        void qc.invalidateQueries({ queryKey: getGetIncidentDossierQueryKey(picked) });
                        void qc.invalidateQueries({ queryKey: getGetAttemptQueryKey(picked) });
                      }}>Refresh review records</Button>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">Review records refresh every 10–15 seconds while this page is visible. Refresh now to check for a recent response.</p>
                    <SupervisionActions key={`sup-${picked}`} examId={examId} attempt={data.attempts.find((a) => a.id === picked)!} resultsPublished={!!exam?.resultsPublished} />
                    <IncidentReview key={picked} attemptId={picked} mode="staff" defaultOpen />
                    <IntegrityReview key={`integrity-${picked}`} attemptId={picked} staff questions={selectedAttempt.data?.questions} />
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground" data-testid="text-review-hint">Select a candidate above to open their technical-incident dossier.</p>
                )}
              </div>
            )}
            <div className="space-y-6">
              <Panel title="Announce">
                <Textarea data-testid="input-monitor-announcement" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message every candidate in this exam" maxLength={2000} />
                <Button
                  className="mt-3 w-full"
                  data-testid="button-monitor-announce"
                  disabled={!msg.trim() || announce.isPending}
                  onClick={() =>
                    announce.mutate(
                      { id: examId, data: { message: msg.trim() } },
                      {
                        onSuccess: () => {
                          setMsg('');
                          qc.invalidateQueries({ queryKey: getGetMonitorQueryKey(examId) });
                          qc.invalidateQueries({ queryKey: getGetExamQueryKey(examId) });
                          toast({ title: 'Announcement sent' });
                        },
                        onError: (e) => toast({ title: 'Not sent', description: errMsg(e), variant: 'destructive' }),
                      },
                    )
                  }
                >
                  {announce.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}Broadcast
                </Button>
                {data.announcements.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t pt-3">
                    {data.announcements.slice(0, 4).map((a) => <li key={a.id} className="text-xs"><span className="text-muted-foreground">{fmtDate(a.createdAt, 'HH:mm')}</span> {a.message}</li>)}
                  </ul>
                )}
              </Panel>
              <Panel title="Incident log" bodyClass="p-0">
                <div className="flex items-start gap-2 border-b bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground"><Info className="mt-0.5 h-3 w-3 shrink-0" />Context only. Not proof of cheating.</div>
                {data.incidents.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No incidents recorded.</p>
                ) : (
                  <ul className="max-h-[420px] divide-y overflow-y-auto">
                    <AnimatePresence initial={false}>
                      {data.incidents.map((i) => {
                        const meta = INC[i.type] ?? { icon: Info, label: i.type };
                        return (
                          <motion.li key={i.id} initial={{ opacity: 0, backgroundColor: 'hsl(18 93% 53% / 0.08)' }} animate={{ opacity: 1, backgroundColor: 'hsl(18 93% 53% / 0)' }} transition={{ duration: 1.2 }} className="flex gap-3 px-4 py-2.5">
                            <meta.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0"><div className="text-sm"><span className="font-medium">{i.candidateName}</span> · {meta.label}</div>{i.detail && <div className="truncate text-xs text-muted-foreground">{i.detail}</div>}<div className="font-mono text-[10px] text-muted-foreground">{fmtDate(i.createdAt, 'HH:mm:ss')}</div></div>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
