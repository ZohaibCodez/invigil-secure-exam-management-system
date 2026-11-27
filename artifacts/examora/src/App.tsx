import { lazy, Suspense, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Link, Redirect, Router as WouterRouter } from 'wouter';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useGetSession, getGetSessionQueryKey, type User } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Shell } from '@/components/shell';
import { Seal, ErrorState } from '@/components/kit';
import { SessionCtx } from '@/lib/session';
import { PrefsProvider } from '@/lib/prefs';
import NotFound from '@/pages/not-found';
import Login from '@/pages/login';
import Verify from '@/pages/verify';
import Dashboard from '@/pages/dashboard';
import Exams from '@/pages/exams';
import ExamDetail from '@/pages/exam-detail';
import Questions from '@/pages/questions';
import Candidates from '@/pages/candidates';
import Monitor from '@/pages/monitor';
import Results from '@/pages/results';
import Analytics from '@/pages/analytics';
import Imports from '@/pages/imports';
import Settings from '@/pages/settings';
import AttemptPage from '@/pages/attempt';
import { RouteMetadata } from '@/components/route-metadata';

const Landing = lazy(() => import('@/pages/landing'));
const Research = lazy(() => import('@/pages/research'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5000, refetchOnWindowFocus: true, retry: 1 } },
});

function Splash() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3">
        <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ repeat: Infinity, duration: 2.4 }}><Seal size={44} /></motion.div>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Checking your session</span>
      </motion.div>
    </div>
  );
}

function Staff({ user, children }: { user: User; children: ReactNode }) {
  if (user.role === 'candidate')
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border bg-card p-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-4 font-display text-3xl">Examiner area</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page is for examiners and administrators.</p>
        <Button asChild className="mt-6"><Link href="/">Back to overview</Link></Button>
      </div>
    );
  return <>{children}</>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function SignedIn({ user }: { user: User }) {
  const [loc] = useLocation();
  if (loc.startsWith('/attempts/'))
    return (
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/attempts/:id" component={AttemptPage} />
        </Switch>
      </RoutedErrorBoundary>
    );
  if (loc.startsWith('/verify/'))
    return (
      <Switch>
        <Route path="/verify/:token" component={Verify} />
      </Switch>
    );
  return (
    <Shell user={user}>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/exams">{() => <Staff user={user}><Exams /></Staff>}</Route>
          <Route path="/exams/:id">{() => <Staff user={user}><ExamDetail /></Staff>}</Route>
          <Route path="/questions">{() => <Staff user={user}><Questions /></Staff>}</Route>
          <Route path="/candidates">{() => <Staff user={user}><Candidates /></Staff>}</Route>
          <Route path="/monitor">{() => <Staff user={user}><Monitor /></Staff>}</Route>
          <Route path="/results" component={Results} />
          <Route path="/analytics">{() => <Staff user={user}><Analytics /></Staff>}</Route>
          <Route path="/imports">{() => <Staff user={user}><Imports /></Staff>}</Route>
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function Gate() {
  const [loc] = useLocation();
  const publicRoute = loc === '/welcome' || loc === '/research';
  const s = useGetSession({ query: { queryKey: getGetSessionQueryKey(), enabled: !publicRoute, refetchInterval: 60000, staleTime: 30000 } });
  // Marketing content remains available even if the examination API is offline.
  if (publicRoute || (loc === '/' && !s.data?.user)) {
    return (
      <PrefsProvider userId={null}>
        {loc === '/research' ? <Research /> : <Landing />}
      </PrefsProvider>
    );
  }
  if (loc.startsWith('/verify/') && !s.data?.user)
    return (
      <Switch>
        <Route path="/verify/:token" component={Verify} />
      </Switch>
    );
  if (s.isLoading) return <Splash />;
  if (s.isError || !s.data)
    return (
      <div className="grid min-h-[100dvh] place-items-center p-6">
        <div className="w-full max-w-md"><ErrorState error={s.error} onRetry={() => s.refetch()} /></div>
      </div>
    );
  const user = s.data.user;
  if (user?.active && loc === '/login') return <Redirect to="/" replace />;
  return (
    <PrefsProvider userId={user?.id ?? null}>
      {user && user.active ? (
        <SessionCtx.Provider value={user}>
          <SignedIn user={user} />
        </SessionCtx.Provider>
      ) : (
        <Login demoEnabled={s.data.demoEnabled} />
      )}
    </PrefsProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RouteMetadata />
          <Suspense fallback={<Splash />}>
            <Gate />
          </Suspense>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
