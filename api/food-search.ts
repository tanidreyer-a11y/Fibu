// Food text search, proxied because Open Food Facts' search service doesn't allow
// browser cross-origin calls. Returns a compact, nutrition-complete result list.

export interface FoodHit {
  code: string;
  name: string;
  brand?: string;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  servingSize?: string;
  servingGrams?: number;
}

const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity';

interface OffHit {
  code?: string;
  product_name?: string;
  brands?: string[] | string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number>;
}

export async function searchFoods(query: string): Promise<{ status: number; body: { ok: true; hits: FoodHit[] } | { ok: false; error: string } }> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return { status: 400, body: { ok: false, error: 'too_short' } };
  let res: Response;
  try {
    res = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=30&fields=${FIELDS}`, {
      headers: { 'User-Agent': 'Fibu/2.0 (personal fitness app; https://fitnessbuddy-omega.vercel.app)' },
      signal: AbortSignal.timeout(9000),
    });
  } catch {
    return { status: 502, body: { ok: false, error: 'unreachable' } };
  }
  if (!res.ok) return { status: 502, body: { ok: false, error: `upstream_${res.status}` } };
  const json = (await res.json().catch(() => null)) as { hits?: OffHit[] } | null;
  const hits: FoodHit[] = [];
  const seen = new Set<string>();
  for (const h of json?.hits ?? []) {
    const n = h.nutriments ?? {};
    const kcal = n['energy-kcal_100g'] ?? (n['energy-kj_100g'] ? n['energy-kj_100g'] / 4.184 : undefined);
    if (!h.code || !h.product_name || kcal == null) continue;
    // The database holds many near-identical listings of one product; show each once.
    const brandName = Array.isArray(h.brands) ? h.brands[0] : h.brands?.split(',')[0];
    const key = `${h.product_name.trim().toLowerCase()}|${(brandName ?? '').toLowerCase()}|${Math.round(kcal)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const grams = Number(h.serving_quantity);
    hits.push({
      code: h.code,
      name: h.product_name.trim(),
      brand: Array.isArray(h.brands) ? h.brands[0] : h.brands?.split(',')[0],
      kcal100: Math.round(kcal),
      protein100: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
      carbs100: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
      fat100: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
      ...(h.serving_size ? { servingSize: h.serving_size } : {}),
      ...(grams > 0 && grams < 2000 ? { servingGrams: grams } : {}),
    });
    if (hits.length >= 20) break;
  }
  return { status: 200, body: { ok: true, hits } };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') return new Response(null, { status: 405 });
    const site = request.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin') return Response.json({ ok: false, error: 'cross_origin' }, { status: 403 });
    const q = new URL(request.url).searchParams.get('q') ?? '';
    const { status, body } = await searchFoods(q);
    // Product data changes slowly; let the CDN reuse identical searches for an hour.
    return Response.json(body, { status, headers: { 'Cache-Control': status === 200 ? 'public, s-maxage=3600' : 'no-store' } });
  },
};
