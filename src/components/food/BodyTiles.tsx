import { Drop, Minus, Plus, Scales, TrendDown, TrendUp } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { addDays } from '../../lib/dates';
import { db, type Units } from '../../lib/db';
import { logWater } from '../../lib/food';
import { displayWeight, toStorageWeightKg } from '../../lib/units';
import { Button } from '../ui/Button';
import { NumberStepper } from '../ui/NumberStepper';
import { ProgressBar } from '../ui/ProgressBar';
import { Sheet } from '../ui/Sheet';

const GLASS_ML = 250;

export function WaterTile({ date, targetMl }: { date: string; targetMl: number }) {
  const total = useLiveQuery(async () => (await db.waterLog.where('date').equals(date).toArray()).reduce((s, w) => s + w.ml, 0), [date], 0);
  const litres = (total ?? 0) / 1000;

  async function undo() {
    const last = await db.waterLog.where('date').equals(date).last();
    if (last?.id != null) await db.waterLog.delete(last.id);
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-b-4 border-border bg-bg-raised p-3.5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-water-tint text-water-text">
          <Drop size={18} weight="fill" />
        </span>
        <span className="text-sm font-extrabold text-text-muted">Water</span>
      </div>
      <p className="tabular font-display text-[22px] leading-none font-black text-text">
        {litres.toFixed(litres % 1 ? 2 : 0).replace(/(\.\d)0$/, '$1')}
        <span className="text-sm font-extrabold text-text-faint"> / {(targetMl / 1000).toFixed(1).replace(/\.0$/, '')} L</span>
      </p>
      <ProgressBar value={(total ?? 0) / targetMl} tone="water" height={10} label="Water today" />
      <div className="flex gap-1.5">
        <button
          onClick={undo}
          disabled={!total}
          aria-label="Remove last glass"
          className="grid h-10 w-10 place-items-center rounded-xl bg-bg-raised-2 text-text-muted disabled:opacity-40"
        >
          <Minus size={16} weight="bold" />
        </button>
        <button
          onClick={() => logWater(date, GLASS_ML)}
          className="press-3d press-3d-sm flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-water text-sm font-extrabold text-white [--ledge-color:#0a7fb8]"
        >
          <Plus size={16} weight="bold" /> Glass
        </button>
      </div>
    </div>
  );
}

export function WeightTile({ date, units }: { date: string; units: Units }) {
  const [open, setOpen] = useState(false);
  const latest = useLiveQuery(() => db.bodyLog.orderBy('date').last(), []);
  const weekAgo = useLiveQuery(() => db.bodyLog.where('date').belowOrEqual(addDays(date, -7)).last(), [date]);
  const delta = latest && weekAgo ? latest.weightKg - weekAgo.weightKg : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="press-3d flex flex-col gap-2.5 rounded-2xl border-2 border-border bg-bg-raised p-3.5 text-left [--ledge-color:var(--color-border)]"
      >
        <span className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-xp-tint text-xp-text">
            <Scales size={18} weight="fill" />
          </span>
          <span className="text-sm font-extrabold text-text-muted">Weight</span>
        </span>
        <span className="tabular font-display text-[22px] leading-none font-black text-text">
          {latest ? displayWeight(latest.weightKg, units) : '–'}
          <span className="text-sm font-extrabold text-text-faint"> {units}</span>
        </span>
        <span className="flex items-center gap-1 text-xs font-extrabold text-text-faint">
          {delta != null && Math.abs(delta) >= 0.05 ? (
            <>
              {delta < 0 ? <TrendDown size={14} weight="bold" /> : <TrendUp size={14} weight="bold" />}
              {delta > 0 ? '+' : ''}
              {displayWeight(delta, units)} {units} this week
            </>
          ) : (
            'Tap to log today'
          )}
        </span>
        <span className="mt-auto flex h-10 items-center justify-center rounded-xl bg-bg-raised-2 text-sm font-extrabold text-text-muted">Log weight</span>
      </button>
      {open && <WeightSheet date={date} units={units} startKg={latest?.weightKg ?? 75} onClose={() => setOpen(false)} />}
    </>
  );
}

export function WeightSheet({ date, units, startKg, onClose }: { date: string; units: Units; startKg: number; onClose: () => void }) {
  const [value, setValue] = useState(displayWeight(startKg, units));
  async function save() {
    const weightKg = toStorageWeightKg(value, units);
    await db.transaction('rw', db.bodyLog, db.profile, async () => {
      // One weigh-in per day: replace today's instead of stacking duplicates.
      const existing = await db.bodyLog.where('date').equals(date).first();
      if (existing?.id != null) await db.bodyLog.update(existing.id, { weightKg, createdAt: new Date().toISOString() });
      else await db.bodyLog.add({ date, weightKg, createdAt: new Date().toISOString() });
      const profile = await db.profile.get('me');
      if (profile) await db.profile.put({ ...profile, weightKg, updatedAt: new Date().toISOString() });
    });
    onClose();
  }
  return (
    <Sheet
      title="Log your weight"
      onClose={onClose}
      footer={
        <Button size="lg" className="w-full" onClick={save}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2">
        <NumberStepper label="Weight" value={value} onChange={setValue} step={units === 'kg' ? 0.1 : 0.2} min={30} max={units === 'kg' ? 300 : 660} suffix={units} />
        <p className="text-center text-sm font-bold text-text-faint">Weigh in the morning, after the bathroom, before eating. Same time each day makes the trend honest.</p>
      </div>
    </Sheet>
  );
}
