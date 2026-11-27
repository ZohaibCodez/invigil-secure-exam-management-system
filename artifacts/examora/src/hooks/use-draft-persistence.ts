import { useCallback, useRef, useState } from 'react';
import { saveDraft, type AttemptDraft } from '@/lib/local';

/** Serialize device writes and never acknowledge an older write as the latest. */
export function useDraftPersistence(userId: string, attemptId: string) {
  const [status, setStatus] = useState<'checking' | 'writing' | 'stored' | 'failed'>('checking');
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const persist = useCallback((draft: AttemptDraft) => {
    const current = ++sequence.current;
    setStatus('writing');
    queue.current = queue.current.catch(() => {}).then(() => saveDraft(userId, attemptId, draft)).then(() => {
      if (current === sequence.current) { setStatus('stored'); setError(null); }
    }, () => {
      if (current === sequence.current) {
        setStatus('failed');
        setError('This browser could not retain the latest work. Reloading or closing it may lose anything not confirmed by the server.');
      }
    });
  }, [userId, attemptId]);
  return { status, error, persist };
}
