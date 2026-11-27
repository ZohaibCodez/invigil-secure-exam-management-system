import { get, set, del } from 'idb-keyval';
import type { Attempt } from '@workspace/api-client-react';

export interface LocalAnswer {
  questionId: string;
  value: string;
  markedForReview: boolean;
  revision: number;
  /** Server-confirmed immutable lock time (save-and-lock mode). Never set locally. */
  lockedAt?: string | null;
}
export interface AttemptDraft {
  answers: Record<string, LocalAnswer>;
  /** revisions the server has confirmed per question */
  confirmed: Record<string, number>;
  scratchpad: string;
  scratchRev: number;
  scratchConfirmed: number;
  /** Server version this scratchpad edit was based on. */
  scratchVersion?: number;
  lastSyncedAt: string | null;
  current: number;
  /** Question IDs the candidate has actually opened. */
  visited?: string[];
}
export interface Prefs {
  examFont: 'sm' | 'md' | 'lg';
  examTheme: 'paper' | 'night';
  examLayout: 'split' | 'focus';
  appTheme: 'light' | 'dark';
  density: 'comfortable' | 'compact';
}
export const defaultPrefs: Prefs = {
  examFont: 'md',
  examTheme: 'paper',
  examLayout: 'split',
  appTheme: 'light',
  density: 'comfortable',
};

const dk = (u: string, a: string) => `examora:draft:${u}:${a}`;
const ck = (u: string, a: string) => `examora:attempt:${u}:${a}`;
const pk = (u: string) => `examora:prefs:${u}`;

export const loadDraft = (u: string, a: string) => get<AttemptDraft>(dk(u, a));
export const saveDraft = (u: string, a: string, d: AttemptDraft) => set(dk(u, a), d);
export const clearDraft = (u: string, a: string) => del(dk(u, a));
export const loadCachedAttempt = (u: string, a: string) => get<Attempt>(ck(u, a));
export const cacheAttempt = (u: string, a: string, at: Attempt) => set(ck(u, a), at);
export async function loadPrefs(u: string): Promise<Prefs> {
  const p = await get<Partial<Prefs>>(pk(u));
  return { ...defaultPrefs, ...(p ?? {}) };
}
export const savePrefs = (u: string, p: Prefs) => set(pk(u), p);

let lastRev = 0;
/** Monotonic, safe-integer revision based on wall clock. */
export function nextRevision() {
  const now = Date.now();
  lastRev = now > lastRev ? now : lastRev + 1;
  return lastRev;
}
export function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
