import Dexie, { type EntityTable } from 'dexie';
import type { Equipment, Injury, Level, Pattern } from './exercises';
import type { MuscleGroup } from './muscleGroups';

export type Goal = 'muscle_gain' | 'fat_loss' | 'strength' | 'general_fitness';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Units = 'kg' | 'lb';
export type Sex = 'male' | 'female' | 'other';
/** What the user can actually train with. Drives which exercises the plan may use. */
export type EquipmentAccess = 'gym' | 'home' | 'bodyweight';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very';

export interface Profile {
  id: 'me';
  name?: string;
  weightKg: number;
  heightCm: number;
  sex?: Sex;
  birthYear?: number;
  goalWeightKg?: number;
  goal: Goal;
  experience: Experience;
  daysPerWeek: number;
  sessionMinutes?: number;
  equipment?: EquipmentAccess;
  hasPullUpBar?: boolean;
  injuries?: Injury[];
  activityLevel?: ActivityLevel;
  onboardedAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  /** primary muscle group first */
  muscleGroups: MuscleGroup[];
  equipment: Equipment | string;
  isCustom: boolean;
  pattern?: Pattern;
  level?: Level;
  mechanic?: 'compound' | 'isolation';
  category?: string;
  /** free-exercise-db image paths (two frames: start and end position) */
  images?: string[];
  instructions?: string[];
  unit?: 'reps' | 'sec';
  avoid?: Injury[];
  source?: 'fibu' | 'fedb' | 'custom';
}

export interface SetEntry {
  /** reps, or seconds for timed moves (exercise.unit === 'sec') */
  reps: number;
  weightKg: number;
  rpe?: number;
}

export interface Prescription {
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
  unit: 'reps' | 'sec';
}

export interface ExerciseEntry {
  exerciseId: string;
  sets: SetEntry[];
  /** what the plan asked for, kept with the log so history shows target vs done */
  target?: Prescription;
}

export interface WorkoutSession {
  id?: number;
  date: string;
  dayLabel: string;
  startedAt: string;
  completedAt?: string;
  exerciseEntries: ExerciseEntry[];
  intensityScore?: number;
  notes?: string;
  source?: 'app' | 'chat' | 'voice';
}

export interface PlanItem extends Prescription {
  pattern: Pattern;
  /** ranked options for this slot: [0] on A weeks, [1] on B weeks; the rest are good swaps */
  exerciseIds: string[];
}

export interface PlanDay {
  label: string;
  muscleFocus: string[];
  /** A-week picks, kept for older code paths */
  suggestedExerciseIds: string[];
  items?: PlanItem[];
}

export interface Plan {
  id: 'active';
  days: PlanDay[];
  source: 'rule_based' | 'ai';
  createdAt: string;
  /** why this plan fits: shown on the plan reveal and in Settings */
  reasons?: string[];
  splitName?: string;
  /** Fibu's personal note about the plan (AI-written when available) */
  coachNote?: string;
  /** weekdays (0 = Sunday) the plan expects you to train, in order of plan days */
  schedule?: number[];
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodEntry {
  id?: number;
  date: string;
  source: 'manual' | 'barcode' | 'photo' | 'search' | 'chat';
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: 'exact' | 'estimate';
  mealType?: MealType;
  servingLabel?: string;
  barcode?: string;
  createdAt: string;
}

export interface BodyEntry {
  id?: number;
  date: string;
  weightKg: number;
  createdAt: string;
}

export interface WaterEntry {
  id?: number;
  date: string;
  ml: number;
  createdAt: string;
}

export interface Achievement {
  id: string;
  unlockedAt: string;
}

export type Theme = 'light' | 'dark';

export interface AppSettings {
  id: 'app';
  /** legacy: keys are server-side now; kept so old rows still type-check */
  geminiApiKey?: string;
  units: Units;
  theme: Theme;
  calorieTarget?: number;
  proteinTargetG?: number;
  carbsTargetG?: number;
  fatTargetG?: number;
  waterTargetMl?: number;
}

export function mealTypeForHour(hour: number): MealType {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'snack';
}

class FibuDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  sessions!: EntityTable<WorkoutSession, 'id'>;
  plan!: EntityTable<Plan, 'id'>;
  foodLog!: EntityTable<FoodEntry, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  bodyLog!: EntityTable<BodyEntry, 'id'>;
  waterLog!: EntityTable<WaterEntry, 'id'>;
  achievements!: EntityTable<Achievement, 'id'>;

  constructor() {
    super('fibu');
    this.version(1).stores({
      profile: 'id',
      exercises: 'id, name, isCustom',
      sessions: '++id, date',
      plan: 'id',
      foodLog: '++id, date',
      settings: 'id',
    });
    // v2 only adds tables and indexes; existing rows are kept as-is. Old food
    // entries get a meal slot from the time they were logged.
    this.version(2)
      .stores({
        exercises: 'id, name, isCustom, pattern, equipment, source',
        foodLog: '++id, date, mealType',
        bodyLog: '++id, date',
        waterLog: '++id, date',
        achievements: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('foodLog')
          .toCollection()
          .modify((entry: FoodEntry) => {
            if (!entry.mealType) entry.mealType = mealTypeForHour(new Date(entry.createdAt).getHours());
          });
        // Seed the weight history with the onboarding weight so the chart has a start point.
        const profile = (await tx.table('profile').get('me')) as Profile | undefined;
        if (profile && (await tx.table('bodyLog').count()) === 0) {
          await tx.table('bodyLog').add({
            date: profile.onboardedAt.slice(0, 10),
            weightKg: profile.weightKg,
            createdAt: profile.onboardedAt,
          } satisfies BodyEntry);
        }
      });
  }
}

export const db = new FibuDB();
