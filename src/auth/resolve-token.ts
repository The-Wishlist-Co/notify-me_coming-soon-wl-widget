import type { AuthConfig } from '../types';
import { getProxyAccessToken } from './proxy-token';

// Resolve the Authorization header value for the configured auth mode.
//
// 'proxy' asks the Shopify App Proxy for a tenant-scoped token, which only
// succeeds for a logged-in customer. 'token' uses a token the merchant supplies
// explicitly (`data-access-token` or `window.TWC_ACCESS_TOKEN`) — the widget
// bundles no credential of its own, so an unconfigured 'token' install resolves
// to null rather than falling back to a shared secret.
//
// Null means no token could be obtained. Callers decide what that means for
// them: customer-interest surfaces it as an auth error, recommendations
// silently render nothing.
export async function resolveAuthToken(
  auth: AuthConfig,
): Promise<string | null> {
  if (auth.mode === 'proxy') {
    const proxyToken = await getProxyAccessToken(auth.proxyApp);
    return proxyToken ? `Bearer ${proxyToken}` : null;
  }

  if (!auth.accessToken) {
    console.error(
      'notify-me-wl: data-auth="token" requires an access token. Set ' +
        'data-access-token on the open button or window.TWC_ACCESS_TOKEN, or ' +
        'use data-auth="proxy" to obtain one via the Shopify App Proxy.',
    );
    return null;
  }

  // Accept a bare token or one already prefixed with the scheme.
  return /^Bearer /i.test(auth.accessToken)
    ? auth.accessToken
    : `Bearer ${auth.accessToken}`;
}
