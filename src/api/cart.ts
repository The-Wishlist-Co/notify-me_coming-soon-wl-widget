// Adds a variant to the shopper's Shopify cart through the storefront's Ajax
// Cart API (same origin, so no TWC credentials are involved).

// Fired on document after a successful add, so a theme can refresh its cart
// count or mini cart: detail = { productId, variantId, response }.
export const CART_ADDED_EVENT = 'twc-nm:cart-added';

function cartAddUrl(): string {
  const root =
    (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  return `${root.endsWith('/') ? root : `${root}/`}cart/add.js`;
}

// Resolves true when Shopify accepted the item. A sold-out or invalid variant
// comes back as a 422, which resolves false like any other failure.
export async function addToCart(productId: string, variantId: string): Promise<boolean> {
  try {
    const response = await fetch(cartAddUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(variantId), quantity: 1 }] }),
    });
    if (!response.ok) return false;

    const body: unknown = await response.json().catch(() => null);
    document.dispatchEvent(
      new CustomEvent(CART_ADDED_EVENT, {
        bubbles: true,
        detail: { productId, variantId, response: body },
      }),
    );
    return true;
  } catch (error) {
    console.error('notify-me-wl: add to cart failed', error);
    return false;
  }
}
