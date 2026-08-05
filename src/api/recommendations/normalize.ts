import type { RecommendedProduct } from '../../types';

export function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Searchspring returns prices as strings in some feeds; TWC returns numbers.
// Null means "no usable number", which callers turn into 0 or omit.
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

// A card without all three cannot be rendered usefully.
export function isRenderable(product: {
  name: string;
  imageUrl: string;
  productUrl: string;
}): boolean {
  return Boolean(product.name && product.imageUrl && product.productUrl);
}

// Dedupe by ref keeping the highest score, then trim to `count`. Load-bearing
// for TWC, which returns one entry per variant; for Athos it is a guard against
// a malformed feed repeating a product.
export function dedupeAndTrim(
  entries: { product: RecommendedProduct; score: number }[],
  count: number,
): RecommendedProduct[] {
  const bestByRef = new Map<
    string,
    { product: RecommendedProduct; score: number }
  >();

  entries.forEach((entry) => {
    const existing = bestByRef.get(entry.product.ref);
    if (existing && existing.score >= entry.score) return;
    bestByRef.set(entry.product.ref, entry);
  });

  return Array.from(bestByRef.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((entry) => entry.product);
}
