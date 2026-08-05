import type { RecommendedProduct } from '../types';

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

// Built with DOM APIs rather than innerHTML: every field here is remote data.
function buildCard(
  product: RecommendedProduct,
  currency: string | null,
): HTMLAnchorElement {
  const card = document.createElement('a');
  card.className = 'twc-nm-rec';
  card.href = product.productUrl;
  // New tab, so a shopper browsing before submitting does not lose the form.
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

  const imageBox = document.createElement('div');
  imageBox.className = 'twc-nm-rec-imgbox';

  const image = document.createElement('img');
  image.className = 'twc-nm-rec-img';
  image.src = product.imageUrl;
  image.alt = product.name;
  image.loading = 'lazy';
  image.decoding = 'async';
  imageBox.appendChild(image);
  card.appendChild(imageBox);

  const name = document.createElement('span');
  name.className = 'twc-nm-rec-name';
  name.textContent = product.name;
  card.appendChild(name);

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
  card.appendChild(price);

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
): void {
  const row = section.querySelector<HTMLElement>('.twc-nm-recs-row');
  if (!row) return;

  const currency = resolveCurrency(fallbackCurrency);
  const cards = document.createDocumentFragment();
  products.forEach((product) => {
    cards.appendChild(buildCard(product, currency));
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
