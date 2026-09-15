import Dexie, { type EntityTable } from 'dexie';
import type { MuscleGroup } from './muscleGroups';

export type Goal = 'muscle_gain' | 'fat_loss' | 'strength' | 'general_fitness';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Units = 'kg' | 'lb';

export interface Profile {
  id: 'me';
  weightKg: number;
  heightCm: number;
  sex?: 'male' | 'female' | 'other';
  goal: Goal;
  experience: Experience;
  daysPerWeek: number;
  onboardedAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  /** primary muscle group first */
  muscleGroups: MuscleGroup[];
  equipment: string;
  isCustom: boolean;
}

export interface SetEntry {
  reps: number;
  weightKg: number;
  rpe?: number;
}

export interface ExerciseEntry {
  exerciseId: string;
  sets: SetEntry[];
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
}

export interface PlanDay {
  label: string;
  muscleFocus: string[];
  suggestedExerciseIds: string[];
}

export interface Plan {
  id: 'active';
  days: PlanDay[];
  source: 'rule_based' | 'ai';
  createdAt: string;
}

export interface FoodEntry {
  id?: number;
  date: string;
  source: 'manual' | 'barcode' | 'photo';
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: 'exact' | 'estimate';
  createdAt: string;
}

export type Theme = 'light' | 'dark';

export interface AppSettings {
  id: 'app';
  geminiApiKey?: string;
  units: Units;
  theme: Theme;
  calorieTarget?: number;
  proteinTargetG?: number;
}

class FibuDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  sessions!: EntityTable<WorkoutSession, 'id'>;
  plan!: EntityTable<Plan, 'id'>;
  foodLog!: EntityTable<FoodEntry, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

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
  }
}

export const db = new FibuDB();
