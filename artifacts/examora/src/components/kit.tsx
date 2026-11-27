import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errMsg } from '@/lib/format';
import { Typewriter, Reveal } from './motion';

const BRAND = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/brand`;

/** Examora icon (graduation cap and checked paper). `tone="dark"` for dark surfaces. */
export function Seal({ className, size = 36, tone = 'light' }: { className?: string; size?: number; tone?: 'light' | 'dark' }) {
  return <img src={`${BRAND}/logo-mark${tone === 'dark' ? '-dark' : ''}.png`} width={size} height={size} alt="" aria-hidden className={cn('shrink-0 select-none object-contain', className)} draggable={false} />;
}

/** Full Examora wordmark with tagline. Height drives size; width follows the 3.4:1 artwork. */
export function Logo({ className, height = 40, tone = 'light' }: { className?: string; height?: number; tone?: 'light' | 'dark' }) {
  return <img src={`${BRAND}/logo-full${tone === 'dark' ? '-dark' : ''}.png`} height={height} style={{ height, width: 'auto' }} alt="Examora" className={cn('select-none object-contain', className)} draggable={false} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8 flex flex-col gap-4 border-b border-border/80 pb-6 md:flex-row md:items-end md:justify-between"
    >
      <div className="min-w-0">
        {/* `eyebrow` is accepted for compatibility but intentionally not rendered. */}
        <h1 className="font-display text-3xl leading-tight md:text-[2.125rem]">{typeof title === 'string' ? <Typewriter text={title} /> : title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}

const statusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  published: 'bg-[hsl(222_60%_94%)] text-[hsl(222_50%_30%)] border-[hsl(222_40%_84%)] dark:bg-[hsl(222_30%_20%)] dark:text-[hsl(222_60%_82%)] dark:border-[hsl(222_30%_30%)]',
  ongoing: 'bg-accent/10 text-accent border-accent/30',
  active: 'bg-accent/10 text-accent border-accent/30',
  completed: 'bg-[hsl(158_30%_92%)] text-[hsl(158_40%_26%)] border-[hsl(158_25%_80%)] dark:bg-[hsl(158_25%_16%)] dark:text-[hsl(158_40%_70%)] dark:border-[hsl(158_25%_26%)]',
  submitted: 'bg-[hsl(38_80%_92%)] text-[hsl(30_70%_30%)] border-[hsl(38_60%_80%)] dark:bg-[hsl(38_40%_16%)] dark:text-[hsl(38_70%_70%)] dark:border-[hsl(38_40%_26%)]',
  graded: 'bg-[hsl(158_30%_92%)] text-[hsl(158_40%_26%)] border-[hsl(158_25%_80%)] dark:bg-[hsl(158_25%_16%)] dark:text-[hsl(158_40%_70%)] dark:border-[hsl(158_25%_26%)]',
};
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const live = status === 'ongoing' || status === 'active';
  return (
    <span
      data-testid={`status-${status}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider',
        statusStyles[status] ?? 'bg-muted text-muted-foreground border-border',
        className,
      )}
    >
      <span className={cn('relative h-1.5 w-1.5 rounded-full bg-current', live && 'pulse-dot')} />
      {status.replace('-', ' ')}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent,
  index = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card p-4',
        accent && 'border-accent/40 bg-accent/[0.04]',
      )}
    >
      <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-4xl leading-none tnum" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </motion.div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClass,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <Reveal as="section" className={cn('rounded-xl border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]', className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-medium">{title}</h2>
          {action}
        </div>
      )}
      <div className={cn('p-4', bodyClass)}>{children}</div>
    </Reveal>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center"
    >
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full border bg-background text-accent">{icon}</div>
      <div className="font-display text-2xl">{title}</div>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="flex-1">
        <div className="text-sm font-medium">Couldn't load this</div>
        <div className="text-sm text-muted-foreground">{errMsg(error)}</div>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} data-testid="button-retry">
          <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function Meter({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <motion.div
        className="h-full origin-left rounded-full bg-accent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground/80">{label}</span>
      {children}
      {error ? <span className="block text-xs text-destructive">{error}</span> : hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
