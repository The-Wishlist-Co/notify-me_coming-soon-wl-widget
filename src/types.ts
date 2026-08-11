export interface Variant {
  id: number | string;
  title: string;
}

export interface Product {
  id: number | string;
  title: string;
  variants?: Variant[];
}

// A recommendation flattened to just what the widget renders. Built from the
// service's nested `{ product: { … }, score, … }` entries.
export interface RecommendedProduct {
  id: string;
  // The service returns one entry per variant, so several entries can share a
  // product_ref. This is what deduping keys on.
  ref: string;
  name: string;
  imageUrl: string;
  productUrl: string;
  price: number;
  originalPrice: number | null;
}

// Everything the widget knows about where the shopper is browsing. Sourced from
// Liquid-rendered data-* attributes first, then runtime detection.
export interface LocalizationContext {
  countryCode: string | null;
  provinceCode: string | null;
  // Numeric portion only, never the full gid://shopify/Market/... string.
  marketId: string | null;
  marketHandle: string | null;
}

export type AuthMode = 'token' | 'proxy';

export type WidgetType = 'notify-me' | 'coming-soon';

// How the widget presents itself: a centred modal (default) or a panel that
// slides in from the right edge. Both are blocking — same backdrop, scroll
// lock, and close behaviour — so only the geometry differs.
export type DisplayMode = 'modal' | 'panel';

export type EngineName = 'TWC' | 'ATHOS';

// Which recommendations engine a tenant uses, read from the remote config's
// websiteRecommendations field. Callers treat a null EngineConfig as "this
// tenant has no engine configured — render no section at all".
export type EngineConfig =
  | { engine: 'TWC' }
  | { engine: 'ATHOS'; siteIdentifier: string; profileTag: string };

export type FieldName =
  | 'email'
  | 'mobile'
  | 'firstName'
  | 'lastName'
  | 'countryCode'
  | 'provinceCode';

export interface WidgetConfig {
  fields: FieldName[];
  type: WidgetType;
  display: DisplayMode;
  authMode: AuthMode;
  tenant: string;
  // Shopify App Proxy app name; forms the `/apps/<name>/...` URL prefix used by
  // the 'proxy' auth mode.
  proxyApp: string;
  // "Shop similar styles" section.
  recommendationsEnabled: boolean;
  recommendationsCount: number;
  // Fallback ISO currency code for prices, used when the storefront does not
  // expose window.Shopify.currency.active. Null renders bare numbers.
  currency: string | null;
  // Email resolved at init (attribute or Shopify context). Null for guests, who
  // fall back to the email they submit through the form.
  customerEmail: string | null;
}
