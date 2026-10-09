import type { ReactNode } from 'react';

export type MascotPose = 'wave' | 'stand' | 'head';

const POSES: Record<MascotPose, { src: string; ratio: number }> = {
  wave: { src: '/mascot/fibu-wave.webp', ratio: 436 / 640 },
  stand: { src: '/mascot/fibu-stand.webp', ratio: 509 / 640 },
  head: { src: '/mascot/fibu-head.webp', ratio: 256 / 200 },
};

interface MascotProps {
  pose?: MascotPose;
  /** Rendered height in px. */
  size?: number;
  /** Gentle idle breathing. Use where the robot is waiting on you, not in lists. */
  bob?: boolean;
  className?: string;
}

export function Mascot({ pose = 'stand', size = 120, bob = false, className = '' }: MascotProps) {
  const { src, ratio } = POSES[pose];
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={Math.round(size * ratio)}
      height={size}
      className={`pointer-events-none shrink-0 select-none ${bob ? 'animate-idle-bob' : ''} ${className}`}
      style={{ width: Math.round(size * ratio), height: size }}
    />
  );
}

/** Round head avatar for chat and small spots. */
export function MascotAvatar({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-border bg-bg-raised-2 ${className}`}
      style={{ width: size, height: size }}
    >
      <img src="/mascot/fibu-head.webp" alt="" draggable={false} className="mt-[18%] w-[112%] max-w-none select-none" />
    </div>
  );
}

/** Speech bubble whose tail points left, toward the robot beside it. */
export function SpeechBubble({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`animate-bubble-in relative rounded-2xl border-2 border-border bg-bg-raised px-4 py-3 text-[15px] leading-snug font-bold text-text ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-5 -left-[9px] h-4 w-4 rotate-45 border-b-2 border-l-2 border-border bg-bg-raised"
      />
      <span className="relative">{children}</span>
    </div>
  );
}

/** Robot + bubble side by side, Duolingo-lesson style. */
export function MascotSays({
  children,
  pose = 'wave',
  size = 120,
  bob = true,
  className = '',
}: {
  children: ReactNode;
  pose?: MascotPose;
  size?: number;
  bob?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <Mascot pose={pose} size={size} bob={bob} />
      <SpeechBubble className="mb-4 flex-1">{children}</SpeechBubble>
    </div>
  );
}
