import type { AuthConfig } from '../types';
import { CUSTOMER_INTEREST_URL } from '../config';
import { resolveAuthToken } from '../auth/resolve-token';

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'error' };

// Resolve the Authorization token for the configured auth mode, then POST the
// customer-interest payload. 'auth' means no token could be obtained (customer
// not logged in, or 'token' mode without a configured token); 'error' means the
// request failed or returned non-OK.
export async function submitCustomerInterest(
  payload: Record<string, unknown>,
  auth: AuthConfig,
  tenant: string,
): Promise<SubmitResult> {
  const authToken = await resolveAuthToken(auth);
  if (!authToken) return { ok: false, reason: 'auth' };

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
