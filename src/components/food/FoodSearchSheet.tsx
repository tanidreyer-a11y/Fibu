import { ArrowLeft, Barcode, ClockCounterClockwise, MagnifyingGlass, PencilSimpleLine, Sparkle } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db, type MealType } from '../../lib/db';
import type { FoodDraft } from '../../lib/food';
import { estimateFoodText, totals } from '../../lib/foodAi';
import { hitToProduct, scaleToGrams, searchFoods, type FoodHit, type OffProduct } from '../../lib/openFoodFacts';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Sheet } from '../ui/Sheet';
import { FoodResultCard } from './FoodResultCard';

interface FoodSearchSheetProps {
  defaultMeal: MealType;
  onClose: () => void;
  onSave: (draft: FoodDraft, mealType: MealType, source: 'search' | 'manual', confidence: 'exact' | 'estimate') => void;
  onBarcode: () => void;
  onManual: () => void;
}

type Picked = { kind: 'product'; product: OffProduct } | { kind: 'draft'; draft: FoodDraft; estimate: boolean; badge: string };

export function FoodSearchSheet({ defaultMeal, onClose, onSave, onBarcode, onManual }: FoodSearchSheetProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [draft, setDraft] = useState<FoodDraft | null>(null);
  const [grams, setGrams] = useState(100);
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [estimating, setEstimating] = useState(false);

  // Recent foods: one row per name, most recent first. Re-logging a usual meal is two taps.
  const recent = useLiveQuery(async () => {
    const rows = await db.foodLog.orderBy('id').reverse().limit(200).toArray();
    const seen = new Set<string>();
    return rows.filter((r) => {
      const key = r.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const q = query.trim();
  const recentMatches = useMemo(
    () => (recent ?? []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())).slice(0, q ? 5 : 8),
    [recent, q],
  );

  useEffect(() => {
    if (q.length < 3) return;
    const ctrl = new AbortController();
    // Debounced: Open Food Facts asks apps not to fire a search per keystroke.
    const t = window.setTimeout(async () => {
      setSearching(true);
      const result = await searchFoods(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setSearching(false);
      if (result.ok) {
        setHits(result.hits);
        setSearchError('');
      } else setSearchError(result.message);
    }, 450);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [q]);

  function pickProduct(product: OffProduct) {
    const g = product.servingGrams ?? 100;
    setPicked({ kind: 'product', product });
    setGrams(g);
    setDraft({ name: product.brand ? `${product.name} (${product.brand})` : product.name, ...scaleToGrams(product, g) });
  }

  async function askFibu() {
    setEstimating(true);
    const result = await estimateFoodText(q, mealType);
    setEstimating(false);
    if (!result.ok) {
      setSearchError(result.error);
      return;
    }
    const d = totals(result.data);
    setPicked({ kind: 'draft', draft: d, estimate: true, badge: 'Fibu estimate' });
    setDraft(d);
  }

  if (picked && draft) {
    const product = picked.kind === 'product' ? picked.product : null;
    return (
      <Sheet
        title="Log food"
        onClose={onClose}
        tall
        leading={
          <button onClick={() => setPicked(null)} aria-label="Back to search" className="grid h-10 w-10 place-items-center rounded-xl text-text-muted">
            <ArrowLeft size={20} weight="bold" />
          </button>
        }
        footer={
          <Button
            size="lg"
            className="w-full"
            onClick={() => onSave(draft, mealType, 'search', picked.kind === 'draft' && picked.estimate ? 'estimate' : 'exact')}
          >
            Add to {mealType === 'snack' ? 'snacks' : mealType}
          </Button>
        }
      >
        <FoodResultCard
          draft={draft}
          onChange={setDraft}
          mealType={mealType}
          onMealType={setMealType}
          badge={product ? `Per ${Math.round(grams)} g` : picked.kind === 'draft' ? picked.badge : undefined}
        >
          {product && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-extrabold text-text-muted">How much?</span>
              <div className="flex flex-wrap gap-2">
                {[...(product.servingGrams ? [{ l: `1 serving (${product.servingGrams} g)`, g: product.servingGrams }] : []), { l: '100 g', g: 100 }, { l: '50 g', g: 50 }].map((o) => (
                  <Chip
                    key={o.l}
                    active={Math.round(grams) === Math.round(o.g)}
                    onClick={() => {
                      setGrams(o.g);
                      setDraft({ ...draft, ...scaleToGrams(product, o.g) });
                    }}
                  >
                    {o.l}
                  </Chip>
                ))}
              </div>
              <label className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-text-muted">Or exactly</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={String(Math.round(grams))}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    const g = Math.max(0, Math.min(5000, parseFloat(e.target.value) || 0));
                    setGrams(g);
                    setDraft({ ...draft, ...scaleToGrams(product, g) });
                  }}
                  aria-label="Grams"
                  className="tabular h-11 w-24 rounded-xl border-2 border-border-strong bg-bg-raised px-3 text-center text-[16px] font-black text-text outline-none focus:border-accent"
                />
                <span className="text-sm font-extrabold text-text-faint">g</span>
              </label>
            </div>
          )}
        </FoodResultCard>
      </Sheet>
    );
  }

  return (
    <Sheet title="Search food" onClose={onClose} tall>
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-bg-raised px-4 pb-3">
        <label className="relative block">
          <MagnifyingGlass size={18} weight="bold" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. banana, Woolworths yoghurt, 2 eggs"
            aria-label="Search food"
            className="h-12 w-full rounded-xl border-2 border-border-strong bg-bg-raised pr-4 pl-10 text-[15px] font-bold text-text outline-none placeholder:text-text-faint focus:border-accent"
          />
        </label>
        <div className="flex gap-2">
          <button onClick={onBarcode} className="flex items-center gap-1.5 rounded-lg bg-bg-raised-2 px-3 py-2 text-xs font-extrabold text-text-muted">
            <Barcode size={16} weight="bold" /> Scan barcode
          </button>
          <button onClick={onManual} className="flex items-center gap-1.5 rounded-lg bg-bg-raised-2 px-3 py-2 text-xs font-extrabold text-text-muted">
            <PencilSimpleLine size={16} weight="bold" /> Enter numbers
          </button>
        </div>
      </div>

      {q.length >= 3 && (
        <button
          onClick={askFibu}
          disabled={estimating}
          className="press-3d mb-4 flex w-full items-center gap-3 rounded-2xl border-2 border-accent bg-accent-tint p-3 text-left [--ledge-color:var(--color-accent)]"
        >
          <Sparkle size={24} weight="fill" className="shrink-0 text-accent-text" />
          <span className="flex-1">
            <span className="block text-[15px] font-extrabold text-accent-text">{estimating ? 'Fibu is estimating…' : `Ask Fibu to estimate “${q}”`}</span>
            <span className="block text-xs font-bold text-text-muted">Great for home cooking and meals out</span>
          </span>
        </button>
      )}

      {recentMatches.length > 0 && (
        <section className="mb-4">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-extrabold text-text-muted">
            <ClockCounterClockwise size={16} weight="bold" /> Recent
          </h3>
          <ul className="flex flex-col">
            {recentMatches.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => {
                    const d = { name: r.name, calories: r.calories, proteinG: r.proteinG, carbsG: r.carbsG, fatG: r.fatG };
                    setPicked({ kind: 'draft', draft: d, estimate: r.confidence === 'estimate', badge: 'Same as last time' });
                    setDraft(d);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left [@media(hover:hover)]:hover:bg-bg-raised-2"
                >
                  <span className="truncate text-[15px] font-extrabold text-text">{r.name}</span>
                  <span className="tabular shrink-0 text-sm font-bold text-text-faint">{r.calories} kcal</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q.length >= 3 && (
        <section>
          <h3 className="mb-1 text-sm font-extrabold text-text-muted">Products {searching && <span className="font-bold text-text-faint">· searching…</span>}</h3>
          {searchError && <p className="py-2 text-sm font-bold text-danger">{searchError}</p>}
          {!searching && !searchError && hits.length === 0 && <p className="py-2 text-sm font-bold text-text-faint">No packaged products match. Ask Fibu above.</p>}
          <ul className="flex flex-col">
            {hits.map((h) => (
              <li key={h.code}>
                <button
                  onClick={() => pickProduct(hitToProduct(h))}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left [@media(hover:hover)]:hover:bg-bg-raised-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-extrabold text-text">{h.name}</span>
                    <span className="block truncate text-xs font-bold text-text-faint">
                      {h.brand ? `${h.brand} · ` : ''}
                      {h.servingSize ? `serving ${h.servingSize}` : 'per 100 g'}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-sm font-bold text-text-faint">{h.kcal100} kcal/100g</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q.length < 3 && recentMatches.length === 0 && (
        <p className="py-8 text-center text-sm font-bold text-text-faint">Type at least 3 letters. Packaged foods come from Open Food Facts; for anything else, ask Fibu.</p>
      )}
    </Sheet>
  );
}
