import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <h1 className="mt-2 font-display text-4xl">No such page</h1>
      <p className="mt-2 text-sm text-muted-foreground">The address may be mistyped, or the page has moved.</p>
      <Button asChild className="mt-6"><Link href="/" data-testid="link-home-404">Back to overview</Link></Button>
    </div>
  );
}
