import { motion } from 'framer-motion';
import { Sun, Moon, Type, Columns2, Square, Rows3, Rows4 } from 'lucide-react';
import { PageHeader, Panel } from '@/components/kit';
import { usePrefs } from '@/lib/prefs';
import { useMe } from '@/lib/session';
import type { Prefs } from '@/lib/local';
import { cn } from '@/lib/utils';

function Choice<K extends keyof Prefs>({ k, options }: { k: K; options: { value: Prefs[K]; label: string; icon: typeof Sun }[] }) {
  const { prefs, update } = usePrefs();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = prefs[k] === o.value;
        return (
          <button
            key={String(o.value)}
            data-testid={`pref-${k}-${String(o.value)}`}
            aria-pressed={on}
            onClick={() => update({ [k]: o.value } as Partial<Prefs>)}
            className={cn('relative flex min-w-[120px] items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition', on ? 'border-accent text-foreground' : 'text-muted-foreground hover:border-foreground/30')}
          >
            {on && <motion.span layoutId={`pref-${k}`} className="absolute inset-0 rounded-lg bg-accent/[0.07]" />}
            <o.icon className={cn('relative h-4 w-4', on && 'text-accent')} />
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function Settings() {
  const me = useMe();
  const { prefs } = usePrefs();
  return (
    <div>
      <PageHeader eyebrow="Preferences" title="Settings" description="Stored on this device for your account only (IndexedDB). They follow you across reloads and into the exam room." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Workspace">
          <div className="space-y-5">
            <div><div className="mb-2 text-xs font-medium">Appearance</div><Choice k="appTheme" options={[{ value: 'light', label: 'Paper', icon: Sun }, { value: 'dark', label: 'Ink', icon: Moon }]} /></div>
            <div><div className="mb-2 text-xs font-medium">Density</div><Choice k="density" options={[{ value: 'comfortable', label: 'Comfortable', icon: Rows3 }, { value: 'compact', label: 'Compact', icon: Rows4 }]} /></div>
          </div>
        </Panel>
        <Panel title="Exam room">
          <div className="space-y-5">
            <div><div className="mb-2 text-xs font-medium">Question text size</div><Choice k="examFont" options={[{ value: 'sm', label: 'Small', icon: Type }, { value: 'md', label: 'Medium', icon: Type }, { value: 'lg', label: 'Large', icon: Type }]} /></div>
            <div><div className="mb-2 text-xs font-medium">Exam theme</div><Choice k="examTheme" options={[{ value: 'paper', label: 'Paper', icon: Sun }, { value: 'night', label: 'Night', icon: Moon }]} /></div>
            <div><div className="mb-2 text-xs font-medium">Layout</div><Choice k="examLayout" options={[{ value: 'split', label: 'Navigator + question', icon: Columns2 }, { value: 'focus', label: 'Focus', icon: Square }]} /></div>
            <div className={cn('ruled rounded-lg border bg-card p-4', `exam-font-${prefs.examFont}`)}>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Preview</div>
              <p className="exam-text mt-1">A rigid container holds 2.0 mol of an ideal gas at 300 K. Calculate the change in entropy when it is heated to 450 K.</p>
            </div>
          </div>
        </Panel>
        <Panel title="Account">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd>{me.name}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{me.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Role</dt><dd className="capitalize">{me.role}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">Name, role and password are managed by your administrator.</p>
        </Panel>
      </div>
    </div>
  );
}
