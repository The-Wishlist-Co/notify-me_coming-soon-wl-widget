# PLP Notify Me Triggers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any element with `data-twc-notify-me` open the widget for its product (card JSON or `window.currentProduct`), with the right out-of-stock size pre-selected, and let configuration live on `#notification-widget` so pages without `#popup-open` work.

**Architecture:** `index.ts` reads config through a per-attribute reader (`#popup-open` wins, else `#notification-widget`) and installs one capture-phase delegated click listener. `createWidget` returns `{ open(trigger) }`; each open resolves the product (`src/product/resolve-product.ts`), lists out-of-stock variants and picks the pre-selection (`src/product/preselect.ts`), and rebuilds the size select keyed on variant id.

**Tech Stack:** TypeScript 5, Rollup (IIFE bundle `build/notify-me-wl.min.js`), headless Google Chrome for the self-test harness.

**Spec:** `docs/superpowers/specs/2026-09-29-plp-notify-me-triggers-design.md`

## Global Constraints

- Existing installs (`#popup-open` + `window.currentProduct`, variants pre-filtered, no `available` field) behave unchanged.
- Trigger selector: `[data-twc-notify-me]`. Product attribute: `data-twc-product`. Pre-select attribute: `data-variant-id`.
- Size `<option>` values are variant ids (`String(variant.id)`); the submit payload is unchanged (`variantRef: selectedVariant.id`).
- Notice copy, verbatim: `Product information is unavailable. Please refresh the page.` and `All sizes are currently in stock.`
- No theme-specific selectors in the widget. No public `window.TWCNotifyMe` API.
- No new npm dependencies.
- Release version: `3.5.0`.

## Review Focus

1. A theme handler calling `stopPropagation()` on its size button — widget must still open (capture phase). Test: Task 1 case "theme handler that stops propagation".
2. Cards inserted after load (filters, infinite scroll) — must open. Test: Task 1 case "card added after init".
3. stfrock's installments form: a hidden `input[name="id"]` earlier in the DOM holding a stale out-of-stock id — must be ignored in favour of the product form's `select`. Test: Task 1 case "hidden installments input ignored".
4. Opening a different product while the popup shows a notice for the previous one — form must reappear, notice clear. Test: Task 1 case "reopening after a notice".
5. Page `?variant=` leaking into a PLP card on a page that has both. Test: Task 1 case "?variant= does not leak into a card".

---

## File Structure

| File | Responsibility |
|---|---|
| `harness/selftest.js` (create) | `?selfTest=1` only: fetch stub, tiny assertion helpers, case runner, result output |
| `harness/triggers.html` (create) | Fixture: widget config without `#popup-open`, mock PLP cards, mock PDP; its cases |
| `harness/run-selftest.sh` (create) | Runs both pages in headless Chrome, exits non-zero on failure |
| `index.html` (modify) | Adds legacy regression cases, loads `harness/selftest.js` |
| `package.json` (modify) | `selftest` script; version 3.5.0 |
| `src/types.ts` (modify) | `Variant.available?` |
| `src/context/config-source.ts` (create) | `AttrReader` + `createAttrReader` |
| `src/context/localization.ts`, `src/context/customer-email.ts` (modify) | Take `AttrReader` instead of an element |
| `src/product/resolve-product.ts` (create) | Trigger → product + source, JSON validation |
| `src/product/preselect.ts` (create) | Listed variants, page variant candidates, pre-selection |
| `src/ui/widget.ts` (modify) | Per-open product/variants, notice element, returns `{ open }` |
| `src/ui/styles.ts` (modify) | `.twc-nm-status--info` |
| `src/index.ts` (modify) | Config via reader, delegated listener, late-load init |
| `README.md` (modify) | New sections and configuration notes |

---

### Task 1: Self-test harness (red)

**Files:**
- Create: `harness/selftest.js`, `harness/triggers.html`, `harness/run-selftest.sh`
- Modify: `index.html` (before the final `<script src="build/notify-me-wl.min.js">`), `package.json` scripts

**Interfaces:**
- Produces: `window.ST` helpers, `window.eq(actual, expected, label)`, `window.SELFTEST_CASES = [{ name, run }]` convention; output line `SELFTEST PASS n/n` or `SELFTEST FAIL k/n` in `#selftest-result`.
- Consumes (from Task 2's DOM): `#twc-nm-size`, `#popup-title`, `#popup-form`, `#popup-notice`, `.twc-nm-submit`, `input[name='email']`.

- [ ] **Step 1: Create `harness/selftest.js`**

```js
// Headless self-test harness. Not part of the shipped widget.
// Active only with ?selfTest=1: stubs fetch so nothing leaves the page, then runs
// the page's window.SELFTEST_CASES on load and prints a PASS/FAIL summary into
// #selftest-result, where `chrome --dump-dom` (harness/run-selftest.sh) reads it.
// Must load before the widget bundle so the widget sees the stubbed fetch.
(function () {
  if (!new URLSearchParams(location.search).has('selfTest')) return;

  var fetches = [];
  function json(status, body) {
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    fetches.push({ url: url, init: init || {} });
    if (url.indexOf('/auth/token') !== -1) {
      return json(200, { success: true, data: { access_token: 'selftest' } });
    }
    if (url.indexOf('/customerInterest') !== -1) return json(200, {});
    return json(404, {});
  };

  function $(sel) {
    return typeof sel === 'string' ? document.querySelector(sel) : sel;
  }

  window.eq = function (actual, expected, label) {
    var a = JSON.stringify(actual);
    var b = JSON.stringify(expected);
    if (a !== b) throw new Error(label + ': expected ' + b + ', got ' + a);
  };

  window.ST = {
    click: function (sel) {
      $(sel).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    },
    title: function () {
      return $('#popup-title').textContent;
    },
    sizeValue: function () {
      return $('#twc-nm-size').value;
    },
    sizeOptions: function () {
      return Array.prototype.slice
        .call(document.querySelectorAll('#twc-nm-size option'))
        .filter(function (o) { return o.value; })
        .map(function (o) { return o.value; });
    },
    formHidden: function () {
      return $('#popup-form').hidden;
    },
    notice: function () {
      var n = $('#popup-notice');
      return n && !n.hidden ? n.textContent : '';
    },
    // Replace the query string, keeping selfTest so a reload still self-tests.
    setQuery: function (q) {
      history.replaceState(null, '', location.pathname + '?selfTest=1' + (q ? '&' + q : ''));
    },
    lastFetch: function (part) {
      for (var i = fetches.length - 1; i >= 0; i--) {
        if (fetches[i].url.indexOf(part) !== -1) return fetches[i];
      }
      return null;
    },
    waitFor: function (pred, ms) {
      var start = Date.now();
      return new Promise(function (resolve, reject) {
        (function poll() {
          var v = pred();
          if (v) return resolve(v);
          if (Date.now() - start > ms) return reject(new Error('timed out'));
          setTimeout(poll, 20);
        })();
      });
    },
  };

  window.addEventListener('load', async function () {
    var cases = window.SELFTEST_CASES || [];
    var out = [];
    var failed = 0;
    for (var i = 0; i < cases.length; i++) {
      try {
        await cases[i].run();
        out.push('ok   ' + cases[i].name);
      } catch (e) {
        failed++;
        out.push('FAIL ' + cases[i].name + ' — ' + (e && e.message));
      }
    }
    out.push(
      failed
        ? 'SELFTEST FAIL ' + failed + '/' + cases.length
        : 'SELFTEST PASS ' + cases.length + '/' + cases.length,
    );
    var el = document.getElementById('selftest-result');
    if (el) el.textContent = out.join('\n');
  });
})();
```

- [ ] **Step 2: Create `harness/triggers.html`**

```html
<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Notify me — PLP / PDP triggers</title>
      <style>
         body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px auto; max-width: 640px; padding: 0 16px; }
         .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
         .size[data-variant-available="false"] { opacity: 0.4; }
         #selftest-result { white-space: pre-wrap; font-size: 12px; }
      </style>
   </head>
   <body>
      <!-- Store-wide configuration, rendered once (theme.liquid). No #popup-open on this page. -->
      <div id="notification-widget"
           data-tenant="triggers-tenant"
           data-auth="proxy"
           data-type="notify-me"
           data-fields='["email"]'
           data-recommendations="false"
           data-country-code="AU"></div>

      <h2>PLP</h2>
      <div class="card" id="card-a" data-twc-product='{"id":1,"title":"Card A","variants":[{"id":101,"title":"8","available":true},{"id":102,"title":"10","available":false},{"id":103,"title":"12","available":false}]}'>
         <p>Card A — two sizes out of stock</p>
         <button type="button" class="size" data-variant-id="101" data-variant-available="true">8</button>
         <button type="button" class="size" data-variant-id="102" data-variant-available="false" data-twc-notify-me>10</button>
         <button type="button" class="size" data-variant-id="103" data-variant-available="false" data-twc-notify-me>12</button>
         <a href="#" class="oos-link" data-twc-notify-me>Size out of stock?</a>
      </div>
      <div class="card" id="card-b" data-twc-product='{"id":2,"title":"Card B","variants":[{"id":201,"title":"8","available":true},{"id":202,"title":"14","available":false}]}'>
         <p>Card B — exactly one size out of stock</p>
         <button type="button" class="size" data-variant-id="201" data-variant-available="true">8</button>
         <button type="button" class="size" data-variant-id="202" data-variant-available="false" data-twc-notify-me>14</button>
         <a href="#" class="oos-link" data-twc-notify-me>Size out of stock?</a>
      </div>
      <div class="card" id="card-c" data-twc-product='{"id":3,"title":"Card C","variants":[{"id":301,"title":"8","available":true},{"id":302,"title":"10","available":true}]}'>
         <p>Card C — everything in stock</p>
         <a href="#" class="oos-link" data-twc-notify-me>Size out of stock?</a>
      </div>
      <div class="card" id="card-d" data-twc-product='{not json'>
         <p>Card D — broken product JSON</p>
         <a href="#" class="oos-link" data-twc-notify-me>Size out of stock?</a>
      </div>

      <h2>PDP</h2>
      <!-- Mirrors stfrock: an installments form whose hidden id does not follow the picker, then the product form. -->
      <form action="/cart/add" id="installments-form"><input type="hidden" name="id" value="902" /></form>
      <form action="/cart/add" id="product-form">
         <select name="id">
            <option value="901">S</option>
            <option value="902">M</option>
            <option value="903">L</option>
         </select>
      </form>
      <button type="button" id="pdp-link" data-twc-notify-me data-variant-id="">Size out of stock?</button>
      <script>
         window.currentProduct = {
            id: 9,
            title: 'PDP Product',
            variants: [
               { id: 901, title: 'S', available: true },
               { id: 902, title: 'M', available: false },
               { id: 903, title: 'L', available: false },
            ],
         };
      </script>

      <pre id="selftest-result"></pre>
      <script>
         function pdpSelect(v) { document.querySelector('#product-form select').value = v; }
         window.SELFTEST_CASES = [
            { name: 'PLP: out-of-stock size opens its card with that size selected', run: function () {
               ST.setQuery('');
               ST.click('#card-a [data-variant-id="102"]');
               eq(ST.title(), 'Card A', 'title');
               eq(ST.sizeOptions(), ['102', '103'], 'options');
               eq(ST.sizeValue(), '102', 'selected');
            } },
            { name: 'PLP: link with several out-of-stock sizes leaves the placeholder', run: function () {
               ST.click('#card-a .oos-link');
               eq(ST.sizeOptions(), ['102', '103'], 'options');
               eq(ST.sizeValue(), '', 'selected');
            } },
            { name: 'PLP: link with exactly one out-of-stock size pre-selects it', run: function () {
               ST.click('#card-b .oos-link');
               eq(ST.title(), 'Card B', 'title');
               eq(ST.sizeValue(), '202', 'selected');
            } },
            { name: 'PLP: card with nothing out of stock shows the in-stock notice', run: function () {
               ST.click('#card-c .oos-link');
               eq(ST.formHidden(), true, 'form hidden');
               eq(ST.notice(), 'All sizes are currently in stock.', 'notice');
            } },
            { name: 'PLP: invalid product JSON shows the unavailable notice', run: function () {
               ST.click('#card-d .oos-link');
               eq(ST.formHidden(), true, 'form hidden');
               eq(ST.notice(), 'Product information is unavailable. Please refresh the page.', 'notice');
            } },
            { name: 'PLP: reopening after a notice shows the form again', run: function () {
               ST.click('#card-a [data-variant-id="103"]');
               eq(ST.formHidden(), false, 'form hidden');
               eq(ST.notice(), '', 'notice');
               eq(ST.sizeValue(), '103', 'selected');
            } },
            { name: 'PLP: ?variant= on the page does not leak into a card', run: function () {
               ST.setQuery('variant=103');
               ST.click('#card-a .oos-link');
               eq(ST.sizeValue(), '', 'selected');
               ST.setQuery('');
            } },
            { name: 'PLP: link click does not navigate', run: function () {
               ST.click('#card-a .oos-link');
               eq(location.hash, '', 'hash');
            } },
            { name: 'PLP: theme handler that stops propagation cannot swallow the click', run: function () {
               ST.click('#card-a .oos-link');
               var btn = document.querySelector('#card-b [data-variant-id="202"]');
               var stop = function (e) { e.stopPropagation(); };
               btn.addEventListener('click', stop);
               ST.click(btn);
               btn.removeEventListener('click', stop);
               eq(ST.title(), 'Card B', 'title');
            } },
            { name: 'PLP: card added after init opens', run: function () {
               var card = document.createElement('div');
               card.setAttribute('data-twc-product', JSON.stringify({ id: 4, title: 'Card E', variants: [{ id: 401, title: '6', available: false }] }));
               card.innerHTML = '<button type="button" id="late-size" data-variant-id="401" data-twc-notify-me>6</button>';
               document.body.appendChild(card);
               ST.click('#late-size');
               eq(ST.title(), 'Card E', 'title');
               eq(ST.sizeValue(), '401', 'selected');
            } },
            { name: 'PDP: out-of-stock ?variant= is pre-selected', run: function () {
               ST.setQuery('variant=902');
               pdpSelect('903');
               ST.click('#pdp-link');
               eq(ST.title(), 'PDP Product', 'title');
               eq(ST.sizeValue(), '902', 'selected');
            } },
            { name: 'PDP: product form select used, hidden installments input ignored', run: function () {
               ST.setQuery('');
               pdpSelect('903');
               ST.click('#pdp-link');
               eq(ST.sizeValue(), '903', 'selected');
            } },
            { name: 'PDP: in-stock ?variant= falls through to the product form select', run: function () {
               ST.setQuery('variant=901');
               pdpSelect('903');
               ST.click('#pdp-link');
               eq(ST.sizeValue(), '903', 'selected');
               ST.setQuery('');
            } },
            { name: 'PDP: trigger data-variant-id wins over page state', run: function () {
               ST.setQuery('variant=902');
               var link = document.getElementById('pdp-link');
               link.setAttribute('data-variant-id', '903');
               ST.click(link);
               link.setAttribute('data-variant-id', '');
               ST.setQuery('');
               eq(ST.sizeValue(), '903', 'selected');
            } },
            { name: 'PDP: in-stock current size and several out of stock leave the placeholder', run: function () {
               pdpSelect('901');
               ST.click('#pdp-link');
               eq(ST.sizeOptions(), ['902', '903'], 'options');
               eq(ST.sizeValue(), '', 'selected');
            } },
            { name: 'Submit sends the card variant and the widget-level tenant', run: async function () {
               ST.click('#card-a [data-variant-id="102"]');
               document.querySelector("#popup-form input[name='email']").value = 'selftest@example.com';
               ST.click('#popup-form .twc-nm-submit');
               var call = await ST.waitFor(function () { return ST.lastFetch('/customerInterest'); }, 3000);
               eq(JSON.parse(call.init.body).variantRef, 102, 'variantRef');
               eq(new Headers(call.init.headers).get('X-Twc-Tenant'), 'triggers-tenant', 'tenant');
            } },
         ];
      </script>
      <script src="selftest.js"></script>
      <script src="../build/notify-me-wl.min.js"></script>
   </body>
</html>
```

- [ ] **Step 3: Add legacy regression cases to `index.html`**

Insert immediately before `<script src="build/notify-me-wl.min.js"></script>`:

```html
      <!-- Legacy #popup-open regression cases for harness/selftest.js (?selfTest=1). -->
      <pre id="selftest-result"></pre>
      <script>
         window.SELFTEST_CASES = [
            { name: 'Legacy: #popup-open opens window.currentProduct with every variant', run: function () {
               ST.click('#popup-open');
               eq(ST.title(), 'Sample Product', 'title');
               eq(ST.sizeOptions(), ['1', '2', '3'], 'options');
               eq(ST.sizeValue(), '', 'selected');
            } },
            { name: 'Legacy: submit sends the chosen variant id and the button tenant', run: async function () {
               ST.click('#popup-open');
               document.getElementById('twc-nm-size').value = '2';
               document.querySelector("#popup-form input[name='email']").value = 'selftest@example.com';
               document.querySelector("#popup-form input[name='firstName']").value = 'A';
               document.querySelector("#popup-form input[name='lastName']").value = 'B';
               ST.click('#popup-form .twc-nm-submit');
               var call = await ST.waitFor(function () { return ST.lastFetch('/customerInterest'); }, 3000);
               eq(JSON.parse(call.init.body).variantRef, 2, 'variantRef');
               eq(new Headers(call.init.headers).get('X-Twc-Tenant'), 'twc-fashion-demo', 'tenant');
            } },
         ];
      </script>
      <script src="harness/selftest.js"></script>
```

Note: `harness/selftest.js` must be the first script that replaces `fetch` when `?selfTest=1` is set; the existing `mockSubmit`/`mockRecs` blocks only act on their own flags, which the self-test does not set.

- [ ] **Step 4: Create `harness/run-selftest.sh` and the npm script**

```sh
#!/bin/sh
# Runs the widget self-test pages in headless Chrome and fails on any FAIL line.
# Override the browser with CHROME=/path/to/chrome.
# Pages are served over a local HTTP server rather than file:// so history.replaceState
# (used to vary ?variant=) behaves as on a real storefront.
set -u
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${SELFTEST_PORT:-8765}"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
status=0
for page in index.html harness/triggers.html; do
  out="$("$CHROME" --headless=new --disable-gpu \
    --virtual-time-budget=5000 --dump-dom "http://127.0.0.1:$PORT/$page?selfTest=1" 2>/dev/null \
    | sed -n '/<pre id="selftest-result">/,/<\/pre>/p' \
    | sed -e 's/<[^>]*>//g' -e 's/&amp;/\&/g' -e 's/&quot;/"/g' -e 's/&lt;/</g' -e 's/&gt;/>/g')"
  echo "== $page"
  echo "$out"
  echo "$out" | grep -q '^SELFTEST PASS' || status=1
done
exit $status
```

In `package.json` `scripts`, add after `"typecheck"`:

```json
    "selftest": "npm run build && sh harness/run-selftest.sh",
```

- [ ] **Step 5: Run it and confirm the expected failures**

Run: `npm run selftest`
Expected: exit status 1.
- `index.html`: both cases FAIL. Today's options are keyed on title, so case 1 reports `options: expected ["1","2","3"], got ["Small","Medium","Large"]`, and case 2 cannot select value `'2'`.
- `harness/triggers.html`: every case FAILS, because today's bundle stops at the missing `#popup-open` and never builds the popup (errors such as `Cannot read properties of null`).

- [ ] **Step 6: Commit**

```bash
git add harness/ index.html package.json
git commit -m "test: add headless self-test harness for PLP/PDP triggers"
```

---

### Task 2: Triggers, per-open product, pre-selection (green)

**Files:**
- Modify: `src/types.ts:1-4`
- Create: `src/context/config-source.ts`, `src/product/resolve-product.ts`, `src/product/preselect.ts`
- Modify: `src/context/localization.ts` (`resolveLocalization`), `src/context/customer-email.ts` (`resolveCustomerEmail`)
- Modify: `src/ui/widget.ts`, `src/ui/styles.ts` (after `.twc-nm-status--success`), `src/index.ts`

**Interfaces:**
- Consumes: Task 1 harness and DOM ids listed there.
- Produces:
  - `type AttrReader = (name: string) => string | null`; `createAttrReader(primary: HTMLElement | null, fallback: HTMLElement): AttrReader`
  - `resolveLocalization(attr: AttrReader): LocalizationContext`; `resolveCustomerEmail(attr: AttrReader): string | null`
  - `resolveProduct(trigger: Element | null): ProductResolution` where `ProductResolution = { ok: true; product: Product; source: 'card' | 'page' } | { ok: false }`
  - `listedVariants(product: Product): Variant[]`; `readPageVariantIds(): Array<string | null>`; `pickPreselectedVariant(listed: Variant[], candidates: Array<string | null>): string | null`
  - `createWidget(params: { wrapper: HTMLElement; config: WidgetConfig; localization: LocalizationContext }): WidgetHandle | null` where `WidgetHandle = { open(trigger: HTMLElement | null): void }`
  - `TRIGGER_SELECTOR = '[data-twc-notify-me]'`, module-local in `src/index.ts`.

- [ ] **Step 1: `src/types.ts` — add `available` to `Variant`**

```ts
export interface Variant {
  id: number | string;
  title: string;
  // Shopify's variant.available. Omitted by legacy installs, which pre-filter
  // window.currentProduct to unavailable variants in Liquid.
  available?: boolean;
}
```

- [ ] **Step 2: Create `src/context/config-source.ts`**

```ts
// Reads a configuration attribute. Configuration can live on the legacy
// #popup-open button or on #notification-widget; per attribute, the button wins
// when it carries it, so existing installs behave exactly as before while PLPs
// (which have no button) configure the widget element instead.
export type AttrReader = (name: string) => string | null;

export function createAttrReader(
  primary: HTMLElement | null,
  fallback: HTMLElement,
): AttrReader {
  return (name) =>
    primary && primary.hasAttribute(name)
      ? primary.getAttribute(name)
      : fallback.getAttribute(name);
}
```

- [ ] **Step 3: Switch the context resolvers to `AttrReader`**

`src/context/localization.ts`: add `import type { AttrReader } from './config-source';`, change the signature and the three reads:

```ts
// Resolve where the shopper is browsing. Liquid-rendered data-* attributes take
// priority; everything below them is the pre-existing runtime detection chain,
// unchanged.
export function resolveLocalization(attr: AttrReader): LocalizationContext {
  const ctx: LocalizationContext = {
    countryCode: normalizeCountryCode(attr('data-country-code')),
    provinceCode: null,
    marketId: normalizeMarketId(attr('data-market-id')),
    // No window.Shopify field exposes the handle, so the attribute is the only
    // source. A theme that does not render it simply reports no handle.
    marketHandle: normalizeMarketHandle(attr('data-market-handle')),
  };
```

`src/context/customer-email.ts`: add `import type { AttrReader } from './config-source';`; replace comment item 1 with `//   1. data-customer-email — a test/QA override.` and:

```ts
export function resolveCustomerEmail(attr: AttrReader): string | null {
  const override = attr('data-customer-email');
```

- [ ] **Step 4: Create `src/product/resolve-product.ts`**

```ts
import type { Product } from '../types';

const PRODUCT_ATTR = 'data-twc-product';

// 'card' — from the trigger's product container on a PLP (or any listing).
// 'page' — window.currentProduct, the PDP's own product. Only a page product
// consults page variant state (URL, product form), so PDP state never leaks
// into a card.
export type ProductSource = 'card' | 'page';

export type ProductResolution =
  | { ok: true; product: Product; source: ProductSource }
  | { ok: false };

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    (typeof p.id === 'number' || typeof p.id === 'string') &&
    typeof p.title === 'string' &&
    (p.variants === undefined || Array.isArray(p.variants))
  );
}

// The trigger's closest [data-twc-product] wins; without one, the page product.
// A container whose JSON is broken is an error, not a cue to fall back — opening
// the page product from a PLP card would register interest in the wrong item.
export function resolveProduct(trigger: Element | null): ProductResolution {
  const card = trigger ? trigger.closest(`[${PRODUCT_ATTR}]`) : null;
  if (card) {
    try {
      const parsed: unknown = JSON.parse(card.getAttribute(PRODUCT_ATTR) || '');
      if (isProduct(parsed)) return { ok: true, product: parsed, source: 'card' };
    } catch {
      // Reported below.
    }
    console.error(`notify-me-wl: invalid ${PRODUCT_ATTR} JSON on`, card);
    return { ok: false };
  }

  const page = window.currentProduct;
  if (isProduct(page)) return { ok: true, product: page, source: 'page' };
  return { ok: false };
}
```

- [ ] **Step 5: Create `src/product/preselect.ts`**

```ts
import type { Product, Variant } from '../types';

// Sizes offered in the widget: out-of-stock variants only. A variant with no
// `available` field is kept, because legacy PDP installs pre-filter
// window.currentProduct in Liquid and omit it. Malformed entries are dropped.
export function listedVariants(product: Product): Variant[] {
  return (product.variants || []).filter(
    (v) =>
      !!v &&
      (typeof v.id === 'number' || typeof v.id === 'string') &&
      typeof v.title === 'string' &&
      v.available !== true,
  );
}

// PDP variant state at open time, in priority order: ?variant= in the URL, then
// the product form's variant <select>. A hidden input[name="id"] is deliberately
// not read — stfrock's installments form carries one that does not follow the
// variant picker.
export function readPageVariantIds(): Array<string | null> {
  const fromUrl = new URLSearchParams(window.location.search).get('variant');
  const select = document.querySelector<HTMLSelectElement>(
    'form[action*="/cart/add"] select[name="id"]',
  );
  return [fromUrl, select ? select.value : null];
}

// The first candidate that is one of the listed sizes wins. With none, a lone
// listed size is pre-selected. Null leaves the "Select a size" placeholder.
export function pickPreselectedVariant(
  listed: Variant[],
  candidates: Array<string | null>,
): string | null {
  const ids = listed.map((v) => String(v.id));
  for (const candidate of candidates) {
    const id = candidate ? candidate.trim() : '';
    if (id && ids.includes(id)) return id;
  }
  return ids.length === 1 ? ids[0] : null;
}
```

- [ ] **Step 6: `src/ui/styles.ts` — neutral notice style**

After the `#twc-nm-overlay .twc-nm-status--success { … }` rule add:

```css
        #twc-nm-overlay .twc-nm-status--info {
            color: #374151;
            background: #f3f4f6;
        }
```

- [ ] **Step 7: `src/ui/widget.ts` — imports, signature, notice element**

Replace the first import line and add the product imports:

```ts
import type { WidgetConfig, Product, Variant, LocalizationContext } from '../types';
import { resolveProduct } from '../product/resolve-product';
import {
  listedVariants,
  readPageVariantIds,
  pickPreselectedVariant,
} from '../product/preselect';
```

Replace the `createWidget` signature block with:

```ts
export interface WidgetHandle {
  // Open for the product the trigger belongs to (its [data-twc-product], else
  // window.currentProduct), pre-selecting per the trigger and page state. Null
  // behaves like a trigger with no product container and no data-variant-id.
  open(trigger: HTMLElement | null): void;
}

export function createWidget(params: {
  wrapper: HTMLElement;
  config: WidgetConfig;
  localization: LocalizationContext;
}): WidgetHandle | null {
  const { wrapper, config, localization } = params;
```

In the overlay template, add the notice after `popup-text` (it sits outside the form so it stays visible when the form is hidden):

```html
                <p id="popup-text" class="twc-nm-text"></p>
                <div id="popup-notice" class="twc-nm-status" role="status" aria-live="polite" hidden></div>
```

After `const form = …`, add `const popupNotice = document.getElementById('popup-notice');` and include `!popupNotice` in the first null guard. Change every early `return;` in `createWidget` (the element guard and `if (!popupStatus || !submitBtn) return;`) to `return null;`.

- [ ] **Step 8: `src/ui/widget.ts` — notice helpers**

After `clearStatus()` add:

```ts
  // Messages that replace the form entirely (no product, nothing out of stock).
  // Rendered outside the form, which is hidden while they show.
  function showNotice(kind: 'error' | 'info', message: string): void {
    form!.hidden = true;
    popupNotice!.textContent = message;
    popupNotice!.className = `twc-nm-status twc-nm-status--${kind}`;
    popupNotice!.hidden = false;
  }
  function clearNotice(): void {
    form!.hidden = false;
    popupNotice!.hidden = true;
    popupNotice!.textContent = '';
  }
```

- [ ] **Step 9: `src/ui/widget.ts` — per-open product state**

Add before `renderRecommendations`:

```ts
  // The product and sizes of the current open. Replaced on every open, because
  // one widget instance serves every trigger on the page.
  let activeProduct: Product | null = null;
  let activeVariants: Variant[] = [];
```

In `renderRecommendations`, change the `productId` line to:

```ts
      productId: activeProduct ? String(activeProduct.id) : null,
```

Remove `let variantsPopulated = false;`. Replace the whole `showPopup` function with:

```ts
  function renderSizeOptions(variants: Variant[], selectedId: string | null): void {
    sizeSelect!.innerHTML =
      '<option value="" disabled selected>Select a size</option>';
    variants.forEach((variant) => {
      const option = document.createElement('option');
      option.value = String(variant.id);
      option.textContent = variant.title;
      sizeSelect!.appendChild(option);
    });
    if (selectedId) sizeSelect!.value = selectedId;
  }

  function showPopup(trigger: HTMLElement | null): void {
    // Opening again while open (another card) starts from a clean slate.
    clearStatus();
    clearNotice();
    removeRecommendationsSection();
    recsInFlight = null;
    openPopup();

    const resolved = resolveProduct(trigger);
    if (!resolved.ok) {
      activeProduct = null;
      activeVariants = [];
      popupTitle!.textContent = '';
      showNotice('error', 'Product information is unavailable. Please refresh the page.');
      return;
    }

    activeProduct = resolved.product;
    activeVariants = listedVariants(activeProduct);
    popupTitle!.textContent = activeProduct.title;

    if (!activeVariants.length) {
      showNotice('info', 'All sizes are currently in stock.');
      return;
    }

    const triggerVariantId = trigger ? trigger.getAttribute('data-variant-id') : null;
    const candidates =
      resolved.source === 'page'
        ? [triggerVariantId, ...readPageVariantIds()]
        : [triggerVariantId];
    renderSizeOptions(activeVariants, pickPreselectedVariant(activeVariants, candidates));

    // Logged-in customers (or a data-customer-email override) get the section
    // straight away. Deliberately not awaited — the modal opens immediately and
    // the section appears when the request resolves.
    if (customerEmail) {
      void showRecommendations(customerEmail);
    }

    const firstControl = form!.querySelector<HTMLElement>('select, input');
    if (firstControl) firstControl.focus();
  }
```

Delete `openButton.addEventListener('click', showPopup);` (the caller wires triggers now). In the submit handler replace the `selectedVariant` lookup with:

```ts
    const selectedVariant = activeVariants.find(
      (variant) => String(variant.id) === sizeSelect.value,
    );
```

At the very end of `createWidget` (after the submit listener) add:

```ts
  return { open: showPopup };
```

- [ ] **Step 10: `src/index.ts` — config reader, delegated triggers, late-load init**

Replace the whole file with:

```ts
import { injectStyles } from './ui/styles';
import { createWidget } from './ui/widget';
import { resolveLocalization } from './context/localization';
import { resolveCustomerEmail } from './context/customer-email';
import { createAttrReader } from './context/config-source';
import { TENANT_ID, PROXY_APP_NAME } from './config';
import type {
  WidgetConfig,
  FieldName,
  WidgetType,
  AuthMode,
  DisplayMode,
} from './types';

// Any element carrying this opens the widget: PLP size buttons, "Size out of
// stock?" links, and anything else a theme marks up.
const TRIGGER_SELECTOR = '[data-twc-notify-me]';

function init(): void {
  const wrapper = document.getElementById('notification-widget');
  if (!wrapper) return;

  // Optional legacy open button. When present, its attributes win over the
  // widget element's, so existing installs are unaffected.
  const openButton = document.getElementById('popup-open');
  const attr = createAttrReader(openButton, wrapper);

  injectStyles();

  const fields = JSON.parse(attr('data-fields') || '["email"]') as FieldName[];
  const type = (attr('data-type') || 'notify-me') as WidgetType;
  // Presentation: centred modal (default) or right-hand slide-in panel.
  // Anything other than "panel" falls back to the modal.
  const display: DisplayMode = attr('data-display') === 'panel' ? 'panel' : 'modal';
  // Auth mode: 'proxy' (default, Shopify App Proxy) or 'token'. The widget
  // bundles no credential, so 'token' mode needs one supplied explicitly —
  // see accessToken below.
  const authMode = (attr('data-auth') || 'proxy') as AuthMode;
  // Tenant for X-Twc-Tenant header; used in both auth modes.
  const tenant = attr('data-tenant') || TENANT_ID;
  // Shopify App Proxy app name; used by the 'proxy' auth mode to build the URL.
  const proxyApp = attr('data-proxy-app') || PROXY_APP_NAME;
  // Merchant-supplied token for 'token' mode. The attribute wins over the
  // global so a single page can override it.
  const accessToken = attr('data-access-token') || window.TWC_ACCESS_TOKEN || null;

  // "Shop similar styles" section. Opt-out via data-recommendations="false".
  const recommendationsEnabled = attr('data-recommendations') !== 'false';
  const parsedCount = parseInt(attr('data-recommendations-count') || '', 10);
  const recommendationsCount =
    Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 8;
  // Athos/Searchspring recommendation profile tag. Lets a theme supply the tag
  // when the tenant config has no profileTag/tags field of its own; the config
  // still wins wherever it does carry one.
  const recommendationsProfile =
    (attr('data-recommendations-profile') || '').trim() || null;
  // Fallback currency for price formatting; window.Shopify.currency.active
  // takes precedence when the storefront exposes it.
  const currency = attr('data-currency') || null;

  const config: WidgetConfig = {
    fields,
    type,
    display,
    auth: { mode: authMode, proxyApp, accessToken },
    tenant,
    recommendationsEnabled,
    recommendationsCount,
    recommendationsProfile,
    currency,
    customerEmail: resolveCustomerEmail(attr),
  };

  const widget = createWidget({
    wrapper,
    config,
    localization: resolveLocalization(attr),
  });
  if (!widget) return;

  // One delegated listener, so cards rendered later (filtering, infinite scroll)
  // work without re-initialising. Capture phase, so a theme handler that stops
  // propagation on its own size buttons cannot swallow the click.
  // preventDefault stops href="#" jumps and in-form button submits; the theme's
  // own handlers still run.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      const trigger =
        target instanceof Element
          ? target.closest<HTMLElement>(TRIGGER_SELECTOR)
          : null;
      if (!trigger) return;
      event.preventDefault();
      widget.open(trigger);
    },
    true,
  );

  // A legacy button that is also marked as a trigger is already handled above.
  if (openButton && !openButton.matches(TRIGGER_SELECTOR)) {
    openButton.addEventListener('click', () => widget.open(openButton));
  }
}

// A deferred or late-injected script can run after DOMContentLoaded has fired.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 11: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no output after the header. If `productData` is still referenced anywhere in `widget.ts`, replace with `activeProduct`.

- [ ] **Step 12: Run the self-test**

Run: `npm run selftest`
Expected: both pages end with `SELFTEST PASS` (`index.html` 2/2, `harness/triggers.html` 16/16); exit 0.

- [ ] **Step 13: Commit**

```bash
git add src/ build/notify-me-wl.min.js
git commit -m "feat: open the widget from any data-twc-notify-me trigger with size pre-selection"
```

---

### Task 3: README

**Files:**
- Modify: `README.md` — Features list, Usage, Configuration, new sections after "Shopify markets"

**Interfaces:**
- Consumes: attribute names and rules from Task 2 (verbatim).

- [ ] **Step 1: Features** — add a bullet after the display-modes bullet:

```markdown
- Opens from any element marked `data-twc-notify-me` — PLP size buttons, "Size out of stock?" links — for the product it belongs to, with the right size pre-selected. See [Opening from product listing pages](#opening-from-product-listing-pages).
```

- [ ] **Step 2: Usage** — replace the first paragraph (line 50) with:

```markdown
Add `<div id="notification-widget"></div>` once per page and put the configuration attributes below on it (or, as older installs do, on a `<button id="popup-open">` — its attributes win where both carry one). Anything marked `data-twc-notify-me` opens the widget; the legacy `#popup-open` button does too. `data-fields` is a JSON string of the fields to include, and `data-type` is `notify-me` or `coming-soon`.
```

After the existing example add:

```markdown
`window.currentProduct` supplies the product on a product page. Its `variants` may
include Shopify's `available` flag — the widget then lists only out-of-stock sizes
itself — or be pre-filtered in Liquid as older installs do.
```

- [ ] **Step 3: Configuration** — directly under the `### Configuration` heading add:

```markdown
Every attribute below can be set on `#notification-widget` or on `#popup-open`. When
both carry the same attribute, `#popup-open` wins. `#popup-open` is optional.
```

- [ ] **Step 4: New sections** — insert before `### Shop similar styles`:

````markdown
### Opening from product listing pages

Three attributes connect a theme to the widget. No theme JavaScript is needed.

| Attribute | Where | Meaning |
| --- | --- | --- |
| `data-twc-product` | A product container, e.g. the card | JSON `{ id, title, variants: [{ id, title, available }] }` |
| `data-twc-notify-me` | Any clickable element | Clicking it opens the widget |
| `data-variant-id` | Optional, on the same element | Variant to pre-select |

The widget finds the product from the clicked element's closest `data-twc-product`,
falling back to `window.currentProduct`. It listens at page level in the capture phase,
so cards added later (filters, infinite scroll) work, and a theme handler that stops
propagation does not block it. It calls `preventDefault()` on the click — `href="#"`
does not jump — but lets the theme's own handlers run.

Build the product JSON with a compact capture rather than `product | json`, which is
too heavy to repeat on every card, and escape it into a double-quoted attribute so a
title with a quote or apostrophe cannot break the markup:

```liquid
{%- capture twc_product -%}
  {"id":{{ product.id | json }},"title":{{ product.title | json }},"variants":[
  {%- for v in product.variants -%}
    {"id":{{ v.id | json }},"title":{{ v.title | json }},"available":{{ v.available | json }}}
    {%- unless forloop.last -%},{%- endunless -%}
  {%- endfor -%}]}
{%- endcapture -%}
<div class="product-card" data-twc-product="{{ twc_product | escape }}">
  {%- for variant in product.variants -%}
    <button type="button" data-variant-id="{{ variant.id }}"
            {% unless variant.available %}data-twc-notify-me{% endunless %}>{{ variant.title }}</button>
  {%- endfor -%}
  <a href="#" data-twc-notify-me>Size out of stock?</a>
</div>
```

Out-of-stock size buttons must not carry the `disabled` attribute: browsers do not
dispatch clicks on disabled buttons. Style them with a class or `aria-disabled="true"`
instead.

Render `#notification-widget` with the configuration once per page (e.g. in
`theme.liquid`), and load the script with `defer` or no attribute:

```liquid
<div id="notification-widget"
     data-tenant="your-tenant"
     data-type="notify-me"
     data-fields='["email"]'
     data-currency="{{ cart.currency.iso_code }}"
     data-market-id="{{ localization.market.id }}"
     data-market-handle="{{ localization.market.handle }}"
     data-country-code="{{ localization.country.iso_code }}"></div>
<script src="https://cdn.jsdelivr.net/npm/notify-me-wl@3.5.0/build/notify-me-wl.min.js" defer></script>
```

A page must have exactly one `#notification-widget`. A second, empty one earlier in
the page would be the one the widget reads its configuration from.

### Size pre-selection

The size list shows only out-of-stock sizes. On open, the first rule that yields one of
them wins:

1. `data-variant-id` on the clicked element.
2. Product page only (the product came from `window.currentProduct`): `?variant=` in
   the URL, then the value of the first `select[name="id"]` inside a
   `form[action*="/cart/add"]`. Hidden `input[name="id"]` fields are ignored — some
   themes keep a stale one in an installments form. Never applied to a card, so page
   state cannot leak into a listing.
3. Exactly one out-of-stock size — that size.
4. Otherwise, "Select a size".

A product with no out-of-stock sizes shows "All sizes are currently in stock." instead
of the form. A missing or malformed product shows "Product information is unavailable.
Please refresh the page."

````

- [ ] **Step 5: Development section** — after `npm run typecheck …` in the Development code block add:

```bash
npm run selftest  # build, then run the harness pages in headless Chrome
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: document PLP triggers, widget-level configuration, and size pre-selection"
```

---

### Task 4: Release 3.5.0

**Files:**
- Modify: `package.json` version, `package-lock.json` version fields

- [ ] **Step 1: Bump**

Run: `npm version 3.5.0 --no-git-tag-version`
Expected: prints `v3.5.0`; `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Full verification**

Run: `npm run typecheck && npm run selftest`
Expected: typecheck exits 0; both pages `SELFTEST PASS`; exit 0.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json build/notify-me-wl.min.js
git commit -m "chore: bump version to 3.5.0"
```

Publishing (`npm publish`) and the PR are left to the user.
