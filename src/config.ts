// Default tenant for the X-Twc-Tenant header; used in both auth modes.
// Not a credential — override per-merchant via `data-tenant`.
export const TENANT_ID = 'victoria-woods';

// Default Shopify App Proxy app name; forms the `/apps/<name>/...` URL prefix
// used by the 'proxy' auth mode. Override per-merchant via `data-proxy-app`.
export const PROXY_APP_NAME = 'twc-sdk';

// Customer-interest API endpoint
export const CUSTOMER_INTEREST_URL =
  'https://api.au-aws.thewishlist.io/services/wsservice/api/wishlist/items/customerInterest';

// Recommendations API base. The retailer id (same value as the tenant) and the
// URL-encoded customer email are appended as path segments.
export const RECOMMENDATIONS_URL_BASE =
  'https://api.au-aws.thewishlist.io/services/recommendations/api/v1/recommendations';

// Tenant config endpoint. Despite the "public" path it requires the same
// Authorization + X-Twc-Tenant headers as every other TWC call — it returns
// 401 without them.
export const TENANT_CONFIG_URL =
  'https://api.au-aws.thewishlist.io/services/eventcollector/api/v1/custom/configs/public';
