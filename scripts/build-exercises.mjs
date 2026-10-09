// Builds public/exercises.json from free-exercise-db (https://github.com/yuhonas/free-exercise-db,
// public domain / Unlicense). Usage:
//   node scripts/build-exercises.mjs path/to/free-exercise-db/dist/exercises.json
// Maps its muscles/equipment onto Fibu's vocabulary, classifies each move into a plan-engine
// movement pattern, and checks every curated `fedb` link in src/lib/exercises.ts resolves.

import { readFileSync, writeFileSync } from 'node:fs';
import { EXERCISE_LIBRARY } from '../src/lib/exercises.ts';

const src = process.argv[2];
if (!src) {
  console.error('Pass the path to free-exercise-db dist/exercises.json');
  process.exit(1);
}
const raw = JSON.parse(readFileSync(src, 'utf8'));

function mapMuscle(m, name) {
  const n = name.toLowerCase();
  switch (m) {
    case 'quadriceps':
      return 'quads';
    case 'shoulders':
      if (/rear|reverse fly|reverse flye|face pull|pull apart|posterior|bent.over.*raise/.test(n)) return 'rear-delts';
      if (/lateral|side raise|upright/.test(n)) return 'side-delts';
      return 'front-delts';
    case 'abdominals':
      return /oblique|twist|side bend|wood ?chop|side bridge|windmill/.test(n) ? 'obliques' : 'abs';
    case 'chest':
      if (/incline/.test(n)) return 'chest-upper';
      if (/decline|dip/.test(n)) return 'chest-lower';
      return 'chest';
    case 'middle back':
      return 'traps';
    case 'lower back':
      return 'lower-back';
    case 'abductors':
      return 'glutes';
    case 'hamstrings':
    case 'triceps':
    case 'biceps':
    case 'lats':
    case 'calves':
    case 'forearms':
    case 'glutes':
    case 'traps':
    case 'adductors':
    case 'neck':
      return m;
    default:
      return null;
  }
}

function mapEquipment(eq, name) {
  if (/smith/i.test(name)) return 'smith';
  switch (eq) {
    case 'barbell':
    case 'dumbbell':
    case 'machine':
    case 'cable':
      return eq;
    case 'kettlebells':
      return 'kettlebell';
    case 'bands':
      return 'band';
    case 'e-z curl bar':
      return 'ez-bar';
    case 'body only':
    case null:
    case undefined:
      return 'bodyweight';
    default:
      return 'other';
  }
}

function classify(e, muscles) {
  const n = e.name.toLowerCase();
  const primary = muscles[0];
  if (e.category === 'stretching') return 'mobility';
  if (e.category === 'cardio' || e.category === 'plyometrics') return 'conditioning';
  if (/wrist curl|wrist roller/.test(n)) return 'forearms';
  if (/curl/.test(n) && primary === 'hamstrings') return 'ham-curl';
  if (/calf|calves/.test(n)) return 'calves';
  if (/shrug/.test(n)) return 'traps';
  if (/rear delt|reverse fly|reverse flye|face pull|pull apart|rear lateral/.test(n)) return 'rear-delt';
  if (/lateral raise|side lateral|upright row|front.*raise/.test(n)) return 'side-delt';
  if (/\bfly\b|flye|crossover|butterfly|pec deck/.test(n)) return 'chest-iso';
  if (/curl/.test(n)) return 'biceps';
  if (primary === 'triceps' && !/push-?up|pushup/.test(n)) return 'triceps';
  if (/pull-?ups?|chin-?ups?|pulldown|pullover/.test(n)) return 'v-pull';
  if (/\brows?\b/.test(n)) return 'h-pull';
  if (/deadlift|good morning|swing|hyperextension|back extension|pull through|superman/.test(n)) return 'hinge';
  if (/hip thrust|glute|bridge|kickback|abduct|adduct/.test(n)) return 'glute';
  if (/lunge|split squat|step[- ]?ups?/.test(n)) return 'lunge';
  if (/squat|leg press/.test(n)) return 'squat';
  if (/leg extension/.test(n)) return 'quad-iso';
  if (/carry|farmer|walk/.test(n) && e.category === 'strongman') return 'carry';
  if (primary === 'abs' || primary === 'obliques') return 'core';
  if (/press|push-?up|pushup/.test(n)) {
    if (primary?.startsWith('chest')) return 'h-push';
    if (primary === 'front-delts' || primary === 'side-delts') return 'v-push';
  }
  switch (primary) {
    case 'chest':
    case 'chest-upper':
    case 'chest-lower':
      return e.mechanic === 'isolation' ? 'chest-iso' : 'h-push';
    case 'front-delts':
    case 'side-delts':
      return e.mechanic === 'isolation' ? 'side-delt' : 'v-push';
    case 'rear-delts':
      return 'rear-delt';
    case 'lats':
    case 'traps':
      return e.mechanic === 'isolation' ? 'v-pull' : 'h-pull';
    case 'quads':
      return 'squat';
    case 'hamstrings':
    case 'lower-back':
      return 'hinge';
    case 'glutes':
    case 'adductors':
      return 'glute';
    case 'biceps':
      return 'biceps';
    case 'forearms':
      return 'forearms';
    case 'calves':
      return 'calves';
    default:
      return 'mobility';
  }
}

const LEVELS = new Set(['beginner', 'intermediate', 'expert']);
const out = [];
for (const e of raw) {
  const muscles = [];
  for (const m of [...(e.primaryMuscles ?? []), ...(e.secondaryMuscles ?? [])]) {
    const g = mapMuscle(m, e.name);
    if (g && !muscles.includes(g)) muscles.push(g);
  }
  if (muscles.length === 0) continue;
  out.push({
    id: `fedb-${e.id}`,
    name: e.name.replace(/\s+/g, ' ').trim(),
    muscleGroups: muscles,
    equipment: mapEquipment(e.equipment, e.name),
    pattern: classify(e, muscles),
    level: LEVELS.has(e.level) ? e.level : 'intermediate',
    ...(e.mechanic ? { mechanic: e.mechanic } : {}),
    category: e.category,
    images: e.images ?? [],
    instructions: e.instructions ?? [],
  });
}

const ids = new Set(raw.map((e) => e.id));
const missing = EXERCISE_LIBRARY.filter((c) => c.fedb && !ids.has(c.fedb)).map((c) => `${c.id} -> ${c.fedb}`);
if (missing.length) {
  console.error('Curated links that do not exist in free-exercise-db:\n  ' + missing.join('\n  '));
  process.exit(1);
}

writeFileSync(new URL('../public/exercises.json', import.meta.url), JSON.stringify(out));
const byPattern = {};
for (const e of out) byPattern[e.pattern] = (byPattern[e.pattern] ?? 0) + 1;
console.log(`Wrote ${out.length} exercises. Curated links OK (${EXERCISE_LIBRARY.filter((c) => c.fedb).length}).`);
console.log(JSON.stringify(byPattern));
