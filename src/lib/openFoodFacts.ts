import type { FoodHit } from '../../api/food-search';
import type { FoodDraft } from './food';

export type { FoodHit };

export interface OffProduct {
  code: string;
  name: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  /** label text like "1 bar (40 g)" */
  servingSize?: string;
  servingGrams?: number;
}

export type LookupError = 'offline' | 'network' | 'not_found' | 'no_nutrition' | 'server';
export type OffResult = { ok: true; data: OffProduct } | { ok: false; error: LookupError; message: string };

const MESSAGES: Record<LookupError, string> = {
  offline: "You're offline, so I can't look the barcode up. Log it by hand or try again with signal.",
  network: "Couldn't reach the food database. Check your signal and try again.",
  not_found: "This barcode isn't in the open food database yet.",
  no_nutrition: 'Found the product, but it has no nutrition info listed.',
  server: 'The food database had a problem. Try again in a moment.',
};

/** Free, keyless barcode -> nutrition lookup (Open Food Facts allows browser calls for products). */
export async function lookupBarcode(barcode: string): Promise<OffResult> {
  const fail = (error: LookupError): OffResult => ({ ok: false, error, message: MESSAGES[error] });
  if (navigator.onLine === false) return fail('offline');
  let res: Response;
  try {
    res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,generic_name,brands,nutriments,serving_size,serving_quantity`,
      { signal: AbortSignal.timeout(12000) },
    );
  } catch {
    return fail('network');
  }
  if (res.status === 404) return fail('not_found');
  if (!res.ok) return fail('server');

  const json = await res.json().catch(() => null);
  if (!json || json.status !== 1 || !json.product) return fail('not_found');
  const p = json.product;
  const n = p.nutriments ?? {};
  const calories = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : undefined);
  if (calories == null) return fail('no_nutrition');
  const grams = Number(p.serving_quantity);

  return {
    ok: true,
    data: {
      code: barcode,
      name: (p.product_name || p.generic_name || 'Unknown product').trim(),
      brand: typeof p.brands === 'string' ? p.brands.split(',')[0]?.trim() : undefined,
      caloriesPer100g: Math.round(calories),
      proteinPer100g: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
      carbsPer100g: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
      fatPer100g: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
      servingSize: p.serving_size || undefined,
      servingGrams: grams > 0 && grams < 2000 ? grams : undefined,
    },
  };
}

export function hitToProduct(h: FoodHit): OffProduct {
  return {
    code: h.code,
    name: h.name,
    brand: h.brand,
    caloriesPer100g: h.kcal100,
    proteinPer100g: h.protein100,
    carbsPer100g: h.carbs100,
    fatPer100g: h.fat100,
    servingSize: h.servingSize,
    servingGrams: h.servingGrams,
  };
}

export function scaleToGrams(product: OffProduct, grams: number): Omit<FoodDraft, 'name'> {
  const factor = grams / 100;
  return {
    calories: Math.round(product.caloriesPer100g * factor),
    proteinG: Math.round(product.proteinPer100g * factor * 10) / 10,
    carbsG: Math.round(product.carbsPer100g * factor * 10) / 10,
    fatG: Math.round(product.fatPer100g * factor * 10) / 10,
  };
}

export async function searchFoods(query: string, signal?: AbortSignal): Promise<{ ok: true; hits: FoodHit[] } | { ok: false; message: string }> {
  if (navigator.onLine === false) return { ok: false, message: "You're offline. Recent foods still work below." };
  try {
    const res = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`, { signal });
    const body = await res.json();
    if (!body.ok) return { ok: false, message: 'Search is having a moment. Try again, or ask Fibu to estimate it.' };
    return { ok: true, hits: body.hits as FoodHit[] };
  } catch (err) {
    if ((err as Error).name === 'AbortError') return { ok: true, hits: [] };
    return { ok: false, message: "Couldn't reach food search. Check your signal." };
  }
}
