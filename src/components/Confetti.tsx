import { useEffect, useRef } from 'react';

const COLORS = ['var(--color-brand)', 'var(--color-streak)', 'var(--color-xp)', 'var(--color-water)', 'var(--color-protein)', 'var(--color-carbs)'];

/**
 * One burst of confetti from the top of the screen, for finished workouts and
 * new bests only (rare moments, so the delight is earned). Pure WAAPI on
 * transform/opacity; nothing runs under reduced motion.
 */
export function Confetti({ pieces = 42 }: { pieces?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const anims: Animation[] = [];
    for (let i = 0; i < pieces; i++) {
      const el = document.createElement('span');
      const w = 6 + Math.random() * 6;
      el.style.cssText = `position:absolute;left:50%;top:-12px;width:${w}px;height:${w * (0.5 + Math.random())}px;border-radius:2px;background:${COLORS[i % COLORS.length]};will-change:transform,opacity`;
      root.appendChild(el);
      const angle = (Math.random() - 0.5) * Math.PI * 0.9;
      const dist = 140 + Math.random() * 220;
      const dx = Math.sin(angle) * dist;
      const rise = 60 + Math.random() * 120;
      const fall = window.innerHeight * (0.55 + Math.random() * 0.35);
      const spin = (Math.random() - 0.5) * 900;
      anims.push(
        el.animate(
          [
            { transform: 'translate(-50%, 0) rotate(0deg)', opacity: 1 },
            { transform: `translate(calc(-50% + ${dx * 0.6}px), ${rise}px) rotate(${spin * 0.4}deg)`, opacity: 1, offset: 0.25 },
            { transform: `translate(calc(-50% + ${dx}px), ${fall}px) rotate(${spin}deg)`, opacity: 0 },
          ],
          { duration: 1600 + Math.random() * 900, delay: Math.random() * 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' },
        ),
      );
    }
    return () => {
      anims.forEach((a) => a.cancel());
      root.replaceChildren();
    };
  }, [pieces]);

  return <div ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-40 h-0 overflow-visible" />;
}
