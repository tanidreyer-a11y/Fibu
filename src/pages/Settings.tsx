import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { NumberStepper } from '../components/ui/NumberStepper';
import { db, type Experience, type Goal, type Theme, type Units } from '../lib/db';
import { generateText } from '../lib/ai';
import { estimateCalorieTarget, estimateProteinTarget } from '../lib/nutrition';
import { generatePlan, planInputFromProfile } from '../lib/plan';
import { displayWeight, toStorageWeightKg } from '../lib/units';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'muscle_gain', label: 'Build Muscle' },
  { value: 'strength', label: 'Get Stronger' },
  { value: 'fat_loss', label: 'Lose Fat' },
  { value: 'general_fitness', label: 'General Fitness' },
];

const EXPERIENCE: { value: Experience; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export function Settings() {
  const profile = useLiveQuery(() => db.profile.get('me'));
  const settings = useLiveQuery(() => db.settings.get('app'));

  const [units, setUnits] = useState<Units>('kg');
  const [weight, setWeight] = useState(75);
  const [heightCm, setHeightCm] = useState(175);
  const [goal, setGoal] = useState<Goal>('muscle_gain');
  const [experience, setExperience] = useState<Experience>('beginner');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [calorieTarget, setCalorieTarget] = useState(2200);
  const [proteinTarget, setProteinTarget] = useState(150);
  const [saved, setSaved] = useState(false);
  const [aiTest, setAiTest] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [aiTestMessage, setAiTestMessage] = useState('');

  useEffect(() => {
    if (!profile || !settings) return;
    setUnits(settings.units);
    setWeight(displayWeight(profile.weightKg, settings.units));
    setHeightCm(profile.heightCm);
    setGoal(profile.goal);
    setExperience(profile.experience);
    setDaysPerWeek(profile.daysPerWeek);
    setCalorieTarget(settings.calorieTarget ?? estimateCalorieTarget(profile.weightKg, profile.goal));
    setProteinTarget(settings.proteinTargetG ?? estimateProteinTarget(profile.weightKg, profile.goal));
  }, [profile, settings]);

  // Dexie's put() replaces the whole row, so every partial update here must
  // spread the current settings first — writing just {id, theme} would
  // silently drop the saved nutrition targets.
  function baseSettings() {
    return { id: 'app' as const, units: settings?.units ?? units, theme: settings?.theme ?? 'light', ...settings };
  }

  async function setTheme(theme: Theme) {
    await db.settings.put({ ...baseSettings(), theme });
  }

  async function testAi() {
    setAiTest('testing');
    const result = await generateText('Reply with exactly one word: ready.', 0);
    if (result.ok) {
      setAiTest('ok');
    } else {
      setAiTest('error');
      setAiTestMessage(result.error);
    }
  }

  async function save() {
    const now = new Date().toISOString();
    const weightKg = toStorageWeightKg(weight, units);
    // Spread the stored profile: put() replaces the row, and onboarding v2 adds fields this screen doesn't edit.
    await db.profile.put({ ...profile, id: 'me', weightKg, heightCm, goal, experience, daysPerWeek, onboardedAt: profile?.onboardedAt ?? now, updatedAt: now });
    await db.settings.put({ ...baseSettings(), units, calorieTarget, proteinTargetG: proteinTarget });

    const planChanged =
      profile && (profile.daysPerWeek !== daysPerWeek || profile.experience !== experience || profile.goal !== goal);
    if (planChanged) {
      const plan = generatePlan({ ...planInputFromProfile(profile), daysPerWeek, experience, goal });
      await db.plan.put({ id: 'active', days: plan.days, reasons: plan.reasons, splitName: plan.splitName, source: 'rule_based', createdAt: now });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-text">Settings</h1>

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-medium text-text-muted">Appearance</p>
        <div className="flex gap-2">
          {(['light', 'dark'] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors duration-150 ${
                (settings?.theme ?? 'light') === t ? 'border-accent bg-accent-dim text-accent' : 'border-border text-text-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex justify-center gap-2">
          {(['kg', 'lb'] as Units[]).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium uppercase transition-colors duration-150 ${
                units === u ? 'border-accent bg-accent-dim text-accent' : 'border-border text-text-muted'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-5">
          <NumberStepper label="Weight" value={weight} onChange={setWeight} step={units === 'kg' ? 0.5 : 1} min={20} max={400} suffix={units} />
          <NumberStepper label="Height" value={heightCm} onChange={setHeightCm} step={1} min={100} max={230} suffix="cm" />
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-medium text-text-muted">Goal</p>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((g) => (
            <button
              key={g.value}
              onClick={() => setGoal(g.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                goal === g.value ? 'border-accent bg-accent-dim text-accent' : 'border-border text-text-muted'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-text-muted">Nutrition targets</p>
          <button
            onClick={() => {
              const weightKg = toStorageWeightKg(weight, units);
              setCalorieTarget(estimateCalorieTarget(weightKg, goal));
              setProteinTarget(estimateProteinTarget(weightKg, goal));
            }}
            className="text-xs font-medium text-accent"
          >
            Reset to estimate
          </button>
        </div>
        <div className="flex flex-col items-center gap-5">
          <NumberStepper label="Calories" value={calorieTarget} onChange={setCalorieTarget} step={50} min={1000} max={6000} suffix="kcal" />
          <NumberStepper label="Protein" value={proteinTarget} onChange={setProteinTarget} step={5} min={30} max={400} suffix="g" />
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-medium text-text-muted">Experience</p>
        <div className="grid grid-cols-3 gap-2">
          {EXPERIENCE.map((e) => (
            <button
              key={e.value}
              onClick={() => setExperience(e.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                experience === e.value ? 'border-accent bg-accent-dim text-accent' : 'border-border text-text-muted'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        <div className="flex justify-center pt-1">
          <NumberStepper label="Days per week" value={daysPerWeek} onChange={setDaysPerWeek} step={1} min={1} max={7} />
        </div>
      </Card>

      <Button size="lg" onClick={save}>
        {saved ? 'Saved ✓' : 'Save changes'}
      </Button>

      <Card className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-text-muted">Fibu AI</p>
          <p className="mt-1 text-xs text-text-faint">
            Built in — nothing to set up. Powers the coach chat, voice logging and meal photos. Your messages and
            photos go to the AI only when you use those features.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md" disabled={aiTest === 'testing'} onClick={testAi}>
            {aiTest === 'testing' ? 'Checking…' : 'Check connection'}
          </Button>
          {aiTest === 'ok' && <span className="text-xs font-medium text-accent">Connected ✓</span>}
          {aiTest === 'error' && <span className="text-xs font-medium text-danger">{aiTestMessage}</span>}
        </div>
      </Card>
    </div>
  );
}
