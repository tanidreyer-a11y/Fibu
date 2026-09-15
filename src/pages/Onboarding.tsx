import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoLockup } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { NumberStepper } from '../components/ui/NumberStepper';
import { db, type Experience, type Goal, type Theme, type Units } from '../lib/db';
import { seedExercises } from '../lib/exercises';
import { estimateCalorieTarget, estimateProteinTarget } from '../lib/nutrition';
import { generateRuleBasedPlan } from '../lib/training';
import { lbToKg } from '../lib/units';

const GOALS: { value: Goal; label: string; blurb: string }[] = [
  { value: 'muscle_gain', label: 'Build Muscle', blurb: 'Hypertrophy-focused training' },
  { value: 'strength', label: 'Get Stronger', blurb: 'Prioritize load on the big lifts' },
  { value: 'fat_loss', label: 'Lose Fat', blurb: 'Keep muscle while trimming down' },
  { value: 'general_fitness', label: 'General Fitness', blurb: 'Stay consistent and capable' },
];

const EXPERIENCE: { value: Experience; label: string; blurb: string }[] = [
  { value: 'beginner', label: 'Beginner', blurb: 'Under a year of consistent training' },
  { value: 'intermediate', label: 'Intermediate', blurb: '1-3 years, progress has slowed' },
  { value: 'advanced', label: 'Advanced', blurb: '3+ years, dialed in on the details' },
];

const TOTAL_STEPS = 4;

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState<Units>('kg');
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const [weight, setWeight] = useState(75);
  const [heightCm, setHeightCm] = useState(175);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [saving, setSaving] = useState(false);

  const canAdvance = [true, goal !== null, experience !== null, true][step];

  async function finish() {
    if (!goal || !experience) return;
    setSaving(true);
    const weightKg = units === 'kg' ? weight : lbToKg(weight);
    const now = new Date().toISOString();

    const existing = await db.exercises.count();
    if (existing === 0) {
      await db.exercises.bulkAdd(seedExercises());
    }

    await db.profile.put({
      id: 'me',
      weightKg,
      heightCm,
      goal,
      experience,
      daysPerWeek,
      onboardedAt: now,
      updatedAt: now,
    });

    // Spread any existing settings row first — onboarding can run against a
    // settings row that was pre-seeded (or re-run after a reset), and a bare
    // put() here would silently erase a saved Gemini key. Same class of bug
    // as the one fixed in Settings.tsx.
    const existingSettings = await db.settings.get('app');
    await db.settings.put({
      ...existingSettings,
      id: 'app',
      units,
      theme,
      calorieTarget: estimateCalorieTarget(weightKg, goal),
      proteinTargetG: estimateProteinTarget(weightKg, goal),
    });

    const days = generateRuleBasedPlan(daysPerWeek, experience);
    await db.plan.put({ id: 'active', days, source: 'rule_based', createdAt: now });

    navigate('/', { replace: true });
  }

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 32px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
    >
      <LogoLockup tagline={step === 0} />

      <div className="mb-8 mt-8 flex gap-1.5">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-border'}`} />
        ))}
      </div>

      <div key={step} className="animate-step-in flex-1">
        {step === 0 && (
          <div>
            <h1 className="font-display text-3xl font-semibold text-text">Let's set up Fibu</h1>
            <p className="mt-2 text-text-muted">A few questions so your plan actually fits you. Takes under a minute.</p>

            <div className="mt-8 flex justify-center gap-2">
              {(['kg', 'lb'] as Units[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnits(u)}
                  className={`rounded-full border px-5 py-2 text-sm font-medium uppercase transition-colors duration-150 ${
                    units === u ? 'border-accent bg-accent-dim text-accent' : 'border-border text-text-muted'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>

            <div className="mt-3 flex justify-center gap-2">
              {(['light', 'dark'] as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`rounded-full border px-5 py-2 text-sm font-medium capitalize transition-colors duration-150 ${
                    theme === t ? 'border-accent bg-accent-dim text-accent' : 'border-border text-text-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-5">
              <NumberStepper label="Weight" value={weight} onChange={setWeight} step={units === 'kg' ? 0.5 : 1} min={20} max={400} suffix={units} />
              <NumberStepper label="Height" value={heightCm} onChange={setHeightCm} step={1} min={100} max={230} suffix="cm" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="font-display text-3xl font-semibold text-text">What's the goal?</h1>
            <p className="mt-2 text-text-muted">This shapes how your plan is built. You can change it later.</p>
            <div className="mt-8 flex flex-col gap-3">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGoal(g.value)}
                  className={`rounded-xl border p-4 text-left transition-colors duration-150 ${
                    goal === g.value ? 'border-accent bg-accent-dim' : 'border-border bg-bg-raised-2'
                  }`}
                >
                  <div className={`font-display font-semibold ${goal === g.value ? 'text-accent' : 'text-text'}`}>{g.label}</div>
                  <div className="text-sm text-text-muted">{g.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-display text-3xl font-semibold text-text">Training experience</h1>
            <p className="mt-2 text-text-muted">And how many days a week can you realistically train?</p>
            <div className="mt-8 flex flex-col gap-3">
              {EXPERIENCE.map((e) => (
                <button
                  key={e.value}
                  onClick={() => setExperience(e.value)}
                  className={`rounded-xl border p-4 text-left transition-colors duration-150 ${
                    experience === e.value ? 'border-accent bg-accent-dim' : 'border-border bg-bg-raised-2'
                  }`}
                >
                  <div className={`font-display font-semibold ${experience === e.value ? 'text-accent' : 'text-text'}`}>{e.label}</div>
                  <div className="text-sm text-text-muted">{e.blurb}</div>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <NumberStepper label="Days per week" value={daysPerWeek} onChange={setDaysPerWeek} step={1} min={1} max={7} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-display text-3xl font-semibold text-text">Ready when you are</h1>
            <p className="mt-2 text-text-muted">
              Fibu will build a starting split around {daysPerWeek} day{daysPerWeek === 1 ? '' : 's'} a week — but nothing here
              is locked in. Swap exercises, skip a day, log freeform whenever you want.
            </p>
            <div className="mt-8 rounded-xl border border-border-soft bg-bg-raised-2 p-4 text-sm text-text-muted">
              <div className="flex justify-between py-1">
                <span>Weight</span>
                <span className="text-text">
                  {weight} {units}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Height</span>
                <span className="text-text">{heightCm} cm</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Goal</span>
                <span className="text-text">{GOALS.find((g) => g.value === goal)?.label}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Experience</span>
                <span className="text-text">{EXPERIENCE.find((e) => e.value === experience)?.label}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <Button variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <Button size="lg" className="flex-1" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : (
          <Button size="lg" className="flex-1" disabled={saving} onClick={finish}>
            {saving ? 'Building your plan…' : 'Build my plan'}
          </Button>
        )}
      </div>
    </div>
  );
}
