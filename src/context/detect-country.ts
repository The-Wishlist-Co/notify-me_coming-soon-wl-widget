import type { CountryContext } from '../types';

// Detect country/province/market context using priority fallback chain.
export function detectCountryContext(): CountryContext {
  const ctx: CountryContext = {
    countryCode: null,
    provinceCode: null,
    marketId: null,
  };

  // Priority 1: Shopify localization/country context
  const shopify = window.Shopify;
  if (shopify) {
    if (typeof shopify.country === 'string') ctx.countryCode = shopify.country;
    const mkt = shopify.markets?.currentMarket;
    if (mkt) {
      if (mkt.countryCode) ctx.countryCode = mkt.countryCode;
      if (mkt.id != null) ctx.marketId = String(mkt.id);
    }
    if (!ctx.countryCode && typeof shopify.locale === 'string') {
      const parts = shopify.locale.split('-');
      if (parts.length > 1) ctx.countryCode = parts[parts.length - 1].toUpperCase();
    }
  }

  // Priority 2: Existing customer shipping country
  if (!ctx.countryCode || !ctx.provinceCode) {
    const addr = window.customer?.default_address;
    if (addr) {
      if (!ctx.countryCode && addr.country_code) ctx.countryCode = addr.country_code;
      if (!ctx.provinceCode && addr.province_code) ctx.provinceCode = addr.province_code;
    }
  }

  // Priority 3: Browser locale fallback
  if (!ctx.countryCode) {
    const parts = (navigator.language || '').split('-');
    if (parts.length > 1) ctx.countryCode = parts[parts.length - 1].toUpperCase();
  }

  return ctx;
}
