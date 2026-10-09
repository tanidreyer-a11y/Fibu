import {
  ArrowLeft,
  Armchair,
  Barbell,
  Bicycle,
  Check,
  CircleNotch,
  Fire,
  HouseLine,
  Heartbeat,
  Lightning,
  PersonSimpleRun,
  PersonSimpleWalk,
  Plant,
  Trophy,
  type Icon,
} from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MascotSays, type MascotPose } from '../components/Mascot';
import { PlanReveal } from '../components/PlanReveal';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { NumberStepper } from '../components/ui/NumberStepper';
import { ProgressBar } from '../components/ui/ProgressBar';
import { writePlanNote } from '../lib/coach';
import { localDate } from '../lib/dates';
import {
  db,
  type ActivityLevel,
  type EquipmentAccess,
  type Experience,
  type Goal,
  type Plan,
  type Profile,
  type Sex,
  type Theme,
  type Units,
} from '../lib/db';
import { CURATED_BY_ID, type Injury } from '../lib/exercises';
import { ensureExerciseLibrary } from '../lib/library';
import { ageFromBirthYear, computeTargets, goalTimeline } from '../lib/nutrition';
import { defaultSchedule, generatePlan } from '../lib/plan';
import { displayWeight, toStorageWeightKg } from '../lib/units';

type StepKey =
  | 'welcome'
  | 'name'
  | 'goal'
  | 'sex'
  | 'age'
  | 'height'
  | 'weight'
  | 'goalWeight'
  | 'experience'
  | 'days'
  | 'length'
  | 'equipment'
  | 'injuries'
  | 'activity'
  | 'building'
  | 'reveal';

const QUESTION_STEPS: StepKey[] = ['name', 'goal', 'sex', 'age', 'height', 'weight', 'goalWeight', 'experience', 'days', 'length', 'equipment', 'injuries', 'activity'];
const ALL_STEPS: StepKey[] = ['welcome', ...QUESTION_STEPS, 'building', 'reveal'];

interface Answers {
  name: string;
  goal: Goal | null;
  sex: Sex | null;
  age: number;
  heightCm: number;
  weight: number; // in display units
  goalWeight: number | null; // in display units
  experience: Experience | null;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: EquipmentAccess | null;
  hasPullUpBar: boolean;
  injuries: Injury[];
  activity: ActivityLevel | null;
}

const GOALS: { value: Goal; label: string; blurb: string; icon: Icon }[] = [
  { value: 'muscle_gain', label: 'Build muscle', blurb: 'Look and feel bigger', icon: Barbell },
  { value: 'fat_loss', label: 'Lose fat', blurb: 'Get leaner, keep your strength', icon: Fire },
  { value: 'strength', label: 'Get stronger', blurb: 'Lift heavier on the big lifts', icon: Trophy },
  { value: 'general_fitness', label: 'Get fit and healthy', blurb: 'Feel good and stay consistent', icon: Heartbeat },
];

const EXPERIENCE: { value: Experience; label: string; blurb: string }[] = [
  { value: 'beginner', label: 'New to this', blurb: 'Less than a year of regular training' },
  { value: 'intermediate', label: 'Getting there', blurb: '1 to 3 years, progress has slowed' },
  { value: 'advanced', label: 'Seasoned', blurb: '3+ years and dialled in' },
];

const EQUIPMENT: { value: EquipmentAccess; label: string; blurb: string; icon: Icon }[] = [
  { value: 'gym', label: 'At a gym', blurb: 'Barbells, dumbbells, machines', icon: Barbell },
  { value: 'home', label: 'At home with weights', blurb: 'Dumbbells, kettlebell or bands', icon: HouseLine },
  { value: 'bodyweight', label: 'No equipment', blurb: 'Just me and the floor', icon: PersonSimpleRun },
];

const ACTIVITY: { value: ActivityLevel; label: string; blurb: string; icon: Icon }[] = [
  { value: 'sedentary', label: 'Mostly sitting', blurb: 'Desk job, little walking', icon: Armchair },
  { value: 'light', label: 'Lightly active', blurb: 'Some walking most days', icon: PersonSimpleWalk },
  { value: 'moderate', label: 'On my feet', blurb: 'Active job or lots of steps', icon: Bicycle },
  { value: 'very', label: 'Very active', blurb: 'Physical work all day', icon: Lightning },
];

const INJURIES: { value: Injury; label: string }[] = [
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'knee', label: 'Knee' },
  { value: 'lower-back', label: 'Lower back' },
  { value: 'wrist', label: 'Wrist' },
  { value: 'elbow', label: 'Elbow' },
];

function OptionCard({ selected, onClick, icon: IconC, label, blurb }: { selected: boolean; onClick: () => void; icon?: Icon; label: string; blurb?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`press-3d flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left ${
        selected ? 'border-accent bg-accent-tint [--ledge-color:var(--color-accent)]' : 'border-border bg-bg-raised [--ledge-color:var(--color-border)]'
      }`}
    >
      {IconC && (
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${selected ? 'bg-accent text-accent-ink' : 'bg-bg-raised-2 text-text-muted'}`}>
          <IconC size={24} weight="fill" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block text-[16px] font-extrabold ${selected ? 'text-accent-text' : 'text-text'}`}>{label}</span>
        {blurb && <span className="block text-[13px] font-bold text-text-faint">{blurb}</span>}
      </span>
    </button>
  );
}

function feetInches(cm: number) {
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}′${totalIn % 12}″`;
}

const EQUIPMENT_LABEL: Record<EquipmentAccess, string> = { gym: 'gym', home: 'home weights', bodyweight: 'no equipment' };

export function Onboarding() {
  const navigate = useNavigate();
  const existing = useLiveQuery(() => db.profile.get('me'), [], null);
  const existingSettings = useLiveQuery(() => db.settings.get('app'), [], null);
  const finishing = !!existing; // existing users "finish their profile" instead of starting over

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd');
  const [units, setUnits] = useState<Units>('kg');
  const [theme, setTheme] = useState<Theme>('light');
  const [a, setA] = useState<Answers>({
    name: '',
    goal: null,
    sex: null,
    age: 28,
    heightCm: 175,
    weight: 75,
    goalWeight: null,
    experience: null,
    daysPerWeek: 3,
    sessionMinutes: 45,
    equipment: null,
    hasPullUpBar: false,
    injuries: [],
    activity: null,
  });
  const prefilled = useRef(false);
  const [plan, setPlan] = useState<Omit<Plan, 'id' | 'createdAt' | 'source'> | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [buildSteps, setBuildSteps] = useState<boolean[]>([false, false, false, false]);
  const [saving, setSaving] = useState(false);

  // Prefill from an existing profile once it loads.
  useEffect(() => {
    if (prefilled.current || existing === null || existingSettings === null) return;
    prefilled.current = true;
    if (!existing) return;
    const u = existingSettings?.units ?? 'kg';
    setUnits(u);
    setTheme(existingSettings?.theme ?? 'light');
    setA((prev) => ({
      ...prev,
      name: existing.name ?? '',
      goal: existing.goal,
      sex: existing.sex ?? null,
      age: ageFromBirthYear(existing.birthYear) ?? prev.age,
      heightCm: existing.heightCm,
      weight: displayWeight(existing.weightKg, u),
      goalWeight: existing.goalWeightKg ? displayWeight(existing.goalWeightKg, u) : null,
      experience: existing.experience,
      daysPerWeek: existing.daysPerWeek,
      sessionMinutes: existing.sessionMinutes ?? prev.sessionMinutes,
      equipment: existing.equipment ?? null,
      hasPullUpBar: existing.hasPullUpBar ?? false,
      injuries: existing.injuries ?? [],
      activity: existing.activityLevel ?? null,
    }));
  }, [existing, existingSettings]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const step = ALL_STEPS[stepIndex];
  const questionNumber = QUESTION_STEPS.indexOf(step);
  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => setA((prev) => ({ ...prev, [key]: value }));

  const weightKg = toStorageWeightKg(a.weight, units);
  const goalWeightKg = a.goalWeight != null ? toStorageWeightKg(a.goalWeight, units) : undefined;
  const firstName = a.name.trim().split(/\s+/)[0];

  const profileDraft = useMemo<Omit<Profile, 'onboardedAt' | 'updatedAt'> | null>(() => {
    if (!a.goal || !a.experience || !a.equipment) return null;
    return {
      id: 'me',
      name: a.name.trim() || undefined,
      weightKg,
      heightCm: a.heightCm,
      sex: a.sex ?? 'other',
      birthYear: new Date().getFullYear() - a.age,
      goalWeightKg,
      goal: a.goal,
      experience: a.experience,
      daysPerWeek: a.daysPerWeek,
      sessionMinutes: a.sessionMinutes,
      equipment: a.equipment,
      hasPullUpBar: a.equipment === 'gym' ? true : a.hasPullUpBar,
      injuries: a.injuries,
      activityLevel: a.activity ?? 'light',
    };
  }, [a, weightKg, goalWeightKg]);

  const targets = useMemo(() => (profileDraft ? computeTargets(profileDraft) : null), [profileDraft]);
  const timeline = useMemo(
    () => (profileDraft ? goalTimeline(profileDraft.weightKg, profileDraft.goalWeightKg, profileDraft.goal, profileDraft.experience === 'beginner') : null),
    [profileDraft],
  );

  function go(delta: 1 | -1) {
    setDirection(delta === 1 ? 'fwd' : 'back');
    setStepIndex((i) => Math.min(ALL_STEPS.length - 1, Math.max(0, i + delta)));
  }

  // Build the plan for real when the "building" screen shows; the checklist ticks as each part is done.
  useEffect(() => {
    if (step !== 'building' || !profileDraft || !targets) return;
    let cancelled = false;
    (async () => {
      const generated = generatePlan({ ...profileDraft });
      const base = { days: generated.days, reasons: generated.reasons, splitName: generated.splitName, schedule: defaultSchedule(profileDraft.daysPerWeek) };
      if (cancelled) return;
      setBuildSteps([true, false, false, false]);
      await ensureExerciseLibrary().catch(() => undefined);
      if (cancelled) return;
      setBuildSteps([true, true, false, false]);
      setBuildSteps([true, true, true, false]);
      setNoteLoading(true);
      setPlan(base);
      const first = generated.days[0];
      const note = await writePlanNote({
        name: firstName,
        goal: profileDraft.goal,
        experience: profileDraft.experience,
        daysPerWeek: profileDraft.daysPerWeek,
        sessionMinutes: profileDraft.sessionMinutes ?? 45,
        equipment: EQUIPMENT_LABEL[profileDraft.equipment ?? 'gym'],
        injuries: profileDraft.injuries ?? [],
        splitName: generated.splitName,
        sampleDay: first?.items?.map((i) => `${CURATED_BY_ID.get(i.exerciseIds[0])?.name} ${i.sets}x${i.repsMin}-${i.repsMax}`).join(', ') ?? '',
        calories: targets.calories,
        proteinG: targets.proteinG,
      });
      if (cancelled) return;
      setNoteLoading(false);
      setBuildSteps([true, true, true, true]);
      setPlan({ ...base, ...(note ? { coachNote: note } : {}) });
      setDirection('fwd');
      setStepIndex(ALL_STEPS.indexOf('reveal'));
    })();
    return () => {
      cancelled = true;
    };
    // Run once per visit to the building screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function start() {
    if (!profileDraft || !targets || !plan) return;
    setSaving(true);
    const now = new Date().toISOString();
    await db.transaction('rw', db.profile, db.settings, db.plan, db.bodyLog, async () => {
      await db.profile.put({ ...existing, ...profileDraft, onboardedAt: existing?.onboardedAt ?? now, updatedAt: now });
      const settings = await db.settings.get('app');
      await db.settings.put({
        ...settings,
        id: 'app',
        units,
        theme,
        calorieTarget: targets.calories,
        proteinTargetG: targets.proteinG,
        carbsTargetG: targets.carbsG,
        fatTargetG: targets.fatG,
        waterTargetMl: targets.waterMl,
      });
      await db.plan.put({ id: 'active', source: plan.coachNote ? 'ai' : 'rule_based', createdAt: now, ...plan });
      const today = localDate();
      const todays = await db.bodyLog.where('date').equals(today).first();
      if (!todays || Math.abs(todays.weightKg - profileDraft.weightKg) > 0.05) {
        await db.bodyLog.add({ date: today, weightKg: profileDraft.weightKg, createdAt: now });
      }
    });
    navigate('/', { replace: true });
  }

  const canContinue: Record<StepKey, boolean> = {
    welcome: true,
    name: true,
    goal: !!a.goal,
    sex: !!a.sex,
    age: a.age >= 13 && a.age <= 100,
    height: true,
    weight: true,
    goalWeight: true,
    experience: !!a.experience,
    days: true,
    length: true,
    equipment: !!a.equipment,
    injuries: true,
    activity: !!a.activity,
    building: false,
    reveal: true,
  };

  const recommendedDays = a.experience === 'beginner' ? '3' : a.experience === 'advanced' ? '4 to 6' : '3 to 5';

  const questions: Record<string, { say: ReactNode; pose?: MascotPose; body: ReactNode; optional?: boolean }> = {
    name: {
      say: finishing ? "Let's finish your profile so your plan really fits. First, what should I call you?" : 'Nice to meet you! What should I call you?',
      optional: true,
      body: (
        <input
          autoFocus
          value={a.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Your first name"
          autoComplete="given-name"
          maxLength={40}
          className="h-14 w-full rounded-2xl border-2 border-border-strong bg-bg-raised px-4 text-lg font-extrabold text-text outline-none placeholder:text-text-faint focus:border-accent"
        />
      ),
    },
    goal: {
      say: `${firstName ? `Great, ${firstName}! ` : ''}What's your main goal right now?`,
      body: (
        <div className="flex flex-col gap-3">
          {GOALS.map((g) => (
            <OptionCard key={g.value} selected={a.goal === g.value} onClick={() => set('goal', g.value)} icon={g.icon} label={g.label} blurb={g.blurb} />
          ))}
        </div>
      ),
    },
    sex: {
      say: 'For your calorie target: which fits you best?',
      body: (
        <div className="flex flex-col gap-3">
          <OptionCard selected={a.sex === 'male'} onClick={() => set('sex', 'male')} label="Male" />
          <OptionCard selected={a.sex === 'female'} onClick={() => set('sex', 'female')} label="Female" />
          <OptionCard selected={a.sex === 'other'} onClick={() => set('sex', 'other')} label="Prefer not to say" blurb="I'll use an average" />
        </div>
      ),
    },
    age: {
      say: 'How old are you?',
      body: <NumberStepper label="Age" value={a.age} onChange={(v) => set('age', Math.round(v))} step={1} min={13} max={100} suffix="yrs" />,
    },
    height: {
      say: 'How tall are you?',
      body: (
        <div className="flex flex-col items-center gap-2">
          <NumberStepper label="Height" value={a.heightCm} onChange={(v) => set('heightCm', Math.round(v))} step={1} min={120} max={230} suffix="cm" />
          <span className="text-sm font-bold text-text-faint">{feetInches(a.heightCm)}</span>
        </div>
      ),
    },
    weight: {
      say: "And what do you weigh today? It's just a starting point, we'll track it from here.",
      body: (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {(['kg', 'lb'] as Units[]).map((u) => (
              <Chip
                key={u}
                active={units === u}
                onClick={() => {
                  if (u === units) return;
                  set('weight', displayWeight(toStorageWeightKg(a.weight, units), u));
                  if (a.goalWeight != null) set('goalWeight', displayWeight(toStorageWeightKg(a.goalWeight, units), u));
                  setUnits(u);
                }}
              >
                {u.toUpperCase()}
              </Chip>
            ))}
          </div>
          <NumberStepper label="Weight" value={a.weight} onChange={(v) => set('weight', v)} step={units === 'kg' ? 0.5 : 1} min={30} max={units === 'kg' ? 300 : 660} suffix={units} />
        </div>
      ),
    },
    goalWeight: {
      say: a.goal === 'fat_loss' ? 'What weight would you like to reach?' : a.goal === 'muscle_gain' ? 'Got a target weight in mind?' : 'Any target weight? Totally fine to skip.',
      optional: true,
      body: (
        <div className="flex flex-col items-center gap-3">
          <NumberStepper
            label="Goal weight"
            value={a.goalWeight ?? a.weight}
            onChange={(v) => set('goalWeight', v)}
            step={units === 'kg' ? 0.5 : 1}
            min={30}
            max={units === 'kg' ? 300 : 660}
            suffix={units}
          />
          {a.goalWeight != null && (
            <span className="text-sm font-bold text-text-faint">
              {a.goalWeight < a.weight ? `${(a.weight - a.goalWeight).toFixed(1)} ${units} to lose` : a.goalWeight > a.weight ? `${(a.goalWeight - a.weight).toFixed(1)} ${units} to gain` : 'Stay where you are'}
            </span>
          )}
        </div>
      ),
    },
    experience: {
      say: 'How much training have you done?',
      body: (
        <div className="flex flex-col gap-3">
          {EXPERIENCE.map((e) => (
            <OptionCard key={e.value} selected={a.experience === e.value} onClick={() => set('experience', e.value)} label={e.label} blurb={e.blurb} />
          ))}
        </div>
      ),
    },
    days: {
      say: 'How many days a week can you train?',
      body: (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button
                key={d}
                onClick={() => set('daysPerWeek', d)}
                aria-pressed={a.daysPerWeek === d}
                className={`press-3d press-3d-sm grid h-14 place-items-center rounded-xl border-2 text-xl font-black ${
                  a.daysPerWeek === d
                    ? 'border-accent bg-accent text-accent-ink [--ledge-color:var(--color-accent-ledge)]'
                    : 'border-border bg-bg-raised text-text-muted [--ledge-color:var(--color-border)]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="text-center text-sm font-bold text-text-muted">For you, {recommendedDays} days is the sweet spot. Pick what you can keep up.</p>
        </div>
      ),
    },
    length: {
      say: 'How long can a workout be?',
      body: (
        <div className="grid grid-cols-3 gap-2">
          {[30, 45, 60, 75, 90].map((m) => (
            <button
              key={m}
              onClick={() => set('sessionMinutes', m)}
              aria-pressed={a.sessionMinutes === m}
              className={`press-3d flex h-16 flex-col items-center justify-center rounded-2xl border-2 ${
                a.sessionMinutes === m
                  ? 'border-accent bg-accent-tint text-accent-text [--ledge-color:var(--color-accent)]'
                  : 'border-border bg-bg-raised text-text [--ledge-color:var(--color-border)]'
              }`}
            >
              <span className="tabular text-xl font-black">{m}</span>
              <span className="text-xs font-extrabold opacity-70">min</span>
            </button>
          ))}
        </div>
      ),
    },
    equipment: {
      say: 'Where will you train?',
      body: (
        <div className="flex flex-col gap-3">
          {EQUIPMENT.map((e) => (
            <OptionCard key={e.value} selected={a.equipment === e.value} onClick={() => set('equipment', e.value)} icon={e.icon} label={e.label} blurb={e.blurb} />
          ))}
          {a.equipment && a.equipment !== 'gym' && (
            <label className="flex items-center justify-between gap-3 rounded-2xl border-2 border-border bg-bg-raised p-3.5">
              <span className="text-[15px] font-extrabold text-text">I have a pull-up bar</span>
              <input
                type="checkbox"
                checked={a.hasPullUpBar}
                onChange={(e) => set('hasPullUpBar', e.target.checked)}
                className="h-6 w-6 accent-[var(--color-accent)]"
              />
            </label>
          )}
        </div>
      ),
    },
    injuries: {
      say: 'Anything that hurts or I should go easy on?',
      body: (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {INJURIES.map((i) => (
              <Chip
                key={i.value}
                active={a.injuries.includes(i.value)}
                onClick={() => set('injuries', a.injuries.includes(i.value) ? a.injuries.filter((x) => x !== i.value) : [...a.injuries, i.value])}
              >
                {i.label}
              </Chip>
            ))}
            <Chip active={a.injuries.length === 0} onClick={() => set('injuries', [])}>
              <Plant size={16} weight="fill" /> Nothing, all good
            </Chip>
          </div>
          <p className="text-sm font-bold text-text-faint">I'll leave out moves that load these. For real pain, check with a physio first.</p>
        </div>
      ),
    },
    activity: {
      say: 'Last one! Outside the gym, how active is your day?',
      body: (
        <div className="flex flex-col gap-3">
          {ACTIVITY.map((x) => (
            <OptionCard key={x.value} selected={a.activity === x.value} onClick={() => set('activity', x.value)} icon={x.icon} label={x.label} blurb={x.blurb} />
          ))}
        </div>
      ),
    },
  };

  const shell = (children: ReactNode, footer?: ReactNode) => (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg px-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
    >
      {children}
      {footer && <div className="sticky bottom-0 -mx-4 mt-auto bg-bg px-4 pt-3 pb-1">{footer}</div>}
    </div>
  );

  if (step === 'welcome') {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <img src="/mascot/fibu-wave.webp" alt="" className="animate-rise-in h-56 w-auto select-none" draggable={false} />
        <div className="animate-rise-in flex flex-col gap-2" style={{ animationDelay: '80ms' }}>
          <h1 className="font-display text-[30px] leading-tight font-black text-text">{finishing ? 'Welcome back!' : "Hi, I'm Fibu!"}</h1>
          <p className="mx-auto max-w-xs text-[16px] font-bold text-text-muted">
            {finishing
              ? 'A few new questions so I can build you a proper plan. Your workouts and meals stay exactly as they are.'
              : "Your training buddy. Answer a few quick questions and I'll build the plan that fits you."}
          </p>
        </div>
        <div className="animate-rise-in flex gap-2" style={{ animationDelay: '140ms' }}>
          {(['light', 'dark'] as Theme[]).map((t) => (
            <Chip key={t} active={theme === t} onClick={() => setTheme(t)}>
              {t === 'light' ? 'Light' : 'Dark'}
            </Chip>
          ))}
        </div>
      </div>,
      <Button size="lg" className="w-full" onClick={() => go(1)}>
        {finishing ? "Let's go" : 'Get started'}
      </Button>,
    );
  }

  if (step === 'building') {
    const labels = [
      `Picking your split for ${a.daysPerWeek} days`,
      `Choosing exercises for ${a.equipment ? EQUIPMENT_LABEL[a.equipment] : 'you'}`,
      'Setting your calories and protein',
      'Writing your coach note',
    ];
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <img src="/mascot/fibu-stand.webp" alt="" className="animate-idle-bob h-48 w-auto select-none" draggable={false} />
        <h1 className="font-display text-2xl font-black text-text">Building your plan…</h1>
        <ul className="flex w-full max-w-xs flex-col gap-3" aria-live="polite">
          {labels.map((label, i) => (
            <li key={label} className="flex items-center gap-3 text-[15px] font-extrabold">
              {buildSteps[i] ? (
                <span className="animate-pop-in grid h-7 w-7 place-items-center rounded-full bg-success text-accent-ink">
                  <Check size={16} weight="bold" />
                </span>
              ) : (
                <CircleNotch size={28} weight="bold" className="animate-spin text-text-faint" />
              )}
              <span className={buildSteps[i] ? 'text-text' : 'text-text-faint'}>{label}</span>
            </li>
          ))}
        </ul>
      </div>,
    );
  }

  if (step === 'reveal' && plan && targets && profileDraft) {
    return shell(
      <div className="flex flex-col gap-5 pb-4">
        <MascotSays pose="wave" size={120}>
          {firstName ? `${firstName}, b` : 'B'}ased on your answers, this is the best plan for you!
        </MascotSays>
        <PlanReveal
          plan={plan}
          targets={targets}
          timeline={timeline}
          goalWeightKg={profileDraft.goalWeightKg}
          units={units}
          sessionMinutes={profileDraft.sessionMinutes ?? 45}
          equipmentLabel={EQUIPMENT_LABEL[profileDraft.equipment ?? 'gym']}
          noteLoading={noteLoading}
        />
        <button onClick={() => { setDirection('back'); setStepIndex(1); }} className="py-2 text-sm font-extrabold text-text-faint">
          Change my answers
        </button>
      </div>,
      <Button size="lg" className="w-full" disabled={saving} onClick={start}>
        {saving ? 'Saving…' : 'Start my plan'}
      </Button>,
    );
  }

  const q = questions[step];
  if (!q) return null;
  const isLast = step === 'activity';

  return shell(
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={() => go(-1)}
          aria-label="Back"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-text-faint [@media(hover:hover)]:hover:text-text"
        >
          <ArrowLeft size={22} weight="bold" />
        </button>
        <ProgressBar value={(questionNumber + 1) / QUESTION_STEPS.length} tone="accent" label="Onboarding progress" className="flex-1" />
      </div>
      <div key={step} className={`${direction === 'fwd' ? 'animate-step-in' : 'animate-step-back'} flex flex-1 flex-col gap-6 pt-6`}>
        <MascotSays pose={q.pose ?? 'stand'} size={96} bob={false}>
          {q.say}
        </MascotSays>
        <div>{q.body}</div>
      </div>
    </>,
    <div className="flex flex-col gap-2">
      <Button size="lg" className="w-full" disabled={!canContinue[step]} onClick={() => go(1)}>
        {isLast ? 'Build my plan' : 'Continue'}
      </Button>
      {q.optional && (
        <button
          onClick={() => {
            if (step === 'goalWeight') set('goalWeight', null);
            if (step === 'name') set('name', '');
            go(1);
          }}
          className="py-2 text-sm font-extrabold text-text-faint"
        >
          Skip
        </button>
      )}
    </div>,
  );
}
