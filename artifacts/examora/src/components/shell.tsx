import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  LayoutDashboard,
  FileText,
  Library,
  Users,
  Radio,
  Award,
  BarChart3,
  Upload,
  Settings,
  LogOut,
  Menu,
  X,
  WifiOff,
} from 'lucide-react';
import type { User } from '@workspace/api-client-react';
import { Logo } from './kit';
import { signOut } from '@/lib/auth';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useOnline } from '@/hooks/use-online';

type Item = { href: string; label: string; icon: typeof FileText; roles: User['role'][] };
const NAV: { group: string; items: Item[] }[] = [
  {
    group: 'Workspace',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard, roles: ['admin', 'examiner', 'candidate'] },
      { href: '/exams', label: 'Exams', icon: FileText, roles: ['admin', 'examiner'] },
      { href: '/questions', label: 'Question bank', icon: Library, roles: ['admin', 'examiner'] },
      { href: '/candidates', label: 'People', icon: Users, roles: ['admin', 'examiner'] },
    ],
  },
  {
    group: 'Conduct',
    items: [
      { href: '/monitor', label: 'Live monitor', icon: Radio, roles: ['admin', 'examiner'] },
      { href: '/results', label: 'Results', icon: Award, roles: ['admin', 'examiner', 'candidate'] },
      { href: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['admin', 'examiner'] },
      { href: '/imports', label: 'Imports', icon: Upload, roles: ['admin', 'examiner'] },
    ],
  },
  { group: 'You', items: [{ href: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'examiner', 'candidate'] }] },
];

function NavList({ user, onNav }: { user: User; onNav?: () => void }) {
  const [loc] = useLocation();
  return (
    <nav className="space-y-6">
      {NAV.map((g) => {
        const items = g.items.filter((i) => i.roles.includes(user.role));
        if (!items.length) return null;
        return (
          <div key={g.group}>
            <div className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/40">{g.group}</div>
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active = i.href === '/' ? loc === '/' : loc.startsWith(i.href);
                const Icon = i.icon;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={onNav}
                      data-testid={`link-nav-${i.label.toLowerCase().replace(/\s+/g, '-')}`}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:text-sidebar-foreground',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-lg bg-sidebar-accent"
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        />
                      )}
                      {active && <motion.span layoutId="nav-bar" className="absolute left-0 top-2 bottom-2 w-[2px] rounded bg-sidebar-primary" />}
                      <Icon className="relative h-4 w-4 transition-transform group-hover:scale-110" strokeWidth={1.75} />
                      <span className="relative">{i.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function UserCard({ user }: { user: User }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sidebar-primary font-mono text-xs text-sidebar-primary-foreground">
        {initials(user.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-sidebar-accent-foreground" data-testid="text-username">{user.name}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-sidebar-foreground/50">{user.role}</div>
      </div>
      <button
        data-testid="button-signout"
        aria-label="Sign out"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await signOut(qc);
            nav('/');
          } catch (error) {
            toast({ title: 'Sign-out failed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
          } finally { setBusy(false); }
        }}
        className="rounded-md p-2 text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-primary disabled:opacity-40"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Shell({ user, children }: { user: User; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loc] = useLocation();
  const online = useOnline();
  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className="grid-paper fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2 pt-1" data-testid="link-home">
          <Logo tone="dark" height={46} />
        </Link>
        <div className="flex-1 overflow-y-auto">
          <NavList user={user} />
        </div>
        <UserCard user={user} />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo tone="dark" height={32} />
        </Link>
        <button aria-label="Open menu" data-testid="button-menu" onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-sidebar-accent">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="grid-paper fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar p-4 text-sidebar-foreground lg:hidden"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="font-display text-2xl text-sidebar-accent-foreground">Examora</span>
                <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-md p-2 hover:bg-sidebar-accent">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NavList user={user} onNav={() => setOpen(false)} />
              </div>
              <UserCard user={user} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="lg:pl-64">
        <AnimatePresence>
          {!online && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-accent/30 bg-accent/10 text-accent"
            >
              <div className="flex items-center gap-2 px-6 py-2 text-xs">
                <WifiOff className="h-3.5 w-3.5" /> You're offline. Showing the last data we received; changes can't be sent until you reconnect.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          key={loc.split('/')[1] || 'home'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="mx-auto max-w-[1320px] px-4 py-8 md:px-8 md:py-10"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
