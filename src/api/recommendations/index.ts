import type { AuthMode, EngineConfig, RecommendedProduct } from '../../types';
import { getEngineConfig } from '../tenant-config';
import { fetchTwcRecommendations } from './twc';

// Page-session cache. The engine is part of the key so a config change cannot
// serve results from the previous engine.
const cache = new Map<string, RecommendedProduct[]>();

// Which engine this tenant uses, or null when the section must not render.
// Callers resolve this before showing a loading state.
export function resolveEngine(
  tenant: string,
  authMode: AuthMode,
  proxyApp: string,
): Promise<EngineConfig | null> {
  return getEngineConfig(tenant, authMode, proxyApp);
}

export async function fetchRecommendations(
  engine: EngineConfig,
  params: {
    email: string;
    tenant: string;
    authMode: AuthMode;
    proxyApp: string;
    count: number;
    productId: string | null;
  },
): Promise<RecommendedProduct[]> {
  const { email, tenant, authMode, proxyApp, count, productId } = params;

  const cacheKey = `${engine.engine}|${tenant}|${email}|${count}|${productId || ''}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let products: RecommendedProduct[] | null = null;
  if (engine.engine === 'TWC') {
    products = await fetchTwcRecommendations({
      email,
      tenant,
      authMode,
      proxyApp,
      count,
    });
  }

  // A failed request stays uncached so the next open retries it.
  if (products === null) return [];

  cache.set(cacheKey, products);
  return products;
}
