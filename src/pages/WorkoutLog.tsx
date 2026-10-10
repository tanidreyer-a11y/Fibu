import { CalendarBlank, Lightning, Microphone, Plus, Sparkle } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { ExerciseEntryCard, type DraftSet } from '../components/ExerciseEntryCard';
import { ExercisePickerSheet } from '../components/ExercisePickerSheet';
import { MascotSays } from '../components/Mascot';
import { VoiceLogSheet } from '../components/VoiceLogSheet';
import { Button } from '../components/ui/Button';
import { PressCard } from '../components/ui/Card';
import { Sheet } from '../components/ui/Sheet';
import { addDays, friendlyDate, localDate } from '../lib/dates';
import { describeDays, detectMovedSession, planSchedule, rememberScheduleAnswer, saveSchedule, scheduleQuestionAnswered, WEEKDAY_NAMES } from '../lib/schedule';
import { db, type Exercise, type PlanDay, type Prescription, type SetEntry, type WorkoutSession } from '../lib/db';
import { currentRung, exerciseForItem, focusLabel, nextPlanDay, weekVariant } from '../lib/plan';
import { calculateIntensityScore, lastSetForExercise, suggestProgressiveOverload } from '../lib/training';
import { useRestTimer } from '../store/restTimer';

type Draft = { exerciseId: string; sets: DraftSet[]; target?: Prescription; pattern?: Exercise['pattern']; optionIds?: string[] };
type PickerTarget = { mode: 'add' } | { mode: 'swap'; entryIndex: number };

const DEFAULT_WEIGHT: Record<string, number> = { barbell: 20, 'ez-bar': 15, smith: 20, machine: 20, cable: 15, dumbbell: 10, kettlebell: 12 };

export function WorkoutLog() {
  const navigate = useNavigate();
  const plan = useLiveQuery(() => db.plan.get('active'));
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);
  const settings = useLiveQuery(() => db.settings.get('app'));
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').toArray(), [], []);

  const [dayLabel, setDayLabel] = useState<string | null>(null);
  const [entries, setEntries] = useState<Draft[]>([]);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [info, setInfo] = useState<Exercise | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const today = localDate();
  const [logDate, setLogDate] = useState(today);
  const [scheduleAnswer, setScheduleAnswer] = useState<'shift' | 'keep' | null>(null);
  const profile = useLiveQuery(() => db.profile.get('me'));

  const units = settings?.units ?? 'kg';
  const exercisesById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);
  const variant = weekVariant();
  const lastSession = sessions?.[sessions.length - 1];
  const upNext = plan ? nextPlanDay(plan.days, lastSession?.dayLabel) : undefined;
  const schedule = planSchedule(plan, profile);
  const moved = plan && sessions && !scheduleQuestionAnswered(today) ? detectMovedSession(schedule, sessions, today) : null;

  async function answerSchedule(answer: 'shift' | 'keep') {
    if (answer === 'shift' && moved) await saveSchedule(moved.shifted);
    rememberScheduleAnswer(answer, today);
    setScheduleAnswer(answer);
  }

  // Fibu's chat can say "start my workout": it leaves the day in sessionStorage and opens this screen.
  useEffect(() => {
    if (dayLabel || !plan || !exercises?.length) return;
    let wanted: string | null = null;
    try {
      wanted = sessionStorage.getItem('fibu:startDay');
      sessionStorage.removeItem('fibu:startDay');
    } catch {
      return;
    }
    if (wanted) startDay(wanted === 'Freeform' ? null : (plan.days.find((d) => d.label === wanted) ?? null));
    // startDay reads current state; run only when the plan/exercises first arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, exercises?.length]);

  /** Pre-fill sets with last time's numbers nudged by the overload rule, or a sensible start. */
  function startingSets(exerciseId: string, target?: Prescription): DraftSet[] {
    const exercise = exercisesById.get(exerciseId);
    const last = sessions?.length ? lastSetForExercise(sessions, exerciseId) : null;
    let first: SetEntry;
    if (last) {
      const s = suggestProgressiveOverload(last.set, units, { exercise, target });
      first = { reps: s.targetReps, weightKg: s.targetWeightKg };
    } else {
      const bodyweight = !exercise || exercise.equipment === 'bodyweight' || exercise.equipment === 'band';
      first = { reps: target?.repsMin ?? (exercise?.unit === 'sec' ? 30 : 8), weightKg: bodyweight ? 0 : (DEFAULT_WEIGHT[exercise.equipment] ?? 10) };
    }
    return Array.from({ length: target?.sets ?? 3 }, () => ({ ...first, done: false }));
  }

  function startDay(day: PlanDay | null) {
    setDayLabel(day?.label ?? 'Freeform');
    setStartedAt(new Date().toISOString());
    if (!day) {
      setEntries([]);
      return;
    }
    if (day.items?.length) {
      setEntries(
        day.items.map((item) => {
          const exerciseId = currentRung(exerciseForItem(item, variant), sessions ?? []);
          const target: Prescription = { sets: item.sets, repsMin: item.repsMin, repsMax: item.repsMax, restSec: item.restSec, unit: item.unit };
          return { exerciseId, target, pattern: item.pattern, optionIds: item.exerciseIds, sets: startingSets(exerciseId, target) };
        }),
      );
    } else {
      setEntries(day.suggestedExerciseIds.map((exerciseId) => ({ exerciseId, sets: startingSets(exerciseId) })));
    }
  }

  function updateEntry(index: number, patch: Partial<Draft>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function handlePickerSelect(exercise: Exercise) {
    if (!picker) return;
    if (picker.mode === 'add') {
      setEntries((prev) => [...prev, { exerciseId: exercise.id, pattern: exercise.pattern, sets: startingSets(exercise.id) }]);
    } else {
      const current = entries[picker.entryIndex];
      updateEntry(picker.entryIndex, { exerciseId: exercise.id, sets: startingSets(exercise.id, current?.target) });
    }
  }

  function handleVoiceConfirm(exerciseId: string, sets: SetEntry[]) {
    setEntries((prev) => [...prev, { exerciseId, sets: sets.map((s) => ({ ...s, done: true })) }]);
    setVoiceOpen(false);
  }

  function cancel() {
    if (entries.some((e) => e.sets.some((s) => s.done)) && !window.confirm('Discard this workout? Ticked sets will be lost.')) return;
    useRestTimer.getState().dismiss();
    setDayLabel(null);
    setEntries([]);
  }

  async function finish() {
    if (!dayLabel) return;
    const unticked = entries.reduce((n, e) => n + e.sets.filter((s) => !s.done && s.reps > 0).length, 0);
    const anyTicked = entries.some((e) => e.sets.some((s) => s.done));
    // Sets left unticked are probably done-but-not-tapped when nothing was ticked at all.
    const includeUnticked = !anyTicked || (unticked > 0 && window.confirm(`${unticked} set${unticked === 1 ? '' : 's'} not ticked. Count them as done?`));

    const exerciseEntries = entries
      .map((e) => ({
        exerciseId: e.exerciseId,
        ...(e.target ? { target: e.target } : {}),
        sets: e.sets.filter((s) => (s.done || includeUnticked) && s.reps > 0).map(({ done: _done, ...s }) => s),
      }))
      .filter((e) => e.sets.length > 0);
    if (!exerciseEntries.length) return;

    setSaving(true);
    const recent = [...(sessions ?? [])].reverse().slice(0, 5);
    const draft: Pick<WorkoutSession, 'exerciseEntries'> = { exerciseEntries };
    const intensity = calculateIntensityScore(draft, recent);
    const now = new Date();
    // A workout logged for an earlier day gets that day's date; its length isn't known, so start = end.
    const backdated = logDate !== localDate(now);
    const stamp = backdated ? new Date(`${logDate}T${now.toTimeString().slice(0, 8)}`).toISOString() : now.toISOString();
    const id = await db.sessions.add({
      date: logDate,
      dayLabel,
      startedAt: backdated ? stamp : (startedAt ?? stamp),
      completedAt: stamp,
      exerciseEntries,
      intensityScore: intensity.score,
      source: 'app',
    });
    useRestTimer.getState().dismiss();
    navigate(`/summary/${id}`, { replace: true, state: { fresh: true } });
  }

  if (!dayLabel) {
    return (
      <div className="flex flex-col gap-5">
        {upNext ? (
          <MascotSays pose="stand" size={104}>
            Up next: <span className="text-accent-text">{upNext.label}</span>. {upNext.items?.length ?? upNext.suggestedExerciseIds.length} moves, ready when you are.
          </MascotSays>
        ) : (
          <MascotSays pose="stand" size={104}>
            No plan yet. Go freeform and log whatever you're doing today.
          </MascotSays>
        )}

        {moved && !scheduleAnswer && (
          <div className="animate-rise-in flex flex-col gap-3 rounded-2xl border-2 border-b-4 border-water/50 bg-water-tint p-4">
            <p className="text-[15px] leading-snug font-bold text-text">
              I see you missed your {WEEKDAY_NAMES[moved.missedWeekday]} session and you're training on {WEEKDAY_NAMES[moved.todayWeekday]} instead. Want your
              training days to shift to <b className="font-black">{describeDays(moved.shifted)}</b> from now on, or stick with{' '}
              <b className="font-black">{describeDays(schedule)}</b>?
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => answerSchedule('shift')}>
                Shift to {WEEKDAY_NAMES[moved.todayWeekday].slice(0, 3)}
              </Button>
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => answerSchedule('keep')}>
                Keep my days
              </Button>
            </div>
          </div>
        )}
        {scheduleAnswer && (
          <p className="animate-rise-in rounded-2xl bg-water-tint px-4 py-3 text-sm font-extrabold text-water-text">
            {scheduleAnswer === 'shift'
              ? `Done. Your training days are now ${describeDays(planSchedule(plan, profile))}.`
              : `Got it, keeping ${describeDays(schedule)}. Today counts as a one-off.`}
          </p>
        )}

        <div className="flex items-end justify-between">
          <h1 className="font-display text-2xl font-black text-text">Pick your workout</h1>
          {plan?.days.some((d) => d.items?.length) && (
            <span className="rounded-lg bg-bg-raised-2 px-2 py-1 text-xs font-extrabold text-text-muted" title="Exercises rotate between A and B weeks">
              Week {variant === 0 ? 'A' : 'B'}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {(plan?.days ?? []).map((d, i) => {
            const isNext = d.label === upNext?.label;
            return (
              <PressCard
                key={d.label}
                onClick={() => startDay(d)}
                className={`animate-rise-in flex items-center gap-3 ${isNext ? '!border-accent [--ledge-color:var(--color-accent)]' : ''}`}
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-black ${
                    isNext ? 'bg-accent text-accent-ink' : 'bg-bg-raised-2 text-text-muted'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-[17px] font-extrabold text-text">{d.label}</span>
                    {isNext && <span className="rounded-md bg-accent-tint px-1.5 py-0.5 text-[10px] font-black text-accent-text uppercase">Up next</span>}
                  </span>
                  <span className="block truncate text-[13px] font-bold text-text-faint">
                    {(d.items?.length ?? d.suggestedExerciseIds.length) + ' moves'} · {focusLabel(d)}
                  </span>
                </span>
              </PressCard>
            );
          })}
          <PressCard onClick={() => startDay(null)} className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-bg-raised-2 text-text-muted">
              <Sparkle size={22} weight="fill" />
            </span>
            <span>
              <span className="font-display block text-[17px] font-extrabold text-text">Freeform</span>
              <span className="block text-[13px] font-bold text-text-faint">Build it as you go</span>
            </span>
          </PressCard>
        </div>
      </div>
    );
  }

  const totalSets = entries.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-start justify-between gap-3 pr-12">
        <div className="min-w-0">
          <h1 className="font-display truncate text-2xl font-black text-text">{dayLabel}</h1>
          <p className="tabular text-sm font-bold text-text-faint">
            {doneSets}/{totalSets} sets done
          </p>
        </div>
        <button onClick={cancel} className="shrink-0 pt-1.5 text-sm font-extrabold text-text-faint [@media(hover:hover)]:hover:text-danger">
          Cancel
        </button>
      </div>

      {/* Logging a workout you already did on an earlier day. */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarBlank size={18} weight="bold" className="text-text-faint" />
        {[today, addDays(today, -1)].map((d) => (
          <button
            key={d}
            onClick={() => setLogDate(d)}
            aria-pressed={logDate === d}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold ${logDate === d ? 'bg-text text-bg' : 'bg-bg-raised-2 text-text-muted'}`}
          >
            {friendlyDate(d, today)}
          </button>
        ))}
        <label
          onClick={(e) => {
            // Desktop browsers only open the calendar via showPicker(); iPhone opens it on tap anyway.
            const input = e.currentTarget.querySelector('input');
            try {
              input?.showPicker?.();
            } catch {
              input?.focus();
            }
          }}
          className={`flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-extrabold ${
            logDate < addDays(today, -1) ? 'bg-text text-bg' : 'bg-bg-raised-2 text-text-muted'
          }`}
        >
          {logDate < addDays(today, -1) ? friendlyDate(logDate, today) : 'Earlier'}
          <input
            type="date"
            max={today}
            value={logDate}
            onChange={(e) => e.target.value && e.target.value <= today && setLogDate(e.target.value)}
            aria-label="Pick the day you trained"
            className="w-0 opacity-0"
          />
        </label>
      </div>

      {totalSets > 0 && (
        <div className="h-3 overflow-hidden rounded-full bg-bg-raised-2" aria-hidden="true">
          <div
            className="h-full rounded-full bg-success transition-[clip-path] duration-500 ease-[var(--ease-out)]"
            style={{ clipPath: `inset(0 ${100 - (doneSets / totalSets) * 100}% 0 0 round 999px)` }}
          />
        </div>
      )}

      {entries.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-text-muted">
          No exercises yet. Add what you're doing, or say it with the mic.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {entries.map((entry, i) => {
          const exercise = exercisesById.get(entry.exerciseId);
          if (!exercise) return null;
          const lastHint = sessions?.length ? lastSetForExercise(sessions, entry.exerciseId) : null;
          const suggestion = lastHint ? suggestProgressiveOverload(lastHint.set, units, { exercise, target: entry.target }) : null;
          return (
            <ExerciseEntryCard
              key={`${entry.exerciseId}-${i}`}
              exercise={exercise}
              sets={entry.sets}
              units={units}
              target={entry.target}
              lastHint={lastHint}
              suggestion={suggestion}
              onUpdateSets={(sets) => updateEntry(i, { sets })}
              onSwap={() => setPicker({ mode: 'swap', entryIndex: i })}
              onRemove={() => setEntries((prev) => prev.filter((_, idx) => idx !== i))}
              onInfo={() => setInfo(exercise)}
              onLevelUp={(nextId) => updateEntry(i, { exerciseId: nextId, sets: startingSets(nextId, entry.target) })}
            />
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setPicker({ mode: 'add' })}>
          <Plus size={18} weight="bold" /> Add exercise
        </Button>
        <Button variant="secondary" size="icon" onClick={() => setVoiceOpen(true)} aria-label="Log by voice">
          <Microphone size={20} weight="bold" />
        </Button>
      </div>

      <Button size="lg" disabled={saving || totalSets === 0} onClick={finish}>
        <Lightning size={20} weight="fill" />
        {saving ? 'Saving…' : 'Finish workout'}
      </Button>

      {picker && (
        <ExercisePickerSheet
          onClose={() => setPicker(null)}
          onSelect={handlePickerSelect}
          swap={
            picker.mode === 'swap'
              ? {
                  currentId: entries[picker.entryIndex]?.exerciseId,
                  pattern: entries[picker.entryIndex]?.pattern ?? exercisesById.get(entries[picker.entryIndex]?.exerciseId)?.pattern,
                  group: exercisesById.get(entries[picker.entryIndex]?.exerciseId)?.muscleGroups[0],
                  optionIds: entries[picker.entryIndex]?.optionIds,
                }
              : undefined
          }
        />
      )}

      {info && (
        <Sheet title={info.name} onClose={() => setInfo(null)} tall>
          <ExerciseDetail exercise={info} />
        </Sheet>
      )}

      {voiceOpen && <VoiceLogSheet units={units} onClose={() => setVoiceOpen(false)} onConfirm={handleVoiceConfirm} />}
    </div>
  );
}
