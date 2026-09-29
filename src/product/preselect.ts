import type { Product, Variant } from '../types';

// Sizes offered in the widget: out-of-stock variants only. A variant with no
// `available` field is kept, because legacy PDP installs pre-filter
// window.currentProduct in Liquid and omit it. Malformed entries are dropped.
export function listedVariants(product: Product): Variant[] {
  return (product.variants || []).filter(
    (v) =>
      !!v &&
      (typeof v.id === 'number' || typeof v.id === 'string') &&
      typeof v.title === 'string' &&
      v.available !== true,
  );
}

// PDP variant state at open time, in priority order: ?variant= in the URL, then
// the product form's variant <select>. A hidden input[name="id"] is deliberately
// not read — stfrock's installments form carries one that does not follow the
// variant picker.
export function readPageVariantIds(): Array<string | null> {
  const fromUrl = new URLSearchParams(window.location.search).get('variant');
  const select = document.querySelector<HTMLSelectElement>(
    'form[action*="/cart/add"] select[name="id"]',
  );
  return [fromUrl, select ? select.value : null];
}

// The first candidate that is one of the listed sizes wins. With none, a lone
// listed size is pre-selected. Null leaves the "Select a size" placeholder.
export function pickPreselectedVariant(
  listed: Variant[],
  candidates: Array<string | null>,
): string | null {
  const ids = listed.map((v) => String(v.id));
  for (const candidate of candidates) {
    const id = candidate ? candidate.trim() : '';
    if (id && ids.includes(id)) return id;
  }
  return ids.length === 1 ? ids[0] : null;
}
