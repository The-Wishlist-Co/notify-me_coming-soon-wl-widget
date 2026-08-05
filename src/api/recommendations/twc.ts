import type { AuthMode, RecommendedProduct } from '../../types';
import { RECOMMENDATIONS_URL_BASE } from '../../config';
import { resolveAuthToken } from '../../auth/resolve-token';
import { dedupeAndTrim, isRenderable, toNumber, toText } from './normalize';

// Only the fields the widget renders. Everything else the service returns
// (score_breakdown, attributes, sizing, metrics, …) is ignored.
interface RawProduct {
  product_id?: unknown;
  product_ref?: unknown;
  name?: unknown;
  image_url?: unknown;
  product_url?: unknown;
  price?: unknown;
  original_price?: unknown;
}

interface RawRecommendation {
  product?: RawProduct;
  score?: unknown;
}

// The service returns one entry per variant, so a single product shows up
// several times as different colourways. Ask for more than we display so
// deduping still leaves a full row.
const OVER_FETCH_FACTOR = 3;

// The service rejects n > 20 with a 422, so the over-fetch has to be clamped.
const MAX_N = 20;

export function normalizeTwc(
  raw: unknown,
  count: number,
): RecommendedProduct[] {
  const list = raw && (raw as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(list)) return [];

  const entries: { product: RecommendedProduct; score: number }[] = [];

  (list as RawRecommendation[]).forEach((entry) => {
    const rawProduct = entry && entry.product;
    if (!rawProduct) return;

    const name = toText(rawProduct.name);
    const imageUrl = toText(rawProduct.image_url);
    const productUrl = toText(rawProduct.product_url);
    if (!isRenderable({ name, imageUrl, productUrl })) return;

    const ref =
      toText(rawProduct.product_ref) ||
      toText(rawProduct.product_id) ||
      productUrl;

    entries.push({
      score: typeof entry.score === 'number' ? entry.score : 0,
      product: {
        id: toText(rawProduct.product_id) || ref,
        ref,
        name,
        imageUrl,
        productUrl,
        price: toNumber(rawProduct.price) ?? 0,
        originalPrice: toNumber(rawProduct.original_price),
      },
    });
  });

  return dedupeAndTrim(entries, count);
}

// null means the request failed; [] means it succeeded with nothing usable.
// The dispatcher caches only the latter, so a transient failure is retried.
export async function fetchTwcRecommendations(params: {
  email: string;
  tenant: string;
  authMode: AuthMode;
  proxyApp: string;
  count: number;
}): Promise<RecommendedProduct[] | null> {
  const { email, tenant, authMode, proxyApp, count } = params;

  const authToken = await resolveAuthToken(authMode, proxyApp);
  if (!authToken) return null;

  const requested = Math.min(count * OVER_FETCH_FACTOR, MAX_N);
  const url =
    `${RECOMMENDATIONS_URL_BASE}/${encodeURIComponent(tenant)}` +
    `/${encodeURIComponent(email)}?n=${requested}`;

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
      return null;
    }

    const body = await response.json().catch(() => null);
    return normalizeTwc(body, count);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return null;
  }
}
