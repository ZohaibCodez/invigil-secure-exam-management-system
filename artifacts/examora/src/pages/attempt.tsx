import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Flag,
  NotebookPen,
  Cloud,
  CloudOff,
  CheckCheck,
  HardDrive,
  Loader2,
  FlaskConical,
  Megaphone,
  Send,
  Sun,
  Moon,
  Columns2,
  Square,
  AlertTriangle,
  X,
  Lock,
  Minus,
  Plus,
  Save,
  SkipForward,
} from 'lucide-react';
import {
  useGetAttempt,
  useSaveAnswers,
  useSubmitAttempt,
  useRecordEvent,
  useCommitQuestion,
  getGetAttemptQueryKey,
  getGetDashboardQueryKey,
  getListExamsQueryKey,
  getListResultsQueryKey,
  type Attempt,
  type EventInput,
} from '@workspace/api-client-react';
import { Seal, ErrorState } from '@/components/kit';
import { IncidentReview } from '@/components/incident-review';
import { IntegrityReview } from '@/components/integrity-review';
import { AttemptSafety, type ScratchConflict } from '@/components/attempt-safety';
import { useDraftPersistence } from '@/hooks/use-draft-persistence';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMe } from '@/lib/session';
import { usePrefs } from '@/lib/prefs';
import { useOnline } from '@/hooks/use-online';
import {
  loadDraft,
  loadCachedAttempt,
  cacheAttempt,
  nextRevision,
  uuid,
  type AttemptDraft,
  type LocalAnswer,
} from '@/lib/local';
import { clock, errMsg, errStatus, fmtDate, parseSelected } from '@/lib/format';
import { cn } from '@/lib/utils';
import { minimumRequired, withDefaults } from '@/lib/delivery';
import { buildSections, QuestionTile, Legend, SectionBar, HelpButton, HelpDialog, type QState } from '@/components/attempt-sections';

type SyncState = 'idle' | 'pending' | 'saving' | 'saved' | 'failed' | 'offline' | 'locked';

const emptyDraft = (): AttemptDraft => ({ answers: {}, confirmed: {}, scratchpad: '', scratchRev: 0, scratchConfirmed: 0, lastSyncedAt: null, current: 0 });

function isAnswered(a?: LocalAnswer) {
  if (!a) return false;
  if (a.value.startsWith('[')) return parseSelected(a.value).length > 0;
  return a.value.trim().length > 0;
}
function unsyncedIds(d: AttemptDraft) {
  return Object.values(d.answers)
    .filter((a) => a.revision > (d.confirmed[a.questionId] ?? 0))
    .map((a) => a.questionId);
}

function hasPendingWork(d: AttemptDraft) {
  return unsyncedIds(d).length > 0 || d.scratchRev > d.scratchConfirmed;
}

export default function AttemptPage() {
  const { id = '' } = useParams<{ id: string }>();
  const me = useMe();
  const uid = me.id;
  const qc = useQueryClient();
  const { prefs, update: updatePrefs } = usePrefs();
  const online = useOnline();

  const q = useGetAttempt(id, { query: { queryKey: getGetAttemptQueryKey(id), enabled: !!id, refetchInterval: 15000, retry: 1 } });
  const saveM = useSaveAnswers();
  const submitM = useSubmitAttempt();
  const eventM = useRecordEvent();
  const saveRef = useRef(saveM.mutateAsync);
  saveRef.current = saveM.mutateAsync;
  const submitRef = useRef(submitM.mutateAsync);
  submitRef.current = submitM.mutateAsync;
  const eventRef = useRef(eventM.mutateAsync);
  eventRef.current = eventM.mutateAsync;
  const commitM = useCommitQuestion();
  const commitRef = useRef(commitM.mutateAsync);
  commitRef.current = commitM.mutateAsync;
  const [committing, setCommitting] = useState(false);
  const [commitErr, setCommitErr] = useState<string | null>(null);
  const [pendingNav, setPendingNav] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const [cached, setCached] = useState<Attempt | null>(null);
  const [cacheChecked, setCacheChecked] = useState(false);
  const attempt: Attempt | null = q.data ?? cached;
  const fromCache = !q.data && !!cached;

  const [draft, setDraft] = useState<AttemptDraft>(emptyDraft);
  const draftRef = useRef<AttemptDraft>(draft);
  const [ready, setReady] = useState(false);
  const initFor = useRef<string | null>(null);
  const [sync, setSync] = useState<SyncState>('idle');
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [lateWork, setLateWork] = useState<string[]>([]);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitStage, setSubmitStage] = useState<'confirm' | 'syncing' | 'unsynced' | 'submitting'>('confirm');
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [seenAnn, setSeenAnn] = useState<string[]>([]);
  const device = useDraftPersistence(uid, id);
  const [scratchConflict, setScratchConflict] = useState<ScratchConflict | null>(null);
  const conflictRef = useRef<ScratchConflict | null>(null);
  const setConflict = useCallback((conflict: ScratchConflict | null) => {
    conflictRef.current = conflict;
    setScratchConflict(conflict);
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const eventsRef = useRef<EventInput[]>([]);
  const lockedRef = useRef(false);
  lockedRef.current = locked;

  // ---------- cached attempt for offline reloads ----------
  useEffect(() => {
    if (!id) return;
    loadCachedAttempt(uid, id)
      .then((a) => a && setCached(a))
      .catch(() => {})
      .finally(() => setCacheChecked(true));
  }, [uid, id]);
  useEffect(() => {
    if (q.data) cacheAttempt(uid, id, q.data).catch(() => {});
  }, [q.data, uid, id]);

  // ---------- server-anchored clock ----------
  const anchor = useRef<{ remaining: number; perf: number; estimated: boolean } | null>(null);
  useEffect(() => {
    if (q.data) {
      anchor.current = { remaining: Date.parse(q.data.deadline) - Date.parse(q.data.serverNow), perf: performance.now(), estimated: false };
    } else if (cached && !anchor.current) {
      anchor.current = { remaining: Date.parse(cached.deadline) - Date.now(), perf: performance.now(), estimated: true };
    }
  }, [q.data, q.dataUpdatedAt, cached]);
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => {
      const a = anchor.current;
      if (a) setRemaining(a.remaining - (performance.now() - a.perf));
    }, 250);
    return () => clearInterval(t);
  }, []);

  // ---------- persistence helpers ----------
  const writeDraft = useCallback(
    (next: AttemptDraft) => {
      draftRef.current = next;
      setDraft(next);
      device.persist(next);
    },
    [device.persist],
  );

  const sendEvents = useCallback(async () => {
    while (eventsRef.current.length && navigator.onLine) {
      const ev = eventsRef.current[0];
      try {
        await eventRef.current({ id, data: ev });
        eventsRef.current.shift();
      } catch (e) {
        if (errStatus(e) >= 400 && errStatus(e) < 500) eventsRef.current.shift();
        else break;
      }
    }
  }, [id]);
  const pushEvent = useCallback(
    (type: EventInput['type'], detail: string) => {
      eventsRef.current.push({ type, detail: detail.slice(0, 5000) });
      void sendEvents();
    },
    [sendEvents],
  );

  // ---------- serialized network save ----------
  const doFlush = useCallback(async (): Promise<boolean> => {
    if (lockedRef.current) return false;
    const d = draftRef.current;
    const dirty = Object.values(d.answers).filter((a) => !a.lockedAt && a.revision > (d.confirmed[a.questionId] ?? 0));
    const scratchDirty = d.scratchRev > d.scratchConfirmed && !conflictRef.current;
    if (!dirty.length && !scratchDirty) {
      setSync(hasPendingWork(d) ? 'failed' : 'saved');
      return !hasPendingWork(d);
    }
    if (!navigator.onLine) {
      setSync('offline');
      return false;
    }
    setSync('saving');
    const sentScratchRev = d.scratchRev;
    try {
      const receipt = await saveRef.current({
        id,
        data: {
          operationId: uuid(),
          answers: dirty.map((a) => ({ questionId: a.questionId, value: a.value, markedForReview: a.markedForReview, revision: a.revision })),
          ...(scratchDirty ? { scratchpad: d.scratchpad, scratchpadVersion: d.scratchVersion ?? 0 } : {}),
        },
      });
      if (!receipt.accepted) {
        setSync('failed');
        setSyncErr(receipt.conflict === 'scratchpad' ? 'Different notes were saved by another tab. Compare the copies below.' : 'A newer answer exists on the server. Refreshing to resolve the conflict; this batch was not confirmed.');
        await qc.invalidateQueries({ queryKey: getGetAttemptQueryKey(id) });
        const latest = qc.getQueryData<Attempt>(getGetAttemptQueryKey(id));
        if (receipt.conflict === 'scratchpad' && latest) setConflict({ text: latest.scratchpad, version: latest.scratchpadVersion ?? 0 });
        return false;
      }
      const cur = draftRef.current;
      const confirmed = { ...cur.confirmed };
      for (const a of dirty) confirmed[a.questionId] = Math.max(confirmed[a.questionId] ?? 0, a.revision);
      writeDraft({ ...cur, confirmed, scratchConfirmed: scratchDirty ? Math.max(cur.scratchConfirmed, sentScratchRev) : cur.scratchConfirmed, ...(scratchDirty ? { scratchVersion: receipt.scratchpadVersion ?? 0 } : {}), lastSyncedAt: receipt.savedAt });
      setSyncErr(null);
      const stillDirty = hasPendingWork(draftRef.current);
      setSync(stillDirty ? 'pending' : 'saved');
      return !stillDirty;
    } catch (e) {
      if (errStatus(e) === 409) {
        setLocked(true);
        lockedRef.current = true;
        setSync('locked');
        setLateWork(unsyncedIds(draftRef.current));
        qc.invalidateQueries({ queryKey: getGetAttemptQueryKey(id) });
        return false;
      }
      setSync(navigator.onLine ? 'failed' : 'offline');
      setSyncErr(errMsg(e));
      return false;
    }
  }, [id, qc, writeDraft, setConflict]);

  const flush = useCallback((): Promise<boolean> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    chainRef.current = chainRef.current.then(doFlush, doFlush);
    return chainRef.current;
  }, [doFlush]);

  const schedule = useCallback(
    (delay = 700) => {
      if (lockedRef.current) return;
      setSync((s) => !navigator.onLine ? 'offline' : s === 'saving' || s === 'failed' ? s : 'pending');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush().then((ok) => {
          if (!ok && !lockedRef.current) schedule(5000);
        });
      }, delay);
    },
    [flush],
  );

  // ---------- init + merge (local never overwritten by older server data) ----------
  useEffect(() => {
    if (!attempt || initFor.current === id) return;
    initFor.current = id;
    (async () => {
      const local = (await loadDraft(uid, id).catch(() => undefined)) ?? emptyDraft();
      const d: AttemptDraft = { ...emptyDraft(), ...local, answers: { ...local.answers }, confirmed: { ...local.confirmed } };
      for (const s of attempt.answers) {
        const l = d.answers[s.questionId];
        // A server lock is authoritative: no local draft can supersede it.
        if (!l || s.revision >= l.revision || s.lockedAt) d.answers[s.questionId] = { questionId: s.questionId, value: s.value, markedForReview: s.markedForReview, revision: s.revision, lockedAt: s.lockedAt ?? null };
        d.confirmed[s.questionId] = Math.max(d.confirmed[s.questionId] ?? 0, s.revision);
      }
      if (d.scratchRev <= d.scratchConfirmed) {
        d.scratchpad = attempt.scratchpad;
        d.scratchVersion = attempt.scratchpadVersion ?? 0;
      } else if ((attempt.scratchpadVersion ?? 0) !== (d.scratchVersion ?? 0)) {
        setConflict({ text: attempt.scratchpad, version: attempt.scratchpadVersion ?? 0 });
      }
      writeDraft(d);
      setReady(true);
      const pending = unsyncedIds(d);
      const scratchPending = d.scratchRev > d.scratchConfirmed;
      if (attempt.status === 'active') {
        if (hasPendingWork(d)) {
          pushEvent('recovery', `Restored ${pending.length} unsynced answer(s)${scratchPending ? ' and unsynced scratchpad notes' : ''} from this device after reload.`);
          schedule(50);
        } else setSync('saved');
      } else {
        setLocked(true);
        lockedRef.current = true;
        setSync('locked');
        if (hasPendingWork(d)) {
          setLateWork(pending);
          pushEvent('late-recovery', `${pending.length} local answer(s)${scratchPending ? ' and unsynced scratchpad notes' : ''} found after submission; not credited. Device persistence is reported separately.`);
        }
      }
    })();
  }, [attempt, id, uid, writeDraft, pushEvent, schedule, setConflict]);

  // merge later server refetches only where server is newer
  useEffect(() => {
    if (!q.data || !ready) return;
    const cur = draftRef.current;
    let changed = false;
    const answers = { ...cur.answers };
    const confirmed = { ...cur.confirmed };
    for (const s of q.data.answers) {
      const l = answers[s.questionId];
      if (!l || s.revision > l.revision || (s.lockedAt && !l.lockedAt)) {
        answers[s.questionId] = { questionId: s.questionId, value: s.value, markedForReview: s.markedForReview, revision: s.revision, lockedAt: s.lockedAt ?? null };
        changed = true;
      }
      if ((confirmed[s.questionId] ?? 0) < s.revision) {
        confirmed[s.questionId] = s.revision;
        changed = true;
      }
    }
    let scratchpad = cur.scratchpad;
    let scratchVersion = cur.scratchVersion ?? 0;
    if ((q.data.scratchpadVersion ?? 0) > scratchVersion) {
      if (cur.scratchRev > cur.scratchConfirmed) {
        setConflict({ text: q.data.scratchpad, version: q.data.scratchpadVersion ?? 0 });
      } else {
        scratchpad = q.data.scratchpad;
        scratchVersion = q.data.scratchpadVersion ?? 0;
        changed = true;
      }
    }
    if (changed) writeDraft({ ...cur, answers, confirmed, scratchpad, scratchVersion });
    if (q.data.status !== 'active') setLocked(true);
  }, [q.data, ready, writeDraft, setConflict]);

  // ---------- environment events ----------
  useEffect(() => {
    if (!attempt || attempt.status !== 'active') return;
    const vis = () => {
      if (document.visibilityState === 'hidden') pushEvent('tab-hidden', `Exam tab hidden at ${new Date().toISOString()}`);
      else void flush();
    };
    const off = () => {
      if (!lockedRef.current && hasPendingWork(draftRef.current)) setSync('offline');
      pushEvent('offline', `Browser reported offline at ${new Date().toISOString()}`);
    };
    const on = () => {
      pushEvent('reconnected', `Browser back online at ${new Date().toISOString()}`);
      schedule(100);
      qc.invalidateQueries({ queryKey: getGetAttemptQueryKey(id) });
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (hasPendingWork(draftRef.current)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    window.addEventListener('beforeunload', unload);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
      window.removeEventListener('beforeunload', unload);
    };
  }, [attempt?.status, id, pushEvent, flush, schedule, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // ---------- submission ----------
  const finishSubmit = useCallback(async () => {
    setSubmitStage('submitting');
    setSubmitErr(null);
    try {
      await submitRef.current({ id });
    } catch (e) {
      if (errStatus(e) !== 409) {
        setSubmitErr(errMsg(e));
        setSubmitStage('confirm');
        return false;
      }
    }
    setLocked(true);
    lockedRef.current = true;
    setLateWork(unsyncedIds(draftRef.current));
    setSubmitOpen(false);
    qc.invalidateQueries({ queryKey: getGetAttemptQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
    qc.invalidateQueries({ queryKey: getListResultsQueryKey() });
    return true;
  }, [id, qc]);

  const startSubmit = async () => {
    setSubmitStage('syncing');
    const ok = await flush();
    if (ok) await finishSubmit();
    else if (!lockedRef.current) setSubmitStage('unsynced');
  };

  // auto-submit at server deadline
  const autoRef = useRef(false);
  useEffect(() => {
    if (remaining === null || remaining > 0 || autoRef.current || !attempt || attempt.status !== 'active' || locked || fromCache) return;
    autoRef.current = true;
    setTimeUp(true);
    (async () => {
      await flush();
      await finishSubmit();
    })();
  }, [remaining, attempt, locked, fromCache, flush, finishSubmit]);

  // ---------- editing ----------
  const questions = attempt?.questions ?? [];
  const current = Math.min(draft.current, Math.max(0, questions.length - 1));
  const qn = questions[current];
  const readOnly = locked || !attempt || attempt.status !== 'active' || (remaining !== null && remaining <= 0 && !fromCache);

  const delivery = withDefaults(attempt?.deliverySettings);
  const lockMode = delivery.lockOnSave;
  const qLocked = !!(qn && draft.answers[qn.id]?.lockedAt);
  const editable = !readOnly && !qLocked && !committing;

  const setAnswer = (qid: string, patch: Partial<Pick<LocalAnswer, 'value' | 'markedForReview'>>) => {
    if (readOnly || committing) return;
    const cur = draftRef.current;
    if (cur.answers[qid]?.lockedAt) return;
    const prev = cur.answers[qid] ?? { questionId: qid, value: '', markedForReview: false, revision: 0 };
    writeDraft({ ...cur, answers: { ...cur.answers, [qid]: { ...prev, ...patch, revision: nextRevision() } } });
    schedule();
  };
  const go = (i: number) => {
    setCommitErr(null);
    writeDraft({ ...draftRef.current, current: Math.max(0, Math.min(questions.length - 1, i)) });
    void flush();
  };
  /** Lock mode: an answered-but-unlocked question asks before leaving. Reviewable mode is unchanged. */
  const requestGo = (i: number) => {
    if (committing) return;
    if (i === current) return;
    const a = qn ? draftRef.current.answers[qn.id] : undefined;
    if (lockMode && !readOnly && a && !a.lockedAt && isAnswered(a)) setPendingNav(i);
    else go(i);
  };
  /** Explicit Save in lock mode. Waits for queued autosaves, then asks the server to lock. Never optimistic. */
  const commitCurrent = async (): Promise<boolean> => {
    if (!qn || readOnly || committing) return false;
    const qid = qn.id;
    if (!navigator.onLine) {
      setCommitErr('Offline. Saving and locking needs the server, so reconnect to continue. Your draft stays on this device and is not locked.');
      return false;
    }
    setCommitting(true);
    setCommitErr(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const run = async (): Promise<boolean> => {
      const a = draftRef.current.answers[qid];
      if (!a || !isAnswered(a)) return false;
      if (a.lockedAt) return true;
      try {
        const res = await commitRef.current({ id, data: { questionId: qid, value: a.value, markedForReview: a.markedForReview, revision: a.revision } });
        const s = res.answers.find((x) => x.questionId === qid);
        if (!s?.lockedAt) {
          setCommitErr('The server did not confirm the lock. Your answer is still a draft; try again.');
          return false;
        }
        const cur = draftRef.current;
        // Only the committed question is rebased; other unsynced answers and notes are untouched.
        writeDraft({
          ...cur,
          answers: { ...cur.answers, [qid]: { questionId: qid, value: s.value, markedForReview: s.markedForReview, revision: s.revision, lockedAt: s.lockedAt } },
          confirmed: { ...cur.confirmed, [qid]: Math.max(cur.confirmed[qid] ?? 0, s.revision) },
        });
        qc.setQueryData(getGetAttemptQueryKey(id), res);
        return true;
      } catch (e) {
        setCommitErr(errStatus(e) === 409 ? `Not locked: ${errMsg(e)}` : `Not locked: ${errMsg(e)}. Your draft is kept.`);
        if (errStatus(e) === 409) qc.invalidateQueries({ queryKey: getGetAttemptQueryKey(id) });
        return false;
      }
    };
    chainRef.current = chainRef.current.then(doFlush, doFlush).then(run, run);
    const ok = await chainRef.current;
    setCommitting(false);
    if (!hasPendingWork(draftRef.current)) setSync('saved');
    return ok;
  };
  const setScratch = (v: string) => {
    const cur = draftRef.current;
    writeDraft({ ...cur, scratchpad: v, scratchRev: nextRevision() });
    if (!readOnly) schedule(1500);
  };
  const resolveScratch = (choice: 'mine' | 'server') => {
    const conflict = conflictRef.current;
    if (!conflict || readOnly) return;
    const cur = draftRef.current;
    const rev = nextRevision();
    writeDraft({ ...cur, scratchpad: choice === 'mine' ? cur.scratchpad : conflict.text,
      scratchVersion: conflict.version, scratchRev: rev, scratchConfirmed: choice === 'server' ? rev : cur.scratchConfirmed });
    setConflict(null);
    setSyncErr(null);
    schedule(50);
  };

  const unsynced = useMemo(() => unsyncedIds(draft), [draft]);
  const sections = useMemo(() => buildSections(questions), [questions]);
  const activeSection = Math.max(0, sections.findIndex((s) => s.indices.includes(current)));
  const visited = draft.visited ?? [];
  const qState = (qid: string): QState => {
    const a = draft.answers[qid];
    if (a?.lockedAt) return 'locked';
    if (isAnswered(a)) return 'answered';
    return visited.includes(qid) ? 'unanswered' : 'unvisited';
  };
  // Record only questions actually opened.
  useEffect(() => {
    if (!ready || !qn) return;
    const cur = draftRef.current;
    if (!(cur.visited ?? []).includes(qn.id)) writeDraft({ ...cur, visited: [...(cur.visited ?? []), qn.id] });
  }, [ready, qn?.id, writeDraft]); // eslint-disable-line react-hooks/exhaustive-deps
  const scratchPending = draft.scratchRev > draft.scratchConfirmed;
  const answeredCount = questions.filter((x) => isAnswered(draft.answers[x.id])).length;
  const flaggedCount = questions.filter((x) => draft.answers[x.id]?.markedForReview).length;
  const lockedCount = questions.filter((x) => draft.answers[x.id]?.lockedAt).length;
  const minimum = minimumRequired(questions.length, delivery.minimumAttemptPercent);
  const countForMinimum = answeredCount;
  const belowMinimum = minimum > 0 && countForMinimum < minimum && (remaining === null || remaining > 0);
  const anns = attempt?.announcements ?? [];
  const freshAnn = anns.find((a) => !seenAnn.includes(a.id));

  // ---------- render ----------
  const night = prefs.examTheme === 'night';
  const wrap = cn('min-h-[100dvh] bg-background text-foreground', night && 'dark', `exam-font-${prefs.examFont}`);

  if (!attempt) {
    if (q.isError && cacheChecked)
      return (
        <div className={cn(wrap, 'grid place-items-center p-6')}>
          <div className="w-full max-w-md space-y-4">
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
            <p className="text-center text-xs text-muted-foreground">No copy of this attempt is stored on this device yet.</p>
            <Button asChild variant="ghost" className="w-full"><Link href="/">Back to overview</Link></Button>
          </div>
        </div>
      );
    return (
      <div className={cn(wrap, 'p-6')}>
        <Skeleton className="mb-6 h-14 w-full" />
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[220px_1fr]"><Skeleton className="h-80" /><Skeleton className="h-96" /></div>
      </div>
    );
  }

  const urgent = remaining !== null && remaining < 5 * 60_000 && remaining > 0;
  const submittedView = attempt.status !== 'active' || (locked && !timeUp && sync !== 'locked') ;

  const SyncBadge = () => {
    const map: Record<SyncState, { icon: typeof Cloud; text: string; tone: string }> = {
      idle: { icon: HardDrive, text: 'Ready', tone: 'text-muted-foreground' },
      pending: { icon: HardDrive, text: device.status === 'stored' ? 'Saved on device · sending' : 'Not server-confirmed · sending', tone: 'text-[hsl(30_70%_40%)] dark:text-[hsl(38_70%_62%)]' },
      saving: { icon: Loader2, text: 'Sending to server', tone: 'text-muted-foreground' },
      saved: { icon: CheckCheck, text: draft.lastSyncedAt ? `Server confirmed ${fmtDate(draft.lastSyncedAt, 'HH:mm:ss')}` : 'Server confirmed', tone: 'text-[hsl(158_40%_32%)] dark:text-[hsl(158_40%_62%)]' },
      failed: { icon: CloudOff, text: device.status === 'stored' ? 'Save not confirmed · draft on device' : 'Save not confirmed · device recovery unavailable', tone: 'text-accent' },
      offline: { icon: CloudOff, text: device.status === 'stored' ? 'Offline · draft on device only' : 'Offline · draft not retained on device', tone: 'text-accent' },
      locked: { icon: Lock, text: 'Attempt closed by server', tone: 'text-muted-foreground' },
    };
    const m = map[sync];
    return (
      <span data-testid="status-sync" className={cn('flex items-center gap-1.5 font-mono text-[11px]', m.tone)} title={syncErr ?? undefined}>
        <m.icon className={cn('h-3.5 w-3.5', sync === 'saving' && 'animate-spin')} />
        <span className="hidden sm:inline">{m.text}</span>
        {unsynced.length > 0 && <span className="rounded bg-current/10 px-1 tnum">{unsynced.length}</span>}
        {scratchPending && <span>Notes not server-confirmed</span>}
      </span>
    );
  };

  if (submittedView && !timeUp) {
    return (
      <div className={cn(wrap, 'ruled grid place-items-center p-6')}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center">
          <Seal size={44} className="mx-auto" />
          <h1 className="mt-5 font-display text-4xl">{attempt.sandbox ? 'Sandbox run finished' : 'Submitted'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{attempt.examTitle}{attempt.submittedAt && <> · received by the server {fmtDate(attempt.submittedAt)}</>}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-lg border p-3"><div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Answers on record</div><div className="font-display text-3xl tnum">{attempt.answers.filter((a) => a.value && a.value !== '[]').length}/{attempt.questions.length}</div></div>
            <div className="rounded-lg border p-3"><div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Score</div><div className="font-display text-3xl tnum">{attempt.score != null ? `${attempt.score}/${attempt.totalMarks}` : '—'}</div>{attempt.score == null && <div className="text-[11px] text-muted-foreground">Released when your examiner publishes</div>}</div>
          </div>
          {lateWork.length > 0 && (
            <div className="mt-5 flex gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3 text-left text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{lateWork.length} answer(s) never reached the server before the attempt closed and are not credited. {device.status === 'stored' ? 'A draft is retained on this device.' : 'Device recovery is not confirmed; copy this work before closing.'} A contextual notification is queued for the examiner.</span>
            </div>
          )}
          {scratchPending && <p className="mt-3 text-xs text-accent">Scratchpad notes were not confirmed by the server before the attempt closed. Notes are not graded. {device.status !== 'stored' && 'Local recovery is not confirmed; copy these notes before closing.'}</p>}
          <AttemptSafety localError={device.error} retry={() => writeDraft(draftRef.current)} conflict={scratchConflict} mine={draft.scratchpad} resolve={resolveScratch} closed />
          {!attempt.sandbox && <IntegrityReview attemptId={attempt.id} staff={false} />}
          {!attempt.sandbox && <IncidentReview key={attempt.id} attemptId={attempt.id} mode="candidate" className="mt-5" />}
          <Button asChild className="mt-7 w-full"><Link href={attempt.sandbox ? `/exams/${attempt.examId}` : '/'} data-testid="link-after-submit">{attempt.sandbox ? 'Back to exam configuration' : 'Back to overview'}</Link></Button>
        </motion.div>
      </div>
    );
  }

  const selected = qn && qn.type !== 'written' ? parseSelected(draft.answers[qn.id]?.value ?? '[]') : [];
  const navList = questions.map((x, i) => ({ x, i })).filter(({ x }) => !flaggedOnly || draft.answers[x.id]?.markedForReview);

  return (
    <div className={wrap}>
      {attempt.sandbox && (
        <div className="flex items-center justify-center gap-2 bg-[repeating-linear-gradient(135deg,hsl(var(--accent)/.12)_0_10px,transparent_10px_20px)] py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-accent" data-testid="banner-sandbox">
          <FlaskConical className="h-3.5 w-3.5" /> Sandbox — excluded from results and statistics
        </div>
      )}
      <AttemptSafety localError={device.error} retry={() => writeDraft(draftRef.current)} conflict={scratchConflict} mine={draft.scratchpad} resolve={resolveScratch} closed={readOnly} />
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5">
          <Seal size={24} className="hidden sm:block" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{attempt.examTitle}</div>
            <div className="flex flex-wrap items-center gap-x-3">
              <SyncBadge />
              <span className="hidden font-mono text-[11px] text-muted-foreground tnum lg:inline" data-testid="text-attempt-progress">Started {fmtDate(attempt.startedAt, 'HH:mm')} · {answeredCount}/{questions.length} answered{lockMode ? ` · ${lockedCount} locked` : ''}</span>
            </div>
          </div>
          <div className="hidden items-center gap-0.5 rounded-lg border p-0.5 md:flex">
            <button aria-label="Smaller text" className="rounded p-1.5 hover:bg-muted" onClick={() => updatePrefs({ examFont: prefs.examFont === 'lg' ? 'md' : 'sm' })} data-testid="button-font-down"><Minus className="h-3.5 w-3.5" /></button>
            <span className="px-1 font-mono text-[10px] uppercase">{prefs.examFont}</span>
            <button aria-label="Larger text" className="rounded p-1.5 hover:bg-muted" onClick={() => updatePrefs({ examFont: prefs.examFont === 'sm' ? 'md' : 'lg' })} data-testid="button-font-up"><Plus className="h-3.5 w-3.5" /></button>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <button aria-label="Toggle theme" className="rounded p-1.5 hover:bg-muted" onClick={() => updatePrefs({ examTheme: night ? 'paper' : 'night' })} data-testid="button-exam-theme">{night ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}</button>
            <button aria-label="Toggle layout" className="rounded p-1.5 hover:bg-muted" onClick={() => updatePrefs({ examLayout: prefs.examLayout === 'split' ? 'focus' : 'split' })} data-testid="button-exam-layout">{prefs.examLayout === 'split' ? <Square className="h-3.5 w-3.5" /> : <Columns2 className="h-3.5 w-3.5" />}</button>
          </div>
          <HelpButton onClick={() => setHelpOpen(true)} />
          <button onClick={() => setScratchOpen((s) => !s)} aria-pressed={scratchOpen} className={cn('rounded-lg border p-2 transition', scratchOpen && 'border-accent text-accent')} aria-label="Scratchpad" data-testid="button-scratchpad"><NotebookPen className="h-4 w-4" /></button>
          <div className={cn('rounded-lg border px-3 py-1.5 text-right transition-colors', urgent && 'border-accent bg-accent/10 text-accent')} data-testid="text-timer">
            <div className="font-mono text-lg font-medium leading-none tnum">{remaining === null ? '--:--' : clock(remaining)}</div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{anchor.current?.estimated ? 'estimated · offline' : 'server time left'}</div>
          </div>
          <Button onClick={() => { setSubmitStage('confirm'); setSubmitErr(null); setSubmitOpen(true); }} disabled={readOnly} data-testid="button-open-submit"><Send className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Submit</span></Button>
        </div>
        {(!online || fromCache) && (
          <div className="border-t border-accent/30 bg-accent/10 px-4 py-1.5 text-center text-xs text-accent">
            {fromCache ? 'Showing the copy of this attempt stored on this device. Answers stay local until the server is reachable.' : 'You are offline. Keep writing — answers are stored on this device and will be sent when you reconnect.'}
          </div>
        )}
        {locked && sync === 'locked' && (
          <div className="border-t bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">The server has closed this attempt. Further changes will not be credited. {device.status === 'stored' ? 'A draft is retained on this device.' : 'Device recovery is not confirmed.'}</div>
        )}
      </header>

      <AnimatePresence>
        {freshAnn && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mx-auto mt-4 max-w-[1400px] px-4">
            <div role="status" className="flex items-start gap-3 rounded-xl border border-accent/40 bg-card p-3 shadow-sm" data-testid="banner-announcement">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="flex-1 text-sm"><span className="font-medium">Examiner announcement · {fmtDate(freshAnn.createdAt, 'HH:mm')}</span><p className="text-muted-foreground">{freshAnn.message}</p></div>
              <button aria-label="Dismiss" onClick={() => setSeenAnn((s) => [...s, freshAnn.id])} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn('mx-auto grid max-w-[1400px] gap-6 px-4 py-6', prefs.examLayout === 'split' ? 'md:grid-cols-[230px_1fr]' : '', scratchOpen && (prefs.examLayout === 'split' ? 'xl:grid-cols-[230px_1fr_320px]' : 'xl:grid-cols-[1fr_320px]'))}>
        {prefs.examLayout === 'split' && (
          <aside className="md:sticky md:top-24 md:self-start">
            <div className="rounded-xl border bg-card p-3">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium">Questions</span><span className="font-mono text-muted-foreground tnum">{answeredCount}/{questions.length}</span></div>
              <div className="grid grid-cols-6 gap-1.5 md:grid-cols-5">
                {navList.map(({ x, i }) => (
                  <QuestionTile key={x.id} n={i + 1} state={qState(x.id)} flagged={!!draft.answers[x.id]?.markedForReview} current={i === current} unsynced={unsynced.includes(x.id)} onClick={() => requestGo(i)} />
                ))}
              </div>
              <button onClick={() => setFlaggedOnly((f) => !f)} className={cn('mt-3 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs', flaggedOnly ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-muted')} data-testid="button-flagged-only">
                <span className="flex items-center gap-1.5"><Flag className="h-3 w-3" />Flagged only</span><span className="tnum">{flaggedCount}</span>
              </button>
              <div className="mt-3 border-t pt-3"><Legend lockMode={lockMode} /></div>
            </div>
          </aside>
        )}

        <main className={cn(prefs.examLayout === 'focus' && 'mx-auto w-full max-w-3xl')}>
          <SectionBar sections={sections} active={activeSection} current={current} onJump={requestGo} answeredIn={(sec) => sec.indices.filter((i) => isAnswered(draft.answers[questions[i].id])).length} />
          {qn ? (
            <AnimatePresence mode="wait">
              <motion.article key={qn.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="rounded-2xl border bg-card p-5 md:p-8">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="font-display text-3xl">Question {current + 1}</span>
                  <span className="font-mono text-xs text-muted-foreground">of {questions.length}</span>
                  <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[11px]">{qn.marks} mark{qn.marks === 1 ? '' : 's'}</span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{qn.type === 'single' ? 'Choose one' : qn.type === 'multiple' ? 'Choose all that apply' : 'Written answer'}</span>
                  {sections.length > 1 && <span className="font-mono text-[11px] text-muted-foreground" data-testid="text-question-section">{qn.category}</span>}
                  <span className="ml-auto font-mono text-[10.5px]" data-testid="status-question-sync">
                    {qLocked ? <span className="inline-flex items-center gap-1 text-foreground" data-testid="status-question-locked"><Lock className="lock-in h-3 w-3" />locked {fmtDate(draft.answers[qn.id]?.lockedAt, 'HH:mm:ss')} · read only</span> : !draft.answers[qn.id] ? null : unsynced.includes(qn.id) ? <span className="text-[hsl(30_70%_40%)] dark:text-[hsl(38_70%_62%)]">{device.status === 'stored' ? 'draft on device' : 'not retained on device'}</span> : <span className="text-[hsl(158_40%_32%)] dark:text-[hsl(158_40%_62%)]">server confirmed</span>}
                  </span>
                </div>
                <p className="exam-text whitespace-pre-wrap">{qn.text}</p>

                {qn.type === 'written' ? (
                  <div className="mt-6">
                    <Textarea
                      data-testid="input-written-answer"
                      value={draft.answers[qn.id]?.value ?? ''}
                      onChange={(e) => setAnswer(qn.id, { value: e.target.value })}
                      readOnly={!editable}
                      rows={12}
                      maxLength={20000}
                      className="exam-text resize-y bg-background"
                      placeholder="Write your answer. It is stored on this device as you type."
                    />
                    <div className="mt-1 text-right font-mono text-[11px] text-muted-foreground tnum">{(draft.answers[qn.id]?.value ?? '').trim().split(/\s+/).filter(Boolean).length} words</div>
                  </div>
                ) : (
                  <ul className="mt-6 space-y-2" role={qn.type === 'single' ? 'radiogroup' : 'group'}>
                    {qn.options.map((o, k) => {
                      const on = selected.includes(o.id);
                      return (
                        <li key={o.id}>
                          <motion.button
                            whileTap={!editable ? undefined : { scale: 0.995 }}
                            role={qn.type === 'single' ? 'radio' : 'checkbox'}
                            aria-checked={on}
                            disabled={!editable}
                            data-testid={`option-${k}`}
                            onClick={() => {
                              const next = qn.type === 'single' ? (on ? [] : [o.id]) : on ? selected.filter((s) => s !== o.id) : [...selected, o.id];
                              setAnswer(qn.id, { value: JSON.stringify(next) });
                            }}
                            className={cn('exam-text flex w-full items-start gap-4 rounded-xl border px-4 py-3 text-left transition', on ? 'border-primary bg-primary/[0.06]' : 'hover:border-foreground/30', !editable && 'cursor-default opacity-80')}
                          >
                            <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center border font-mono text-xs transition', qn.type === 'single' ? 'rounded-full' : 'rounded-md', on ? 'border-primary bg-primary text-primary-foreground' : '')}>{String.fromCharCode(65 + k)}</span>
                            <span>{o.text}</span>
                          </motion.button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {commitErr && <p role="alert" className="mt-4 rounded-lg border border-accent/40 bg-accent/[0.06] p-2.5 text-xs text-accent" data-testid="text-commit-error">{commitErr}</p>}
                <div className="mt-8 flex flex-wrap items-center gap-2 border-t pt-5">
                  <Button variant="outline" onClick={() => requestGo(current - 1)} disabled={current === 0} data-testid="button-prev"><ArrowLeft className="mr-1.5 h-4 w-4" />Previous</Button>
                  <Button
                    variant="ghost"
                    disabled={!editable}
                    onClick={() => setAnswer(qn.id, { value: draft.answers[qn.id]?.value ?? (qn.type === 'written' ? '' : '[]'), markedForReview: !draft.answers[qn.id]?.markedForReview })}
                    className={cn(draft.answers[qn.id]?.markedForReview && 'text-accent')}
                    data-testid="button-flag"
                  >
                    <Flag className={cn('mr-1.5 h-4 w-4', draft.answers[qn.id]?.markedForReview && 'fill-accent')} />{draft.answers[qn.id]?.markedForReview ? 'Flagged for review' : 'Flag for review'}
                  </Button>
                  {editable && isAnswered(draft.answers[qn.id]) && <Button variant="ghost" onClick={() => setAnswer(qn.id, { value: qn.type === 'written' ? '' : '[]' })} data-testid="button-clear">Clear</Button>}
                  <div className="flex-1" />
                  {lockMode && !readOnly && !qLocked ? (
                    <>
                      {current < questions.length - 1 && (
                        <Button variant="ghost" disabled={isAnswered(draft.answers[qn.id]) || committing} onClick={() => go(current + 1)} title={isAnswered(draft.answers[qn.id]) ? 'Clear your answer to skip, or save it' : undefined} data-testid="button-skip"><SkipForward className="mr-1.5 h-4 w-4" />Skip</Button>
                      )}
                      <Button variant="outline" disabled={!isAnswered(draft.answers[qn.id]) || committing || !online} onClick={() => void commitCurrent()} data-testid="button-save-lock">
                        {committing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Save
                      </Button>
                      {current < questions.length - 1 ? (
                        <Button disabled={!isAnswered(draft.answers[qn.id]) || committing || !online} onClick={async () => { if (await commitCurrent()) go(current + 1); }} data-testid="button-save-next">Save and next<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                      ) : (
                        <Button variant="secondary" onClick={() => { setSubmitStage('confirm'); setSubmitOpen(true); }} data-testid="button-finish">Review &amp; submit</Button>
                      )}
                    </>
                  ) : current < questions.length - 1 ? (
                    <Button onClick={() => requestGo(current + 1)} data-testid="button-next">Next<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                  ) : (
                    <Button onClick={() => { setSubmitStage('confirm'); setSubmitOpen(true); }} disabled={readOnly} data-testid="button-finish">Review &amp; submit</Button>
                  )}
                </div>
              </motion.article>
            </AnimatePresence>
          ) : (
            <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">This paper has no questions.</div>
          )}
          {prefs.examLayout === 'focus' && (
            <div className="mt-4 flex flex-wrap justify-center gap-1">
              {questions.map((x, i) => (
                <button key={x.id} onClick={() => requestGo(i)} aria-label={`Question ${i + 1}`} className={cn('h-2 rounded-full transition-all', i === current ? 'w-6 bg-foreground' : isAnswered(draft.answers[x.id]) ? 'w-2 bg-primary/50' : 'w-2 bg-muted-foreground/25', draft.answers[x.id]?.markedForReview && 'bg-accent')} />
              ))}
            </div>
          )}
        </main>

        <AnimatePresence>
          {scratchOpen && (
            <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="xl:sticky xl:top-24 xl:self-start">
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-medium"><NotebookPen className="h-3.5 w-3.5" />Scratchpad</span><span className="text-muted-foreground">{scratchPending ? device.status === 'stored' ? 'draft on device · not synced' : 'not synced · device recovery unconfirmed' : 'synced'}</span></div>
                <Textarea data-testid="input-scratchpad" value={draft.scratchpad} onChange={(e) => setScratch(e.target.value)} rows={16} maxLength={50000} className="ruled font-mono text-sm leading-8" placeholder="Working notes. Not graded." />
                <p className="mt-2 text-[11px] text-muted-foreground">Not graded. Visible to examiners only as context.</p>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {!attempt.sandbox && (
        <div className="mx-auto max-w-3xl px-4 pb-10">
          <IncidentReview key={attempt.id} attemptId={attempt.id} mode="candidate" />
          <details className="mt-4 rounded-xl border bg-card p-4"><summary className="cursor-pointer font-medium">Assistance policy, disclosure and human review</summary><IntegrityReview attemptId={attempt.id} staff={false} /></details>
        </div>
      )}

      <AlertDialog open={submitOpen} onOpenChange={(o) => submitStage !== 'submitting' && submitStage !== 'syncing' && setSubmitOpen(o)}>
        <AlertDialogContent className={cn(night && 'dark')}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-3xl font-normal">{submitStage === 'unsynced' ? 'Some work is not on the server' : 'Submit your attempt?'}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {submitStage === 'unsynced' ? (
                  <p>{unsynced.length > 0 ? `${unsynced.length} answer(s) are not server-confirmed. ` : ''}{scratchPending ? 'Scratchpad notes are not server-confirmed. ' : ''}The last send failed ({syncErr ?? 'network unavailable'}). You can retry, or submit using only what the server already has. Unsent answers will not be credited; notes are not graded. {device.status === 'stored' ? 'A draft is retained on this device.' : 'Device recovery is not confirmed. Copy any unsent work before closing.'}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border p-2"><div className="font-display text-2xl text-foreground tnum">{answeredCount}</div><div className="text-[11px]">answered</div></div>
                      <div className="rounded-lg border p-2"><div className="font-display text-2xl text-foreground tnum">{questions.length - answeredCount}</div><div className="text-[11px]">blank</div></div>
                      <div className="rounded-lg border p-2"><div className="font-display text-2xl text-foreground tnum">{flaggedCount}</div><div className="text-[11px]">flagged</div></div>
                    </div>
                    {lockMode && <p data-testid="text-submit-locked">{lockedCount} answer(s) saved and locked.{answeredCount - lockedCount > 0 ? ` ${answeredCount - lockedCount} unlocked draft(s) will also be submitted once the server confirms them.` : ''}</p>}
                    {minimum > 0 && (
                      <p className={cn('rounded-lg border p-2', belowMinimum && 'border-accent/40 text-accent')} data-testid="text-submit-minimum">
                        Early submission needs at least {minimum} answered question(s); server-confirmed drafts count. You have {countForMinimum}. {belowMinimum ? 'Keep working; when time ends the server submits automatically.' : ''}
                      </p>
                    )}
                    <p>We'll send any unsaved work first, then submit. You can't change answers afterwards.</p>
                  </>
                )}
                {submitErr && <p className="text-destructive">{submitErr}</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={submitStage === 'syncing' || submitStage === 'submitting'}>Keep working</AlertDialogCancel>
            {submitStage === 'unsynced' ? (
              <>
                <Button variant="outline" onClick={startSubmit} data-testid="button-retry-sync">Retry sending</Button>
                <Button variant="destructive" disabled={belowMinimum} onClick={() => void finishSubmit()} data-testid="button-submit-server-only">Submit server-saved answers</Button>
              </>
            ) : (
              <Button onClick={startSubmit} disabled={submitStage !== 'confirm' || belowMinimum} data-testid="button-confirm-submit">
                {submitStage !== 'confirm' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitStage === 'syncing' ? 'Sending answers' : submitStage === 'submitting' ? 'Submitting' : 'Sync and submit'}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingNav !== null} onOpenChange={(o) => !o && !committing && setPendingNav(null)}>
        <AlertDialogContent className={cn(night && 'dark')} data-testid="dialog-unlocked-leave">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">This answer is not locked</AlertDialogTitle>
            <AlertDialogDescription>A selected answer cannot be skipped in this exam. Save to lock it on the server, or stay and clear it first. Locked answers stay readable but cannot be changed.{!online ? ' You are offline: saving needs a connection, so reconnect before moving on.' : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          {commitErr && <p role="alert" className="text-xs text-accent">{commitErr}</p>}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={committing} data-testid="button-stay">Stay here</AlertDialogCancel>
            <Button disabled={committing || !online} onClick={async () => { const t = pendingNav; if (await commitCurrent()) { setPendingNav(null); if (t !== null) go(t); } }} data-testid="button-save-leave">
              {committing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save and lock
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} lockMode={lockMode} minimum={minimum} night={night} />

      <AnimatePresence>
        {timeUp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn('fixed inset-0 z-50 grid place-items-center bg-background/85 p-6 backdrop-blur', night && 'dark')}>
            <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center" role="alertdialog" aria-live="assertive">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Time is up</div>
              <h2 className="mt-2 font-display text-4xl">Pens down.</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {submitM.isPending || sync === 'saving' ? 'Sending your last answers and submitting…' : attempt.status !== 'active' || locked ? 'Your attempt has been submitted with the answers the server received.' : 'Submitting…'}
              </p>
              {unsynced.length > 0 && locked && <p className="mt-3 rounded-lg bg-accent/10 p-2 text-xs text-accent">{unsynced.length} answer(s) didn't reach the server in time and won't be credited. {device.status === 'stored' ? 'A draft is retained on this device.' : 'Device recovery is not confirmed; copy unsent work before closing.'}</p>}
              {scratchPending && locked && <p className="mt-3 text-xs text-accent">The server did not confirm scratchpad notes before the attempt closed. Notes are not graded. {device.status !== 'stored' && 'Device recovery is not confirmed.'}</p>}
              <Button asChild className="mt-6 w-full" disabled={!locked}><Link href="/">Back to overview</Link></Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
