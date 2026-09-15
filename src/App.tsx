import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { db } from './lib/db';
import { Body } from './pages/Body';
import { Chat } from './pages/Chat';
import { Food } from './pages/Food';
import { Home } from './pages/Home';
import { Onboarding } from './pages/Onboarding';
import { Settings } from './pages/Settings';
import { WorkoutLog } from './pages/WorkoutLog';
import { WorkoutSummary } from './pages/WorkoutSummary';

/** Light is the default theme (bare :root tokens) — this only ever needs to flip the attribute on for dark, an explicit user choice, never OS-driven. */
function useThemeSync() {
  const settings = useLiveQuery(() => db.settings.get('app'));
  useEffect(() => {
    const theme = settings?.theme ?? 'light';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c0c0e' : '#faf9f7');
  }, [settings?.theme]);
}

function Gate({ children }: { children: ReactNode }) {
  // `undefined` is ambiguous in dexie-react-hooks (both "still loading" and
  // "resolved, no row found"), so give loading its own distinct sentinel.
  const profile = useLiveQuery(() => db.profile.get('me'), [], null);
  if (profile === null) return null; // still loading from IndexedDB
  if (!profile) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function App() {
  useThemeSync();
  return (
    <HashRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route
          path="/*"
          element={
            <Gate>
              <AppShell>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/train" element={<WorkoutLog />} />
                  <Route path="/summary/:id" element={<WorkoutSummary />} />
                  <Route path="/food" element={<Food />} />
                  <Route path="/body" element={<Body />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            </Gate>
          }
        />
      </Routes>
    </HashRouter>
  );
}

export default App
