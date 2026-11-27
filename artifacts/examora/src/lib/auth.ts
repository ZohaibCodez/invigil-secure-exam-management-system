import type { QueryClient } from '@tanstack/react-query';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

async function post(path: string, body: unknown) {
  const res = await fetch(`${base}/api/auth${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const m = data && typeof data === 'object' && 'message' in data ? String((data as { message: unknown }).message) : '';
    const msg =
      m ||
      (res.status === 401 ? 'Email or password is incorrect.' : `Sign-in failed (${res.status}).`);
    throw new Error(msg);
  }
  return data;
}

export async function signIn(qc: QueryClient, email: string, password: string) {
  await post('/sign-in/email', { email, password });
  qc.clear();
}

export async function signOut(qc: QueryClient) {
  try {
    await post('/sign-out', {});
  } finally {
    qc.clear();
  }
}

export const DEMO_PASSWORD = 'ExamoraDemo2026!';
export const DEMO_ACCOUNTS = [
  { role: 'examiner', email: 'examiner@examora.demo', blurb: 'Author exams, grade, publish' },
  { role: 'candidate', email: 'candidate@examora.demo', blurb: 'Sit an exam, see results' },
  { role: 'admin', email: 'admin@examora.demo', blurb: 'Manage people and access' },
] as const;
