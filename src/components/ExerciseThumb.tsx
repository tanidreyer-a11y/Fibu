import { Barbell, Heartbeat, PersonSimpleRun, PersonSimpleTaiChi } from '@phosphor-icons/react';
import { useState } from 'react';
import type { Exercise } from '../lib/db';
import { exerciseImageUrl } from '../lib/exercises';

/** Square photo of the start position, or a tidy icon tile when the move has no photo. */
export function ExerciseThumb({ exercise, size = 48 }: { exercise: Pick<Exercise, 'images' | 'pattern' | 'name'>; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = exercise.images?.[0];
  const Icon =
    exercise.pattern === 'conditioning' ? Heartbeat : exercise.pattern === 'mobility' ? PersonSimpleTaiChi : exercise.pattern === 'core' ? PersonSimpleRun : Barbell;

  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-border bg-bg-raised-2 text-text-faint"
      style={{ width: size, height: size }}
    >
      {src && !failed ? (
        <img
          src={exerciseImageUrl(src)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Icon size={Math.round(size * 0.5)} weight="duotone" />
      )}
    </div>
  );
}
