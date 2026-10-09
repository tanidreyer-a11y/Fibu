import { TONE_FILL, type Tone } from './tones';

interface ProgressBarProps {
  /** 0–1; values over 1 render full. */
  value: number;
  tone?: Tone;
  height?: number;
  label?: string;
  className?: string;
}

/**
 * Chunky pill progress with the little highlight stripe. Fill is revealed with
 * clip-path rather than width, so it animates without layout and keeps round ends.
 */
export function ProgressBar({ value, tone = 'accent', height = 16, label, className = '' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={`relative w-full overflow-hidden rounded-full bg-bg-raised-2 ${className}`}
      style={{ height }}
    >
      <div
        className="absolute inset-0 rounded-full transition-[clip-path] duration-700 ease-[var(--ease-out)]"
        style={{ background: TONE_FILL[tone], clipPath: `inset(0 ${100 - pct}% 0 0 round 999px)` }}
      >
        {height >= 12 && <div className="absolute top-[22%] right-2.5 left-2.5 h-[22%] rounded-full bg-white/35" />}
      </div>
    </div>
  );
}
