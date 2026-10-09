import { db, type Exercise } from './db';
import { EXERCISE_LIBRARY, seedExercises } from './exercises';

/** Bump when src/lib/exercises.ts or public/exercises.json changes, so devices re-import. */
export const LIBRARY_VERSION = 4;
const VERSION_KEY = 'fibu:libraryVersion';

let inflight: Promise<void> | null = null;

const compactName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');

function storedVersion(): number {
  try {
    return Number(localStorage.getItem(VERSION_KEY) ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Loads the full exercise library into IndexedDB: Fibu's curated moves (with
 * photos and steps borrowed from the open database) plus every other entry of
 * free-exercise-db. Custom exercises are never touched. Safe to call often.
 * If the network fails, the curated core is still written so the app works offline.
 */
export function ensureExerciseLibrary(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const count = await db.exercises.where('source').anyOf('fibu', 'fedb').count();
    if (storedVersion() === LIBRARY_VERSION && count >= EXERCISE_LIBRARY.length + 500) return;

    let fedb: Exercise[] = [];
    try {
      const res = await fetch('/exercises.json');
      if (res.ok) fedb = (await res.json()) as Exercise[];
    } catch {
      // offline on first run: fall through with just the curated core
    }

    const byId = new Map(fedb.map((e) => [e.id, e]));
    const claimed = new Set<string>();
    const curated: Exercise[] = EXERCISE_LIBRARY.map((c) => {
      const match = c.fedb ? byId.get(`fedb-${c.fedb}`) : undefined;
      if (match) claimed.add(match.id);
      const { fedb: _link, how, ...rest } = c;
      return {
        ...rest,
        images: match?.images,
        instructions: how ?? match?.instructions,
        isCustom: false,
        source: 'fibu',
      };
    });
    // Same-named database entries would show up twice in search; Fibu's version wins.
    const curatedNames = new Set(curated.map((e) => compactName(e.name)));
    const duplicates = fedb.filter((e) => !claimed.has(e.id) && curatedNames.has(compactName(e.name))).map((e) => e.id);
    const skip = new Set([...claimed, ...duplicates]);
    const others: Exercise[] = fedb.filter((e) => !skip.has(e.id)).map((e) => ({ ...e, isCustom: false, source: 'fedb' as const }));

    await db.transaction('rw', db.exercises, db.sessions, async () => {
      await db.exercises.bulkPut(fedb.length ? [...curated, ...others] : seedExercises());
      if (!skip.size) return;
      // Drop rows an older import added, unless a logged workout still points at one.
      const used = new Set<string>();
      await db.sessions.each((s) => s.exerciseEntries.forEach((e) => used.add(e.exerciseId)));
      await db.exercises.bulkDelete([...skip].filter((id) => !used.has(id)));
    });

    if (fedb.length) {
      try {
        localStorage.setItem(VERSION_KEY, String(LIBRARY_VERSION));
      } catch {
        // without storage we simply re-check next launch
      }
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
