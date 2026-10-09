import { X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { useRestTimer } from '../store/restTimer';

/**
 * A floating card above the tab bar, not a blocking countdown: the rest of the
 * app stays usable while it ticks ("never hide the routine behind the timer").
 */
export function RestTimerBanner() {
  const { endsAt, totalSeconds, adjust, dismiss } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());
  const buzzedFor = useRef<number | null>(null);

  useEffect(() => {
    if (endsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const remainingMs = endsAt == null ? 0 : Math.max(0, endsAt - now);
  const done = endsAt != null && remainingMs === 0;

  useEffect(() => {
    // One buzz when rest ends (Android; iOS Safari ignores vibrate).
    if (done && endsAt != null && buzzedFor.current !== endsAt) {
      buzzedFor.current = endsAt;
      navigator.vibrate?.([180, 90, 180]);
    }
  }, [done, endsAt]);

  if (endsAt == null) return null;

  const remaining = Math.ceil(remainingMs / 1000);
  const progress = 1 - Math.min(1, remaining / totalSeconds);
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');
  const r = 16;
  const c = 2 * Math.PI * r;

  return (
    <div
      className="animate-rise-in fixed inset-x-0 z-20 mx-auto max-w-md px-3"
      style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
      role="timer"
      aria-live="polite"
    >
      <div
        className={`flex h-16 items-center gap-3 rounded-2xl border-2 border-b-4 px-3 ${
          done ? 'border-success bg-protein-tint' : 'border-border bg-bg-raised'
        }`}
      >
        <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-bg-raised-2)" strokeWidth="5" />
          <circle
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke={done ? 'var(--color-success)' : 'var(--color-water)'}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 250ms linear' }}
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="tabular font-display text-[17px] font-black text-text">{done ? 'Rest done. Go!' : `${mm}:${ss}`}</p>
          <p className="truncate text-xs font-bold text-text-faint">{done ? 'Hit your next set.' : 'Resting. Breathe, sip water.'}</p>
        </div>
        {!done && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => adjust(-15)}
              aria-label="15 seconds less"
              className="tabular h-10 rounded-xl bg-bg-raised-2 px-2.5 text-sm font-extrabold text-text-muted active:opacity-70"
            >
              −15
            </button>
            <button
              onClick={() => adjust(15)}
              aria-label="15 seconds more"
              className="tabular h-10 rounded-xl bg-bg-raised-2 px-2.5 text-sm font-extrabold text-text-muted active:opacity-70"
            >
              +15
            </button>
          </div>
        )}
        <button onClick={dismiss} aria-label="Dismiss rest timer" className="grid h-10 w-9 shrink-0 place-items-center rounded-xl text-text-faint">
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
