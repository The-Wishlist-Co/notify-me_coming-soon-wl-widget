# Market and Country Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the Shopify market id (numeric portion of the GID), market handle, and country ISO code on every `customerInterest` submission.

**Architecture:** `src/context/detect-country.ts` becomes `src/context/localization.ts`, which takes the widget's open button and returns one `LocalizationContext` covering all four values. Liquid-rendered `data-*` attributes sit at the top of each precedence chain; the existing `window.Shopify` / `window.customer` / `navigator.language` fallbacks are preserved beneath them. `marketId` is stripped to its numeric portion regardless of source.

**Tech Stack:** TypeScript 5.6 (strict), Rollup 4 → single IIFE bundle, no runtime dependencies, no test framework.

**Spec:** `docs/superpowers/specs/2026-08-11-market-localization-capture-design.md`

## Global Constraints

- **No new runtime or dev dependencies.** No test framework is being added.
- **`target: ES2018`, `lib: ["DOM", "DOM.Iterable", "ES2018"]`.** No ES2019+ library methods: no `Array.prototype.flat`/`flatMap`, `Object.fromEntries`, `String.prototype.trimStart`/`trimEnd`, `Promise.allSettled`. Optional chaining and `??` are syntax and downlevel fine.
- **`strict: true`.** Every function in this plan has explicit parameter and return types.
- **`marketId` is always the number only.** `gid://shopify/Market/12345` is sent as `"12345"`. Never send the GID.
- **Absent values are omitted from the payload, never sent as `null`**, matching every other optional field.
- **A malformed value is treated as absent.** No `console.warn`, no `console.error`, no thrown exception — an unrendered `{{ localization.market.id }}` or an empty market must be silent.
- **The shopper's country dropdown selection still wins** over the Liquid value when the field is shown and non-empty. Do not invert this.
- **Commit after every task** using the message given in the task's final step.

## Verification Approach

No test framework — `npm test` is a stub and adding one is out of scope. Each task is gated on:

1. `npm run typecheck` — exits 0, no output.
2. `npm run build` — writes `build/notify-me-wl.min.js`.
3. Browser checks against `index.html`. Serve with:

```bash
python3 -m http.server 4173 --bind 127.0.0.1   # then http://localhost:4173/index.html
```

**The bundled token in `src/config.ts` is expired**, so a real submission returns 401 and the widget shows "Something went wrong". Task 1 therefore builds a `?mockSubmit=1` harness that intercepts the `customerInterest` POST, logs the parsed request body to the console, and returns 200. Every payload check in Tasks 2 and 3 reads that logged object. Build before each browser check — the page loads `build/notify-me-wl.min.js`, not the sources.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `index.html` | Modify | `?mockSubmit=1` payload-logging harness; localization attributes on the demo button |
| `src/types.ts` | Modify | `CountryContext` → `LocalizationContext` + `marketHandle`; drop `marketId` from `WidgetConfig` |
| `src/context/detect-country.ts` | **Delete** | Replaced by the file below |
| `src/context/localization.ts` | Create | Normalisers + `resolveLocalization`; the single precedence chain |
| `src/index.ts` | Modify | Call `resolveLocalization`; drop its own `data-market-id` read |
| `src/ui/widget.ts` | Modify | Rename `countryCtx` → `localization`; read `marketId` from it; add `marketHandle` to the payload |
| `README.md` | Modify | Document the three attributes and the Shopify markets setup |

---

### Task 1: Payload-logging harness

Builds the instrument the next task is verified with. Nothing in `src/` changes, so the payload logged at the end of this task is the *current* behaviour — that baseline is what Task 2 is compared against.

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: nothing.
- Produces: a `?mockSubmit=1` URL parameter that logs `[mockSubmit] payload: <object>` to the browser console on every submit and returns HTTP 200, so the widget shows its success path.

- [ ] **Step 1: Add the submit-stub script block**

In `index.html`, insert this **immediately after** the closing `</script>` of the `window.currentProduct` mock block (currently line 35) and **before** the `<!-- Local verification harness. -->` comment.

Order matters. This block must come first so that the existing `mockRecs` block captures *this* patched `fetch` as its passthrough. The variable is deliberately **not** named `realFetch` — the `mockRecs` block already declares a global `var realFetch`, and reusing the name would make the two stubs call each other forever.

```html
<!--
   Local verification harness. Not part of the shipped widget.
   Add ?mockSubmit=1 to the URL to intercept the customer-interest POST, log the
   payload, and return 200. The bundled token is expired, so without this a real
   submission returns 401 and the payload cannot be inspected.
-->
<script>
   if (new URLSearchParams(location.search).has('mockSubmit')) {
      var nativeFetchForSubmit = window.fetch.bind(window);
      window.fetch = function (input, init) {
         var url = typeof input === 'string' ? input : input.url;

         if (url && url.indexOf('/customerInterest') !== -1) {
            var body = (init || {}).body;
            console.log('[mockSubmit] payload:', body ? JSON.parse(body) : null);
            return Promise.resolve(
               new Response('{}', {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
               }),
            );
         }

         return nativeFetchForSubmit(input, init);
      };
   }
</script>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0, writes `build/notify-me-wl.min.js`.

(No source changed, but the page loads the bundle — build so the browser check runs against current sources.)

- [ ] **Step 3: Verify the harness logs a payload**

Serve, then open `http://localhost:4173/index.html?mockSubmit=1`.

Click "Notify Me - Join Waitlist", fill Email / First name / Last name, pick a Size, submit.

Expected in the console:

```
[mockSubmit] payload: {variantRef: 1, email: "...", subscribe: false, subscribeSms: false, notifyMe: true, firstName: "...", lastName: "...", countryCode: "..."}
```

Expected in the UI: the green "You're on the list. We'll be in touch." message.

Record this object — it is the **baseline**. Note that `marketId` and `marketHandle` are absent, and `countryCode` is whatever `navigator.language` yields (e.g. `"AU"` or `"US"`).

- [ ] **Step 4: Verify the two stubs compose**

Open `http://localhost:4173/index.html?mockSubmit=1&mockRecs=1` and submit again.

Expected: `[mockSubmit] payload:` logs once, then `[mockRecs] config:` and `[mockRecs] intercepted` follow, and the recommendations section renders. If the tab hangs or the console floods, the two `fetch` wrappers are recursing — check that Step 1's block is placed *before* the `mockRecs` block and uses `nativeFetchForSubmit`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "test: add mockSubmit harness for inspecting the customerInterest payload"
```

---

### Task 2: Localization module and payload

The whole behavioural change. It is one task because deleting `detect-country.ts` breaks `src/index.ts` and `src/ui/widget.ts` immediately — there is no intermediate state where the build is green and the work is half done.

**Files:**
- Modify: `src/types.ts:26-30` (the `CountryContext` interface) and `src/types.ts:58-77` (`WidgetConfig`)
- Delete: `src/context/detect-country.ts`
- Create: `src/context/localization.ts`
- Modify: `src/index.ts:52-71`
- Modify: `src/ui/widget.ts` — lines 1, 31-51, 100, 138, 354-369
- Modify: `index.html` (demo button attributes)

**Interfaces:**
- Consumes: `window.Shopify` and `window.customer` as declared in `src/global.d.ts`.
- Produces:
  - `LocalizationContext` in `src/types.ts` — `{ countryCode: string | null; provinceCode: string | null; marketId: string | null; marketHandle: string | null }`.
  - `resolveLocalization(button: HTMLElement): LocalizationContext` from `src/context/localization.ts`.
  - `createWidget` params object: the `countryCtx: CountryContext` property is replaced by `localization: LocalizationContext`, and `WidgetConfig` no longer has `marketId`.

- [ ] **Step 1: Update the types**

In `src/types.ts`, replace the `CountryContext` interface (lines 26-30) with:

```ts
// Everything the widget knows about where the shopper is browsing. Sourced from
// Liquid-rendered data-* attributes first, then runtime detection.
export interface LocalizationContext {
  countryCode: string | null;
  provinceCode: string | null;
  // Numeric portion only, never the full gid://shopify/Market/... string.
  marketId: string | null;
  marketHandle: string | null;
}
```

In the same file, delete the `marketId: string | null;` line from `WidgetConfig` (line 67). It moves onto `LocalizationContext`, which is where the rest of the market data lives.

- [ ] **Step 2: Create the localization module**

Create `src/context/localization.ts`:

```ts
import type { LocalizationContext } from '../types';

// gid://shopify/Market/12345 -> "12345"; a bare "12345" passes through.
// Anything that is not all digits after the last "/" is treated as absent, which
// also catches an unrendered "{{ localization.market.id }}" and the empty string
// Liquid renders when the storefront has no market configured.
export function normalizeMarketId(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const tail = value.split('?')[0].split('/').pop() ?? '';
  return /^\d+$/.test(tail) ? tail : null;
}

// Shopify market handles are lowercase alphanumeric with hyphens. Reject
// anything else rather than forwarding an unrendered Liquid tag to the API.
function normalizeMarketHandle(raw: string | null): string | null {
  const value = (raw ?? '').trim();
  return /^[a-z0-9_-]+$/i.test(value) ? value : null;
}

// Two-letter ISO country code, upper-cased.
function normalizeCountryCode(raw: string | null): string | null {
  const value = (raw ?? '').trim();
  return /^[a-z]{2}$/i.test(value) ? value.toUpperCase() : null;
}

// Resolve where the shopper is browsing. Liquid-rendered data-* attributes on
// the open button take priority; everything below them is the pre-existing
// runtime detection chain, unchanged.
export function resolveLocalization(button: HTMLElement): LocalizationContext {
  const ctx: LocalizationContext = {
    countryCode: normalizeCountryCode(button.getAttribute('data-country-code')),
    provinceCode: null,
    marketId: normalizeMarketId(button.getAttribute('data-market-id')),
    // No window.Shopify field exposes the handle, so the attribute is the only
    // source. A theme that does not render it simply reports no handle.
    marketHandle: normalizeMarketHandle(button.getAttribute('data-market-handle')),
  };

  // Priority 2: Shopify localization/country context. The market is consulted
  // before window.Shopify.country — the old code assigned country first and let
  // the market overwrite it, so this guarded order preserves that outcome.
  const shopify = window.Shopify;
  if (shopify) {
    const mkt = shopify.markets?.currentMarket;
    if (mkt) {
      if (!ctx.countryCode && mkt.countryCode) ctx.countryCode = mkt.countryCode;
      // Normalised too — window.Shopify is not a documented API and has been
      // seen carrying the full GID.
      if (!ctx.marketId) ctx.marketId = normalizeMarketId(String(mkt.id ?? ''));
    }
    if (!ctx.countryCode && typeof shopify.country === 'string') {
      ctx.countryCode = shopify.country;
    }
    if (!ctx.countryCode && typeof shopify.locale === 'string') {
      const parts = shopify.locale.split('-');
      if (parts.length > 1) ctx.countryCode = parts[parts.length - 1].toUpperCase();
    }
  }

  // Priority 3: Existing customer shipping address.
  if (!ctx.countryCode || !ctx.provinceCode) {
    const addr = window.customer?.default_address;
    if (addr) {
      if (!ctx.countryCode && addr.country_code) ctx.countryCode = addr.country_code;
      if (!ctx.provinceCode && addr.province_code) ctx.provinceCode = addr.province_code;
    }
  }

  // Priority 4: Browser locale fallback.
  if (!ctx.countryCode) {
    const parts = (navigator.language || '').split('-');
    if (parts.length > 1) ctx.countryCode = parts[parts.length - 1].toUpperCase();
  }

  return ctx;
}
```

Note the structural change from the old file: it assigned `ctx.countryCode` from `shopify.country` and then let `currentMarket.countryCode` **overwrite** it. Here every assignment is guarded by `!ctx.countryCode`, so the first source to produce a value wins — which is why the `mkt` block is now written *above* the `shopify.country` check. The resulting order is identical to the old file's effective behaviour, and the guards are what let the `data-country-code` attribute reliably outrank both.

- [ ] **Step 3: Delete the old module**

```bash
git rm src/context/detect-country.ts
```

- [ ] **Step 4: Rewire the entry point**

In `src/index.ts`, change the import on line 3:

```ts
import { resolveLocalization } from './context/localization';
```

Replace lines 52-54 (the `detectCountryContext()` call and the `marketId` attribute read) with:

```ts
const localization = resolveLocalization(openButton);
```

In the `config` object literal, delete the `marketId,` line. Then change the final call to:

```ts
createWidget({ wrapper, openButton, config, productData, localization });
```

- [ ] **Step 5: Rewire the widget**

In `src/ui/widget.ts`:

Line 1 — change the type import:

```ts
import type { WidgetConfig, Product, LocalizationContext } from '../types';
```

Lines 31-51 — the params signature and destructure. Replace `countryCtx: CountryContext;` with `localization: LocalizationContext;`, update the destructure to `const { wrapper, openButton, config, productData, localization } = params;`, and **delete `marketId,`** from the `config` destructure.

Line 100 — `countryCtx.countryCode` becomes `localization.countryCode`.

Line 138 — `countryCtx.provinceCode` becomes `localization.provinceCode`.

Lines 354-369 — replace the whole block with:

```ts
    // Country / province / market — a shown, non-empty form field beats the
    // resolved context.
    if (fields.includes('countryCode')) {
      const selected = getValue("select[name='countryCode']");
      if (selected) formData.countryCode = selected;
    } else if (localization.countryCode) {
      formData.countryCode = localization.countryCode;
    }

    if (fields.includes('provinceCode')) {
      const val = getValue("input[name='provinceCode']");
      if (val) formData.provinceCode = val;
    } else if (localization.provinceCode) {
      formData.provinceCode = localization.provinceCode;
    }

    if (localization.marketId) formData.marketId = localization.marketId;
    if (localization.marketHandle) {
      formData.marketHandle = localization.marketHandle;
    }
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no output.

If it reports `Cannot find name 'CountryContext'` or `Property 'marketId' does not exist on type 'WidgetConfig'`, a reference from Step 1 or Step 5 was missed. Find stragglers with `grep -rn "CountryContext\|countryCtx\|detectCountryContext" src/`— it must return nothing.

- [ ] **Step 7: Add the attributes to the demo button**

In `index.html`, add three attributes to the `#popup-open` button so the harness exercises the path:

```html
<button id="popup-open" class="notification-btn" type="button" data-type="notify-me" data-fields='["email", "firstName", "lastName"]'
         data-display="panel"
        data-tenant="twc-fashion-demo"
        data-customer-email="mjhampshire@gmail.com"
        data-market-id="gid://shopify/Market/12345"
        data-market-handle="au"
        data-country-code="AU"
        data-currency="AUD">Notify Me - Join Waitlist</button>
```

`data-market-id` deliberately carries a full GID here so the default harness run proves the stripping works.

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: exits 0, writes `build/notify-me-wl.min.js`.

- [ ] **Step 9: Verify the eight payload scenarios**

Serve and open `http://localhost:4173/index.html?mockSubmit=1`. For each case, edit the button's attributes in `index.html`, reload, submit, and read `[mockSubmit] payload:` in the console. No rebuild is needed between cases — only `index.html` changes.

| # | Button attributes | Expected in the payload |
| --- | --- | --- |
| 1 | as committed in Step 7 | `marketId: "12345"`, `marketHandle: "au"`, `countryCode: "AU"` |
| 2 | `data-market-id="gid://shopify/Market/12345"` | `marketId: "12345"` |
| 3 | `data-market-id="12345"` | `marketId: "12345"` |
| 4 | all three attributes removed | no `marketId`, no `marketHandle`; `countryCode` from `navigator.language` — matches the Task 1 baseline exactly |
| 5 | all three present but `=""` | none of the three keys present |
| 6 | `data-market-id="{{ localization.market.id }}"` literal | no `marketId` key, no console error |

For case 4, confirm the `window.Shopify` fallback separately: keep the attributes removed, open with `?mockSubmit=1&mockRecs=1` (that harness sets `window.Shopify`), and confirm no crash and still no `marketId` — the harness's `Shopify` object has no `markets`.

Cases 7 and 8 need the country dropdown, so add `"countryCode"` to `data-fields`:

```html
data-fields='["email", "firstName", "lastName", "countryCode"]'
```

| # | Action | Expected |
| --- | --- | --- |
| 7 | attributes as Step 7; in the form, change Country to **New Zealand** | `countryCode: "NZ"` — the shopper's choice, not `"AU"` |
| 8 | same, but set Country back to the blank "Select country" option | `countryCode: "AU"` — the `data-country-code` value |

**Expect the dropdown to arrive pre-selected on Australia** in cases 7 and 8. That is correct and is a visible consequence of this change: line 100 pre-selects `localization.countryCode`, which is now the Liquid value. Case 8 requires deliberately choosing the blank option.

Revert `data-fields` and the button attributes to the Step 7 state before committing.

- [ ] **Step 10: Commit**

```bash
git add src/types.ts src/context/localization.ts src/index.ts src/ui/widget.ts index.html
git commit -m "feat: capture Shopify market id, market handle, and country code

Reads localization from Liquid-rendered data-* attributes on the open button,
falling back to the existing runtime detection. The market id is stripped to
its numeric portion, so gid://shopify/Market/12345 is sent as 12345."
```

The deletion of `src/context/detect-country.ts` is already staged from Step 3.

---

### Task 3: Documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the attribute names from Task 2.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Document the attributes**

In the `### Configuration` list in `README.md`, insert these three bullets after the `data-proxy-app` bullet (currently line 54) and before `data-recommendations`:

```markdown
- `data-market-id`: The Shopify market the shopper is browsing in. Accepts either the numeric id or the full GID — `gid://shopify/Market/12345` and `12345` both send `12345`. Falls back to `window.Shopify.markets.currentMarket.id` when omitted. See [Shopify markets](#shopify-markets).
- `data-market-handle`: The market handle (e.g. `"au"`). Attribute only — there is no runtime fallback, so a theme that does not render it reports no handle.
- `data-country-code`: Two-letter ISO country code for the market the shopper is browsing in. Takes priority over the automatic detection chain, but a country the shopper picks in the form still wins over both.
```

- [ ] **Step 2: Add the Shopify markets section**

Insert this new section immediately **before** the `### Shop similar styles` heading (currently line 90):

```markdown
### Shopify markets

Market and country are captured on every submission so interest can be reported per
market. The values come from Liquid, which renders server-side, so the theme passes
them to the widget as attributes on the open button:

```html
<button id="popup-open"
        data-type="notify-me"
        data-market-id="{{ localization.market.id }}"
        data-market-handle="{{ localization.market.handle }}"
        data-country-code="{{ localization.country.iso_code }}">
  Notify Me
</button>
```

**The market id is sent as the number only** — `12345`, never
`gid://shopify/Market/12345`. The widget strips the GID prefix itself, so it does not
matter which form the theme renders.

Any value that does not look right — an empty string from a storefront with no market
configured, or an unrendered Liquid tag — is dropped, and the field is left out of the
payload rather than sent as `null`. All three attributes are optional: without them,
`marketId` and `countryCode` still resolve from `window.Shopify` and the browser locale,
and `marketHandle` is simply not reported.

When `data-fields` includes `"countryCode"`, the country the shopper picks in the form
takes precedence over `data-country-code`. The dropdown is pre-selected to the market's
country, so leaving it untouched sends the market country either way.
```

- [ ] **Step 3: Verify the rendered Markdown**

Open `README.md` in a Markdown preview (VS Code: `Cmd+Shift+V`).

Expected: the fenced `html` block inside the new section renders as one code block, and the section heading appears in sequence between "Display modes" and "Shop similar styles". Confirm the `[Shopify markets](#shopify-markets)` link in the `data-market-id` bullet jumps to the new section.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document market and country capture attributes"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| Three `data-*` attributes on the button | Task 2, Steps 2 and 7 |
| `resolveLocalization` module, `detect-country.ts` deleted | Task 2, Steps 2-3 |
| `LocalizationContext` + `marketHandle`; `marketId` off `WidgetConfig` | Task 2, Step 1 |
| Precedence chains | Task 2, Step 2 |
| `normalizeMarketId` applied to both sources | Task 2, Step 2 |
| Handle and country format validation | Task 2, Step 2 |
| Payload wiring, omit-don't-null | Task 2, Step 5 |
| Shopper's selection wins | Task 2, Step 5; verified Step 9 cases 7-8 |
| README Configuration + Shopify markets section | Task 3 |
| `index.html` harness | Task 1 |
| Verification cases 1-8 | Task 2, Step 9 |
| Known gaps (backfill, theme updates) | Documentation only — no task; the backfill is a backend decision recorded in the spec |

**Type consistency:** `LocalizationContext` is defined in Task 2 Step 1 and used under that name in Steps 2, 4, and 5. `resolveLocalization` is declared in Step 2 and called in Step 4. `normalizeMarketId` is the only exported helper besides `resolveLocalization`; the other two normalisers are module-private and are called only within Step 2's file. The `createWidget` params property is named `localization` in both Step 4's call site and Step 5's signature.

**Placeholder scan:** clean — no TBD/TODO, and every code step carries the literal content to write. The one instruction without a code block is Task 2 Step 5's line-by-line rename list, which names each line number and the exact substitution.

**Precedence check:** Step 2's chain matches the spec's table in order — attribute, `currentMarket.countryCode`, `Shopify.country`, locale suffix, `customer.default_address`, `navigator.language`. The `!ctx.countryCode` guards make this the real evaluation order rather than a last-write-wins sequence, and it reproduces the old file's effective behaviour.
