export type Tone = 'accent' | 'streak' | 'xp' | 'water' | 'protein' | 'carbs' | 'fat' | 'success';

export const TONE_FILL: Record<Tone, string> = {
  accent: 'var(--color-brand)',
  streak: 'var(--color-streak)',
  xp: 'var(--color-xp)',
  water: 'var(--color-water)',
  protein: 'var(--color-protein)',
  carbs: 'var(--color-carbs)',
  fat: 'var(--color-fat)',
  success: 'var(--color-success)',
};
