import type { RecommendedProduct } from '../types';

export const RECS_SECTION_ID = 'twc-nm-recs';
const RECS_TITLE_ID = 'twc-nm-recs-title';

// Format a price in the storefront's active currency when Shopify exposes it.
// Without a known currency, render a plain number rather than guessing a symbol
// and showing the shopper the wrong one.
function formatPrice(value: number): string {
  const currency =
    window.Shopify && window.Shopify.currency && window.Shopify.currency.active;

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

// Built with DOM APIs rather than innerHTML: every field here is remote data.
function buildCard(product: RecommendedProduct): HTMLAnchorElement {
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
    was.textContent = formatPrice(product.originalPrice);
    price.appendChild(was);
    price.appendChild(document.createTextNode(' '));
  }
  price.appendChild(document.createTextNode(formatPrice(product.price)));
  card.appendChild(price);

  return card;
}

// Build the "Shop similar styles" section. Returns null for an empty list so
// the caller can skip insertion entirely rather than render an empty heading.
export function createRecommendationsSection(
  products: RecommendedProduct[],
): HTMLElement | null {
  if (!products.length) return null;

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
  products.forEach((product) => {
    row.appendChild(buildCard(product));
  });
  section.appendChild(row);

  return section;
}

// Tear the section down on close so reopening does not stack duplicates.
export function removeRecommendationsSection(): void {
  const existing = document.getElementById(RECS_SECTION_ID);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}
