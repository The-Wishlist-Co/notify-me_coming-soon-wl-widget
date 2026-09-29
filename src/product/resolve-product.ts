import type { Product } from '../types';

const PRODUCT_ATTR = 'data-twc-product';

// 'card' — from the trigger's product container on a PLP (or any listing).
// 'page' — window.currentProduct, the PDP's own product. Only a page product
// consults page variant state (URL, product form), so PDP state never leaks
// into a card.
export type ProductSource = 'card' | 'page';

export type ProductResolution =
  | { ok: true; product: Product; source: ProductSource }
  | { ok: false };

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    (typeof p.id === 'number' || typeof p.id === 'string') &&
    typeof p.title === 'string' &&
    (p.variants === undefined || Array.isArray(p.variants))
  );
}

// The trigger's closest [data-twc-product] wins; without one, the page product.
// A container whose JSON is broken is an error, not a cue to fall back — opening
// the page product from a PLP card would register interest in the wrong item.
export function resolveProduct(trigger: Element | null): ProductResolution {
  const card = trigger ? trigger.closest(`[${PRODUCT_ATTR}]`) : null;
  if (card) {
    try {
      const parsed: unknown = JSON.parse(card.getAttribute(PRODUCT_ATTR) || '');
      if (isProduct(parsed)) return { ok: true, product: parsed, source: 'card' };
    } catch {
      // Reported below.
    }
    console.error(`notify-me-wl: invalid ${PRODUCT_ATTR} JSON on`, card);
    return { ok: false };
  }

  const page = window.currentProduct;
  if (isProduct(page)) return { ok: true, product: page, source: 'page' };
  return { ok: false };
}
