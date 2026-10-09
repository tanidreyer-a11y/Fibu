import { GearSix } from '@phosphor-icons/react';
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
        className="press-3d press-3d-sm absolute right-4 z-10 grid h-10 w-10 place-items-center rounded-xl border-2 border-border bg-bg-raised text-text-muted [--ledge-color:var(--color-border)] [@media(hover:hover)]:hover:text-text"
        style={{ top: 'calc(env(safe-area-inset-top) + 14px)' }}
      >
        <GearSix size={20} weight="bold" />
      </Link>
      <main
        className="flex-1 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', paddingBottom: timerActive ? '104px' : '32px' }}
      >
        {children}
      </main>
      <RestTimerBanner />
      <BottomNav />
    </div>
  );
}
