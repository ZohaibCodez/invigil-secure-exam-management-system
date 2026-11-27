import { useMemo, useRef, useState } from 'react';
import { saveDraft, type AttemptDraft } from '@/lib/local';
import { createDraftWriter, type DeviceWriteState } from '@/lib/draft-persistence';

/** Serialize device writes and never acknowledge an older write as the latest. */
export function useDraftPersistence(userId: string, attemptId: string) {
  const [state, setState] = useState<DeviceWriteState>({ status: 'checking', error: null });
  const key = `${userId}:${attemptId}`;
  const active = useRef(key);
  active.current = key;
  const persist = useMemo(() => createDraftWriter<AttemptDraft>(
    draft => saveDraft(userId, attemptId, draft),
    next => { if (active.current === key) setState(next); },
  ), [userId, attemptId, key]);
  return { ...state, persist };
}
