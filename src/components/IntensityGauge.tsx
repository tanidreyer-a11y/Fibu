import { useEffect, useState } from 'react';
import type { IntensityResult } from '../lib/training';

export function IntensityGauge({ result }: { result: IntensityResult }) {
  const [mounted, setMounted] = useState(false);
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const r = 80;
  const circumference = Math.PI * r; // semicircle
  const progress = mounted ? result.score / 100 : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-56">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: reduceMotion ? 'none' : 'stroke-dashoffset 900ms var(--ease-out)',
          }}
        />
      </svg>
      <div className="-mt-10 flex flex-col items-center">
        <span className="font-display text-4xl font-semibold tabular-nums text-text">{result.score}</span>
        <span className="text-sm font-medium text-text-muted">{result.label} intensity</span>
      </div>
    </div>
  );
}
