import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Users, Loader2, ShieldAlert } from 'lucide-react';
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  getListUsersQueryKey,
  getGetDashboardQueryKey,
  type UserRole,
  type UserInputRole,
} from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, SkeletonRows, Field } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMe } from '@/lib/session';
import { errMsg, initials, fmtDate } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const ROLES: UserRole[] = ['candidate', 'examiner', 'admin'];

function CreateUser({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateUser();
  const [v, setV] = useState({ name: '', email: '', password: '', role: 'candidate' as UserInputRole });
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    if (v.name.trim().length < 2) return setErr('Name needs at least 2 characters.');
    if (!/^\S+@\S+\.\S+$/.test(v.email)) return setErr('Enter a valid email.');
    if (v.password.length < 10) return setErr('Password must be at least 10 characters.');
    setErr(null);
    create.mutate(
      { data: { ...v, name: v.name.trim(), email: v.email.trim().toLowerCase() } },
      {
        onSuccess: (u) => {
          qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast({ title: 'Account created', description: `${u.name} · ${u.role}` });
          onDone();
        },
        onError: (e) => setErr(errMsg(e)),
      },
    );
  };
  return (
    <div className="space-y-3">
      <Field label="Full name"><Input data-testid="input-user-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label="Email"><Input data-testid="input-user-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Initial password" hint="10+ characters; share it securely."><Input data-testid="input-user-password" type="text" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></Field>
        <Field label="Role">
          <Select value={v.role} onValueChange={(r) => setV({ ...v, role: r as UserInputRole })}>
            <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button disabled={create.isPending} onClick={submit} data-testid="button-create-user">{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create account</Button>
      </div>
    </div>
  );
}

export default function Candidates() {
  const me = useMe();
  const isAdmin = me.role === 'admin';
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useListUsers({ query: { queryKey: getListUsersQueryKey() } });
  const update = useUpdateUser();
  const [role, setRole] = useState<'all' | UserRole>(isAdmin ? 'all' : 'candidate');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const all = q.data ?? [];
  const rows = all.filter((u) => (role === 'all' || u.role === role) && `${u.name} ${u.email}`.toLowerCase().includes(text.toLowerCase()));
  const count = (r: UserRole) => all.filter((u) => u.role === r).length;

  const patch = (id: string, data: { role?: UserRole; active?: boolean }, label: string) =>
    update.mutate(
      { id, data },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: label });
        },
        onError: (e) => toast({ title: 'Change refused', description: errMsg(e), variant: 'destructive' }),
      },
    );

  return (
    <div>
      <PageHeader
        eyebrow={isAdmin ? 'Administration' : 'Directory'}
        title="People"
        description={isAdmin ? 'Create accounts, assign roles and suspend access. Deactivated users cannot sign in or start attempts.' : 'Candidates available for enrollment. Administrators manage roles and access.'}
        actions={isAdmin && <Button onClick={() => setOpen(true)} data-testid="button-new-user"><UserPlus className="mr-1.5 h-4 w-4" />New account</Button>}
      />
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {(['all', ...ROLES] as const).map((r) => (
            <button key={r} onClick={() => setRole(r)} data-testid={`filter-role-${r}`} className={cn('relative rounded-md px-3 py-1.5 text-xs capitalize', role === r ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {role === r && <motion.span layoutId="role-f" className="absolute inset-0 rounded-md bg-primary" />}
              <span className="relative">{r} <span className="opacity-60 tnum">{r === 'all' ? all.length : count(r)}</span></span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 md:max-w-xs md:ml-auto"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Name or email" className="bg-card pl-9" data-testid="input-search-people" /></div>
      </div>
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading ? <SkeletonRows rows={7} /> : rows.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="Nobody here" body="Import candidates from CSV or create accounts individually." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y">
            {rows.map((u, i) => (
              <motion.li key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 15) * 0.015 }} data-testid={`row-user-${u.id}`} className={cn('grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[auto_1.5fr_1fr_160px_120px]', !u.active && 'opacity-60')}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-mono text-[11px]">{initials(u.name)}</span>
                <div className="min-w-0"><div className="truncate text-sm font-medium">{u.name}{u.id === me.id && <span className="ml-2 font-mono text-[10px] text-accent">YOU</span>}</div><div className="truncate text-xs text-muted-foreground">{u.email}</div></div>
                <div className="col-span-2 text-xs text-muted-foreground md:col-span-1">Joined {fmtDate(u.createdAt, 'd MMM yyyy')}</div>
                <div className="col-span-2 md:col-span-1">
                  {isAdmin && u.id !== me.id ? (
                    <Select value={u.role} onValueChange={(r) => patch(u.id, { role: r as UserRole }, `${u.name} is now ${r}`)}>
                      <SelectTrigger className="h-8 capitalize" data-testid={`select-role-${u.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <span className="font-mono text-[11px] uppercase tracking-wider">{u.role}</span>
                  )}
                </div>
                <div className="col-span-2 flex items-center gap-2 md:col-span-1 md:justify-end">
                  {isAdmin && u.id !== me.id ? (
                    <>
                      <span className="text-xs text-muted-foreground">{u.active ? 'Active' : 'Suspended'}</span>
                      <Switch data-testid={`switch-active-${u.id}`} checked={u.active} onCheckedChange={(c) => patch(u.id, { active: c }, c ? `${u.name} reactivated` : `${u.name} suspended`)} />
                    </>
                  ) : !u.active ? (
                    <span className="flex items-center gap-1 text-xs text-destructive"><ShieldAlert className="h-3.5 w-3.5" />Suspended</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Active</span>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-3xl font-normal">New account</DialogTitle><DialogDescription>The person signs in with this email and password.</DialogDescription></DialogHeader>
          {open && <CreateUser onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
