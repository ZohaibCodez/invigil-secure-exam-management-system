import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultPrefs, loadPrefs, savePrefs, type Prefs } from './local';

const Ctx = createContext<{ prefs: Prefs; update: (p: Partial<Prefs>) => void; ready: boolean }>({
  prefs: defaultPrefs,
  update: () => {},
  ready: false,
});

export function PrefsProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    setReady(false);
    loadPrefs(userId ?? 'anon')
      .then((p) => alive && setPrefs(p))
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [userId]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.appTheme === 'dark');
  }, [prefs.appTheme]);
  useEffect(() => {
    document.documentElement.style.fontSize = prefs.density === 'compact' ? '15px' : '';
  }, [prefs.density]);
  const update = (p: Partial<Prefs>) =>
    setPrefs((old) => {
      const next = { ...old, ...p };
      savePrefs(userId ?? 'anon', next).catch(() => {});
      return next;
    });
  return <Ctx.Provider value={{ prefs, update, ready }}>{children}</Ctx.Provider>;
}
export const usePrefs = () => useContext(Ctx);
