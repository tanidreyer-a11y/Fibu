import { ArrowLeft, Info, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db, type Exercise } from '../lib/db';
import type { Pattern } from '../lib/exercises';
import {
  BODY_PARTS,
  EQUIPMENT_FILTERS,
  EQUIPMENT_LABEL,
  inBodyPart,
  matchesEquipment,
  matchesQuery,
  patternForGroup,
  type BodyPart,
  type EquipmentFilter,
} from '../lib/exerciseFilters';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../lib/muscleGroups';
import { ladderRelation } from '../lib/plan';
import { ExerciseDetail } from './ExerciseDetail';
import { ExerciseThumb } from './ExerciseThumb';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { Sheet } from './ui/Sheet';

interface ExercisePickerSheetProps {
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  /** when swapping: show moves for the same slot first */
  swap?: { pattern?: Pattern; group?: MuscleGroup; optionIds?: string[]; currentId?: string };
}

const PAGE = 60;

const CUSTOM_GROUPS: MuscleGroup[] = ['chest', 'lats', 'front-delts', 'side-delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];
const CUSTOM_EQUIPMENT = ['bodyweight', 'dumbbell', 'barbell', 'machine', 'cable', 'kettlebell', 'band', 'other'];

function Row({ exercise, onPick, onInfo, badge }: { exercise: Exercise; onPick: () => void; onInfo: () => void; badge?: string }) {
  return (
    <li className="flex items-center gap-2">
      <button
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-2 text-left transition-colors duration-150 active:bg-bg-raised-2 [@media(hover:hover)]:hover:bg-bg-raised-2"
      >
        <ExerciseThumb exercise={exercise} size={52} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-extrabold text-text">{exercise.name}</span>
            {badge && (
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${
                  badge === 'Harder' ? 'bg-protein-tint text-protein-text' : badge === 'Easier' ? 'bg-bg-raised-2 text-text-muted' : 'bg-accent-tint text-accent-text'
                }`}
              >
                {badge}
              </span>
            )}
          </span>
          <span className="block truncate text-xs font-bold text-text-faint">
            {MUSCLE_GROUP_LABELS[exercise.muscleGroups[0]] ?? exercise.muscleGroups[0]} · {EQUIPMENT_LABEL[exercise.equipment] ?? exercise.equipment}
          </span>
        </span>
      </button>
      <button
        onClick={onInfo}
        aria-label={`How to do ${exercise.name}`}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-text-faint transition-colors duration-150 [@media(hover:hover)]:hover:bg-bg-raised-2 [@media(hover:hover)]:hover:text-text"
      >
        <Info size={20} weight="bold" />
      </button>
    </li>
  );
}

/** Mount only while open — each mount starts with a clean search. */
export function ExercisePickerSheet({ onClose, onSelect, swap }: ExercisePickerSheetProps) {
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<BodyPart>('all');
  const [equipment, setEquipment] = useState<EquipmentFilter>('any');
  const [limit, setLimit] = useState(PAGE);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customGroup, setCustomGroup] = useState<MuscleGroup>(swap?.group ?? 'chest');
  const [customEquipment, setCustomEquipment] = useState('bodyweight');

  const { sameSlot, rest } = useMemo(() => {
    const list = (exercises ?? []).filter((e) => e.id !== swap?.currentId);
    const q = query.trim();
    const filtered = list.filter(
      (e) => (q ? matchesQuery(e, q) : inBodyPart(e, part)) && (!q || part === 'all' || inBodyPart(e, part)) && matchesEquipment(e, equipment),
    );
    // Fibu's own picks first (they carry plan logic), custom next, then the open database.
    const rank = (e: Exercise) => (e.source === 'fibu' ? 0 : e.isCustom ? 1 : 2);
    filtered.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

    if (!swap || q) return { sameSlot: [] as Exercise[], rest: filtered };
    // The plan's own ranking for this slot comes first, in its order; other moves of the same pattern follow.
    const order = new Map((swap.optionIds ?? []).map((id, i) => [id, i]));
    const same = filtered
      .filter((e) => order.has(e.id) || (swap.pattern && e.pattern === swap.pattern && e.source !== 'fedb'))
      .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
    const sameIds = new Set(same.map((e) => e.id));
    return { sameSlot: same, rest: filtered.filter((e) => !sameIds.has(e.id)) };
  }, [exercises, query, part, equipment, swap]);

  function pick(e: Exercise) {
    onSelect(e);
    onClose();
  }

  async function saveCustom() {
    const name = customName.trim();
    if (!name) return;
    const exercise: Exercise = {
      id: `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${Date.now().toString(36)}`,
      name,
      muscleGroups: [customGroup],
      equipment: customEquipment,
      pattern: patternForGroup(customGroup),
      isCustom: true,
      source: 'custom',
    };
    await db.exercises.put(exercise);
    pick(exercise);
  }

  if (creating) {
    return (
      <Sheet
        title="Add your own exercise"
        onClose={onClose}
        leading={
          <button onClick={() => setCreating(false)} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-xl text-text-muted">
            <ArrowLeft size={20} weight="bold" />
          </button>
        }
        footer={
          <Button size="lg" className="w-full" disabled={!customName.trim()} onClick={saveCustom}>
            Save and add
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-extrabold text-text-muted">Name</span>
            <input
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Landmine Press"
              className="h-12 rounded-xl border-2 border-border-strong bg-bg-raised px-4 text-[15px] font-bold text-text outline-none placeholder:text-text-faint focus:border-accent"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-extrabold text-text-muted">Main muscle</span>
            <div className="flex flex-wrap gap-2">
              {CUSTOM_GROUPS.map((g) => (
                <Chip key={g} active={customGroup === g} onClick={() => setCustomGroup(g)}>
                  {MUSCLE_GROUP_LABELS[g]}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-extrabold text-text-muted">Equipment</span>
            <div className="flex flex-wrap gap-2">
              {CUSTOM_EQUIPMENT.map((eq) => (
                <Chip key={eq} active={customEquipment === eq} onClick={() => setCustomEquipment(eq)}>
                  {EQUIPMENT_LABEL[eq]}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </Sheet>
    );
  }

  if (detail) {
    return (
      <Sheet
        title={detail.name}
        onClose={onClose}
        tall
        leading={
          <button onClick={() => setDetail(null)} aria-label="Back to list" className="grid h-10 w-10 place-items-center rounded-xl text-text-muted">
            <ArrowLeft size={20} weight="bold" />
          </button>
        }
        footer={
          <Button size="lg" className="w-full" onClick={() => pick(detail)}>
            {swap ? 'Swap this in' : 'Add to workout'}
          </Button>
        }
      >
        <ExerciseDetail exercise={detail} />
      </Sheet>
    );
  }

  const shown = rest.slice(0, limit);
  const total = sameSlot.length + rest.length;

  return (
    <Sheet title={swap ? 'Swap exercise' : 'Add an exercise'} onClose={onClose} tall>
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2.5 bg-bg-raised px-4 pb-3">
        <label className="relative block">
          <MagnifyingGlass size={18} weight="bold" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-faint" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search 950+ exercises"
            aria-label="Search exercises"
            className="h-12 w-full rounded-xl border-2 border-border-strong bg-bg-raised pr-4 pl-10 text-[15px] font-bold text-text outline-none placeholder:text-text-faint focus:border-accent"
          />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {BODY_PARTS.map((b) => (
            <Chip
              key={b.key}
              active={part === b.key}
              onClick={() => {
                setPart(b.key);
                setLimit(PAGE);
              }}
            >
              {b.label}
            </Chip>
          ))}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {EQUIPMENT_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setEquipment(f.key);
                setLimit(PAGE);
              }}
              aria-pressed={equipment === f.key}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-extrabold whitespace-nowrap transition-colors duration-150 ${
                equipment === f.key ? 'bg-text text-bg' : 'bg-bg-raised-2 text-text-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {exercises === undefined || exercises.length === 0 ? (
        <p className="py-10 text-center text-sm font-bold text-text-muted">Loading exercises…</p>
      ) : (
        <>
          {sameSlot.length > 0 && (
            <section className="mb-3">
              <h3 className="mb-1 text-sm font-extrabold text-text-muted">Same movement</h3>
              <ul className="flex flex-col">
                {sameSlot.map((e, i) => {
                  // On a progression ladder, say plainly whether a swap is a step up or a step back.
                  const rel = swap?.currentId ? ladderRelation(swap.currentId, e.id) : null;
                  const badge = rel === 'harder' ? 'Harder' : rel === 'easier' ? 'Easier' : i === 0 ? 'Best swap' : undefined;
                  return <Row key={e.id} exercise={e} badge={badge} onPick={() => pick(e)} onInfo={() => setDetail(e)} />;
                })}
              </ul>
            </section>
          )}

          {sameSlot.length > 0 && rest.length > 0 && <h3 className="mb-1 text-sm font-extrabold text-text-muted">Everything else</h3>}
          <ul className="flex flex-col">
            {shown.map((e) => (
              <Row key={e.id} exercise={e} onPick={() => pick(e)} onInfo={() => setDetail(e)} />
            ))}
          </ul>

          {rest.length > limit && (
            <Button variant="secondary" className="mt-3 w-full" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({rest.length - limit} left)
            </Button>
          )}

          {total === 0 && <p className="py-6 text-center text-sm font-bold text-text-muted">Nothing matches that. Add it as your own:</p>}

          <button
            onClick={() => {
              setCustomName(query.trim());
              setCreating(true);
            }}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-border px-4 py-3.5 text-left text-[15px] font-extrabold text-text-muted transition-colors duration-150 [@media(hover:hover)]:hover:border-text-faint [@media(hover:hover)]:hover:text-text"
          >
            <Plus size={20} weight="bold" />
            {query.trim() ? `Create “${query.trim()}”` : 'Create your own exercise'}
          </button>
        </>
      )}
    </Sheet>
  );
}
