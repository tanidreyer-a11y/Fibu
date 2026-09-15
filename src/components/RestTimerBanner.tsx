import { useEffect, useState } from 'react';
import { useRestTimer } from '../store/restTimer';

/**
 * A persistent bottom banner, not a blocking full-screen countdown — the rest
 * of the app (including switching tabs to check the plan) stays fully usable
 * while it ticks, per the "never hide the routine behind the timer" pattern.
 */
export function RestTimerBanner() {
  const { endsAt, totalSeconds, adjust, dismiss } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  if (endsAt == null) return null;

  const remainingMs = Math.max(0, endsAt - now);
  const remaining = Math.ceil(remainingMs / 1000);
  const done = remainingMs === 0;
  const progress = 1 - Math.min(1, remaining / totalSeconds);

  return (
    <div
      className="fixed inset-x-0 z-20 mx-auto flex max-w-md items-center gap-3 border-t border-border-soft bg-bg-raised px-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))', height: '56px' }}
    >
      <div className="relative h-9 w-9 shrink-0">
        <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-border)" strokeWidth="4" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 15}
            strokeDashoffset={2 * Math.PI * 15 * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 250ms linear' }}
          />
        </svg>
      </div>
      <div className="flex-1">
        <p className="font-display text-sm font-semibold tabular-nums text-text">{done ? 'Rest complete' : `${remaining}s rest`}</p>
        <p className="text-xs text-text-faint">{done ? 'Next set whenever you are.' : 'Keep reviewing the plan below.'}</p>
      </div>
      {!done && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => adjust(-15)}
            aria-label="15 seconds less"
            className="h-9 w-9 rounded-full text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-bg-raised-2 active:scale-90"
          >
            −15
          </button>
          <button
            onClick={() => adjust(15)}
            aria-label="15 seconds more"
            className="h-9 w-9 rounded-full text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-bg-raised-2 active:scale-90"
          >
            +15
          </button>
        </div>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss rest timer"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-faint transition-colors duration-150 hover:bg-bg-raised-2 active:scale-90"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
