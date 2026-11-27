import type { DeliverySettings, AdmissionStatus } from '@workspace/api-client-react';

export const DEFAULT_DELIVERY: DeliverySettings = {
  requireProctorApproval: false,
  requireReadiness: false,
  confirmSubjects: false,
  lockOnSave: false,
  minimumAttemptPercent: 0,
  venue: '',
  sessionLabel: '',
};

/** Supervised delivery preset: readiness, subject confirmation and save-and-lock. QR approval and threshold stay optional. */
export const SUPERVISED_PRESET: Pick<DeliverySettings, 'requireReadiness' | 'confirmSubjects' | 'lockOnSave'> = {
  requireReadiness: true,
  confirmSubjects: true,
  lockOnSave: true,
};

export const withDefaults = (s?: Partial<DeliverySettings> | null): DeliverySettings => ({ ...DEFAULT_DELIVERY, ...(s ?? {}) });

export const isStrict = (s?: DeliverySettings | null) =>
  !!s && (s.requireProctorApproval || s.requireReadiness || s.confirmSubjects || s.lockOnSave || s.minimumAttemptPercent > 0);

export const minimumRequired = (total: number, percent: number) => (percent > 0 ? Math.ceil((total * percent) / 100) : 0);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Only same-origin, single-slash internal paths are accepted. Returns '/' otherwise. */
export function safeInternalPath(raw: string | null | undefined): string {
  if (!raw) return '/';
  const v = raw.trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || /[\u0000-\u001f]/.test(v)) return '/';
  try {
    const u = new URL(v, window.location.origin);
    if (u.origin !== window.location.origin) return '/';
    let p = u.pathname;
    if (BASE && p.startsWith(BASE + '/')) p = p.slice(BASE.length);
    return p + u.search + u.hash;
  } catch {
    return '/';
  }
}

const ID_RE = /^[A-Za-z0-9_-]{4,100}$/;

/** Extract an admission request ID from a scanned value. Never returns a URL; foreign origins are rejected. */
export function extractAdmissionId(raw: string): { id: string } | { error: string } {
  const v = raw.trim();
  if (!v) return { error: 'Nothing was read.' };
  if (ID_RE.test(v)) return { id: v };
  let u: URL;
  try {
    u = new URL(v, window.location.origin);
  } catch {
    return { error: 'This is not an Examora admission code.' };
  }
  if (u.origin !== window.location.origin) return { error: 'This code points to another website. It was ignored and not opened.' };
  let p = u.pathname;
  if (BASE && p.startsWith(BASE + '/')) p = p.slice(BASE.length);
  const m = /^\/admissions\/([A-Za-z0-9_-]{4,100})\/?$/.exec(p);
  if (!m) return { error: 'This link is from Examora but is not an admission request.' };
  return { id: m[1] };
}

export const admissionUrl = (id: string) => `${window.location.origin}${BASE}/admissions/${encodeURIComponent(id)}`;

export const ADMISSION_COPY: Record<AdmissionStatus, { label: string; body: string }> = {
  pending: { label: 'Awaiting staff', body: 'A supervisor must review this request before the candidate can start.' },
  approved: { label: 'Approved', body: 'Staff approved entry. The timer still starts only when the candidate presses Start.' },
  denied: { label: 'Denied', body: 'Staff declined this request. Speak with the supervisor in the room.' },
  consumed: { label: 'Used', body: 'This approval was used to start an attempt and cannot be reused.' },
  expired: { label: 'Expired', body: 'Requests are valid for five minutes. Create a fresh request to continue.' },
};
