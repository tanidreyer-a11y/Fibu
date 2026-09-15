import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { RestTimerBanner } from './RestTimerBanner';
import { useRestTimer } from '../store/restTimer';

export function AppShell({ children }: { children: ReactNode }) {
  const timerActive = useRestTimer((s) => s.endsAt !== null);
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col bg-bg">
      <Link
        to="/settings"
        aria-label="Settings"
        className="absolute right-4 z-10 grid h-10 w-10 place-items-center rounded-full text-text-faint transition-colors duration-150 hover:bg-bg-raised-2 hover:text-text active:scale-90"
        style={{ top: 'calc(env(safe-area-inset-top) + 14px)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
      <main
        className="flex-1 px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)', paddingBottom: timerActive ? '88px' : '32px' }}
      >
        {children}
      </main>
      <RestTimerBanner />
      <BottomNav />
    </div>
  );
}
