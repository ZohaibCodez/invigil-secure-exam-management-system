import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { User } from '@workspace/api-client-react';
import { Logo, Seal } from './kit';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

function NavList({ user, onNav, collapsed = false }: { user: User; onNav?: () => void; collapsed?: boolean }) {
  const [loc] = useLocation();
  return (
    <nav className="space-y-6">
      {NAV.map((g) => {
        const items = g.items.filter((i) => i.roles.includes(user.role));
        if (!items.length) return null;
        return (
          <div key={g.group}>
            {collapsed ? <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" /> : <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/40">{g.group}</div>}
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active = i.href === '/' ? loc === '/' : loc.startsWith(i.href);
                const Icon = i.icon;
                return (
                  <li key={i.href}>
                    <Tooltip delayDuration={80}>
                      <TooltipTrigger asChild>
                    <Link
                      href={i.href}
                      onClick={onNav}
                      data-testid={`link-nav-${i.label.toLowerCase().replace(/\s+/g, '-')}`}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200',
                        collapsed && 'justify-center px-0',
                        active ? 'font-medium text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-lg bg-sidebar-accent"
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        />
                      )}
                      {active && <motion.span layoutId="nav-bar" className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-sidebar-primary shadow-[0_0_12px_hsl(var(--sidebar-primary)/0.8)]" />}
                      <Icon className={cn('relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5', active && 'text-sidebar-primary')} strokeWidth={1.75} />
                      {!collapsed && <span className="relative truncate">{i.label}</span>}
                    </Link>
                      </TooltipTrigger>
                      {collapsed && <TooltipContent side="right" sideOffset={14} className="bg-primary text-primary-foreground shadow-lg">{i.label}</TooltipContent>}
                    </Tooltip>
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

function UserCard({ user, collapsed = false }: { user: User; collapsed?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const [busy, setBusy] = useState(false);
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-2.5', collapsed && 'flex-col gap-2 border-transparent bg-transparent p-0')}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sidebar-primary font-mono text-xs text-sidebar-primary-foreground">
        {initials(user.name)}
      </div>
      <div className={cn('min-w-0 flex-1', collapsed && 'hidden')}>
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

const SIDEBAR_KEY = 'examora:sidebar-collapsed';

export function Shell({ user, children }: { user: User; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; } });
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1'); } catch { /* private mode */ } return !c; });
  // Ctrl/Cmd + B toggles the sidebar, like most enterprise consoles.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggle(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(false);
  const [loc] = useLocation();
  const online = useOnline();
  return (
    <div className="min-h-[100dvh] bg-background" style={{ '--sb': collapsed ? '80px' : '256px' } as CSSProperties}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 256 }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        className={cn('grid-paper fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground lg:flex', collapsed ? 'px-3' : 'px-4')}
      >
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (Ctrl+B)`}
          data-testid="button-sidebar-toggle"
          className="absolute -right-3.5 top-9 z-10 grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-foreground shadow-md transition hover:scale-110 hover:text-accent"
        >
          {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
        <Link href="/" className={cn("mb-8 flex items-center gap-2.5 pt-1", collapsed ? "justify-center" : "px-2")} data-testid="link-home">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={collapsed ? 'mark' : 'full'} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.18 }}>
              {collapsed ? <Seal tone="dark" size={44} /> : <Logo tone="dark" height={60} />}
            </motion.span>
          </AnimatePresence>
        </Link>
        <div className="flex-1 overflow-y-auto">
          <NavList user={user} collapsed={collapsed} />
        </div>
        <UserCard user={user} collapsed={collapsed} />
      </motion.aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo tone="dark" height={38} />
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
                <Logo tone="dark" height={40} />
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

      <main className="transition-[padding] duration-300 ease-out lg:pl-[var(--sb)]">
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
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-[1320px] px-4 py-8 md:px-8 md:py-10"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
