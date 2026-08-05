import type { AuthMode, RecommendedProduct } from '../types';
import { RECOMMENDATIONS_URL_BASE } from '../config';
import { resolveAuthToken } from '../auth/resolve-token';

// Only the fields the widget renders. Everything else the service returns
// (score_breakdown, attributes, sizing, metrics, …) is ignored.
interface RawProduct {
  product_id?: string;
  product_ref?: string;
  name?: string;
  image_url?: string | null;
  product_url?: string | null;
  price?: number | null;
  original_price?: number | null;
}

interface RawRecommendation {
  product?: RawProduct;
  score?: number;
}

// The service returns one entry per variant, so a single product shows up
// several times as different colourways. Ask for more than we display so
// deduping still leaves a full row.
const OVER_FETCH_FACTOR = 3;

// Page-session cache, keyed by tenant + email + count. Opening and closing the
// modal must not refetch.
const cache = new Map<string, RecommendedProduct[]>();

// Flatten, drop unrenderable entries, dedupe by product_ref keeping the highest
// score, and trim to `count`. Tolerates any shape — anything unexpected yields
// an empty list rather than throwing.
export function normalizeRecommendations(
  raw: unknown,
  count: number,
): RecommendedProduct[] {
  const list = raw && (raw as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(list)) return [];

  const bestByRef = new Map<
    string,
    { product: RecommendedProduct; score: number }
  >();

  (list as RawRecommendation[]).forEach((entry) => {
    const rawProduct = entry && entry.product;
    if (!rawProduct) return;

    const name =
      typeof rawProduct.name === 'string' ? rawProduct.name.trim() : '';
    const imageUrl =
      typeof rawProduct.image_url === 'string' ? rawProduct.image_url : '';
    const productUrl =
      typeof rawProduct.product_url === 'string' ? rawProduct.product_url : '';
    // A card without any of these cannot be rendered usefully.
    if (!name || !imageUrl || !productUrl) return;

    const ref = String(
      rawProduct.product_ref || rawProduct.product_id || productUrl,
    );
    const score = typeof entry.score === 'number' ? entry.score : 0;

    const existing = bestByRef.get(ref);
    if (existing && existing.score >= score) return;

    bestByRef.set(ref, {
      score,
      product: {
        id: String(rawProduct.product_id || ref),
        ref,
        name,
        imageUrl,
        productUrl,
        price: typeof rawProduct.price === 'number' ? rawProduct.price : 0,
        originalPrice:
          typeof rawProduct.original_price === 'number'
            ? rawProduct.original_price
            : null,
      },
    });
  });

  return Array.from(bestByRef.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((entry) => entry.product);
}

// Fetch recommendations for a customer. Every failure — no auth token, network
// error, non-OK status, unparseable body, unexpected shape — resolves to an
// empty list, because this feature must never disrupt the notify-me flow.
export async function fetchRecommendations(params: {
  email: string;
  tenant: string;
  authMode: AuthMode;
  proxyApp: string;
  count: number;
}): Promise<RecommendedProduct[]> {
  const { email, tenant, authMode, proxyApp, count } = params;

  const cacheKey = `${tenant}|${email}|${count}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const authToken = await resolveAuthToken(authMode, proxyApp);
  if (!authToken) return [];

  const url =
    `${RECOMMENDATIONS_URL_BASE}/${encodeURIComponent(tenant)}` +
    `/${encodeURIComponent(email)}?n=${count * OVER_FETCH_FACTOR}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authToken,
        'X-Twc-Tenant': tenant,
      },
    });
    if (!response.ok) {
      console.error('Recommendations request failed:', response.status);
      return [];
    }

    const body = await response.json().catch(() => null);
    const products = normalizeRecommendations(body, count);
    cache.set(cacheKey, products);
    return products;
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return [];
  }
}
