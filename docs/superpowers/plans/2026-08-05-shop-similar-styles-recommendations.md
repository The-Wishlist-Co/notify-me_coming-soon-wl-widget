# Shop Similar Styles Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a horizontally scrolling "Shop similar styles" product row beneath the form in the Notify Me / Coming Soon modal, populated from the TWC recommendations service.

**Architecture:** A new API client (`src/api/recommendations.ts`) fetches and normalises recommendations; a new renderer (`src/ui/recommendations.ts`) turns the normalised list into DOM; `src/ui/widget.ts` decides when to call them. Auth-token resolution, currently inlined in the customer-interest client, is extracted so both API clients share it.

**Tech Stack:** TypeScript 5.6 (strict), Rollup 4 → single IIFE bundle, no runtime dependencies, no test framework.

**Spec:** `docs/superpowers/specs/2026-08-05-shop-similar-styles-recommendations-design.md`

## Global Constraints

- **No new runtime or dev dependencies.** The bundle has zero dependencies and stays that way.
- **`target: ES2018`, `lib: ["DOM", "DOM.Iterable", "ES2018"]`** (`tsconfig.json`). ES2019+ library methods are unavailable: no `Array.prototype.flat`, `Array.prototype.flatMap`, `Object.fromEntries`, `String.prototype.trimStart/trimEnd`, `Promise.allSettled`. Optional chaining and nullish coalescing are fine (syntax, downlevelled by TS).
- **`strict: true`.** No implicit `any`, no unchecked null access.
- **All CSS lives in `src/ui/styles.ts` and every selector is namespaced under `#twc-nm-overlay`** so it cannot collide with a host store theme.
- **Never string-interpolate API data into `innerHTML`.** Recommendation fields are remote data; build those nodes with `document.createElement` and `textContent`.
- **No failure in the recommendations path may block or alter customer-interest submission.** Every error resolves to an empty list and is logged with `console.error`.
- **Section copy is exactly `Shop similar styles`** (sentence case).
- **Commit after every task** using the message given in the task's final step.

## Verification Approach

This repo has no test framework — `npm test` is a stub, and adding a harness is explicitly out of scope per the spec. Every task is therefore gated on:

1. `npm run typecheck` — must exit 0 with no output.
2. `npm run build` — must write `build/notify-me-wl.min.js` without errors.
3. Manual checks in a browser against `index.html`, using the mock harness built in Task 1.

Tasks 2–6 are gated on typecheck + build + the specific manual check listed. Task 7 is where the feature is first verifiable end to end and carries the full behaviour matrix.

To serve the demo page (opening it as a `file://` URL works, but a server matches production more closely):

```bash
npx --yes serve . -l 4173   # then open http://localhost:4173/index.html
```

`npx serve` downloads a one-off CLI; it is not added to `package.json` and is not a project dependency.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `index.html` | Modify | Demo page; fixed script path plus a `?mockRecs=1` fetch stub |
| `src/config.ts` | Modify | Add `RECOMMENDATIONS_URL_BASE` |
| `src/types.ts` | Modify | Add `RecommendedProduct`; extend `WidgetConfig` |
| `src/global.d.ts` | Modify | Add `window.customer.email`, `window.Shopify.currency` |
| `src/auth/resolve-token.ts` | Create | Single place that turns an auth mode into an `Authorization` value |
| `src/api/customer-interest.ts` | Modify | Use the extracted token resolver |
| `src/api/recommendations.ts` | Create | Fetch, normalise, dedupe, cache recommendations |
| `src/context/customer-email.ts` | Create | Resolve the customer email from attribute or Shopify context |
| `src/ui/recommendations.ts` | Create | Build and remove the "Shop similar styles" DOM |
| `src/ui/styles.ts` | Modify | Styles for the section |
| `src/ui/widget.ts` | Modify | Decide when to fetch and render; conditional auto-close |
| `src/index.ts` | Modify | Parse the new `data-*` attributes |
| `README.md` | Modify | Document the feature and attributes |

---

### Task 1: Repair the demo page and add a recommendations mock harness

The demo page currently loads `build/notify-me-wl.js`, which rollup never emits — the widget does not run at all. Every later task's manual verification depends on this page, so fix it first and add the mock the later tasks need.

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: nothing.
- Produces: a demo page where `?mockRecs=1` makes any request to a URL containing `/services/recommendations/` resolve to a fixed payload, and `window.customer.email` is set to `mjhampshire@gmail.com`.

- [ ] **Step 1: Confirm the demo page is currently broken**

Run:

```bash
npm run build && ls build && grep -n 'notify-me-wl' index.html
```

Expected: `build/` contains only `notify-me-wl.min.js`, while `index.html` references `build/notify-me-wl.js`. This mismatch is the bug.

- [ ] **Step 2: Fix the script path**

In `index.html`, change:

```html
<script src="build/notify-me-wl.js"></script>
```

to:

```html
<script src="build/notify-me-wl.min.js"></script>
```

- [ ] **Step 3: Verify the widget now runs**

Serve the page and open it:

```bash
npx --yes serve . -l 4173
```

Open `http://localhost:4173/index.html`, click "Notify Me - Join Waitlist".
Expected: the modal opens showing "Sample Product", a Size select containing Small/Medium/Large, and Email / First name / Last name fields. Before this fix, nothing happened on click.

- [ ] **Step 4: Add the mock customer and recommendations stub**

In `index.html`, immediately after the existing `window.currentProduct` script block and before the `<script src=...>` line, add:

```html
<!--
  Local verification harness. Not part of the shipped widget.
  Add ?mockRecs=1 to the URL to stub the recommendations API with a fixed
  payload, so the section can be checked without a live token. The payload
  deliberately repeats product_ref values (the real service returns one entry
  per variant) so deduping is exercised.
-->
<script>
   if (new URLSearchParams(location.search).has('mockRecs')) {
      window.customer = { email: 'mjhampshire@gmail.com' };
      window.Shopify = { currency: { active: 'AUD' } };

      var MOCK_RECS = {
         customer_id: 'mjhampshire@gmail.com',
         retailer_id: 'twc-fashion-demo',
         recommendations: [
            {
               product: {
                  product_id: '41894306939129',
                  product_ref: '7340330778873',
                  name: 'Thelma Sandal',
                  price: 319.0,
                  original_price: null,
                  image_url:
                     'https://cdn.shopify.com/s/files/1/0600/2963/2761/products/mlouye-thelma-sandal-black-1_1100x_c7c4f762-4c37-40c3-9757-bd5e1c1391e2.jpg?v=1634796354',
                  product_url:
                     'https://twc-fashion-demo.myshopify.com/products/thelma-sandal?variant=41894306939129',
               },
               score: 0.3443859649122807,
            },
            {
               product: {
                  product_id: '41894319849721',
                  product_ref: '7340335923449',
                  name: 'Louise Slide Sandal',
                  price: 357.0,
                  original_price: 399.0,
                  image_url:
                     'https://cdn.shopify.com/s/files/1/0600/2963/2761/products/mlouye-louise-slide-sandal-buttermilk-6_1100x_52cb034a-1d33-496a-8cf4-084b5d4d7c8a.jpg?v=1634796677',
                  product_url:
                     'https://twc-fashion-demo.myshopify.com/products/louise-slide-sandal?variant=41894319849721',
               },
               score: 0.29272807017543856,
            },
            {
               product: {
                  product_id: '41894330138873',
                  product_ref: '7340337660153',
                  name: 'Pleated Heel Mule',
                  price: 355.0,
                  original_price: null,
                  image_url:
                     'https://cdn.shopify.com/s/files/1/0600/2963/2761/products/mlouye-pleated-heel-mules-denim-5_1100x_1ad6539d-f116-4b55-bee4-2d1bea0f2ed6.jpg?v=1634796909',
                  product_url:
                     'https://twc-fashion-demo.myshopify.com/products/pleated-heel-mule?variant=41894330138873',
               },
               score: 0.25407375438596486,
            },
            {
               product: {
                  product_id: '41894308086009',
                  product_ref: '7340330778873',
                  name: 'Thelma Sandal',
                  price: 319.0,
                  original_price: null,
                  image_url:
                     'https://cdn.shopify.com/s/files/1/0600/2963/2761/products/mlouye-thelma-sandal-white-1_1100x_8a80e3cc-1c5c-40d7-8d32-99d1fae5c67a.jpg?v=1634796364',
                  product_url:
                     'https://twc-fashion-demo.myshopify.com/products/thelma-sandal?variant=41894308086009',
               },
               score: 0.22197481578947365,
            },
            {
               product: {
                  product_id: '41894195986681',
                  product_ref: '7340309020921',
                  name: 'Small Convertible Flex Bag SL test',
                  price: 328.0,
                  original_price: null,
                  image_url:
                     'https://cdn.shopify.com/s/files/1/0600/2963/2761/products/mlouye-small-convertible-flex-bag-clay-1_1_1100x_56f063f3-ec9e-45c6-b951-1b8894212532.jpg?v=1634788900',
                  product_url:
                     'https://twc-fashion-demo.myshopify.com/products/small-convertible-flex-bag?variant=41894195986681',
               },
               score: 0.20403508771929824,
            },
            {
               product: {
                  product_id: '41894329680121',
                  product_ref: '7340337660153',
                  name: 'Pleated Heel Mule',
                  price: 355.0,
                  original_price: null,
                  image_url:
                     'https://cdn.shopify.com/s/files/1/0600/2963/2761/products/mlouye-pleated-mules-olive-1_1800x1800_1100x_7cb95bd3-9379-4fc4-bd4c-9bdfa8c78254.jpg?v=1634796909',
                  product_url:
                     'https://twc-fashion-demo.myshopify.com/products/pleated-heel-mule?variant=41894329680121',
               },
               score: 0.20300492975438592,
            },
         ],
      };

      var realFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
         var url = typeof input === 'string' ? input : input.url;
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
   }
</script>
```

- [ ] **Step 5: Verify the stub is inert and installed**

Open `http://localhost:4173/index.html?mockRecs=1` and in the browser console run:

```js
window.customer.email
fetch('https://example.com/services/recommendations/x/y').then(r => r.json()).then(d => console.log(d.recommendations.length))
```

Expected: `"mjhampshire@gmail.com"`, then `[mockRecs] intercepted …` logged followed by `6`.
Then open `http://localhost:4173/index.html` (no query param) and run `window.customer` — expected `undefined`, confirming the harness is opt-in.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
fix: point demo page at the emitted bundle and add a recommendations mock

The demo loaded build/notify-me-wl.js, which rollup never emits, so the
widget never initialised. Also adds an opt-in ?mockRecs=1 harness that
stubs the recommendations API for local verification.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extract shared auth-token resolution

`src/api/customer-interest.ts` inlines the choice between the bundled token and a Shopify App Proxy token. The recommendations client needs the same logic, so move it out. This task is a pure refactor with no behaviour change.

**Files:**
- Create: `src/auth/resolve-token.ts`
- Modify: `src/api/customer-interest.ts:1-24`

**Interfaces:**
- Consumes: `getProxyAccessToken(proxyApp: string): Promise<string | null>` from `src/auth/proxy-token.ts`; `ACCESS_TOKEN` from `src/config.ts`.
- Produces: `resolveAuthToken(authMode: AuthMode, proxyApp: string): Promise<string | null>` — the full `Authorization` header value (already prefixed with `Bearer `), or `null` when proxy mode cannot obtain a token.

- [ ] **Step 1: Create the resolver**

Create `src/auth/resolve-token.ts`:

```ts
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
```

- [ ] **Step 2: Rewrite the customer-interest client to use it**

Replace the whole of `src/api/customer-interest.ts` with:

```ts
import type { AuthMode } from '../types';
import { CUSTOMER_INTEREST_URL } from '../config';
import { resolveAuthToken } from '../auth/resolve-token';

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
  proxyApp: string,
): Promise<SubmitResult> {
  const authToken = await resolveAuthToken(authMode, proxyApp);
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
```

Note the `ACCESS_TOKEN` and `getProxyAccessToken` imports are gone — `resolveAuthToken` owns both now.

- [ ] **Step 3: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: both exit 0, no output from typecheck. If typecheck reports `ACCESS_TOKEN is declared but never read` or similar, an import was left behind in `customer-interest.ts`.

- [ ] **Step 4: Verify submission behaviour is unchanged**

Open `http://localhost:4173/index.html`, open the modal, pick a size, enter an email and names, and submit with the Network tab open.
Expected: a `POST` to `…/wsservice/api/wishlist/items/customerInterest` carrying `Authorization: Bearer …` and `X-Twc-Tenant: victoria-woods`. The bundled token is long expired, so the response will be a 401 and the modal will show "Something went wrong. Please try again." — that is the correct pre-existing behaviour. What matters is that the request is still made with both headers.

- [ ] **Step 5: Commit**

```bash
git add src/auth/resolve-token.ts src/api/customer-interest.ts
git commit -m "$(cat <<'EOF'
refactor: extract shared auth token resolution

Both API clients need to turn an auth mode into an Authorization header;
move that decision into src/auth/resolve-token.ts so it cannot drift.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Config, types, and widget attributes

Add everything the later tasks type against, and parse the three new `data-*` attributes. Nothing consumes them yet.

**Files:**
- Modify: `src/config.ts:13-15`
- Modify: `src/types.ts:1-39`
- Modify: `src/global.d.ts:4-22`
- Modify: `src/index.ts:16-39`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `RECOMMENDATIONS_URL_BASE: string` from `src/config.ts`.
  - `RecommendedProduct` from `src/types.ts` with fields `id`, `ref`, `name`, `imageUrl`, `productUrl` (all `string`), `price` (`number`), `originalPrice` (`number | null`).
  - `WidgetConfig` gains `recommendationsEnabled: boolean`, `recommendationsCount: number`, `customerEmail: string | null`.
  - `window.customer.email?: string` and `window.Shopify.currency?.active?: string`.

- [ ] **Step 1: Add the API base URL**

Append to `src/config.ts`:

```ts
// Recommendations API base. The retailer id (same value as the tenant) and the
// URL-encoded customer email are appended as path segments.
export const RECOMMENDATIONS_URL_BASE =
  'https://api.au-aws.thewishlist.io/services/recommendations/api/v1/recommendations';
```

- [ ] **Step 2: Add the product type and extend the widget config**

In `src/types.ts`, add after the `Product` interface:

```ts
// A recommendation flattened to just what the widget renders. Built from the
// service's nested `{ product: { … }, score, … }` entries.
export interface RecommendedProduct {
  id: string;
  // The service returns one entry per variant, so several entries can share a
  // product_ref. This is what deduping keys on.
  ref: string;
  name: string;
  imageUrl: string;
  productUrl: string;
  price: number;
  originalPrice: number | null;
}
```

and extend `WidgetConfig`:

```ts
export interface WidgetConfig {
  fields: FieldName[];
  type: WidgetType;
  authMode: AuthMode;
  tenant: string;
  // Shopify App Proxy app name; forms the `/apps/<name>/...` URL prefix used by
  // the 'proxy' auth mode.
  proxyApp: string;
  marketId: string | null;
  // "Shop similar styles" section.
  recommendationsEnabled: boolean;
  recommendationsCount: number;
  // Email resolved at init (attribute or Shopify context). Null for guests, who
  // fall back to the email they submit through the form.
  customerEmail: string | null;
}
```

- [ ] **Step 3: Extend the window globals**

In `src/global.d.ts`, add `currency` to `Shopify` and `email` to `customer`:

```ts
    Shopify?: {
      country?: string;
      locale?: string;
      currency?: {
        active?: string;
      };
      markets?: {
        currentMarket?: {
          countryCode?: string;
          id?: string | number;
        };
      };
    };
    customer?: {
      // Not provided by Shopify by default — the merchant's theme must expose it,
      // e.g. `window.customer = {{ customer | json }}` in a Liquid template.
      email?: string;
      default_address?: {
        country_code?: string;
        province_code?: string;
      };
    };
```

- [ ] **Step 4: Parse the new attributes**

In `src/index.ts`, after the `proxyApp` line and before `const countryCtx = …`, add:

```ts
  // "Shop similar styles" section. Opt-out via data-recommendations="false".
  const recommendationsEnabled =
    openButton.getAttribute('data-recommendations') !== 'false';
  const parsedCount = parseInt(
    openButton.getAttribute('data-recommendations-count') || '',
    10,
  );
  const recommendationsCount =
    Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 4;
```

and add the three fields to the `config` object literal:

```ts
  const config: WidgetConfig = {
    fields,
    type,
    authMode,
    tenant,
    proxyApp,
    marketId,
    recommendationsEnabled,
    recommendationsCount,
    customerEmail: null,
  };
```

`customerEmail` stays `null` here; Task 4 fills it in.

- [ ] **Step 5: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: both exit 0. A `Property 'recommendationsEnabled' is missing` error means the `config` literal in Step 4 was not updated.

- [ ] **Step 6: Verify no behaviour changed**

Open `http://localhost:4173/index.html`, open the modal, submit the form.
Expected: identical to Task 2 — the modal opens and submits exactly as before. These are type and config additions only.

- [ ] **Step 7: Commit**

```bash
git add src/config.ts src/types.ts src/global.d.ts src/index.ts
git commit -m "$(cat <<'EOF'
feat: add recommendations config, types, and data attributes

Adds RECOMMENDATIONS_URL_BASE, the RecommendedProduct type, and parsing for
data-recommendations and data-recommendations-count. Nothing consumes them yet.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Customer email resolution

**Files:**
- Create: `src/context/customer-email.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `window.customer.email` (declared in Task 3).
- Produces: `resolveCustomerEmail(openButton: HTMLElement): string | null`, and `config.customerEmail` is now populated from it.

- [ ] **Step 1: Create the resolver**

Create `src/context/customer-email.ts`:

```ts
// Resolve the customer email that the recommendations API takes as a path
// segment. Order of precedence:
//   1. data-customer-email on the open button — a test/QA override.
//   2. window.customer.email — a logged-in Shopify customer. Shopify does not
//      expose this by default; the merchant's theme must inject it, the same
//      way it injects window.currentProduct.
// Returns null when neither is available. The widget then falls back to the
// email the shopper submits through the form.
export function resolveCustomerEmail(openButton: HTMLElement): string | null {
  const override = openButton.getAttribute('data-customer-email');
  if (override && override.trim()) return override.trim();

  const themeEmail = window.customer && window.customer.email;
  if (themeEmail && themeEmail.trim()) return themeEmail.trim();

  return null;
}
```

- [ ] **Step 2: Wire it into init**

In `src/index.ts`, add the import alongside the other context import:

```ts
import { resolveCustomerEmail } from './context/customer-email';
```

and replace `customerEmail: null,` in the `config` literal with:

```ts
    customerEmail: resolveCustomerEmail(openButton),
```

- [ ] **Step 3: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: both exit 0.

- [ ] **Step 4: Verify each resolution source**

There is no consumer yet, so check the resolver directly in the console. Open `http://localhost:4173/index.html?mockRecs=1` and run:

```js
window.customer.email
```

Expected: `"mjhampshire@gmail.com"` — confirming the mock harness sets what the resolver reads.

Then edit `index.html` to add `data-customer-email="override@example.com"` to the `#popup-open` button, reload with `?mockRecs=1`, and confirm in the console:

```js
document.getElementById('popup-open').getAttribute('data-customer-email')
```

Expected: `"override@example.com"`. Per the precedence rules this attribute wins over `window.customer.email`. **Remove the attribute from `index.html` again before committing** — Task 8 documents it, but the default demo page should exercise the Shopify-context path.

- [ ] **Step 5: Commit**

```bash
git add src/context/customer-email.ts src/index.ts
git commit -m "$(cat <<'EOF'
feat: resolve customer email from attribute or Shopify context

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Recommendations API client

**Files:**
- Create: `src/api/recommendations.ts`

**Interfaces:**
- Consumes: `resolveAuthToken` (Task 2), `RECOMMENDATIONS_URL_BASE` (Task 3), `RecommendedProduct` (Task 3).
- Produces:
  - `normalizeRecommendations(raw: unknown, count: number): RecommendedProduct[]` — exported so it can be reasoned about and checked independently.
  - `fetchRecommendations(params: { email: string; tenant: string; authMode: AuthMode; proxyApp: string; count: number }): Promise<RecommendedProduct[]>`.

- [ ] **Step 1: Create the client**

Create `src/api/recommendations.ts`:

```ts
import type { AuthMode, RecommendedProduct } from '../types';
import { RECOMMENDATIONS_URL_BASE } from '../config';
import { resolveAuthToken } from '../auth/resolve-token';

// Only the fields the widget renders. Everything else the service returns
// (score_breakdown, attributes, sizing, metrics, …) is ignored.
interface RawProduct {
  product_id?: string;
  product_ref?: string;
  name?: string;
  image_url?: string | null;
  product_url?: string | null;
  price?: number | null;
  original_price?: number | null;
}

interface RawRecommendation {
  product?: RawProduct;
  score?: number;
}

// The service returns one entry per variant, so a single product shows up
// several times as different colourways. Ask for more than we display so
// deduping still leaves a full row.
const OVER_FETCH_FACTOR = 3;

// Page-session cache, keyed by tenant + email + count. Opening and closing the
// modal must not refetch.
const cache = new Map<string, RecommendedProduct[]>();

// Flatten, drop unrenderable entries, dedupe by product_ref keeping the highest
// score, and trim to `count`. Tolerates any shape — anything unexpected yields
// an empty list rather than throwing.
export function normalizeRecommendations(
  raw: unknown,
  count: number,
): RecommendedProduct[] {
  const list = raw && (raw as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(list)) return [];

  const bestByRef = new Map<
    string,
    { product: RecommendedProduct; score: number }
  >();

  (list as RawRecommendation[]).forEach((entry) => {
    const rawProduct = entry && entry.product;
    if (!rawProduct) return;

    const name =
      typeof rawProduct.name === 'string' ? rawProduct.name.trim() : '';
    const imageUrl =
      typeof rawProduct.image_url === 'string' ? rawProduct.image_url : '';
    const productUrl =
      typeof rawProduct.product_url === 'string' ? rawProduct.product_url : '';
    // A card without any of these cannot be rendered usefully.
    if (!name || !imageUrl || !productUrl) return;

    const ref = String(
      rawProduct.product_ref || rawProduct.product_id || productUrl,
    );
    const score = typeof entry.score === 'number' ? entry.score : 0;

    const existing = bestByRef.get(ref);
    if (existing && existing.score >= score) return;

    bestByRef.set(ref, {
      score,
      product: {
        id: String(rawProduct.product_id || ref),
        ref,
        name,
        imageUrl,
        productUrl,
        price: typeof rawProduct.price === 'number' ? rawProduct.price : 0,
        originalPrice:
          typeof rawProduct.original_price === 'number'
            ? rawProduct.original_price
            : null,
      },
    });
  });

  return Array.from(bestByRef.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((entry) => entry.product);
}

// Fetch recommendations for a customer. Every failure — no auth token, network
// error, non-OK status, unparseable body, unexpected shape — resolves to an
// empty list, because this feature must never disrupt the notify-me flow.
export async function fetchRecommendations(params: {
  email: string;
  tenant: string;
  authMode: AuthMode;
  proxyApp: string;
  count: number;
}): Promise<RecommendedProduct[]> {
  const { email, tenant, authMode, proxyApp, count } = params;

  const cacheKey = `${tenant}|${email}|${count}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const authToken = await resolveAuthToken(authMode, proxyApp);
  if (!authToken) return [];

  const url =
    `${RECOMMENDATIONS_URL_BASE}/${encodeURIComponent(tenant)}` +
    `/${encodeURIComponent(email)}?n=${count * OVER_FETCH_FACTOR}`;

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
      return [];
    }

    const body = await response.json().catch(() => null);
    const products = normalizeRecommendations(body, count);
    cache.set(cacheKey, products);
    return products;
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return [];
  }
}
```

Note `cache.set` runs only after a successful parse, so a transient failure is retried on the next open rather than being cached as empty.

- [ ] **Step 2: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: both exit 0.

- [ ] **Step 3: Confirm the dedupe logic against the mock payload by hand**

Nothing calls this module yet, so trace it against the Task 1 payload rather than running it. With `count = 4`, the six mock entries carry four distinct `product_ref` values:

| `product_ref` | Entries | Highest score | Kept as |
| --- | --- | --- | --- |
| `7340330778873` | Thelma black (0.344), Thelma white (0.222) | 0.344 | Thelma Sandal (black) |
| `7340335923449` | Louise buttermilk (0.293) | 0.293 | Louise Slide Sandal |
| `7340337660153` | Mule denim (0.254), Mule olive (0.203) | 0.254 | Pleated Heel Mule (denim) |
| `7340309020921` | Flex Bag clay (0.204) | 0.204 | Small Convertible Flex Bag SL test |

Expected result: exactly 4 products, in score order — Thelma Sandal, Louise Slide Sandal, Pleated Heel Mule, Small Convertible Flex Bag SL test. Task 7 verifies this in the browser; this step is the reviewer's reference for what correct looks like.

- [ ] **Step 4: Commit**

```bash
git add src/api/recommendations.ts
git commit -m "$(cat <<'EOF'
feat: add recommendations API client

Fetches, flattens, dedupes by product_ref, and caches recommendations.
Every failure mode resolves to an empty list so the notify-me flow is
never disrupted.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Section renderer and styles

**Files:**
- Create: `src/ui/recommendations.ts`
- Modify: `src/ui/styles.ts:183` (insert before the `@media (prefers-reduced-motion: reduce)` block)

**Interfaces:**
- Consumes: `RecommendedProduct` (Task 3), `window.Shopify.currency.active` (Task 3).
- Produces:
  - `createRecommendationsSection(products: RecommendedProduct[]): HTMLElement | null` — null for an empty list.
  - `removeRecommendationsSection(): void`.
  - The rendered element carries `id="twc-nm-recs"`, which Task 7 uses as its "already rendered" check.

- [ ] **Step 1: Create the renderer**

Create `src/ui/recommendations.ts`:

```ts
import type { RecommendedProduct } from '../types';

export const RECS_SECTION_ID = 'twc-nm-recs';
const RECS_TITLE_ID = 'twc-nm-recs-title';

// Format a price in the storefront's active currency when Shopify exposes it.
// Without a known currency, render a plain number rather than guessing a symbol
// and showing the shopper the wrong one.
function formatPrice(value: number): string {
  const currency =
    window.Shopify && window.Shopify.currency && window.Shopify.currency.active;

  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
      }).format(value);
    } catch (error) {
      // Unrecognised currency code — fall through to the plain format.
    }
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// Built with DOM APIs rather than innerHTML: every field here is remote data.
function buildCard(product: RecommendedProduct): HTMLAnchorElement {
  const card = document.createElement('a');
  card.className = 'twc-nm-rec';
  card.href = product.productUrl;
  // New tab, so a shopper browsing before submitting does not lose the form.
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

  const imageBox = document.createElement('div');
  imageBox.className = 'twc-nm-rec-imgbox';

  const image = document.createElement('img');
  image.className = 'twc-nm-rec-img';
  image.src = product.imageUrl;
  image.alt = product.name;
  image.loading = 'lazy';
  image.decoding = 'async';
  imageBox.appendChild(image);
  card.appendChild(imageBox);

  const name = document.createElement('span');
  name.className = 'twc-nm-rec-name';
  name.textContent = product.name;
  card.appendChild(name);

  const price = document.createElement('span');
  price.className = 'twc-nm-rec-price';
  if (product.originalPrice !== null && product.originalPrice > product.price) {
    const was = document.createElement('s');
    was.className = 'twc-nm-rec-was';
    was.textContent = formatPrice(product.originalPrice);
    price.appendChild(was);
    price.appendChild(document.createTextNode(' '));
  }
  price.appendChild(document.createTextNode(formatPrice(product.price)));
  card.appendChild(price);

  return card;
}

// Build the "Shop similar styles" section. Returns null for an empty list so
// the caller can skip insertion entirely rather than render an empty heading.
export function createRecommendationsSection(
  products: RecommendedProduct[],
): HTMLElement | null {
  if (!products.length) return null;

  const section = document.createElement('section');
  section.id = RECS_SECTION_ID;
  section.className = 'twc-nm-recs';
  section.setAttribute('aria-labelledby', RECS_TITLE_ID);

  const title = document.createElement('h3');
  title.id = RECS_TITLE_ID;
  title.className = 'twc-nm-recs-title';
  title.textContent = 'Shop similar styles';
  section.appendChild(title);

  const row = document.createElement('div');
  row.className = 'twc-nm-recs-row';
  products.forEach((product) => {
    row.appendChild(buildCard(product));
  });
  section.appendChild(row);

  return section;
}

// Tear the section down on close so reopening does not stack duplicates.
export function removeRecommendationsSection(): void {
  const existing = document.getElementById(RECS_SECTION_ID);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}
```

- [ ] **Step 2: Add the styles**

In `src/ui/styles.ts`, insert this immediately before the `@media (prefers-reduced-motion: reduce)` block:

```css
        #twc-nm-overlay .twc-nm-recs {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }
        #twc-nm-overlay .twc-nm-recs-title {
            margin: 0 0 12px;
            font-size: 14px;
            font-weight: 600;
            color: #111827;
        }
        #twc-nm-overlay .twc-nm-recs-row {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 8px;
            scrollbar-width: thin;
        }
        #twc-nm-overlay .twc-nm-rec {
            flex: 0 0 132px;
            scroll-snap-align: start;
            display: flex;
            flex-direction: column;
            gap: 6px;
            color: inherit;
            text-decoration: none;
        }
        #twc-nm-overlay .twc-nm-rec:focus-visible {
            outline: 2px solid #111827;
            outline-offset: 2px;
            border-radius: 8px;
        }
        #twc-nm-overlay .twc-nm-rec-imgbox {
            aspect-ratio: 3 / 4;
            overflow: hidden;
            border-radius: 8px;
            background: #f3f4f6;
        }
        #twc-nm-overlay .twc-nm-rec-img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: opacity 150ms ease;
        }
        #twc-nm-overlay .twc-nm-rec:hover .twc-nm-rec-img {
            opacity: 0.85;
        }
        #twc-nm-overlay .twc-nm-rec-name {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 13px;
            line-height: 1.35;
            color: #111827;
        }
        #twc-nm-overlay .twc-nm-rec-price {
            font-size: 13px;
            font-weight: 600;
            color: #111827;
        }
        #twc-nm-overlay .twc-nm-rec-was {
            margin-right: 4px;
            font-weight: 400;
            color: #9ca3af;
        }
```

Then extend the existing reduced-motion block so the new transition is suppressed too. Replace:

```css
        @media (prefers-reduced-motion: reduce) {
            #twc-nm-overlay,
            #twc-nm-overlay .twc-nm-card {
                transition: none;
            }
```

with:

```css
        @media (prefers-reduced-motion: reduce) {
            #twc-nm-overlay,
            #twc-nm-overlay .twc-nm-card,
            #twc-nm-overlay .twc-nm-rec-img {
                transition: none;
            }
```

- [ ] **Step 3: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: both exit 0.

- [ ] **Step 4: Verify the styles visually**

Nothing calls the renderer yet, so inject equivalent static markup by hand. Open `http://localhost:4173/index.html`, click the button to open the modal, then paste into the console:

```js
document.querySelector('#twc-nm-overlay .twc-nm-card').insertAdjacentHTML('beforeend', `
<section class="twc-nm-recs" aria-labelledby="t"><h3 id="t" class="twc-nm-recs-title">Shop similar styles</h3>
<div class="twc-nm-recs-row">${[
  ['Thelma Sandal','$319','https://cdn.shopify.com/s/files/1/0600/2963/2761/products/mlouye-thelma-sandal-black-1_1100x_c7c4f762-4c37-40c3-9757-bd5e1c1391e2.jpg'],
  ['Louise Slide Sandal','$357','https://cdn.shopify.com/s/files/1/0600/2963/2761/products/mlouye-louise-slide-sandal-buttermilk-6_1100x_52cb034a-1d33-496a-8cf4-084b5d4d7c8a.jpg'],
  ['Pleated Heel Mule','$355','https://cdn.shopify.com/s/files/1/0600/2963/2761/products/mlouye-pleated-heel-mules-denim-5_1100x_1ad6539d-f116-4b55-bee4-2d1bea0f2ed6.jpg'],
  ['Small Convertible Flex Bag SL test','$328','https://cdn.shopify.com/s/files/1/0600/2963/2761/products/mlouye-small-convertible-flex-bag-clay-1_1_1100x_56f063f3-ec9e-45c6-b951-1b8894212532.jpg'],
].map(([n,p,i]) => `<a class="twc-nm-rec" href="#"><div class="twc-nm-rec-imgbox"><img class="twc-nm-rec-img" src="${i}" alt=""></div><span class="twc-nm-rec-name">${n}</span><span class="twc-nm-rec-price">${p}</span></a>`).join('')}</div></section>`)
```

Expected, all of which must hold:
- A hairline divider separates the section from the form.
- The heading reads "Shop similar styles".
- Cards sit in one row; the fourth is partly cut off at the card's right edge, signalling that the row scrolls.
- Dragging or shift-scrolling the row scrolls it horizontally and it snaps to card boundaries.
- Images fill their boxes at a 3:4 ratio with no distortion; the grey placeholder box is visible before each image loads.
- "Small Convertible Flex Bag SL test" clamps to two lines with an ellipsis rather than pushing the card taller.
- The modal card itself does not scroll horizontally — only the row does.
- Tabbing moves focus through the cards with a visible black outline, scrolling each into view.

Reload the page to discard the injected markup.

- [ ] **Step 5: Commit**

```bash
git add src/ui/recommendations.ts src/ui/styles.ts
git commit -m "$(cat <<'EOF'
feat: add 'Shop similar styles' section renderer and styles

Horizontally scrolling product row built with DOM APIs (the fields are
remote data), namespaced under #twc-nm-overlay like the rest of the widget.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Wire the section into the widget

The feature becomes live here: fetch on open for a known customer, fetch after submit for a guest, suppress the auto-close when products are shown, and tear down on close.

**Files:**
- Modify: `src/ui/widget.ts:1-3` (imports), `:28-29` (config destructuring), `:178-186` (`closePopup`), `:188-211` (`showPopup`), `:271-295` (submit handler)

**Interfaces:**
- Consumes: `fetchRecommendations` (Task 5), `createRecommendationsSection` / `removeRecommendationsSection` / `RECS_SECTION_ID` (Task 6), `config.recommendationsEnabled` / `recommendationsCount` / `customerEmail` (Tasks 3–4), `SubmitResult` (Task 2).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the imports**

At the top of `src/ui/widget.ts`, alongside the existing imports:

```ts
import { submitCustomerInterest, type SubmitResult } from '../api/customer-interest';
import { fetchRecommendations } from '../api/recommendations';
import {
  createRecommendationsSection,
  removeRecommendationsSection,
  RECS_SECTION_ID,
} from './recommendations';
```

This replaces the existing `import { submitCustomerInterest } from '../api/customer-interest';` line — do not leave both.

- [ ] **Step 2: Destructure the new config fields**

Change:

```ts
  const { fields, type, authMode, tenant, proxyApp, marketId } = config;
```

to:

```ts
  const {
    fields,
    type,
    authMode,
    tenant,
    proxyApp,
    marketId,
    recommendationsEnabled,
    recommendationsCount,
    customerEmail,
  } = config;
```

- [ ] **Step 3: Add the fetch-and-render helper**

Insert this immediately after the `isChecked` helper (just before the `// Open / close the popup.` comment):

```ts
  const cardEl = overlayEl.querySelector<HTMLElement>('.twc-nm-card');

  // Fetch and render "Shop similar styles" for `email`. Resolves to true when a
  // section is on screen, which is what tells the submit path to skip the
  // auto-close and leave the shopper room to browse.
  async function showRecommendations(email: string): Promise<boolean> {
    if (!recommendationsEnabled || !cardEl) return false;
    // Already rendered by the on-open path — nothing to do.
    if (document.getElementById(RECS_SECTION_ID)) return true;

    const products = await fetchRecommendations({
      email,
      tenant,
      authMode,
      proxyApp,
      count: recommendationsCount,
    });

    const section = createRecommendationsSection(products);
    if (!section) return false;
    // The shopper may have closed the popup while the request was in flight.
    if (!overlayEl!.classList.contains('is-open')) return false;
    // And another call may have won the race while we awaited.
    if (document.getElementById(RECS_SECTION_ID)) return true;

    cardEl.appendChild(section);
    return true;
  }
```

- [ ] **Step 4: Tear the section down on close**

In `closePopup`, add `removeRecommendationsSection();` after `clearStatus();`:

```ts
  function closePopup(): void {
    overlayEl!.classList.remove('is-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    clearStatus();
    removeRecommendationsSection();
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }
```

The module cache in `fetchRecommendations` means reopening re-renders without a second request.

- [ ] **Step 5: Fetch on open for a known customer**

In `showPopup`, insert between the `variantsPopulated` block and the `firstControl` focus lines:

```ts
    // Logged-in customers (or a data-customer-email override) get the section
    // straight away. Deliberately not awaited — the modal opens immediately and
    // the section appears when the request resolves.
    if (customerEmail) {
      void showRecommendations(customerEmail);
    }
```

This sits after the `if (!productData)` guard, so a broken product page shows the error state alone.

- [ ] **Step 6: Rework the submit result handling**

Replace the whole `try { … } finally { … }` block at the end of the submit handler with:

```ts
    let result: SubmitResult = { ok: false, reason: 'error' };
    try {
      result = await submitCustomerInterest(formData, authMode, tenant, proxyApp);
    } finally {
      // Restore the button before any recommendations request, so it is not
      // stuck on "Sending…" while that resolves.
      submitBtn.disabled = false;
      submitBtn.textContent = originalButtonText;
    }

    if (result.ok) {
      setStatus('success', "You're on the list. We'll be in touch.");

      // Guests have no email until now — use the one they just submitted.
      const email = customerEmail || getValue("input[name='email']");
      const showingRecs = email ? await showRecommendations(email) : false;

      // Leave the modal open when there is something to browse; otherwise keep
      // the original auto-close.
      if (!showingRecs) setTimeout(closePopup, 1500);
    } else if (result.reason === 'auth') {
      setStatus('error', 'Please log in to your account to continue.');
    } else {
      setStatus('error', 'Something went wrong. Please try again.');
    }
```

- [ ] **Step 7: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: both exit 0. If typecheck reports `'SubmitResult' is a type and must be imported using a type-only import`, the Step 1 import is missing the `type` keyword on that specifier.

- [ ] **Step 8: Verify the logged-in path**

Open `http://localhost:4173/index.html?mockRecs=1` and click the button.
Expected:
- The modal opens immediately with the form.
- `[mockRecs] intercepted …/recommendations/victoria-woods/mjhampshire%40gmail.com?n=12` appears in the console — note the tenant path segment, the encoded `@`, and `n=12` (4 × 3).
- The section appears under the form with exactly **4** cards: Thelma Sandal, Louise Slide Sandal, Pleated Heel Mule, Small Convertible Flex Bag SL test. Neither Thelma nor Pleated Heel Mule appears twice.
- Prices render as `A$319.00` etc. (the mock sets `Shopify.currency.active = 'AUD'`), and Louise shows `A$399.00` struck through before `A$357.00`.
- Clicking a card opens the Shopify product page in a **new tab**, leaving the modal open.

- [ ] **Step 9: Verify caching and teardown**

Still on `?mockRecs=1`: close the modal with ×, then reopen it.
Expected: the section reappears with the same 4 cards, and **no** second `[mockRecs] intercepted` line is logged. Inspect the DOM and confirm there is exactly one `#twc-nm-recs` element.
Close with Esc and with a backdrop click and confirm both also remove the section.

- [ ] **Step 10: Verify the guest path and conditional auto-close**

`customerEmail` is resolved once at page init, before any console command can run, so simulate a guest by editing the harness: in `index.html`, comment out the `window.customer = { email: … };` line inside the `?mockRecs=1` block. Reload `http://localhost:4173/index.html?mockRecs=1`.

Then open the modal, pick a size, fill in the fields (the demo page includes `email` in `data-fields`), and submit.
Expected: the success message appears, the request goes out with the **submitted** email in the path, the section renders, and the modal **stays open** past 1.5s.

Now reload without `?mockRecs=1` (so the real API is hit and returns nothing usable) and submit again.
Expected: no section, and the modal auto-closes after ~1.5s — the original behaviour.

Uncomment the `window.customer` line in `index.html` before committing.

- [ ] **Step 11: Verify the opt-out**

Add `data-recommendations="false"` to the `#popup-open` button in `index.html`, reload with `?mockRecs=1`, and open the modal.
Expected: no section, and **no** `[mockRecs] intercepted` line — the request is never made. Remove the attribute again before committing.

- [ ] **Step 12: Verify submission is unaffected by a recommendations failure**

With `?mockRecs=1`, edit the stub's URL match temporarily so it returns a 500 instead of the payload (change `status: 200` to `status: 500`), reload, and submit.
Expected: the success/error status from the customer-interest call behaves exactly as before, `Recommendations request failed: 500` is logged, no section renders, and the modal auto-closes after 1.5s. Restore `status: 200` before committing.

- [ ] **Step 13: Commit**

```bash
git add src/ui/widget.ts
git commit -m "$(cat <<'EOF'
feat: render 'Shop similar styles' in the notify-me modal

Fetches on open for a known customer and after submit for a guest. The
1.5s success auto-close is skipped when products are shown, so the shopper
can browse; the section is torn down on close.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Document the feature

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the attributes added in Task 3 and Task 4.
- Produces: nothing.

- [ ] **Step 1: Add a Features bullet**

In the `#### Features:` list in `README.md`, add:

```markdown
- Optional "Shop similar styles" section under the form, showing personalised product recommendations for the customer.
```

- [ ] **Step 2: Document the new attributes**

In the `### Configuration` list, after the `data-proxy-app` bullet, add:

```markdown
- `data-recommendations`: Set to `"false"` to disable the "Shop similar styles" section. Enabled by default.
- `data-recommendations-count`: How many products to show. Defaults to `4`. Non-numeric or non-positive values fall back to `4`.
- `data-customer-email`: Overrides the customer email used to request recommendations. Intended for testing — in production the email comes from the Shopify customer context, or from the email the shopper submits.
```

- [ ] **Step 3: Add a section explaining the feature**

After the `### Proxy auth mode` section, add the following. Note this outer block is fenced with four backticks because the content itself contains fenced blocks — copy the inner content only.

````markdown
### Shop similar styles

When enabled, the widget shows a horizontally scrolling row of recommended products
beneath the form, fetched from:

```
https://api.au-aws.thewishlist.io/services/recommendations/api/v1/recommendations/<tenant>/<customerEmail>
```

The request carries the same `Authorization` and `X-Twc-Tenant` headers as the
customer-interest call, and the tenant doubles as the retailer id in the path.

The API needs a customer email, resolved in this order:

1. `data-customer-email` on the open button (testing).
2. `window.customer.email` — a logged-in Shopify customer. The section then appears
   as soon as the modal opens.
3. The email the shopper submits through the form. The section appears after a
   successful submit, and the modal stays open instead of auto-closing so they can
   browse.

Shopify does **not** expose `window.customer` by default. To get recommendations for
logged-in customers, the theme must inject it, the same way it injects
`window.currentProduct`:

```liquid
<script>
  {% if customer %}
    window.customer = { email: {{ customer.email | json }} };
  {% endif %}
</script>
```

If no email can be resolved, or the request fails or returns nothing, the section is
simply not rendered. It never blocks or alters the notify-me submission.
````

- [ ] **Step 4: Verify the README renders**

Run:

```bash
grep -n 'Shop similar styles\|data-recommendations\|data-customer-email' README.md
```

Expected: matches in the Features list, the Configuration list, and the new section. Check the nested code fences render correctly in a Markdown preview — the Liquid block and the URL block are both inside the new section.

- [ ] **Step 5: Final full verification**

```bash
npm run typecheck && npm run build && git status --short
```

Expected: both commands exit 0. `git status` should show only `build/notify-me-wl.min.js` as modified (the rebuilt bundle) plus the staged README — no stray edits left over from the Task 7 verification steps (`data-recommendations="false"`, `data-customer-email`, `status: 500`).

- [ ] **Step 6: Commit**

```bash
git add README.md build/notify-me-wl.min.js
git commit -m "$(cat <<'EOF'
docs: document the 'Shop similar styles' recommendations section

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Spec Coverage

| Spec requirement | Task |
| --- | --- |
| Email order: attribute → `window.customer.email` → submitted | 4, 7 |
| `window.customer` documented as theme-injected | 8 |
| `GET {base}/{tenant}/{email}?n=` with Bearer + `X-Twc-Tenant` | 5 |
| `RECOMMENDATIONS_URL_BASE` in `config.ts` | 3 |
| `resolveAuthToken` extracted, `customer-interest` refactored | 2 |
| `RecommendedProduct` normalisation | 3, 5 |
| Drop entries missing image / url / name | 5 |
| Dedupe by `product_ref`, keep highest score | 5 |
| Over-fetch `count × 3` | 5 |
| All failures → `[]`, logged, never shown | 5 |
| Per-email page-session cache | 5 |
| `createRecommendationsSection` returns null when empty | 6 |
| Placed after the form, hairline divider | 6, 7 |
| Horizontal scroll row, snap, ~132px cards | 6 |
| `<a target="_blank" rel="noopener">` cards | 6 |
| Lazy images, 3:4 aspect box | 6 |
| Two-line name clamp | 6 |
| Currency from `Shopify.currency.active`, plain fallback | 6 |
| `originalPrice` struck through when greater | 6 |
| Namespaced under `#twc-nm-overlay` | 6 |
| DOM APIs not `innerHTML` for API data | 6 |
| `data-recommendations`, `-count`, `data-customer-email` | 3, 4, 8 |
| Fetch on open (not awaited), guarded | 7 |
| Fetch after successful submit | 7 |
| Conditional auto-close | 7 |
| `closePopup` removes the section | 7 |
| Success message shown before the fetch | 7 |
| `WidgetConfig` and `global.d.ts` additions | 3 |
| Seven manual test cases | 1, 7 |
| README updates | 8 |
