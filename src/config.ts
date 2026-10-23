// Default tenant for the X-Twc-Tenant header; used in both auth modes.
// Not a credential — override per-merchant via `data-tenant`.
export const TENANT_ID = 'victoria-woods';

// Default Shopify App Proxy app name; forms the `/apps/<name>/...` URL prefix
// used by the 'proxy' auth mode. Override per-merchant via `data-proxy-app`.
export const PROXY_APP_NAME = 'twc-sdk';

// Default TWC API origin (production). Override per-install via `data-api-base`,
// e.g. https://api.au-sandbox.thewishlist.io for a UAT store. The paths below
// are appended to it.
export const DEFAULT_API_BASE = 'https://api.au-aws.thewishlist.io';

// Customer-interest API endpoint
export const CUSTOMER_INTEREST_PATH =
  '/services/wsservice/api/wishlist/items/customerInterest';

// Recommendations API base. The retailer id (same value as the tenant) and the
// URL-encoded customer email are appended as path segments.
export const RECOMMENDATIONS_PATH = '/services/recommendations/api/v1/recommendations';

// Tenant config endpoint. Despite the "public" path it requires the same
// Authorization + X-Twc-Tenant headers as every other TWC call — it returns
// 401 without them.
export const TENANT_CONFIG_PATH = '/services/eventcollector/api/v1/custom/configs/public';
