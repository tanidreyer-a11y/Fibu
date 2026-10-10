import { ArrowsClockwise, CheckCircle, DownloadSimple, Robot, UploadSimple, UserCircle } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { NumberStepper } from '../components/ui/NumberStepper';
import { generateText } from '../lib/ai';
import { exportBackup, importBackup } from '../lib/backup';
import { db, type AppSettings, type Theme, type Units } from '../lib/db';
import { BUILD_TAG } from '../lib/diag';
import { computeTargets, estimateCalorieTarget, estimateProteinTarget } from '../lib/nutrition';
import { defaultSchedule, focusLabel, generatePlan, planInputFromProfile } from '../lib/plan';
import { describeDays, planSchedule, saveSchedule, WEEK_ORDER, WEEKDAY_SHORT } from '../lib/schedule';
import { displayWeight } from '../lib/units';

const GOAL_LABEL: Record<string, string> = { muscle_gain: 'Build muscle', fat_loss: 'Lose fat', strength: 'Get stronger', general_fitness: 'Get fit and healthy' };
const EQUIPMENT_LABEL: Record<string, string> = { gym: 'Gym', home: 'Home with weights', bodyweight: 'No equipment' };

type TargetKey = 'calorieTarget' | 'proteinTargetG' | 'carbsTargetG' | 'fatTargetG' | 'waterTargetMl';

export function Settings() {
  const navigate = useNavigate();
  const profile = useLiveQuery(() => db.profile.get('me'));
  const settings = useLiveQuery(() => db.settings.get('app'));
  const plan = useLiveQuery(() => db.plan.get('active'));
  const [aiTest, setAiTest] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [aiTestMessage, setAiTestMessage] = useState('');
  const [showReasons, setShowReasons] = useState(false);
  const [dataMessage, setDataMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!settings || !profile) return <p className="font-bold text-text-muted">Loading…</p>;
  const units = settings.units;
  const schedule = planSchedule(plan, profile);

  // put() replaces the whole row, so every update starts from the stored settings.
  const saveSettings = (patch: Partial<AppSettings>) => db.settings.put({ ...settings, ...patch });

  const fallback = profile.birthYear ? computeTargets(profile) : null;
  const targets: Record<TargetKey, number> = {
    calorieTarget: settings.calorieTarget ?? fallback?.calories ?? estimateCalorieTarget(profile.weightKg, profile.goal),
    proteinTargetG: settings.proteinTargetG ?? fallback?.proteinG ?? estimateProteinTarget(profile.weightKg, profile.goal),
    carbsTargetG: settings.carbsTargetG ?? fallback?.carbsG ?? 250,
    fatTargetG: settings.fatTargetG ?? fallback?.fatG ?? 70,
    waterTargetMl: settings.waterTargetMl ?? fallback?.waterMl ?? 2500,
  };

  async function recalculate() {
    if (!profile) return;
    const t = computeTargets(profile);
    await saveSettings({ calorieTarget: t.calories, proteinTargetG: t.proteinG, carbsTargetG: t.carbsG, fatTargetG: t.fatG, waterTargetMl: t.waterMl });
  }

  async function rebuildPlan() {
    if (!profile || !plan) return;
    if (!window.confirm('Rebuild your plan from your answers? Your logged workouts stay as they are.')) return;
    const next = generatePlan(planInputFromProfile(profile));
    await db.plan.put({ ...plan, days: next.days, reasons: next.reasons, splitName: next.splitName, schedule: plan.schedule ?? defaultSchedule(profile.daysPerWeek), createdAt: new Date().toISOString() });
  }

  async function testAi() {
    setAiTest('testing');
    const result = await generateText('Reply with exactly one word: ready.', 0);
    if (result.ok) setAiTest('ok');
    else {
      setAiTest('error');
      setAiTestMessage(result.error);
    }
  }

  async function download() {
    const { blob, filename } = await exportBackup();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setDataMessage('Backup saved. Keep it somewhere safe (Files, iCloud, email to yourself).');
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    if (!window.confirm('Restore this backup? It replaces everything currently in Fibu on this phone.')) return;
    const result = await importBackup(file);
    setDataMessage(result.ok ? `Restored: ${result.counts.sessions ?? 0} workouts, ${result.counts.foodLog ?? 0} foods.` : result.error);
  }

  const diagOn = (() => {
    try {
      return localStorage.getItem('fibu:diag') === '1';
    } catch {
      return false;
    }
  })();

  return (
    <div className="flex flex-col gap-4 pb-4">
      <h1 className="font-display text-2xl font-black text-text">Settings</h1>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <UserCircle size={40} weight="fill" className="text-text-faint" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[18px] font-black text-text">{profile.name ?? 'You'}</p>
            <p className="text-sm font-bold text-text-muted">
              {GOAL_LABEL[profile.goal]} · {displayWeight(profile.weightKg, units)} {units}
              {profile.goalWeightKg ? ` → ${displayWeight(profile.goalWeightKg, units)} ${units}` : ''}
            </p>
            <p className="text-sm font-bold text-text-faint">
              {profile.daysPerWeek} days a week · {profile.sessionMinutes ?? 45} min · {EQUIPMENT_LABEL[profile.equipment ?? 'gym']}
              {profile.injuries?.length ? ` · careful with ${profile.injuries.join(', ')}` : ''}
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate('/onboarding')}>
          Change my answers
        </Button>
      </Card>

      {plan && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold text-text-faint">Your plan</p>
              <p className="font-display text-[20px] font-black text-text">{plan.splitName ?? 'Custom plan'}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={rebuildPlan}>
              <ArrowsClockwise size={16} weight="bold" /> Rebuild
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-extrabold text-text-muted">
              Training days <span className="font-bold text-text-faint">({describeDays(schedule)})</span>
            </p>
            <div className="grid grid-cols-7 gap-1">
              {WEEK_ORDER.map((wd) => {
                const on = schedule.includes(wd);
                return (
                  <button
                    key={wd}
                    onClick={() => {
                      const next = on ? schedule.filter((d) => d !== wd) : [...schedule, wd];
                      if (next.length) void saveSchedule(next);
                    }}
                    aria-pressed={on}
                    className={`press-3d press-3d-sm h-11 rounded-xl border-2 text-xs font-black ${
                      on ? 'border-accent bg-accent text-accent-ink [--ledge-color:var(--color-accent-ledge)]' : 'border-border bg-bg-raised text-text-muted [--ledge-color:var(--color-border)]'
                    }`}
                  >
                    {WEEKDAY_SHORT[wd]}
                  </button>
                );
              })}
            </div>
            {schedule.length !== plan.days.length && (
              <p className="text-xs font-bold text-text-faint">
                Your plan has {plan.days.length} workouts a week. Fibu keeps them in order whichever days you pick; change "days a week" in your answers to rebuild the plan.
              </p>
            )}
          </div>
          <ul className="flex flex-col gap-1.5">
            {plan.days.map((d, i) => (
              <li key={d.label} className="flex items-center gap-2 text-sm font-bold text-text">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-bg-raised-2 text-xs font-black text-text-muted">{i + 1}</span>
                <span className="font-extrabold">{d.label}</span>
                <span className="truncate text-text-faint">· {focusLabel(d)}</span>
              </li>
            ))}
          </ul>
          {plan.reasons?.length ? (
            <>
              <button onClick={() => setShowReasons((s) => !s)} className="self-start text-sm font-extrabold text-water-text" aria-expanded={showReasons}>
                {showReasons ? 'Hide' : 'Why this plan?'}
              </button>
              {showReasons && (
                <ul className="flex flex-col gap-2">
                  {plan.reasons.map((r) => (
                    <li key={r} className="flex gap-2 text-sm font-semibold text-text">
                      <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-success" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-[17px] font-black text-text">Daily targets</p>
          {profile.birthYear && (
            <button onClick={recalculate} className="text-sm font-extrabold text-water-text">
              Recalculate
            </button>
          )}
        </div>
        <div className="flex flex-col items-center gap-5">
          <NumberStepper label="Calories" value={targets.calorieTarget} onChange={(v) => saveSettings({ calorieTarget: Math.round(v) })} step={50} min={1000} max={6000} suffix="kcal" />
          <NumberStepper label="Protein" value={targets.proteinTargetG} onChange={(v) => saveSettings({ proteinTargetG: Math.round(v) })} step={5} min={30} max={400} suffix="g" />
          <NumberStepper label="Carbs" value={targets.carbsTargetG} onChange={(v) => saveSettings({ carbsTargetG: Math.round(v) })} step={5} min={20} max={800} suffix="g" />
          <NumberStepper label="Fat" value={targets.fatTargetG} onChange={(v) => saveSettings({ fatTargetG: Math.round(v) })} step={5} min={20} max={300} suffix="g" />
          <NumberStepper label="Water" value={targets.waterTargetMl} onChange={(v) => saveSettings({ waterTargetMl: Math.round(v) })} step={250} min={1000} max={6000} suffix="ml" />
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="font-display text-[17px] font-black text-text">Look and units</p>
        <div className="flex flex-wrap gap-2">
          {(['light', 'dark'] as Theme[]).map((t) => (
            <Chip key={t} active={settings.theme === t} onClick={() => saveSettings({ theme: t })}>
              {t === 'light' ? 'Light' : 'Dark'}
            </Chip>
          ))}
          <span className="w-2" />
          {(['kg', 'lb'] as Units[]).map((u) => (
            <Chip key={u} active={units === u} onClick={() => saveSettings({ units: u })}>
              {u.toUpperCase()}
            </Chip>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Robot size={22} weight="fill" className="text-text-muted" />
          <p className="font-display text-[17px] font-black text-text">Fibu AI</p>
        </div>
        <p className="text-sm font-semibold text-text-muted">
          Built in, nothing to set up. Your messages and photos go to the AI only when you use the coach, voice logging or meal photos.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" disabled={aiTest === 'testing'} onClick={testAi}>
            {aiTest === 'testing' ? 'Checking…' : 'Check connection'}
          </Button>
          {aiTest === 'ok' && <span className="text-sm font-extrabold text-success-text">Connected</span>}
          {aiTest === 'error' && <span className="text-sm font-bold text-danger">{aiTestMessage}</span>}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="font-display text-[17px] font-black text-text">Your data</p>
        <p className="text-sm font-semibold text-text-muted">
          Everything lives on this phone only. Download a backup now and then, and use it to move Fibu to a new phone.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={download}>
            <DownloadSimple size={18} weight="bold" /> Backup
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
            <UploadSimple size={18} weight="bold" /> Restore
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
        </div>
        {dataMessage && <p className="text-sm font-bold text-text">{dataMessage}</p>}
      </Card>

      <div className="flex items-center justify-between px-1 text-xs font-bold text-text-faint">
        <span>Fibu · build {BUILD_TAG}</span>
        <button
          onClick={() => {
            try {
              localStorage.setItem('fibu:diag', diagOn ? '0' : '1');
            } catch {
              // ignore
            }
            location.reload();
          }}
          className="underline"
        >
          {diagOn ? 'Hide' : 'Show'} diagnostics
        </button>
      </div>
    </div>
  );
}
