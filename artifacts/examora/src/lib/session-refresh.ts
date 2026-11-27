import { hashKey, type QueryClient, type QueryKey } from '@tanstack/react-query';

/** Keep the session observer alive so authentication updates the mounted gate. */
export async function refreshSessionAfterAuth(qc: QueryClient, sessionKey: QueryKey) {
  await qc.cancelQueries();
  const sessionHash = hashKey(sessionKey);
  qc.removeQueries({ predicate: query => query.queryHash !== sessionHash });
  await qc.resetQueries({ queryKey: sessionKey, exact: true });
}
