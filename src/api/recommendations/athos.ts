import type { RecommendedProduct } from '../../types';
import { dedupeAndTrim, isRenderable, toNumber, toText } from './normalize';

// Searchspring nests the renderable fields under mappings.core.
interface RawCore {
  uid?: unknown;
  sku?: unknown;
  name?: unknown;
  price?: unknown;
  msrp?: unknown;
  imageUrl?: unknown;
  thumbnailImageUrl?: unknown;
  url?: unknown;
}

interface RawResult {
  mappings?: { core?: RawCore };
}

export function normalizeAthos(
  raw: unknown,
  count: number,
): RecommendedProduct[] {
  // Searchspring returns an array of profile objects when several tags are
  // requested, and a single object when one is. Accept both.
  const root = Array.isArray(raw) ? raw[0] : raw;
  const list = root && (root as { results?: unknown }).results;
  if (!Array.isArray(list)) return [];

  const entries: { product: RecommendedProduct; score: number }[] = [];

  (list as RawResult[]).forEach((result, index) => {
    const core = result && result.mappings && result.mappings.core;
    if (!core) return;

    const name = toText(core.name);
    const imageUrl = toText(core.imageUrl) || toText(core.thumbnailImageUrl);
    const productUrl = toText(core.url);
    if (!isRenderable({ name, imageUrl, productUrl })) return;

    const ref = toText(core.uid) || toText(core.sku) || productUrl;
    const price = toNumber(core.price) ?? 0;
    const msrp = toNumber(core.msrp);

    entries.push({
      // Searchspring returns results already ranked, so synthesise a
      // descending score from the position to preserve that order.
      score: list.length - index,
      product: {
        id: toText(core.uid) || ref,
        ref,
        name,
        imageUrl,
        productUrl,
        price,
        originalPrice: msrp !== null && msrp > price ? msrp : null,
      },
    });
  });

  return dedupeAndTrim(entries, count);
}

// null means the request failed; [] means it succeeded with nothing usable.
// Unlike TWC there is no over-fetch — Searchspring returns products rather than
// variants, so there are no duplicates for deduping to absorb.
export async function fetchAthosRecommendations(params: {
  engine: { siteIdentifier: string; profileTag: string };
  email: string;
  count: number;
  productId: string | null;
}): Promise<RecommendedProduct[] | null> {
  const { engine, email, count, productId } = params;
  const site = encodeURIComponent(engine.siteIdentifier);

  const query = [
    `tags=${encodeURIComponent(engine.profileTag)}`,
    `limits=${count}`,
  ];
  if (productId) query.push(`products=${encodeURIComponent(productId)}`);
  if (email) query.push(`shopper=${encodeURIComponent(email)}`);

  const url =
    `https://${site}.a.searchspring.io/boost/${site}/recommend?` +
    query.join('&');

  try {
    // Deliberately no Authorization and no X-Twc-Tenant header: Searchspring is
    // a third-party host and must never receive a tenant-scoped TWC token.
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      console.error('Athos recommendations request failed:', response.status);
      return null;
    }

    const body = await response.json().catch(() => null);
    return normalizeAthos(body, count);
  } catch (error) {
    console.error('Error fetching Athos recommendations:', error);
    return null;
  }
}
