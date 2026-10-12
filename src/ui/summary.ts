import type { Product, Variant } from '../types';

// Only web URLs reach img.src; anything else (javascript:, data:, a bare path)
// is treated as no image.
export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  return /^(https?:)?\/\//i.test(url) ? url : null;
}

// Theme-supplied fields of the wrong type are treated as absent.
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function createSummary(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'twc-nm-summary';
  root.innerHTML =
    '<div class="twc-nm-summary-image"><img alt="" /></div>' +
    '<div class="twc-nm-summary-info">' +
    '<p class="twc-nm-summary-name"></p>' +
    '<p class="twc-nm-summary-variant"></p>' +
    '<p class="twc-nm-summary-price"><span class="twc-nm-summary-now"></span> <s class="twc-nm-summary-compare"></s></p>' +
    '</div>';
  return root;
}

// Show the selected variant, or the product itself while no size is chosen.
// Every part is rewritten on every call, so nothing from a previous product or
// size survives.
export function updateSummary(
  root: HTMLElement,
  product: Product,
  variant: Variant | null,
  listed: Variant[],
): void {
  const part = <T extends HTMLElement = HTMLElement>(selector: string): T =>
    root.querySelector<T>(selector)!;

  const imageBox = part('.twc-nm-summary-image');
  const image = part<HTMLImageElement>('.twc-nm-summary-image img');
  const imageUrl = (variant && safeImageUrl(variant.image)) || safeImageUrl(product.image);
  if (imageUrl) {
    image.src = imageUrl;
    image.alt = product.title;
  } else {
    image.removeAttribute('src');
  }
  imageBox.hidden = !imageUrl;

  part('.twc-nm-summary-name').textContent = product.title;

  const variantLine = part('.twc-nm-summary-variant');
  variantLine.textContent = variant ? variant.title : '';
  variantLine.hidden = !variant;

  let now = '';
  let was = '';
  if (variant) {
    now = text(variant.price);
    was = text(variant.compareAtPrice);
  } else {
    // No size chosen: a price is only meaningful when every size shares it.
    // The same goes for the was price, so a sale shows before a size is picked.
    const shared = (values: string[]): string =>
      values.length && values[0] && values.every((p) => p === values[0]) ? values[0] : '';
    now = shared(listed.map((v) => text(v.price)));
    if (now) was = shared(listed.map((v) => text(v.compareAtPrice)));
  }
  if (was === now) was = '';

  part('.twc-nm-summary-now').textContent = now;
  const compare = part('.twc-nm-summary-compare');
  compare.textContent = was;
  compare.hidden = !was;
  part('.twc-nm-summary-price').hidden = !now;
}
