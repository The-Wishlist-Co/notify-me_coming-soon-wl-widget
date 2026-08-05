import type { AuthMode, EngineConfig } from '../types';
import { TENANT_CONFIG_URL } from '../config';
import { resolveAuthToken } from '../auth/resolve-token';

// Searchspring requires a profile tag and the config shape does not carry one
// yet. Matches the section's own copy, "Shop similar styles".
const DEFAULT_ATHOS_PROFILE_TAG = 'similar';

// Page-session cache keyed by tenant. A cached null is a real answer meaning
// "no engine configured"; absence from the map means "not fetched yet".
const cache = new Map<string, EngineConfig | null>();

interface RawWebsiteRecommendations {
  engine?: unknown;
  siteIdentifier?: unknown;
  profileTag?: unknown;
  tags?: unknown;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Reduce a tenant config body to the engine the widget should use. Returns null
// for every unusable case — field absent, unknown engine, or ATHOS without a
// site id — and the caller renders no section.
export function parseEngineConfig(body: unknown): EngineConfig | null {
  if (!body || typeof body !== 'object') return null;

  const raw: RawWebsiteRecommendations | undefined = (
    body as { websiteRecommendations?: RawWebsiteRecommendations }
  ).websiteRecommendations;
  // A non-object value (a bare "TWC" string, say) is not usable config.
  if (!raw || typeof raw !== 'object') return null;

  // Merchant-entered configuration, so match leniently.
  const engine = text(raw.engine).toUpperCase();

  if (engine === 'TWC') return { engine: 'TWC' };

  if (engine === 'ATHOS') {
    const siteIdentifier = text(raw.siteIdentifier);
    // No site id means there is no Searchspring URL to build.
    if (!siteIdentifier) return null;
    const profileTag =
      text(raw.profileTag) || text(raw.tags) || DEFAULT_ATHOS_PROFILE_TAG;
    return { engine: 'ATHOS', siteIdentifier, profileTag };
  }

  return null;
}

// Fetch the tenant config and resolve the engine. Only a successfully parsed
// response is cached, so a missing token or a transient failure is retried on
// the next attempt rather than disabling the section for the whole session.
export async function getEngineConfig(
  tenant: string,
  authMode: AuthMode,
  proxyApp: string,
): Promise<EngineConfig | null> {
  const cached = cache.get(tenant);
  if (cached !== undefined) return cached;

  const authToken = await resolveAuthToken(authMode, proxyApp);
  if (!authToken) return null;

  try {
    const response = await fetch(TENANT_CONFIG_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authToken,
        'X-Twc-Tenant': tenant,
      },
    });
    if (!response.ok) {
      console.error('Tenant config request failed:', response.status);
      return null;
    }

    const body = await response.json().catch(() => null);
    const engineConfig = parseEngineConfig(body);
    cache.set(tenant, engineConfig);
    return engineConfig;
  } catch (error) {
    console.error('Error fetching tenant config:', error);
    return null;
  }
}
