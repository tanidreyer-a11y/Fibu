import { useEffect, useState } from 'react';
import type { Exercise } from '../lib/db';
import { exerciseImageUrl } from '../lib/exercises';
import { EQUIPMENT_LABEL } from '../lib/exerciseFilters';
import { MUSCLE_GROUP_LABELS } from '../lib/muscleGroups';
import { ExerciseThumb } from './ExerciseThumb';

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Advanced' } as const;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The open database ships two photos per move (start and end position).
 * Flipping between them reads as a tiny demo of the rep, which explains the
 * movement faster than the text does. Static under reduced motion.
 */
function RepDemo({ images, name }: { images: string[]; name: string }) {
  const [frame, setFrame] = useState(0);
  const animate = images.length > 1 && !prefersReducedMotion();
  useEffect(() => {
    if (!animate) return;
    const t = window.setInterval(() => setFrame((f) => (f + 1) % images.length), 1100);
    return () => window.clearInterval(t);
  }, [animate, images.length]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-2 border-border bg-bg-raised-2">
      {images.map((src, i) => (
        <img
          key={src}
          src={exerciseImageUrl(src)}
          alt={i === 0 ? `${name}, start position` : `${name}, end position`}
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300"
          style={{ opacity: i === frame ? 1 : 0 }}
        />
      ))}
      {images.length > 1 && (
        <div className="absolute right-2 bottom-2 flex gap-1" aria-hidden="true">
          {images.map((src, i) => (
            <span key={src} className={`h-1.5 w-4 rounded-full ${i === frame ? 'bg-brand' : 'bg-black/20'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExerciseDetail({ exercise }: { exercise: Exercise }) {
  const muscles = exercise.muscleGroups.map((g) => MUSCLE_GROUP_LABELS[g] ?? g);
  return (
    <div className="flex flex-col gap-4">
      {exercise.images?.length ? (
        <RepDemo images={exercise.images} name={exercise.name} />
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-bg-raised-2 p-3">
          <ExerciseThumb exercise={exercise} size={56} />
          <p className="text-sm text-text-muted">No photo for this one yet. The steps below cover it.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-lg bg-accent-tint px-2.5 py-1 text-xs font-extrabold text-accent-text">{muscles[0]}</span>
        {muscles.slice(1).map((m) => (
          <span key={m} className="rounded-lg bg-bg-raised-2 px-2.5 py-1 text-xs font-bold text-text-muted">
            {m}
          </span>
        ))}
        <span className="rounded-lg bg-bg-raised-2 px-2.5 py-1 text-xs font-bold text-text-muted">
          {EQUIPMENT_LABEL[exercise.equipment] ?? exercise.equipment}
        </span>
        {exercise.level && (
          <span className="rounded-lg bg-bg-raised-2 px-2.5 py-1 text-xs font-bold text-text-muted">{LEVEL_LABEL[exercise.level]}</span>
        )}
      </div>

      {exercise.instructions?.length ? (
        <ol className="flex flex-col gap-2.5">
          {exercise.instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-snug text-text">
              <span className="tabular mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-bg-raised-2 text-xs font-extrabold text-text-muted">
                {i + 1}
              </span>
              <span className="font-semibold">{step}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-text-muted">You added this one yourself, so there are no steps saved for it.</p>
      )}
    </div>
  );
}
