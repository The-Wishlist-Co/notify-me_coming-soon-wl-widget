import type { RecommendedProduct } from '../types';
import type { ResolvedCopy } from './copy';
import { addToCart } from '../api/cart';

export interface RecommendationsOptions {
  // Links open in a new tab (default) or this one.
  newTab: boolean;
  // Size buttons that add to the Shopify cart, for products with variant data.
  addToCart: boolean;
  copy: Pick<ResolvedCopy, 'addToCart' | 'addedToCart' | 'addToCartError'>;
}

// How long "Added to cart" or an error stays under the card.
const STATUS_MS = 3000;

export const RECS_SECTION_ID = 'twc-nm-recs';
const RECS_TITLE_ID = 'twc-nm-recs-title';

// The storefront's active currency, falling back to the merchant-configured
// `data-currency`. Shopify themes expose window.Shopify.currency.active; that
// reflects the shopper's market, so it wins over the static attribute.
function resolveCurrency(fallback: string | null): string | null {
  const active =
    window.Shopify && window.Shopify.currency && window.Shopify.currency.active;
  return active || fallback || null;
}

// Format a price in the resolved currency. With no currency known, render a
// plain number rather than guessing a symbol — showing A$ on a GBP price is
// worse than showing none.
function formatPrice(value: number, currency: string | null): string {
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
      }).format(value);
    } catch (error) {
      // Unrecognised currency code — fall through to the plain format.
    }
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// How far the pointer must travel before a press counts as a drag rather than a
// click. Below this the row does not move and the card link opens normally.
const DRAG_THRESHOLD_PX = 5;

// Click-and-drag scrolling for the row.
//
// Mouse only, deliberately: touch devices already pan the row natively through
// `overflow-x: auto`, so intercepting touch would replace working behaviour
// with a worse imitation. The cards are links, so a completed drag has to
// swallow the click it is about to produce, or dragging opens a product page.
function attachDragScroll(row: HTMLElement): void {
  let startX = 0;
  let startScroll = 0;
  let dragging = false;
  let moved = false;
  let suppressClick = false;

  row.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    dragging = true;
    moved = false;
    // Clear any flag left over from a drag whose click never arrived, so it
    // cannot swallow an unrelated click later.
    suppressClick = false;
    startX = event.clientX;
    startScroll = row.scrollLeft;
    row.classList.add('twc-nm-recs-row--dragging');
  });

  row.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const delta = event.clientX - startX;
    if (!moved && Math.abs(delta) < DRAG_THRESHOLD_PX) return;
    moved = true;
    row.scrollLeft = startScroll - delta;
    // Keep the browser from starting a native selection drag mid-scroll.
    event.preventDefault();
  });

  const endDrag = (): void => {
    if (!dragging) return;
    dragging = false;
    suppressClick = moved;
    row.classList.remove('twc-nm-recs-row--dragging');
  };

  row.addEventListener('pointerup', endDrag);
  row.addEventListener('pointercancel', endDrag);
  row.addEventListener('pointerleave', endDrag);

  // Capture phase, so the card link never sees the click that ended a drag.
  row.addEventListener(
    'click',
    (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  // Dragging from a product image would otherwise become a native image drag.
  row.addEventListener('dragstart', (event) => {
    if (dragging && moved) event.preventDefault();
  });
}

// The section shell — heading plus an empty row. Shared by the loading and
// loaded states so filling in products never moves anything.
function buildShell(): { section: HTMLElement; row: HTMLElement } {
  const section = document.createElement('section');
  section.id = RECS_SECTION_ID;
  section.className = 'twc-nm-recs';
  section.setAttribute('aria-labelledby', RECS_TITLE_ID);

  const title = document.createElement('h3');
  title.id = RECS_TITLE_ID;
  title.className = 'twc-nm-recs-title';
  title.textContent = 'Shop similar styles';
  section.appendChild(title);

  const row = document.createElement('div');
  row.className = 'twc-nm-recs-row';
  attachDragScroll(row);
  section.appendChild(row);

  return { section, row };
}

function buildSkeletonCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'twc-nm-rec twc-nm-rec--skeleton';
  // Placeholder geometry carries no information for a screen reader.
  card.setAttribute('aria-hidden', 'true');

  const imageBox = document.createElement('div');
  imageBox.className = 'twc-nm-rec-imgbox twc-nm-skel';
  card.appendChild(imageBox);

  const nameLine = document.createElement('span');
  nameLine.className = 'twc-nm-skel twc-nm-skel-line';
  card.appendChild(nameLine);

  const priceLine = document.createElement('span');
  priceLine.className = 'twc-nm-skel twc-nm-skel-line twc-nm-skel-line--short';
  card.appendChild(priceLine);

  return card;
}

// Image, name and price: the part of a card that links to the product.
// Built with DOM APIs rather than innerHTML: every field here is remote data.
function fillCardBody(
  target: HTMLElement,
  product: RecommendedProduct,
  currency: string | null,
): void {
  const imageBox = document.createElement('div');
  imageBox.className = 'twc-nm-rec-imgbox';

  const image = document.createElement('img');
  image.className = 'twc-nm-rec-img';
  image.src = product.imageUrl;
  image.alt = product.name;
  image.loading = 'lazy';
  image.decoding = 'async';
  imageBox.appendChild(image);
  target.appendChild(imageBox);

  const name = document.createElement('span');
  name.className = 'twc-nm-rec-name';
  name.textContent = product.name;
  target.appendChild(name);

  const price = document.createElement('span');
  price.className = 'twc-nm-rec-price';
  if (product.originalPrice !== null && product.originalPrice > product.price) {
    const was = document.createElement('s');
    was.className = 'twc-nm-rec-was';
    was.textContent = formatPrice(product.originalPrice, currency);
    price.appendChild(was);
    price.appendChild(document.createTextNode(' '));
  }
  price.appendChild(document.createTextNode(formatPrice(product.price, currency)));
  target.appendChild(price);
}

function buildLink(product: RecommendedProduct, newTab: boolean): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = product.productUrl;
  if (newTab) {
    // New tab, so a shopper browsing before submitting does not lose the form.
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  return link;
}

// One button per size, sold-out sizes disabled. A product whose only variant
// is Shopify's "Default Title" gets a single add-to-cart button instead.
function buildSizes(
  product: RecommendedProduct,
  options: RecommendationsOptions,
  status: HTMLElement,
): HTMLElement {
  const variants = product.variants || [];
  const sizes = document.createElement('div');
  sizes.className = 'twc-nm-rec-sizes';
  const single = variants.length === 1 && variants[0].title === 'Default Title';
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  const show = (message: string, kind: 'ok' | 'error'): void => {
    status.textContent = message;
    status.className = `twc-nm-rec-status twc-nm-rec-status--${kind}`;
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      status.textContent = '';
      status.className = 'twc-nm-rec-status';
    }, STATUS_MS);
  };

  variants.forEach((variant) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'twc-nm-rec-size';
    button.textContent = single ? options.copy.addToCart : variant.title;
    button.disabled = !variant.available;
    if (!single) {
      button.setAttribute('aria-label', `${options.copy.addToCart}: ${product.name}, ${variant.title}`);
    }
    button.addEventListener('click', async () => {
      const buttons = Array.from(sizes.querySelectorAll<HTMLButtonElement>('button'));
      const wasDisabled = buttons.map((b) => b.disabled);
      buttons.forEach((b) => {
        b.disabled = true;
      });
      button.classList.add('twc-nm-rec-size--busy');
      const ok = await addToCart(product.id, variant.id);
      button.classList.remove('twc-nm-rec-size--busy');
      buttons.forEach((b, i) => {
        b.disabled = wasDisabled[i];
      });
      show(ok ? options.copy.addedToCart : options.copy.addToCartError, ok ? 'ok' : 'error');
    });
    sizes.appendChild(button);
  });
  return sizes;
}

function buildCard(
  product: RecommendedProduct,
  currency: string | null,
  options: RecommendationsOptions,
): HTMLElement {
  if (!options.addToCart || !product.variants || !product.variants.length) {
    const card = buildLink(product, options.newTab);
    card.className = 'twc-nm-rec';
    fillCardBody(card, product, currency);
    return card;
  }

  // Buttons cannot sit inside a link, so a shoppable card is a container: the
  // link (image, name, price), then the sizes and a status line.
  const card = document.createElement('div');
  card.className = 'twc-nm-rec twc-nm-rec--shop';
  const link = buildLink(product, options.newTab);
  link.className = 'twc-nm-rec-link';
  fillCardBody(link, product, currency);
  card.appendChild(link);

  const status = document.createElement('span');
  status.className = 'twc-nm-rec-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  card.appendChild(buildSizes(product, options, status));
  card.appendChild(status);
  return card;
}

// Build the loading state: the real section shell with `count` placeholder
// cards. Inserted before the request goes out so the shopper sees the section
// reserve its space immediately instead of the modal jumping when data lands.
export function createRecommendationsSkeleton(count: number): HTMLElement {
  const { section, row } = buildShell();
  section.classList.add('twc-nm-recs--loading');
  section.setAttribute('aria-busy', 'true');

  for (let i = 0; i < count; i++) {
    row.appendChild(buildSkeletonCard());
  }

  return section;
}

// Swap the placeholders for real products, in place.
export function fillRecommendationsSection(
  section: HTMLElement,
  products: RecommendedProduct[],
  fallbackCurrency: string | null,
  options: RecommendationsOptions,
): void {
  const row = section.querySelector<HTMLElement>('.twc-nm-recs-row');
  if (!row) return;

  const currency = resolveCurrency(fallbackCurrency);
  const cards = document.createDocumentFragment();
  products.forEach((product) => {
    cards.appendChild(buildCard(product, currency, options));
  });

  row.textContent = '';
  row.appendChild(cards);

  section.classList.remove('twc-nm-recs--loading');
  section.removeAttribute('aria-busy');
}

// Tear the section down on close so reopening does not stack duplicates.
export function removeRecommendationsSection(): void {
  const existing = document.getElementById(RECS_SECTION_ID);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}
