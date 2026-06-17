import type { AuthMode } from '../types';
import { ACCESS_TOKEN, CUSTOMER_INTEREST_URL } from '../config';
import { getProxyAccessToken } from '../auth/proxy-token';

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'error' };

// Resolve the Authorization token for the configured auth mode, then POST the
// customer-interest payload. 'auth' means a proxy token could not be obtained
// (customer not logged in); 'error' means the request failed or returned non-OK.
export async function submitCustomerInterest(
  payload: Record<string, unknown>,
  authMode: AuthMode,
  tenant: string,
): Promise<SubmitResult> {
  let authToken = ACCESS_TOKEN;
  if (authMode === 'proxy') {
    const proxyToken = await getProxyAccessToken();
    if (!proxyToken) return { ok: false, reason: 'auth' };
    authToken = `Bearer ${proxyToken}`;
  }

  try {
    const response = await fetch(CUSTOMER_INTEREST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
        'X-Twc-Tenant': tenant,
      },
      body: JSON.stringify(payload),
    });
    return response.ok ? { ok: true } : { ok: false, reason: 'error' };
  } catch (error) {
    console.error('Error submitting form:', error);
    return { ok: false, reason: 'error' };
  }
}
