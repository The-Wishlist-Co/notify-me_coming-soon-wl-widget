import type { LocalizationContext } from '../types';

// gid://shopify/Market/12345 -> "12345"; a bare "12345" passes through.
// Anything that is not all digits after the last "/" is treated as absent, which
// also catches an unrendered "{{ localization.market.id }}" and the empty string
// Liquid renders when the storefront has no market configured.
export function normalizeMarketId(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const tail = value.split('?')[0].split('/').pop() ?? '';
  return /^\d+$/.test(tail) ? tail : null;
}

// Shopify market handles are lowercase alphanumeric with hyphens. Reject
// anything else rather than forwarding an unrendered Liquid tag to the API.
function normalizeMarketHandle(raw: string | null): string | null {
  const value = (raw ?? '').trim();
  return /^[a-z0-9_-]+$/i.test(value) ? value : null;
}

// Two-letter ISO country code, upper-cased.
function normalizeCountryCode(raw: string | null): string | null {
  const value = (raw ?? '').trim();
  return /^[a-z]{2}$/i.test(value) ? value.toUpperCase() : null;
}

// Resolve where the shopper is browsing. Liquid-rendered data-* attributes on
// the open button take priority; everything below them is the pre-existing
// runtime detection chain, unchanged.
export function resolveLocalization(button: HTMLElement): LocalizationContext {
  const ctx: LocalizationContext = {
    countryCode: normalizeCountryCode(button.getAttribute('data-country-code')),
    provinceCode: null,
    marketId: normalizeMarketId(button.getAttribute('data-market-id')),
    // No window.Shopify field exposes the handle, so the attribute is the only
    // source. A theme that does not render it simply reports no handle.
    marketHandle: normalizeMarketHandle(button.getAttribute('data-market-handle')),
  };

  // Priority 2: Shopify localization/country context. The market is consulted
  // before window.Shopify.country — the old code assigned country first and let
  // the market overwrite it, so this guarded order preserves that outcome.
  const shopify = window.Shopify;
  if (shopify) {
    const mkt = shopify.markets?.currentMarket;
    if (mkt) {
      if (!ctx.countryCode && mkt.countryCode) ctx.countryCode = mkt.countryCode;
      // Normalised too — window.Shopify is not a documented API and has been
      // seen carrying the full GID.
      if (!ctx.marketId) ctx.marketId = normalizeMarketId(String(mkt.id ?? ''));
    }
    if (!ctx.countryCode && typeof shopify.country === 'string') {
      ctx.countryCode = shopify.country;
    }
    if (!ctx.countryCode && typeof shopify.locale === 'string') {
      const parts = shopify.locale.split('-');
      if (parts.length > 1) ctx.countryCode = parts[parts.length - 1].toUpperCase();
    }
  }

  // Priority 3: Existing customer shipping address.
  if (!ctx.countryCode || !ctx.provinceCode) {
    const addr = window.customer?.default_address;
    if (addr) {
      if (!ctx.countryCode && addr.country_code) ctx.countryCode = addr.country_code;
      if (!ctx.provinceCode && addr.province_code) ctx.provinceCode = addr.province_code;
    }
  }

  // Priority 4: Browser locale fallback.
  if (!ctx.countryCode) {
    const parts = (navigator.language || '').split('-');
    if (parts.length > 1) ctx.countryCode = parts[parts.length - 1].toUpperCase();
  }

  return ctx;
}
