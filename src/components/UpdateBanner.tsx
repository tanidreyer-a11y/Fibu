import { ArrowsClockwise } from '@phosphor-icons/react';
import { useAppUpdate } from '../lib/pwaUpdate';

/** Shown when a new version of Fibu has downloaded. One tap reloads into it; data is untouched. */
export function UpdateBanner() {
  const { ready, apply } = useAppUpdate();
  if (!ready) return null;
  return (
    <div className="animate-rise-in fixed inset-x-0 z-50 mx-auto max-w-md px-3" style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }} role="status">
      <div className="flex items-center gap-3 rounded-2xl border-2 border-b-4 border-water bg-water-tint px-3 py-2.5">
        <ArrowsClockwise size={22} weight="bold" className="shrink-0 text-water-text" />
        <span className="min-w-0 flex-1 text-sm leading-snug font-extrabold text-text">
          New version of Fibu ready.
          <span className="block text-xs font-bold text-text-muted">Your data stays. Finish any workout first.</span>
        </span>
        <button
          onClick={apply}
          className="press-3d press-3d-sm shrink-0 rounded-xl bg-water px-3 py-2 text-sm font-black text-white [--ledge-color:#0a7fb8]"
        >
          Update
        </button>
      </div>
    </div>
  );
}
