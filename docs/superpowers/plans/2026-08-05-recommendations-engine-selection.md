# Recommendations Engine Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pick the recommendations engine (TWC or Athos/Searchspring) from the tenant config's `websiteRecommendations` field, and render no section at all when it is absent.

**Architecture:** A new tenant-config client fetches and caches the remote config and reduces it to an `EngineConfig | null`. `src/api/recommendations.ts` becomes a folder with one client per engine behind a dispatcher; both normalise to the existing `RecommendedProduct`, so the renderer is untouched. The widget resolves the engine *before* inserting the loading skeleton.

**Tech Stack:** TypeScript 5.6 (strict), Rollup 4 → single IIFE bundle, no runtime dependencies, no test framework.

**Spec:** `docs/superpowers/specs/2026-08-05-recommendations-engine-selection-design.md`

## Global Constraints

- **No new runtime or dev dependencies.**
- **`target: ES2018`, `lib: ["DOM", "DOM.Iterable", "ES2018"]`.** No ES2019+ library methods: no `Array.prototype.flat`/`flatMap`, `Object.fromEntries`, `String.prototype.trimStart`/`trimEnd`, `Promise.allSettled`. Optional chaining and `??` are syntax and downlevel fine.
- **`strict: true`.**
- **Never send `Authorization` or `X-Twc-Tenant` to `*.searchspring.io`.** It is a third-party host; a tenant-scoped TWC token must not leak to it.
- **Only `websiteRecommendations` decides the engine.** The legacy top-level `recommendationsEngine` field is deliberately ignored.
- **Absent / unusable `websiteRecommendations` means no section**, no engine request, no skeleton.
- **A failed request must not be cached.** Clients return `null` for failure and `[]` for "succeeded, nothing usable"; only the latter is cached, so a transient failure is retried on the next open.
- **No `console.error` output in the shopper's happy path**, and no failure may block or alter the customer-interest submission.
- **Never string-interpolate API data into `innerHTML`.**
- **Commit after every task** using the message given in the task's final step.

## Verification Approach

No test framework — `npm test` is a stub and adding one is out of scope. Each task is gated on:

1. `npm run typecheck` — exits 0, no output.
2. `npm run build` — writes `build/notify-me-wl.min.js`.
3. Browser checks against `index.html`, using the mock harness. Serve with:

```bash
python3 -m http.server 4173 --bind 127.0.0.1   # then http://localhost:4173/index.html
```

**The bundled token in `src/config.ts` is expired.** Every check in this plan therefore runs against stubs, which is also the only way to exercise Athos (there is no real Searchspring `siteId`). Task 4 builds the harness that makes those stubs selectable by query parameter; Tasks 1–3 stub inline from the browser console, with the exact snippets given.

Optionally, with a fresh token pasted into `ACCESS_TOKEN`, the live config can be confirmed with:

```bash
curl -s -H "Authorization: Bearer <fresh>" -H "X-Twc-Tenant: twc-fashion-demo" \
  https://api.au-aws.thewishlist.io/services/eventcollector/api/v1/custom/configs/public \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.stringify(JSON.parse(s).websiteRecommendations)))"
```

At the time of writing this prints `undefined` for `twc-fashion-demo` — the field does not exist yet.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/config.ts` | Modify | Add `TENANT_CONFIG_URL` |
| `src/types.ts` | Modify | Add `EngineName`, `EngineConfig` |
| `src/api/tenant-config.ts` | Create | Fetch + cache the config, reduce to `EngineConfig \| null` |
| `src/api/recommendations.ts` | **Delete** | Replaced by the folder below |
| `src/api/recommendations/index.ts` | Create | Resolve engine, dispatch, cache results |
| `src/api/recommendations/normalize.ts` | Create | Shared coercion / dedupe helpers |
| `src/api/recommendations/twc.ts` | Create | TWC client (logic moved from the deleted file) |
| `src/api/recommendations/athos.ts` | Create | Searchspring client |
| `src/ui/widget.ts` | Modify | Resolve engine before the skeleton; pass `productId` |
| `index.html` | Modify | Harness stubs for config + Searchspring |
| `README.md` | Modify | Document engine selection |

The widget's import path `'../api/recommendations'` is unchanged — with `moduleResolution: "bundler"` it resolves to the folder's `index.ts`.

---

### Task 1: Tenant config client

**Files:**
- Modify: `src/config.ts`
- Modify: `src/types.ts`
- Create: `src/api/tenant-config.ts`

**Interfaces:**
- Consumes: `resolveAuthToken(authMode: AuthMode, proxyApp: string): Promise<string | null>` from `src/auth/resolve-token.ts`.
- Produces:
  - `TENANT_CONFIG_URL: string`.
  - `EngineName = 'TWC' | 'ATHOS'` and `EngineConfig = { engine: 'TWC' } | { engine: 'ATHOS'; siteIdentifier: string; profileTag: string }` in `src/types.ts`.
  - `parseEngineConfig(body: unknown): EngineConfig | null` — exported so it can be exercised directly.
  - `getEngineConfig(tenant: string, authMode: AuthMode, proxyApp: string): Promise<EngineConfig | null>`.

- [ ] **Step 1: Add the endpoint URL**

Append to `src/config.ts`:

```ts
// Tenant config endpoint. Despite the "public" path it requires the same
// Authorization + X-Twc-Tenant headers as every other TWC call — it returns
// 401 without them.
export const TENANT_CONFIG_URL =
  'https://api.au-aws.thewishlist.io/services/eventcollector/api/v1/custom/configs/public';
```

- [ ] **Step 2: Add the engine types**

Add to `src/types.ts`, after the `DisplayMode` type:

```ts
export type EngineName = 'TWC' | 'ATHOS';

// Which recommendations engine a tenant uses, read from the remote config's
// websiteRecommendations field. Callers treat a null EngineConfig as "this
// tenant has no engine configured — render no section at all".
export type EngineConfig =
  | { engine: 'TWC' }
  | { engine: 'ATHOS'; siteIdentifier: string; profileTag: string };
```

- [ ] **Step 3: Create the client**

Create `src/api/tenant-config.ts`:

```ts
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
  const raw =
    body &&
    (body as { websiteRecommendations?: RawWebsiteRecommendations })
      .websiteRecommendations;
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
```

Note `cache.get(tenant) !== undefined` rather than `cache.has(tenant)` — both work, but the explicit `undefined` check makes it obvious that a cached `null` is a hit, not a miss.

- [ ] **Step 4: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: both exit 0. Nothing imports this module yet, so no behaviour changes.

- [ ] **Step 5: Verify the parser against every case**

Nothing calls the module yet, so exercise the pure function directly. Open `http://localhost:4173/index.html` and paste into the console — this is the same logic, inlined:

```js
const DEFAULT='similar';
const text=v=>typeof v==='string'?v.trim():'';
function parseEngineConfig(body){
  const raw = body && body.websiteRecommendations;
  if(!raw||typeof raw!=='object')return null;
  const engine=text(raw.engine).toUpperCase();
  if(engine==='TWC')return{engine:'TWC'};
  if(engine==='ATHOS'){
    const siteIdentifier=text(raw.siteIdentifier);
    if(!siteIdentifier)return null;
    return{engine:'ATHOS',siteIdentifier,profileTag:text(raw.profileTag)||text(raw.tags)||DEFAULT};
  }
  return null;
}
console.table([
  ['TWC',                     {websiteRecommendations:{engine:'TWC'}}],
  ['lowercase twc',           {websiteRecommendations:{engine:' twc '}}],
  ['ATHOS + site',            {websiteRecommendations:{engine:'ATHOS',siteIdentifier:'abc123'}}],
  ['ATHOS + profileTag',      {websiteRecommendations:{engine:'ATHOS',siteIdentifier:'abc123',profileTag:'also-viewed'}}],
  ['ATHOS + tags alias',      {websiteRecommendations:{engine:'ATHOS',siteIdentifier:'abc123',tags:'also-bought'}}],
  ['ATHOS no site',           {websiteRecommendations:{engine:'ATHOS'}}],
  ['ATHOS blank site',        {websiteRecommendations:{engine:'ATHOS',siteIdentifier:'   '}}],
  ['unknown engine',          {websiteRecommendations:{engine:'NOPE'}}],
  ['field absent',            {recommendationsEngine:'TWC'}],
  ['null body',               null],
  ['non-object field',        {websiteRecommendations:'TWC'}],
].map(([label,input])=>({label,result:JSON.stringify(parseEngineConfig(input))})));
```

Expected, exactly:

| label | result |
| --- | --- |
| TWC | `{"engine":"TWC"}` |
| lowercase twc | `{"engine":"TWC"}` |
| ATHOS + site | `{"engine":"ATHOS","siteIdentifier":"abc123","profileTag":"similar"}` |
| ATHOS + profileTag | `…"profileTag":"also-viewed"` |
| ATHOS + tags alias | `…"profileTag":"also-bought"` |
| ATHOS no site | `null` |
| ATHOS blank site | `null` |
| unknown engine | `null` |
| field absent | `null` |
| null body | `null` |
| non-object field | `null` |

The "field absent" row is the important one: a config carrying only the legacy `recommendationsEngine` must resolve to `null`.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts src/types.ts src/api/tenant-config.ts
git commit -m "$(cat <<'EOF'
feat: add tenant config client and engine resolution

Reads websiteRecommendations from the tenant config and reduces it to an
EngineConfig, or null when the tenant has no usable engine. The legacy
recommendationsEngine field is deliberately ignored. Nothing consumes it yet.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Restructure recommendations behind the engine gate

Turns the single client into a dispatcher with the TWC engine behind it, and makes the widget resolve the engine before it shows anything. Athos arrives in Task 3.

**Files:**
- Create: `src/api/recommendations/normalize.ts`
- Create: `src/api/recommendations/twc.ts`
- Create: `src/api/recommendations/index.ts`
- Delete: `src/api/recommendations.ts`
- Modify: `src/ui/widget.ts`

**Interfaces:**
- Consumes: `getEngineConfig` (Task 1); `RECOMMENDATIONS_URL_BASE`, `resolveAuthToken`, `RecommendedProduct`.
- Produces:
  - `dedupeAndTrim(entries: { product: RecommendedProduct; score: number }[], count: number): RecommendedProduct[]`
  - `isRenderable(p: { name: string; imageUrl: string; productUrl: string }): boolean`
  - `toText(value: unknown): string`
  - `toNumber(value: unknown): number | null`
  - `normalizeTwc(raw: unknown, count: number): RecommendedProduct[]`
  - `fetchTwcRecommendations(params): Promise<RecommendedProduct[] | null>`
  - `resolveEngine(tenant, authMode, proxyApp): Promise<EngineConfig | null>`
  - `fetchRecommendations(engine: EngineConfig, params): Promise<RecommendedProduct[]>`

- [ ] **Step 1: Create the shared helpers**

Create `src/api/recommendations/normalize.ts`:

```ts
import type { RecommendedProduct } from '../../types';

export function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Searchspring returns prices as strings in some feeds; TWC returns numbers.
// Null means "no usable number", which callers turn into 0 or omit.
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

// A card without all three cannot be rendered usefully.
export function isRenderable(product: {
  name: string;
  imageUrl: string;
  productUrl: string;
}): boolean {
  return Boolean(product.name && product.imageUrl && product.productUrl);
}

// Dedupe by ref keeping the highest score, then trim to `count`. Load-bearing
// for TWC, which returns one entry per variant; for Athos it is a guard against
// a malformed feed repeating a product.
export function dedupeAndTrim(
  entries: { product: RecommendedProduct; score: number }[],
  count: number,
): RecommendedProduct[] {
  const bestByRef = new Map<
    string,
    { product: RecommendedProduct; score: number }
  >();

  entries.forEach((entry) => {
    const existing = bestByRef.get(entry.product.ref);
    if (existing && existing.score >= entry.score) return;
    bestByRef.set(entry.product.ref, entry);
  });

  return Array.from(bestByRef.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((entry) => entry.product);
}
```

- [ ] **Step 2: Create the TWC client**

Create `src/api/recommendations/twc.ts`:

```ts
import type { AuthMode, RecommendedProduct } from '../../types';
import { RECOMMENDATIONS_URL_BASE } from '../../config';
import { resolveAuthToken } from '../../auth/resolve-token';
import { dedupeAndTrim, isRenderable, toNumber, toText } from './normalize';

// Only the fields the widget renders. Everything else the service returns
// (score_breakdown, attributes, sizing, metrics, …) is ignored.
interface RawProduct {
  product_id?: unknown;
  product_ref?: unknown;
  name?: unknown;
  image_url?: unknown;
  product_url?: unknown;
  price?: unknown;
  original_price?: unknown;
}

interface RawRecommendation {
  product?: RawProduct;
  score?: unknown;
}

// The service returns one entry per variant, so a single product shows up
// several times as different colourways. Ask for more than we display so
// deduping still leaves a full row.
const OVER_FETCH_FACTOR = 3;

// The service rejects n > 20 with a 422, so the over-fetch has to be clamped.
const MAX_N = 20;

export function normalizeTwc(
  raw: unknown,
  count: number,
): RecommendedProduct[] {
  const list = raw && (raw as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(list)) return [];

  const entries: { product: RecommendedProduct; score: number }[] = [];

  (list as RawRecommendation[]).forEach((entry) => {
    const rawProduct = entry && entry.product;
    if (!rawProduct) return;

    const name = toText(rawProduct.name);
    const imageUrl = toText(rawProduct.image_url);
    const productUrl = toText(rawProduct.product_url);
    if (!isRenderable({ name, imageUrl, productUrl })) return;

    const ref =
      toText(rawProduct.product_ref) ||
      toText(rawProduct.product_id) ||
      productUrl;

    entries.push({
      score: typeof entry.score === 'number' ? entry.score : 0,
      product: {
        id: toText(rawProduct.product_id) || ref,
        ref,
        name,
        imageUrl,
        productUrl,
        price: toNumber(rawProduct.price) ?? 0,
        originalPrice: toNumber(rawProduct.original_price),
      },
    });
  });

  return dedupeAndTrim(entries, count);
}

// null means the request failed; [] means it succeeded with nothing usable.
// The dispatcher caches only the latter, so a transient failure is retried.
export async function fetchTwcRecommendations(params: {
  email: string;
  tenant: string;
  authMode: AuthMode;
  proxyApp: string;
  count: number;
}): Promise<RecommendedProduct[] | null> {
  const { email, tenant, authMode, proxyApp, count } = params;

  const authToken = await resolveAuthToken(authMode, proxyApp);
  if (!authToken) return null;

  const requested = Math.min(count * OVER_FETCH_FACTOR, MAX_N);
  const url =
    `${RECOMMENDATIONS_URL_BASE}/${encodeURIComponent(tenant)}` +
    `/${encodeURIComponent(email)}?n=${requested}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authToken,
        'X-Twc-Tenant': tenant,
      },
    });
    if (!response.ok) {
      console.error('Recommendations request failed:', response.status);
      return null;
    }

    const body = await response.json().catch(() => null);
    return normalizeTwc(body, count);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return null;
  }
}
```

- [ ] **Step 3: Create the dispatcher**

Create `src/api/recommendations/index.ts`. The Athos branch is added in Task 3; for now TWC is the only engine that can be dispatched to, and an `ATHOS` config yields an empty row.

```ts
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
```

- [ ] **Step 4: Delete the old module**

```bash
git rm src/api/recommendations.ts
```

Its logic now lives in `twc.ts` and `normalize.ts`.

- [ ] **Step 5: Wire the widget to the engine gate**

In `src/ui/widget.ts`, change the import:

```ts
import { resolveEngine, fetchRecommendations } from '../api/recommendations';
```

(The path is unchanged — it now resolves to the folder's `index.ts`.)

Then replace the body of `renderRecommendations` with:

```ts
  async function renderRecommendations(email: string): Promise<boolean> {
    // Resolve the engine before showing anything. A tenant with no engine
    // configured must not flash placeholders that are then taken away.
    const engine = await resolveEngine(tenant, authMode, proxyApp);
    if (!engine) return false;
    // The shopper may have closed the popup during that request.
    if (!overlayEl!.classList.contains('is-open')) return false;

    const section = createRecommendationsSkeleton(recommendationsCount);
    cardEl!.appendChild(section);

    const products = await fetchRecommendations(engine, {
      email,
      tenant,
      authMode,
      proxyApp,
      count: recommendationsCount,
      productId: productData ? String(productData.id) : null,
    });

    // Closed (and torn down) while the request was in flight.
    if (!section.isConnected) return false;

    if (!products.length) {
      removeRecommendationsSection();
      return false;
    }

    fillRecommendationsSection(section, products, currency);
    return true;
  }
```

- [ ] **Step 6: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: both exit 0. A "Cannot find module '../api/recommendations'" error means the folder's `index.ts` is missing or misnamed.

- [ ] **Step 7: Verify the TWC engine still renders**

Open `http://localhost:4173/index.html`, and before touching anything paste this into the console to stub both the config and the TWC service:

```js
const products = n => ({recommendations: Array.from({length:n},(_,i)=>({
  product:{product_ref:'r'+i,product_id:'p'+i,name:'Product '+i,price:100+i,
    image_url:'https://placehold.co/300x400?text='+i,product_url:'https://example.com/p'+i},
  score:1-i/100}))});
window.__cfg = {websiteRecommendations:{engine:'TWC'}};
window.__hits = [];
const real = window.fetch.bind(window);
window.fetch = (i,init) => {
  const u = typeof i==='string'?i:i.url;
  if (u.includes('/configs/public')) { __hits.push('config');
    return Promise.resolve(new Response(JSON.stringify(__cfg),{status:200})); }
  if (u.includes('/services/recommendations/')) { __hits.push('twc');
    return Promise.resolve(new Response(JSON.stringify(products(14)),{status:200})); }
  return real(i,init);
};
```

Then click the button and wait ~1s.

Expected: `__hits` is `["config","twc"]` — config first, engine second — and 8 product cards render. Close and reopen: `__hits` gains **no** new entries, because both the config and the results are cached.

- [ ] **Step 8: Verify the gate closes when the field is absent**

Reload the page, paste the same stub but with:

```js
window.__cfg = {recommendationsEngine:'TWC'};   // legacy field only
```

Then click the button and wait ~1s.

Expected: `__hits` is `["config"]` only — **no** TWC request is made — and no section renders. Critically, **no skeleton ever appears**: watch the modal as it opens and confirm no placeholder cards flash in and out.

Repeat with `window.__cfg = {websiteRecommendations:{engine:'NOPE'}}` and expect the same.

- [ ] **Step 9: Verify a config failure does not disable the session**

Reload, and stub the config to fail once then succeed:

```js
let fail = true;
window.__hits = [];
const real = window.fetch.bind(window);
const products = n => ({recommendations: Array.from({length:n},(_,i)=>({
  product:{product_ref:'r'+i,product_id:'p'+i,name:'Product '+i,price:100+i,
    image_url:'https://placehold.co/300x400?text='+i,product_url:'https://example.com/p'+i},
  score:1-i/100}))});
window.fetch = (i,init) => {
  const u = typeof i==='string'?i:i.url;
  if (u.includes('/configs/public')) { __hits.push('config');
    const r = fail ? new Response('{}',{status:500})
                   : new Response(JSON.stringify({websiteRecommendations:{engine:'TWC'}}),{status:200});
    fail = false; return Promise.resolve(r); }
  if (u.includes('/services/recommendations/')) { __hits.push('twc');
    return Promise.resolve(new Response(JSON.stringify(products(14)),{status:200})); }
  return real(i,init);
};
```

Open the modal (no section, `Tenant config request failed: 500` logged), close it, open it again.

Expected: the second open re-requests the config (`__hits` is `["config","config","twc"]`) and renders 8 cards. A failed config must not be cached.

- [ ] **Step 10: Commit**

```bash
git add src/api/recommendations src/ui/widget.ts
git commit -m "$(cat <<'EOF'
refactor: gate recommendations behind the tenant's configured engine

Splits the single client into a dispatcher plus per-engine modules, and
resolves the engine before the skeleton is inserted so an unconfigured
tenant never flashes placeholders. Clients now return null for a failed
request and [] for an empty one, so only the latter is cached.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Athos (Searchspring) client

**Files:**
- Create: `src/api/recommendations/athos.ts`
- Modify: `src/api/recommendations/index.ts`

**Interfaces:**
- Consumes: `dedupeAndTrim`, `isRenderable`, `toNumber`, `toText` from `./normalize`.
- Produces:
  - `normalizeAthos(raw: unknown, count: number): RecommendedProduct[]`
  - `fetchAthosRecommendations(params: { engine: { siteIdentifier: string; profileTag: string }; email: string; count: number; productId: string | null }): Promise<RecommendedProduct[] | null>`

- [ ] **Step 1: Create the client**

Create `src/api/recommendations/athos.ts`:

```ts
import type { RecommendedProduct } from '../../types';
import { dedupeAndTrim, isRenderable, toNumber, toText } from './normalize';

// Searchspring nests the renderable fields under mappings.core.
interface RawCore {
  uid?: unknown;
  sku?: unknown;
  name?: unknown;
  price?: unknown;
  msrp?: unknown;
  imageUrl?: unknown;
  thumbnailImageUrl?: unknown;
  url?: unknown;
}

interface RawResult {
  mappings?: { core?: RawCore };
}

export function normalizeAthos(
  raw: unknown,
  count: number,
): RecommendedProduct[] {
  // Searchspring returns an array of profile objects when several tags are
  // requested, and a single object when one is. Accept both.
  const root = Array.isArray(raw) ? raw[0] : raw;
  const list = root && (root as { results?: unknown }).results;
  if (!Array.isArray(list)) return [];

  const entries: { product: RecommendedProduct; score: number }[] = [];

  (list as RawResult[]).forEach((result, index) => {
    const core = result && result.mappings && result.mappings.core;
    if (!core) return;

    const name = toText(core.name);
    const imageUrl = toText(core.imageUrl) || toText(core.thumbnailImageUrl);
    const productUrl = toText(core.url);
    if (!isRenderable({ name, imageUrl, productUrl })) return;

    const ref = toText(core.uid) || toText(core.sku) || productUrl;
    const price = toNumber(core.price) ?? 0;
    const msrp = toNumber(core.msrp);

    entries.push({
      // Searchspring returns results already ranked, so synthesise a
      // descending score from the position to preserve that order.
      score: list.length - index,
      product: {
        id: toText(core.uid) || ref,
        ref,
        name,
        imageUrl,
        productUrl,
        price,
        originalPrice: msrp !== null && msrp > price ? msrp : null,
      },
    });
  });

  return dedupeAndTrim(entries, count);
}

// null means the request failed; [] means it succeeded with nothing usable.
// Unlike TWC there is no over-fetch — Searchspring returns products rather than
// variants, so there are no duplicates for deduping to absorb.
export async function fetchAthosRecommendations(params: {
  engine: { siteIdentifier: string; profileTag: string };
  email: string;
  count: number;
  productId: string | null;
}): Promise<RecommendedProduct[] | null> {
  const { engine, email, count, productId } = params;
  const site = encodeURIComponent(engine.siteIdentifier);

  const query = [
    `tags=${encodeURIComponent(engine.profileTag)}`,
    `limits=${count}`,
  ];
  if (productId) query.push(`products=${encodeURIComponent(productId)}`);
  if (email) query.push(`shopper=${encodeURIComponent(email)}`);

  const url =
    `https://${site}.a.searchspring.io/boost/${site}/recommend?` +
    query.join('&');

  try {
    // Deliberately no Authorization and no X-Twc-Tenant header: Searchspring is
    // a third-party host and must never receive a tenant-scoped TWC token.
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      console.error('Athos recommendations request failed:', response.status);
      return null;
    }

    const body = await response.json().catch(() => null);
    return normalizeAthos(body, count);
  } catch (error) {
    console.error('Error fetching Athos recommendations:', error);
    return null;
  }
}
```

- [ ] **Step 2: Dispatch to it**

In `src/api/recommendations/index.ts`, add the import:

```ts
import { fetchAthosRecommendations } from './athos';
```

and replace the single-engine block with:

```ts
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
      authMode,
      proxyApp,
      count,
    });
  }
```

TypeScript narrows `engine` to the `ATHOS` member inside the branch, so `engine.siteIdentifier` and `engine.profileTag` are available without a cast.

- [ ] **Step 3: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: both exit 0.

- [ ] **Step 4: Verify the Athos path against a stubbed Searchspring**

There is no real Searchspring site to call, so stub one in the documented shape. Reload `http://localhost:4173/index.html` and paste:

```js
window.__req = null;
const real = window.fetch.bind(window);
const core = (i, extra) => ({mappings:{core:Object.assign({
  uid:'u'+i, sku:'SKU'+i, name:'Athos Product '+i,
  price: 100+i, msrp: 150+i,
  imageUrl:'https://placehold.co/300x400?text=A'+i,
  url:'https://example.com/athos/'+i,
}, extra)}});
window.fetch = (i,init) => {
  const u = typeof i==='string'?i:i.url;
  if (u.includes('/configs/public'))
    return Promise.resolve(new Response(JSON.stringify(
      {websiteRecommendations:{engine:'ATHOS',siteIdentifier:'abc123',profileTag:'also-viewed'}}),{status:200}));
  if (u.includes('searchspring.io')) {
    __req = {url:u, headers:(init&&init.headers)||{}};
    return Promise.resolve(new Response(JSON.stringify({
      results:[
        core(0), core(1),
        // string prices, as some Searchspring feeds return them — placed
        // inside the visible top 8 so the coercion is actually exercised
        core(2,{price:'249.50',msrp:'299.00'}),
        // unusable: no image of either kind, must be dropped
        core(3,{imageUrl:'',thumbnailImageUrl:''}),
        // falls back to the thumbnail when the main image is missing
        core(4,{imageUrl:'',thumbnailImageUrl:'https://placehold.co/300x400?text=T4'}),
        // msrp below price must NOT render a strikethrough
        core(5,{price:200,msrp:150}),
        core(6), core(7), core(8), core(9),
      ],
      profile:{tag:'also-viewed'}, responseId:'abc'
    }),{status:200}));
  }
  return real(i,init);
};
```

Click the button, wait ~1s, then inspect:

```js
__req.url
__req.headers
Array.from(document.querySelectorAll('.twc-nm-rec-name')).map(e=>e.textContent)
Array.from(document.querySelectorAll('.twc-nm-rec-price')).map(e=>e.textContent)
```

Expected, all of which must hold:
- URL is `https://abc123.a.searchspring.io/boost/abc123/recommend?tags=also-viewed&limits=8&products=123456789&shopper=mjhampshire%40gmail.com` — `products` comes from `window.currentProduct.id` in the demo page, `shopper` from `data-customer-email`.
- **`__req.headers` contains only `Accept`** — no `Authorization`, no `X-Twc-Tenant`. This is the security-relevant assertion.
- 8 cards render. Product 3 is **absent** (no image of either kind), so the names are "Athos Product" 0, 1, 2, 4, 5, 6, 7, 8 in that order — Searchspring's ranking is preserved.
- Product 2 renders its string prices as numbers, with `299.00` struck through before `249.50`.
- Product 4 renders, using its `thumbnailImageUrl`.
- Product 5 shows **no** strikethrough, because its `msrp` (150) is below its `price` (200).
- Reduce the stub to 3 results and reload: 3 cards render, not 8.

- [ ] **Step 5: Verify Athos is disqualified without a site id**

Reload and stub the config as `{websiteRecommendations:{engine:'ATHOS'}}` with the same Searchspring stub in place.

Expected: no section, no skeleton flash, and **no request to searchspring.io** (`__req` stays `null`).

- [ ] **Step 6: Commit**

```bash
git add src/api/recommendations/athos.ts src/api/recommendations/index.ts
git commit -m "$(cat <<'EOF'
feat: add Athos (Searchspring) recommendations engine

Calls {siteId}.a.searchspring.io directly with no TWC credentials — a
separate module so a tenant-scoped token cannot leak to a third-party
host — and normalises mappings.core onto the shared product type.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Harness and documentation

Folds the ad-hoc console stubs from Tasks 2 and 3 into the demo page so the scenarios are repeatable, and documents engine selection.

**Files:**
- Modify: `index.html`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `?mockRecs=1&engine=<twc|athos|none|unknown|error>` on the demo page.

- [ ] **Step 1: Extend the harness**

In `index.html`, inside the existing `if (new URLSearchParams(location.search).has('mockRecs'))` block, add this immediately before the `var realFetch = ...` line:

```js
            // Engine scenario for the tenant-config stub, chosen with
            // &engine=twc|athos|none|unknown|error (default: twc).
            var ENGINE = new URLSearchParams(location.search).get('engine') || 'twc';
            var CONFIGS = {
               twc: { websiteRecommendations: { engine: 'TWC' } },
               athos: {
                  websiteRecommendations: {
                     engine: 'ATHOS',
                     siteIdentifier: 'abc123',
                     profileTag: 'also-viewed',
                  },
               },
               // Legacy field only — the widget must ignore it and render nothing.
               none: { recommendationsEngine: 'TWC' },
               unknown: { websiteRecommendations: { engine: 'NOPE' } },
            };

            function athosCore(i) {
               return {
                  mappings: {
                     core: {
                        uid: 'u' + i,
                        sku: 'SKU' + i,
                        name: 'Athos Product ' + i,
                        price: 100 + i,
                        msrp: 150 + i,
                        imageUrl: 'https://placehold.co/300x400?text=A' + i,
                        url: 'https://example.com/athos/' + i,
                     },
                  },
               };
            }
            var MOCK_ATHOS = {
               results: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(athosCore),
               profile: { tag: 'also-viewed' },
               responseId: 'mock',
            };
```

Then replace the body of the `window.fetch` override with:

```js
            var realFetch = window.fetch.bind(window);
            window.fetch = function (input, init) {
               var url = typeof input === 'string' ? input : input.url;

               if (url && url.indexOf('/configs/public') !== -1) {
                  console.log('[mockRecs] config:', ENGINE);
                  if (ENGINE === 'error') {
                     return Promise.resolve(new Response('{}', { status: 500 }));
                  }
                  return Promise.resolve(
                     new Response(JSON.stringify(CONFIGS[ENGINE] || CONFIGS.twc), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                     }),
                  );
               }

               if (url && url.indexOf('searchspring.io') !== -1) {
                  console.log('[mockRecs] athos', url, JSON.stringify((init || {}).headers));
                  return Promise.resolve(
                     new Response(JSON.stringify(MOCK_ATHOS), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                     }),
                  );
               }

               if (url && url.indexOf('/services/recommendations/') !== -1) {
                  console.log('[mockRecs] intercepted', url);
                  return Promise.resolve(
                     new Response(JSON.stringify(MOCK_RECS), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                     }),
                  );
               }

               return realFetch(input, init);
            };
```

- [ ] **Step 2: Verify every scenario**

Open each URL, click the button, wait ~1s, and check the console and the modal:

| URL | Expected |
| --- | --- |
| `?mockRecs=1` | `[mockRecs] config: twc` then a TWC request; 4 cards (the TWC mock has 4 unique refs) |
| `?mockRecs=1&engine=athos` | `[mockRecs] athos …` with headers logged as `{"Accept":"application/json"}`; 8 "Athos Product" cards |
| `?mockRecs=1&engine=none` | `[mockRecs] config: none`; **no** engine request, no section, no skeleton flash |
| `?mockRecs=1&engine=unknown` | Same as `none` |
| `?mockRecs=1&engine=error` | `Tenant config request failed: 500`; no section; submitting the form still works |

The `engine=athos` header log is the security check — confirm no `Authorization` key appears in it.

- [ ] **Step 3: Document engine selection**

In `README.md`, replace the paragraph beginning "The service returns one entry per product variant" in the "Shop similar styles" section with:

```markdown
#### Choosing an engine

Which engine powers the section is a per-tenant server-side setting, not a data
attribute. On first open the widget fetches the tenant config from:

    GET /services/eventcollector/api/v1/custom/configs/public

(with the same `Authorization` and `X-Twc-Tenant` headers as every other call — despite
the path, this endpoint is not anonymous) and reads `websiteRecommendations`:

    "websiteRecommendations": { "engine": "TWC" }

    "websiteRecommendations": { "engine": "ATHOS", "siteIdentifier": "abc123" }

**If `websiteRecommendations` is absent, the section does not render at all.** The older
top-level `recommendationsEngine` field is ignored. The section is also skipped when the
engine is unrecognised, or when `ATHOS` has no `siteIdentifier`.

For `ATHOS`, `siteIdentifier` is the Searchspring site ID and is used in both the
subdomain and the path:

    https://{siteIdentifier}.a.searchspring.io/boost/{siteIdentifier}/recommend

The recommendation profile comes from `profileTag` (or `tags`) on
`websiteRecommendations`, defaulting to `similar`. Searchspring is called with **no** TWC
credentials.

The TWC service returns one entry per product variant, so several entries can describe
the same product in different colourways. The widget requests three times the display
count and dedupes by `product_ref`, keeping the highest-scoring entry. **That API rejects
`n` above 20 with a 422**, so the over-fetch is clamped to 20 — at the default count of 8
that means `n=20`. Athos returns products rather than variants, so it is asked for
exactly `limits={count}`.
```

- [ ] **Step 4: Final verification**

```bash
npm run typecheck && npm run build && git status --short
```

Expected: both commands exit 0, and `git status` shows only the intended files — no leftover scratch HTML from earlier tasks.

- [ ] **Step 5: Commit**

```bash
git add index.html README.md build/notify-me-wl.min.js
git commit -m "$(cat <<'EOF'
docs: document engine selection and add harness scenarios

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Spec Coverage

| Spec requirement | Task |
| --- | --- |
| `TENANT_CONFIG_URL` in `config.ts` | 1 |
| Config needs Authorization + X-Twc-Tenant | 1 |
| Config cached per session, keyed by tenant | 1 |
| `EngineConfig` / `EngineName` types | 1 |
| Null for: no token, failure, absent field, unknown engine, ATHOS without site id | 1 |
| Case-insensitive, trimmed `engine` match | 1 |
| Legacy `recommendationsEngine` ignored | 1, 2 |
| Profile tag: `profileTag` → `tags` → `similar` | 1 |
| `recommendations/` folder split | 2 |
| Shared normalize helpers | 2 |
| TWC client moved, behaviour unchanged | 2 |
| Cache key includes engine | 2 |
| Failure not cached (null vs `[]`) | 2 |
| `productId` added to the fetch params | 2 |
| Engine resolved before the skeleton | 2 |
| Athos URL shape, `tags`/`limits`/`products`/`shopper` | 3 |
| Athos sends no TWC credentials | 3 |
| `mappings.core` field mapping | 3 |
| String price coercion | 3 |
| `msrp` → `originalPrice` only when greater | 3 |
| Entries missing name/image/url dropped | 2, 3 |
| No Athos over-fetch | 3 |
| `data-recommendations="false"` short-circuits | unchanged from base feature |
| Eight verification scenarios | 2, 3, 4 |
| Harness stubs config + Searchspring | 4 |
| README updates | 4 |
