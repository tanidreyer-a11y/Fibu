// Maps our exercise-tagging vocabulary (~20 groups) onto the concrete
// left/right region ids the `body-muscles` package's SVG data uses
// (read directly from node_modules/body-muscles/dist/esm/data/muscles.{front,back}.js).

export const MUSCLE_GROUPS = [
  'chest',
  'chest-upper',
  'chest-lower',
  'front-delts',
  'side-delts',
  'rear-delts',
  'traps',
  'lats',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'lower-back',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
  'hip-flexors',
  'neck',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  'chest-upper': 'Upper Chest',
  'chest-lower': 'Lower Chest',
  'front-delts': 'Front Delts',
  'side-delts': 'Side Delts',
  'rear-delts': 'Rear Delts',
  traps: 'Traps',
  lats: 'Lats',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  'lower-back': 'Lower Back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
  'hip-flexors': 'Hip Flexors',
  neck: 'Neck',
};

/** group -> every body-muscles diagram region id (both sides) it lights up */
export const MUSCLE_GROUP_TO_DIAGRAM_IDS: Record<MuscleGroup, string[]> = {
  chest: ['chest-upper-left', 'chest-upper-right', 'chest-lower-left', 'chest-lower-right'],
  'chest-upper': ['chest-upper-left', 'chest-upper-right'],
  'chest-lower': ['chest-lower-left', 'chest-lower-right'],
  'front-delts': ['shoulder-front-left', 'shoulder-front-right'],
  'side-delts': ['shoulder-side-left', 'shoulder-side-right'],
  'rear-delts': ['deltoid-rear-left', 'deltoid-rear-right'],
  traps: [
    'traps-upper-left',
    'traps-upper-right',
    'traps-mid-left',
    'traps-mid-right',
    'traps-lower-left',
    'traps-lower-right',
  ],
  lats: [
    'lats-upper-left',
    'lats-upper-right',
    'lats-mid-left',
    'lats-mid-right',
    'lats-lower-left',
    'lats-lower-right',
  ],
  biceps: ['biceps-left', 'biceps-right'],
  triceps: ['triceps-long-left', 'triceps-long-right', 'triceps-lateral-left', 'triceps-lateral-right'],
  forearms: [
    'forearm-left',
    'forearm-right',
    'forearm-flexors-left',
    'forearm-flexors-right',
    'forearm-extensors-left',
    'forearm-extensors-right',
  ],
  abs: ['abs-upper-left', 'abs-upper-right', 'abs-lower-left', 'abs-lower-right'],
  obliques: ['obliques-left', 'obliques-right', 'serratus-anterior-left', 'serratus-anterior-right'],
  'lower-back': ['spine', 'lower-back-erectors-left', 'lower-back-erectors-right', 'lower-back-ql-left', 'lower-back-ql-right'],
  glutes: ['gluteus-maximus-left', 'gluteus-maximus-right', 'gluteus-medius-left', 'gluteus-medius-right'],
  quads: ['quads-left', 'quads-right'],
  hamstrings: [
    'hamstrings-medial-left',
    'hamstrings-medial-right',
    'hamstrings-lateral-left',
    'hamstrings-lateral-right',
  ],
  adductors: ['adductors-left', 'adductors-right'],
  calves: [
    'calves-gastroc-medial-left',
    'calves-gastroc-medial-right',
    'calves-gastroc-lateral-left',
    'calves-gastroc-lateral-right',
    'calves-soleus-left',
    'calves-soleus-right',
  ],
  'hip-flexors': ['hip-flexor-left', 'hip-flexor-right'],
  neck: ['neck-left', 'neck-right', 'nape'],
};

/**
 * Builds a body-muscles bodyState object from a map of muscle group -> volume
 * (arbitrary units, e.g. sets performed). Volumes are scaled relative to the
 * single hardest-worked group in the set, onto the library's 0-10 intensity scale.
 */
export function buildBodyState(
  groupVolumes: Partial<Record<MuscleGroup, number>>,
): Record<string, { intensity: number; selected: boolean }> {
  const max = Math.max(1, ...Object.values(groupVolumes).filter((v): v is number => typeof v === 'number'));
  const state: Record<string, { intensity: number; selected: boolean }> = {};
  for (const [group, volume] of Object.entries(groupVolumes) as [MuscleGroup, number | undefined][]) {
    if (!volume) continue;
    const intensity = Math.max(1, Math.round((volume / max) * 10));
    for (const id of MUSCLE_GROUP_TO_DIAGRAM_IDS[group]) {
      state[id] = { intensity, selected: false };
    }
  }
  return state;
}
