// Session-cached access token obtained from the Shopify App Proxy (proxy auth mode).
let cachedProxyToken: string | null = null;

// Fetch a tenant-scoped access token from the Shopify App Proxy.
// `proxyApp` is the merchant's App Proxy subpath, forming the `/apps/<name>/...`
// URL prefix. The path is relative/same-origin, so Shopify's App Proxy layer
// appends and signs `shop`, `logged_in_customer_id`, `timestamp`, and `signature`.
// Returns the access token string, or null on failure (e.g. customer not logged in).
export async function getProxyAccessToken(
  proxyApp: string,
): Promise<string | null> {
  if (cachedProxyToken) return cachedProxyToken;
  try {
    const response = await fetch(`/apps/${proxyApp}/auth/token`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const body = await response.json().catch(() => null);
    if (
      response.ok &&
      body &&
      body.success &&
      body.data &&
      body.data.access_token
    ) {
      cachedProxyToken = body.data.access_token;
      return cachedProxyToken;
    }
    return null;
  } catch (error) {
    console.error('Error fetching proxy access token:', error);
    return null;
  }
}
