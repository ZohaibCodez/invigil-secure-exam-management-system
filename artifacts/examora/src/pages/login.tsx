import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck, Clock3, CloudOff, CheckCheck } from 'lucide-react';
import { Seal } from '@/components/kit';
import { Input } from '@/components/ui/input';
import { signIn, DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/auth';

const LEDGER = [
  { t: '14:02:11', s: 'local', text: 'Q7 answer written to this device' },
  { t: '14:02:12', s: 'pending', text: 'Network dropped — save queued' },
  { t: '14:03:40', s: 'pending', text: 'Reconnected, sending revision 4' },
  { t: '14:03:41', s: 'confirmed', text: 'Server confirmed Q7 rev. 4' },
  { t: '14:30:00', s: 'confirmed', text: 'Deadline set by server clock' },
];

function Ledger() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v >= LEDGER.length ? 1 : v + 1)), 1700);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50">
        <span>How a save travels</span>
        <span className="flex items-center gap-1.5">
          <span className="relative h-1.5 w-1.5 rounded-full bg-sidebar-primary pulse-dot text-sidebar-primary" /> illustration
        </span>
      </div>
      <ul className="space-y-1.5 font-mono text-[12px]">
        <AnimatePresence initial={false}>
          {LEDGER.slice(0, n).map((l) => (
            <motion.li
              key={l.t}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <span className="text-sidebar-foreground/40 tnum">{l.t}</span>
              <span
                className={
                  l.s === 'confirmed'
                    ? 'text-[hsl(158_45%_62%)]'
                    : l.s === 'pending'
                      ? 'text-[hsl(38_85%_62%)]'
                      : 'text-sidebar-foreground/70'
                }
              >
                {l.s === 'confirmed' ? <CheckCheck className="h-3.5 w-3.5" /> : l.s === 'pending' ? <CloudOff className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
              </span>
              <span className="text-sidebar-foreground/85">{l.text}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

export default function Login({ demoEnabled }: { demoEnabled: boolean }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(e: string, p: string, key: string) {
    setBusy(key);
    setError(null);
    try {
      await signIn(qc, e, p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setBusy(null);
    }
  }
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!email || !password) return setError('Enter your email and password.');
    go(email.trim(), password, 'form');
  };

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      <section className="grid-paper relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col">
        <svg className="sweep pointer-events-none absolute -right-48 -top-48 h-[640px] w-[640px] opacity-[0.08]" viewBox="0 0 200 200" aria-hidden>
          {Array.from({ length: 60 }).map((_, i) => (
            <line key={i} x1="100" y1="6" x2="100" y2={i % 5 === 0 ? 20 : 13} stroke="currentColor" strokeWidth={i % 5 === 0 ? 1.4 : 0.6} transform={`rotate(${i * 6} 100 100)`} />
          ))}
          <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth=".6" />
        </svg>
        <div className="flex items-center gap-3">
          <Seal size={34} />
          <span className="font-display text-3xl text-sidebar-accent-foreground">Examora</span>
        </div>
        <div className="my-auto max-w-xl py-12">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-5 font-mono text-[11px] uppercase tracking-[0.24em] text-sidebar-primary">
            Secure examinations for universities
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-[clamp(3rem,5.2vw,5.4rem)] leading-[0.95] text-sidebar-accent-foreground"
          >
            The connection drops.
            <br />
            <em className="text-sidebar-primary">The exam doesn't.</em>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-6 max-w-md text-[15px] leading-relaxed text-sidebar-foreground/70">
            Every keystroke lands on the candidate's device first, then reaches the server in order. Time is kept by the server, not the laptop. Grades are published when you say so.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-10">
            <Ledger />
          </motion.div>
        </div>
        <div className="flex gap-8 font-mono text-[10.5px] uppercase tracking-[0.18em] text-sidebar-foreground/45">
          <span>Server-timed</span>
          <span>Local-first answers</span>
          <span>Verifiable reports</span>
        </div>
      </section>

      <section className="relative flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <Seal size={30} />
            <span className="font-display text-3xl">Examora</span>
          </div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h2 className="font-display text-5xl leading-none">Sign in</h2>
            <p className="mt-3 text-sm text-muted-foreground">Use the account your institution issued. Examiners, candidates and administrators share one door.</p>
          </motion.div>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Email</span>
              <Input
                data-testid="input-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                className="h-11 bg-card"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Password</span>
              <div className="relative">
                <Input
                  data-testid="input-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-card pr-11"
                />
                <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)} className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" data-testid="text-login-error" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <motion.button
              whileTap={{ scale: 0.985 }}
              type="submit"
              disabled={!!busy}
              data-testid="button-signin"
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {busy === 'form' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
          </form>

          {demoEnabled && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-10">
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Demo</span>
                <span className="text-xs text-muted-foreground">Sign in as a seeded demo account</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((d, i) => (
                  <motion.button
                    key={d.email}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    whileHover={{ x: 3 }}
                    disabled={!!busy}
                    data-testid={`button-demo-${d.role}`}
                    onClick={() => {
                      setEmail(d.email);
                      setPassword(DEMO_PASSWORD);
                      go(d.email, DEMO_PASSWORD, d.role);
                    }}
                    className="group flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition hover:border-accent/50 disabled:opacity-60"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary font-mono text-[11px] uppercase">{d.role.slice(0, 2)}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium capitalize">{d.role}</span>
                      <span className="block text-xs text-muted-foreground">{d.blurb}</span>
                    </span>
                    {busy === d.role ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-accent" />}
                  </motion.button>
                ))}
              </div>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                Password for all demo accounts: <span className="text-foreground">{DEMO_PASSWORD}</span>
              </p>
            </motion.div>
          )}

          <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Session cookies are httpOnly. Nothing about your attempt is decided by this browser's clock.
          </p>
        </div>
      </section>
    </div>
  );
}
