import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export type ScratchConflict = { text: string; version: number };
export function AttemptSafety({ localError, retry, conflict, mine, resolve, closed }: {
  localError: string | null; retry: () => void; conflict: ScratchConflict | null;
  mine: string; resolve: (choice: 'mine' | 'server') => void; closed: boolean;
}) {
  if (!localError && !conflict) return null;
  return <aside className="mx-auto my-4 max-w-5xl space-y-3 px-4" aria-label="Work recovery notices">
    {localError && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />Device storage unavailable</p>
      <p className="my-2">{localError} Server-confirmed answers remain on the server; this warning is about device recovery.</p>
      <Button size="sm" variant="outline" onClick={retry} data-testid="button-retry-device-storage">Retry device storage</Button>
    </div>}
    {conflict && <div role="alert" className="rounded-xl border border-accent/40 bg-card p-4 text-sm">
      <h2 className="font-display text-2xl">Another tab saved different notes</h2>
      <p className="my-2 text-muted-foreground">Your notes have not replaced server version {conflict.version}. Compare both before choosing. Notes are never graded.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">Your unsent notes<Textarea readOnly rows={5} value={mine} data-testid="conflict-local-notes" /></label>
        <label className="space-y-1">Current server notes<Textarea readOnly rows={5} value={conflict.text} data-testid="conflict-server-notes" /></label>
      </div>
      {!closed ? <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => resolve('mine')} data-testid="button-keep-local-notes">Replace server notes with mine</Button>
        <Button variant="outline" onClick={() => resolve('server')} data-testid="button-use-server-notes">Discard mine and use server notes</Button>
      </div> : <p className="mt-3 text-accent">The attempt is closed. Neither copy will be submitted now. Copy any notes you wish to keep.</p>}
    </div>}
  </aside>;
}
