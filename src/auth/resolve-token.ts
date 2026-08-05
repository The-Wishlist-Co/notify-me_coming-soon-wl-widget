import type { AuthMode } from '../types';
import { ACCESS_TOKEN } from '../config';
import { getProxyAccessToken } from './proxy-token';

// Resolve the Authorization header value for the configured auth mode.
// 'token' mode uses the bundled server-issued token. 'proxy' mode asks the
// Shopify App Proxy for a tenant-scoped token, which only succeeds for a
// logged-in customer — null means no token could be obtained. Callers decide
// what a null means for them: customer-interest surfaces it as an auth error,
// recommendations silently render nothing.
export async function resolveAuthToken(
  authMode: AuthMode,
  proxyApp: string,
): Promise<string | null> {
  if (authMode !== 'proxy') return ACCESS_TOKEN;

  const proxyToken = await getProxyAccessToken(proxyApp);
  return proxyToken ? `Bearer ${proxyToken}` : null;
}
