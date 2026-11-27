import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { refreshSessionAfterAuth } from '../src/lib/session-refresh';

test('sign-in and sign-out refresh the mounted observer and discard private cache', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const sessionKey = ['/api/session'];
  let user: string | null = null;
  const observer = new QueryObserver(qc, { queryKey: sessionKey, queryFn: async () => ({ user }) });
  const seen: (string | null)[] = [];
  const unsubscribe = observer.subscribe(result => { if (result.data) seen.push(result.data.user); });
  try {
    await observer.refetch();
    assert.equal(observer.getCurrentResult().data?.user, null);
    qc.setQueryData(['/api/attempts/previous-user'], { private: 'previous answers' });
    user = 'candidate';
    await refreshSessionAfterAuth(qc, sessionKey);
    assert.equal(observer.getCurrentResult().data?.user, 'candidate');
    assert.ok(seen.includes('candidate'), 'mounted authentication gate receives the sign-in');
    assert.equal(qc.getQueryData(['/api/attempts/previous-user']), undefined);
    qc.setQueryData(['/api/attempts/current-user'], { private: 'current answers' });
    user = null;
    await refreshSessionAfterAuth(qc, sessionKey);
    assert.equal(observer.getCurrentResult().data?.user, null);
    assert.equal(qc.getQueryData(['/api/attempts/current-user']), undefined);
    assert.equal(seen.at(-1), null, 'mounted gate receives the sign-out');
  } finally { unsubscribe(); qc.clear(); }
});
