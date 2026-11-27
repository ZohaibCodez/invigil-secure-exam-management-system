import { useEffect } from 'react';
import { useLocation } from 'wouter';

const publicDescription = 'Run examinations with server-controlled timing, clear answer-saving status, thoughtful grading, and verifiable reports. Explore Examora and its research.';

const routeTitles: Record<string, string> = {
  '/login': 'Sign in',
  '/exams': 'Examinations',
  '/questions': 'Question bank',
  '/candidates': 'People and access',
  '/monitor': 'Examination monitoring',
  '/results': 'Results and grading',
  '/analytics': 'Performance analytics',
  '/imports': 'Bulk imports',
  '/settings': 'Workspace preferences',
};

function setMeta(key: string, content: string, property = false) {
  const attribute = property ? 'property' : 'name';
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

export function RouteMetadata() {
  const [path] = useLocation();
  useEffect(() => {
    const marketing = path === '/' || path === '/welcome';
    const research = path === '/research';
    const label = routeTitles[path] ?? (path.startsWith('/verify/') ? 'Verify a report' : path.startsWith('/attempts/') ? 'Examination attempt' : path.startsWith('/exams/') ? 'Examination details' : 'Page not found');
    const title = marketing
      ? 'Examora — Resilient Examinations, Clearer Outcomes'
      : research ? 'Research & Innovation — Examora' : `${label} — Examora`;
    const description = marketing ? publicDescription
      : research ? 'Explore the evidence behind Examora: connectivity failures, proctoring bias, randomized-exam fairness, implemented safeguards, and honest limitations.'
      : `Access ${label.toLowerCase()} in your authorized Examora examination workspace.`;
    document.title = title;
    setMeta('description', description);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('robots', marketing || research ? 'index, follow' : 'noindex, nofollow');
  }, [path]);
  return null;
}
