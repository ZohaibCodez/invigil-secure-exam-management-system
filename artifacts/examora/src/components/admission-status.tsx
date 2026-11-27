import { CheckCircle2, Clock, Ban, TimerOff, BadgeCheck } from 'lucide-react';
import type { AdmissionStatus } from '@workspace/api-client-react';
import { ADMISSION_COPY } from '@/lib/delivery';
import { cn } from '@/lib/utils';

const ICON = { pending: Clock, approved: CheckCircle2, denied: Ban, consumed: BadgeCheck, expired: TimerOff } as const;
const TONE: Record<AdmissionStatus, string> = {
  pending: 'border-[hsl(38_70%_50%/.45)] bg-[hsl(38_80%_55%/.1)] text-[hsl(30_70%_34%)] dark:text-[hsl(38_70%_66%)]',
  approved: 'border-[hsl(158_40%_40%/.45)] bg-[hsl(158_40%_40%/.1)] text-[hsl(158_45%_28%)] dark:text-[hsl(158_40%_64%)]',
  denied: 'border-destructive/40 bg-destructive/10 text-destructive',
  consumed: 'border-border bg-muted text-muted-foreground',
  expired: 'border-border bg-muted text-muted-foreground',
};

export function AdmissionBadge({ status, className }: { status: AdmissionStatus; className?: string }) {
  const Icon = ICON[status];
  return (
    <span data-testid={`status-admission-${status}`} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider', TONE[status], className)}>
      <Icon className={cn('h-3 w-3', status === 'pending' && 'motion-safe:animate-pulse')} aria-hidden />
      {ADMISSION_COPY[status].label}
    </span>
  );
}
