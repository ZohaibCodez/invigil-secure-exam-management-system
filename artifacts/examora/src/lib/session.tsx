import { createContext, useContext } from 'react';
import type { User } from '@workspace/api-client-react';

export const SessionCtx = createContext<User | null>(null);
export function useMe() {
  const u = useContext(SessionCtx);
  if (!u) throw new Error('No session');
  return u;
}
export const isStaff = (u: User) => u.role === 'examiner' || u.role === 'admin';
