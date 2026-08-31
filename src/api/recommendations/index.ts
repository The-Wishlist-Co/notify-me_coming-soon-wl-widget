import type { AuthConfig, EngineConfig, RecommendedProduct } from '../../types';
import { getEngineConfig } from '../tenant-config';
import { fetchTwcRecommendations } from './twc';
import { fetchAthosRecommendations } from './athos';

// Page-session cache. The engine is part of the key so a config change cannot
// serve results from the previous engine.
const cache = new Map<string, RecommendedProduct[]>();

// Which engine this tenant uses, or null when the section must not render.
// Callers resolve this before showing a loading state.
export function resolveEngine(
  tenant: string,
  auth: AuthConfig,
): Promise<EngineConfig | null> {
  return getEngineConfig(tenant, auth);
}

export async function fetchRecommendations(
  engine: EngineConfig,
  params: {
    email: string;
    tenant: string;
    auth: AuthConfig;
    count: number;
    productId: string | null;
  },
): Promise<RecommendedProduct[]> {
  const { email, tenant, auth, count, productId } = params;

  const cacheKey = `${engine.engine}|${tenant}|${email}|${count}|${productId || ''}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let products: RecommendedProduct[] | null = null;
  if (engine.engine === 'ATHOS') {
    products = await fetchAthosRecommendations({
      engine,
      email,
      count,
      productId,
    });
  } else {
    products = await fetchTwcRecommendations({
      email,
      tenant,
      auth,
      count,
    });
  }

  // A failed request stays uncached so the next open retries it.
  if (products === null) return [];

  cache.set(cacheKey, products);
  return products;
}
