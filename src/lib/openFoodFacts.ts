export interface OffProduct {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

export type OffResult = { ok: true; data: OffProduct } | { ok: false; error: string };

/** Free, keyless barcode -> nutrition lookup. No API key needed, per the design plan. */
export async function lookupBarcode(barcode: string): Promise<OffResult> {
  let res: Response;
  try {
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
  } catch {
    return { ok: false, error: 'Could not reach the food database — check your connection.' };
  }

  if (!res.ok) return { ok: false, error: `Lookup failed (${res.status}).` };

  const json = await res.json();
  if (json.status !== 1 || !json.product) {
    return { ok: false, error: "No match for that barcode — log it manually instead." };
  }

  const n = json.product.nutriments ?? {};
  const calories = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : undefined);
  if (calories == null) {
    return { ok: false, error: "Found the product but it's missing nutrition data — log it manually." };
  }

  return {
    ok: true,
    data: {
      name: json.product.product_name || json.product.generic_name || 'Unknown product',
      caloriesPer100g: Math.round(calories),
      proteinPer100g: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
      carbsPer100g: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
      fatPer100g: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
    },
  };
}

export function scaleToGrams(product: OffProduct, grams: number) {
  const factor = grams / 100;
  return {
    calories: Math.round(product.caloriesPer100g * factor),
    proteinG: Math.round(product.proteinPer100g * factor * 10) / 10,
    carbsG: Math.round(product.carbsPer100g * factor * 10) / 10,
    fatG: Math.round(product.fatPer100g * factor * 10) / 10,
  };
}
