import { localDate } from './dates';
import { db } from './db';

const TABLES = ['profile', 'settings', 'plan', 'sessions', 'foodLog', 'bodyLog', 'waterLog', 'achievements'] as const;
type TableName = (typeof TABLES)[number];

/** Everything the user created, as one JSON file. Library exercises are rebuilt on import; custom ones are kept. */
export async function exportBackup(): Promise<{ blob: Blob; filename: string }> {
  const tables: Record<string, unknown[]> = {};
  for (const name of TABLES) tables[name] = await db.table(name).toArray();
  // Booleans aren't indexable in IndexedDB, so filter rather than query the isCustom index.
  tables.customExercises = await db.exercises.filter((e) => e.isCustom).toArray();
  const payload = { app: 'fibu', version: 2, exportedAt: new Date().toISOString(), tables };
  return { blob: new Blob([JSON.stringify(payload)], { type: 'application/json' }), filename: `fibu-backup-${localDate()}.json` };
}

export async function importBackup(file: File): Promise<{ ok: true; counts: Record<string, number> } | { ok: false; error: string }> {
  let payload: { app?: string; tables?: Record<string, unknown[]> };
  try {
    payload = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "That file isn't a Fibu backup." };
  }
  if (payload.app !== 'fibu' || !payload.tables) return { ok: false, error: "That file isn't a Fibu backup." };
  const counts: Record<string, number> = {};
  await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.exercises], async () => {
    for (const name of TABLES) {
      const rows = payload.tables![name as TableName];
      if (!Array.isArray(rows)) continue;
      await db.table(name).clear();
      await db.table(name).bulkPut(rows);
      counts[name] = rows.length;
    }
    const custom = payload.tables!.customExercises;
    if (Array.isArray(custom)) await db.exercises.bulkPut(custom as never[]);
  });
  return { ok: true, counts };
}
