import { format, formatDistanceToNowStrict } from 'date-fns';
import { ApiError } from '@workspace/api-client-react';

export function fmtDate(iso?: string | null, pattern = 'd MMM yyyy, HH:mm') {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : format(d, pattern);
}
export function ago(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : `${formatDistanceToNowStrict(d)} ago`;
}
export function errMsg(e: unknown) {
  if (e instanceof ApiError) {
    const d = e.data as { message?: string; error?: string } | null;
    return d?.message || d?.error || e.message;
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
export function errStatus(e: unknown) {
  return e instanceof ApiError ? e.status : 0;
}
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}
export function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
export function pct(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${Number(n).toFixed(digits)}%`;
}
export function parseSelected(value: string): string[] {
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
