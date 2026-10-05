# JSON Config, Copy, Product Summary and Theming Hooks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any merchant configure the widget from one JSON block, override its copy, show a product summary, and hand its styling to their theme — with 3.5.x rendering unchanged when none of it is used.

**Architecture:** A three-layer config reader (button attribute → widget attribute → JSON block) feeds `index.ts`, which resolves `copy`, `classes` and `productSummary` into `WidgetConfig` with every default filled. `widget.ts` renders copy as escaped text, an optional summary bound to the size select, and applies theme classes plus a `twc-nm-themed` marker that switches off the widget's cosmetic CSS for that element. All widget CSS values move behind `var(--twc-nm-*, <current value>)`.

**Tech Stack:** TypeScript 5 (strict, ES2018 target), Rollup IIFE bundle, headless Chrome self-test harness (`harness/selftest.js`), no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-05-config-object-and-theming-design.md`

## Global Constraints

- With no JSON block, no `copy`, no `classes`, no `productSummary` and no `--twc-nm-*` variables set, rendering and behaviour must be identical to `main` (checked by `npm run visual` and the existing self-test pages).
- Precedence per setting: `#popup-open` attribute → `#notification-widget` attribute → JSON block → default.
- JSON key = attribute name without `data-`, camelCased (`data-proxy-app` → `proxyApp`). `copy`, `classes`, `productSummary` are JSON-only.
- JSON wrong type → `console.warn` naming the key, fall through. JSON `null` → absent, no warning. String settings also accept a finite number via `String()`.
- Invalid JSON block → `console.error('notify-me-wl: invalid data-twc-config JSON')`, continue with no block.
- Copy is always inserted as text (`textContent` or HTML-escaped into templates), never HTML.
- Image URLs accepted only if they match `^(https?:)?//` (case-insensitive).
- Class tokens accepted only if they match `^[A-Za-z_-][A-Za-z0-9_-]*$`.
- Console prefix for all messages: `notify-me-wl:`.
- Release version: `3.6.0`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- `babyboo/` is a local-only folder (excluded via `.git/info/exclude`); never `git add` it.

## Review Focus

- Copy strings containing `<`, `&` or `"` must show literally and never create elements or break attributes — pinned in Task 3.
- A product title containing `$&` or `$'` must appear literally in `{product}` substitutions — pinned in Task 3.
- Opening a second product after one with an image and compare-at price must not leave the first product's image or "was" price showing — pinned in Task 4.
- A `classes` value that is empty or whitespace-only must leave the element unthemed (keeping the widget's own styles) — pinned in Task 5.
- A JSON `null` (how Liquid renders nil) must fall through silently to the next layer — pinned in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/context/config-source.ts` (modify) | Read the JSON block; layered, typed config reader; `warnConfig` helper |
| `src/index.ts` (modify) | Resolve every setting through the reader into `WidgetConfig` |
| `src/ui/copy.ts` (create) | Copy defaults, `resolveCopy`, `fillProduct`, `escapeHtml` |
| `src/ui/summary.ts` (create) | Summary markup, `updateSummary`, `safeImageUrl` |
| `src/ui/classes.ts` (create) | `resolveClasses`, `applyClasses`, element targets |
| `src/ui/widget.ts` (modify) | Use copy, summary, classes; header wrapper |
| `src/ui/styles.ts` (modify) | CSS variables; layout vs cosmetic split; summary/disclaimer rules |
| `src/types.ts` (modify) | Optional product fields; `WidgetConfig` additions |
| `harness/visual.html`, `harness/run-visual.sh` (create) | Default-rendering pixel comparison against `main` |
| `harness/config.html`, `config-fallback.html`, `config-invalid.html`, `copy.html`, `summary.html`, `classes.html` (create) | Self-test pages |
| `harness/run-selftest.sh` (modify) | Page list |
| `README.md`, `package.json`, `package-lock.json`, `build/notify-me-wl.min.js` | Docs, version, bundle |

The self-test harness: each page defines `window.SELFTEST_CASES`, loads `harness/selftest.js` (stubs `fetch`, provides `ST.*` and `eq`) and then the bundle. `npm run selftest` builds and runs every page listed in `harness/run-selftest.sh` in headless Chrome, failing on any `FAIL`. `selftest.js` stubs `/auth/token` (returns a token) and `/customerInterest` (returns 200), recording every call; `ST.lastFetch(part)` returns the last recorded `{url, init}` whose URL contains `part`.

---

### Task 1: Default-rendering visual check

**Files:**
- Create: `harness/visual.html`
- Create: `harness/run-visual.sh`
- Modify: `package.json` (scripts)
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run visual` — builds, then screenshots the open widget (modal and panel, at 1024×768 and 400×800) with `main`'s bundle and the current bundle, and exits non-zero if any pair differs. `BASELINE_REF` env var overrides `main`.

- [ ] **Step 1: Create `harness/visual.html`**

```html
<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Notify me — visual check</title>
      <style>
         body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
      </style>
   </head>
   <body>
      <!-- Opened automatically for harness/run-visual.sh. ?display=modal|panel, ?bundle=<path>. -->
      <div id="notification-widget"
           data-tenant="visual-tenant"
           data-type="notify-me"
           data-fields='["email", "mobile"]'
           data-recommendations="false"
           data-country-code="AU"></div>
      <button type="button" id="open" data-twc-notify-me data-variant-id="2">Notify me</button>
      <script>
         var q = new URLSearchParams(location.search);
         document.getElementById('notification-widget').setAttribute('data-display', q.get('display') || 'modal');
         window.currentProduct = {
            id: 1,
            title: 'Visual Product',
            variants: [
               { id: 1, title: 'Small', available: true },
               { id: 2, title: 'Medium', available: false },
               { id: 3, title: 'Large', available: false },
            ],
         };
         var bundle = document.createElement('script');
         bundle.src = q.get('bundle') || '../build/notify-me-wl.min.js';
         bundle.onload = function () { document.getElementById('open').click(); };
         document.body.appendChild(bundle);
      </script>
   </body>
</html>
```

- [ ] **Step 2: Create `harness/run-visual.sh`**

```sh
#!/bin/sh
# Screenshots the open widget with BASELINE_REF's committed bundle (default: main)
# and with the working tree's bundle, and fails if any pair differs. Guards the
# promise that installs using no new configuration render exactly as before.
set -u
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${VISUAL_PORT:-8766}"
REF="${BASELINE_REF:-main}"
OUT="$ROOT/harness/.visual"
mkdir -p "$OUT"
git -C "$ROOT" show "$REF:build/notify-me-wl.min.js" > "$ROOT/harness/.baseline.min.js" || exit 1
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
status=0
for size in 1024,768 400,800; do
  for display in modal panel; do
    for which in baseline current; do
      if [ "$which" = baseline ]; then bundle=.baseline.min.js; else bundle=../build/notify-me-wl.min.js; fi
      "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size="$size" \
        --virtual-time-budget=3000 --screenshot="$OUT/$display-$size-$which.png" \
        "http://127.0.0.1:$PORT/harness/visual.html?display=$display&bundle=$bundle" >/dev/null 2>&1
    done
    if cmp -s "$OUT/$display-$size-baseline.png" "$OUT/$display-$size-current.png"; then
      echo "same $display $size"
    else
      echo "DIFF $display $size (see harness/.visual/)"
      status=1
    fi
  done
done
exit $status
```

- [ ] **Step 3: Add the npm script and ignore the outputs**

In `package.json` `scripts`, after `"selftest"`, add:

```json
    "visual": "npm run build && sh harness/run-visual.sh",
```

Append to `.gitignore`:

```
harness/.visual/
harness/.baseline.min.js
```

- [ ] **Step 4: Run it — the tree equals `main`, so every pair must match**

Run: `npm run visual`
Expected: four lines `same modal 1024,768`, `same panel 1024,768`, `same modal 400,800`, `same panel 400,800`, exit 0. If a pair differs with identical bundles, rendering is non-deterministic: open both PNGs, and fix the page (e.g. raise `--virtual-time-budget`) before continuing — later tasks depend on this check.

- [ ] **Step 5: Commit**

```bash
git add harness/visual.html harness/run-visual.sh package.json .gitignore
git commit -m "test: add a pixel comparison of default rendering against main

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: JSON config block and layered reader

**Files:**
- Modify: `src/context/config-source.ts` (whole file)
- Modify: `src/index.ts:19-75`
- Create: `harness/config.html`, `harness/config-fallback.html`, `harness/config-invalid.html`
- Modify: `harness/run-selftest.sh` (page list)

**Interfaces:**
- Produces (from `src/context/config-source.ts`):
  - `type AttrReader = (name: string) => string | null` (unchanged name; `localization.ts` and `customer-email.ts` keep using it)
  - `type JsonConfig = Record<string, unknown>`
  - `readJsonConfig(wrapper: HTMLElement): JsonConfig`
  - `jsonKey(attrName: string): string`
  - `warnConfig(key: string, expected: string): void` — logs `notify-me-wl: ignoring data-twc-config "<key>": expected <expected>`
  - `interface ConfigReader { string: AttrReader; boolean(name: string): boolean | null; number(name: string): number | null; stringArray(name: string): string[] | null; json(key: string): unknown; jsonBoolean(key: string): boolean | null }`
  - `createConfigReader(primary: HTMLElement | null, fallback: HTMLElement, json: JsonConfig): ConfigReader`
  - `createAttrReader` is removed.
- In `index.ts`, the reader is the local `source`; Tasks 3–5 add `source.json('copy')`, `source.jsonBoolean('productSummary')`, `source.json('classes')`.

- [ ] **Step 1: Write the failing self-test pages**

`harness/config.html`:

```html
<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8" />
      <title>Notify me — JSON config</title>
      <style>#selftest-result { white-space: pre-wrap; font-size: 12px; }</style>
   </head>
   <body>
      <div id="notification-widget" data-tenant="wrapper-tenant" data-type="notify-me">
         <script type="application/json" data-twc-config>
            {
               "tenant": "json-tenant",
               "type": "coming-soon",
               "display": "panel",
               "fields": ["email", "mobile"],
               "auth": "proxy",
               "proxyApp": "json-proxy",
               "recommendations": false,
               "countryCode": "NZ",
               "marketId": 12345,
               "marketHandle": "nz"
            }
         </script>
         <button id="popup-open" type="button" data-tenant="button-tenant">Notify me</button>
      </div>
      <script>
         window.currentProduct = { id: 7, title: 'Config Product', variants: [{ id: 71, title: 'S', available: false }] };
      </script>
      <pre id="selftest-result"></pre>
      <script>
         function open() { ST.click('#popup-open'); }
         window.SELFTEST_CASES = [
            { name: 'JSON display applies', run: function () {
               open();
               eq(document.getElementById('twc-nm-overlay').classList.contains('twc-nm--panel'), true, 'panel class');
            } },
            { name: 'JSON fields apply', run: function () {
               eq(!!document.querySelector("#popup-form input[name='mobile']"), true, 'mobile field');
            } },
            { name: 'Widget attribute beats JSON (type)', run: function () {
               eq(document.querySelector('#popup-form .twc-nm-submit').textContent, 'Notify Me', 'submit text');
            } },
            { name: 'Submit: button beats both, JSON proxyApp, numeric marketId, country', run: async function () {
               open();
               document.querySelector("#popup-form input[name='email']").value = 'cfg@example.com';
               document.querySelector("#popup-form input[name='mobile']").value = '0400000000';
               ST.click('#popup-form .twc-nm-submit');
               var call = await ST.waitFor(function () { return ST.lastFetch('/customerInterest'); }, 3000);
               eq(new Headers(call.init.headers).get('X-Twc-Tenant'), 'button-tenant', 'tenant');
               eq(!!ST.lastFetch('/apps/json-proxy/auth/token'), true, 'proxy app');
               var body = JSON.parse(call.init.body);
               eq(body.marketId, '12345', 'marketId');
               eq(body.marketHandle, 'nz', 'marketHandle');
               eq(body.countryCode, 'NZ', 'countryCode');
            } },
         ];
      </script>
      <script src="selftest.js"></script>
      <script src="../build/notify-me-wl.min.js"></script>
   </body>
</html>
```

`harness/config-fallback.html`:

```html
<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8" />
      <title>Notify me — JSON config fallbacks</title>
      <style>#selftest-result { white-space: pre-wrap; font-size: 12px; }</style>
   </head>
   <body>
      <div id="notification-widget">
         <script type="application/json" data-twc-config>
            { "display": 5, "fields": "email", "tenant": "fallback-tenant", "proxyApp": null, "recommendations": false }
         </script>
      </div>
      <button type="button" id="open" data-twc-notify-me>Notify me</button>
      <script>
         window.WARNINGS = [];
         var nativeWarn = console.warn;
         console.warn = function () {
            WARNINGS.push(Array.prototype.join.call(arguments, ' '));
            nativeWarn.apply(console, arguments);
         };
         window.currentProduct = { id: 8, title: 'Fallback Product', variants: [{ id: 81, title: 'S', available: false }] };
      </script>
      <pre id="selftest-result"></pre>
      <script>
         function warned(key) {
            return WARNINGS.some(function (w) { return w.indexOf('"' + key + '"') !== -1; });
         }
         window.SELFTEST_CASES = [
            { name: 'Wrong-type display falls back to modal and warns', run: function () {
               ST.click('#open');
               eq(document.getElementById('twc-nm-overlay').classList.contains('twc-nm--panel'), false, 'panel class');
               eq(warned('display'), true, 'warned display');
            } },
            { name: 'Wrong-type fields falls back to email only and warns', run: function () {
               eq(!!document.querySelector("#popup-form input[name='email']"), true, 'email field');
               eq(!!document.querySelector("#popup-form input[name='mobile']"), false, 'mobile field');
               eq(warned('fields'), true, 'warned fields');
            } },
            { name: 'null proxyApp falls back to the default silently; valid keys still apply', run: async function () {
               document.querySelector("#popup-form input[name='email']").value = 'fb@example.com';
               ST.click('#popup-form .twc-nm-submit');
               var call = await ST.waitFor(function () { return ST.lastFetch('/customerInterest'); }, 3000);
               eq(!!ST.lastFetch('/apps/twc-sdk/auth/token'), true, 'default proxy app');
               eq(new Headers(call.init.headers).get('X-Twc-Tenant'), 'fallback-tenant', 'tenant');
               eq(warned('proxyApp'), false, 'no warning for null');
            } },
         ];
      </script>
      <script src="selftest.js"></script>
      <script src="../build/notify-me-wl.min.js"></script>
   </body>
</html>
```

`harness/config-invalid.html`:

```html
<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8" />
      <title>Notify me — invalid JSON config</title>
      <style>#selftest-result { white-space: pre-wrap; font-size: 12px; }</style>
   </head>
   <body>
      <div id="notification-widget" data-tenant="attr-tenant" data-recommendations="false">
         <script type="application/json" data-twc-config>{ not json</script>
      </div>
      <button type="button" id="open" data-twc-notify-me>Notify me</button>
      <script>
         window.ERRORS = [];
         var nativeError = console.error;
         console.error = function () {
            ERRORS.push(Array.prototype.join.call(arguments, ' '));
            nativeError.apply(console, arguments);
         };
         window.currentProduct = { id: 9, title: 'Invalid Config Product', variants: [{ id: 91, title: 'S', available: false }] };
      </script>
      <pre id="selftest-result"></pre>
      <script>
         window.SELFTEST_CASES = [
            { name: 'Invalid JSON is reported and the widget still opens with defaults', run: function () {
               ST.click('#open');
               eq(ST.title(), 'Invalid Config Product', 'title');
               eq(ERRORS.some(function (e) { return e.indexOf('invalid data-twc-config JSON') !== -1; }), true, 'error logged');
            } },
            { name: 'Attributes still apply alongside an invalid block', run: async function () {
               document.querySelector("#popup-form input[name='email']").value = 'inv@example.com';
               ST.click('#popup-form .twc-nm-submit');
               var call = await ST.waitFor(function () { return ST.lastFetch('/customerInterest'); }, 3000);
               eq(new Headers(call.init.headers).get('X-Twc-Tenant'), 'attr-tenant', 'tenant');
            } },
         ];
      </script>
      <script src="selftest.js"></script>
      <script src="../build/notify-me-wl.min.js"></script>
   </body>
</html>
```

In `harness/run-selftest.sh`, change the loop line to:

```sh
for page in index.html harness/triggers.html harness/optins.html harness/config.html harness/config-fallback.html harness/config-invalid.html; do
```

- [ ] **Step 2: Run to verify the new pages fail**

Run: `npm run selftest`
Expected: `index.html`, `triggers.html`, `optins.html` PASS; `config.html` FAIL (`panel class`, `mobile field`, proxy app), `config-fallback.html` FAIL (`warned display`), `config-invalid.html` FAIL (`error logged`).

- [ ] **Step 3: Replace `src/context/config-source.ts`**

```ts
// Configuration reader. Per setting, the first layer that has it wins:
//   1. an attribute on the legacy #popup-open button
//   2. an attribute on #notification-widget
//   3. the JSON block inside #notification-widget:
//        <script type="application/json" data-twc-config>{ … }</script>
// A setting's JSON key is its attribute name without "data-", camelCased:
// data-proxy-app -> proxyApp. copy, classes and productSummary exist only in JSON.
export type AttrReader = (name: string) => string | null;

export type JsonConfig = Record<string, unknown>;

export interface ConfigReader {
  // String settings. Also the AttrReader handed to localization and
  // customer-email, which predate the JSON layer.
  string: AttrReader;
  boolean(name: string): boolean | null;
  number(name: string): number | null;
  stringArray(name: string): string[] | null;
  // JSON-only settings, by key. Undefined when absent or null.
  json(key: string): unknown;
  jsonBoolean(key: string): boolean | null;
}

const CONFIG_SELECTOR = 'script[type="application/json"][data-twc-config]';

export function readJsonConfig(wrapper: HTMLElement): JsonConfig {
  const block = wrapper.querySelector(CONFIG_SELECTOR);
  if (!block) return {};
  try {
    const parsed: unknown = JSON.parse(block.textContent || '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as JsonConfig;
    }
  } catch {
    // Reported below.
  }
  console.error('notify-me-wl: invalid data-twc-config JSON');
  return {};
}

export function jsonKey(attrName: string): string {
  return attrName
    .replace(/^data-/, '')
    .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function warnConfig(key: string, expected: string): void {
  console.warn(`notify-me-wl: ignoring data-twc-config "${key}": expected ${expected}`);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function createConfigReader(
  primary: HTMLElement | null,
  fallback: HTMLElement,
  json: JsonConfig,
): ConfigReader {
  const attr = (name: string): string | null => {
    if (primary && primary.hasAttribute(name)) return primary.getAttribute(name);
    return fallback.hasAttribute(name) ? fallback.getAttribute(name) : null;
  };
  // Liquid renders nil as null, so null means "not set" rather than a bad value.
  const raw = (key: string): unknown => (json[key] === null ? undefined : json[key]);

  const jsonBoolean = (key: string): boolean | null => {
    const value = raw(key);
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value;
    warnConfig(key, 'true or false');
    return null;
  };

  return {
    string(name) {
      const fromAttr = attr(name);
      if (fromAttr !== null) return fromAttr;
      const key = jsonKey(name);
      const value = raw(key);
      if (value === undefined) return null;
      if (typeof value === 'string') return value;
      // `localization.market.id | json` renders a number.
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
      warnConfig(key, 'a string');
      return null;
    },
    boolean(name) {
      const fromAttr = attr(name);
      if (fromAttr !== null) return fromAttr !== 'false';
      return jsonBoolean(jsonKey(name));
    },
    number(name) {
      const fromAttr = attr(name);
      if (fromAttr !== null) {
        const parsed = parseInt(fromAttr, 10);
        if (Number.isFinite(parsed)) return parsed;
      }
      const key = jsonKey(name);
      const value = raw(key);
      if (value === undefined) return null;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      warnConfig(key, 'a number');
      return null;
    },
    stringArray(name) {
      const fromAttr = attr(name);
      if (fromAttr !== null) {
        try {
          const parsed: unknown = JSON.parse(fromAttr);
          if (isStringArray(parsed)) return parsed;
        } catch {
          // Reported below.
        }
        console.warn(`notify-me-wl: ignoring invalid ${name} attribute`);
      }
      const key = jsonKey(name);
      const value = raw(key);
      if (value === undefined) return null;
      if (isStringArray(value)) return value;
      warnConfig(key, 'an array of strings');
      return null;
    },
    json: raw,
    jsonBoolean,
  };
}
```

- [ ] **Step 4: Read settings through the reader in `src/index.ts`**

Replace the import `import { createAttrReader } from './context/config-source';` with:

```ts
import { createConfigReader, readJsonConfig } from './context/config-source';
```

Replace the body of `init()` from `// Optional legacy open button.` through the closing `};` of `const config: WidgetConfig = { … };` with:

```ts
  // Optional legacy open button. When present, its attributes win over the
  // widget element's, which win over the JSON block — so existing installs are
  // unaffected.
  const openButton = document.getElementById('popup-open');
  const source = createConfigReader(openButton, wrapper, readJsonConfig(wrapper));
  const attr = source.string;

  injectStyles();

  const fields = (source.stringArray('data-fields') || ['email']) as FieldName[];
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
  // Merchant-supplied token for 'token' mode. Configuration wins over the
  // global so a single page can override it.
  const accessToken = attr('data-access-token') || window.TWC_ACCESS_TOKEN || null;

  // "Shop similar styles" section. Opt-out via data-recommendations="false".
  const recommendationsEnabled = source.boolean('data-recommendations') !== false;
  const parsedCount = source.number('data-recommendations-count');
  const recommendationsCount =
    parsedCount !== null && parsedCount > 0 ? parsedCount : 8;
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
```

Leave `createWidget({ wrapper, config, localization: resolveLocalization(attr) })` and everything after it unchanged.

- [ ] **Step 5: Typecheck, then run the self-tests**

Run: `npm run typecheck && npm run selftest`
Expected: typecheck clean; all six pages print `SELFTEST PASS`.

- [ ] **Step 6: Confirm default rendering is unchanged**

Run: `npm run visual`
Expected: four `same` lines.

- [ ] **Step 7: Commit**

```bash
git add src/context/config-source.ts src/index.ts harness/config.html harness/config-fallback.html harness/config-invalid.html harness/run-selftest.sh build/notify-me-wl.min.js
git commit -m "feat: read every setting from an optional data-twc-config JSON block

Attributes still win over the block, so existing installs are unchanged.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Configurable copy

**Files:**
- Create: `src/ui/copy.ts`
- Modify: `src/types.ts` (`WidgetConfig`)
- Modify: `src/index.ts` (config object)
- Modify: `src/ui/widget.ts` (remove `TYPE_CONFIG`; use copy)
- Modify: `src/ui/styles.ts` (disclaimer rules)
- Create: `harness/copy.html`
- Modify: `harness/run-selftest.sh`

**Interfaces:**
- Consumes: `warnConfig(key, expected)` and `source.json(key)` from Task 2.
- Produces (from `src/ui/copy.ts`):
  - `interface ResolvedCopy { title: string; intro: string; sizeLabel: string; sizePlaceholder: string; emailLabel: string | false; emailPlaceholder: string; emailOptIn: string; smsOptIn: string; submit: string; success: string; disclaimer: string | null }`
  - `resolveCopy(raw: unknown, type: WidgetType): ResolvedCopy`
  - `fillProduct(template: string, productTitle: string): string`
  - `escapeHtml(value: string): string`
- `WidgetConfig.copy: ResolvedCopy`.

- [ ] **Step 1: Write the failing self-test page `harness/copy.html`**

```html
<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8" />
      <title>Notify me — copy</title>
      <style>#selftest-result { white-space: pre-wrap; font-size: 12px; }</style>
   </head>
   <body>
      <div id="notification-widget">
         <script type="application/json" data-twc-config>
            {
               "fields": ["email", "mobile"],
               "recommendations": false,
               "copy": {
                  "title": "Notify me: {product}",
                  "intro": "Tell me about {product} and {product}",
                  "sizeLabel": "Pick a size",
                  "sizePlaceholder": "Choose one",
                  "emailLabel": false,
                  "emailPlaceholder": "Email \"address\"",
                  "emailOptIn": "Promos & <b>deals</b>",
                  "smsOptIn": "Texts",
                  "submit": "NOTIFY ME",
                  "success": "Done!",
                  "disclaimer": "We try to restock."
               }
            }
         </script>
      </div>
      <button type="button" id="open" data-twc-notify-me>Notify me</button>
      <script>
         window.currentProduct = {
            id: 4, title: "Dress $& Co $'",
            variants: [{ id: 41, title: 'S', available: false }, { id: 42, title: 'M', available: false }],
         };
      </script>
      <pre id="selftest-result"></pre>
      <script>
         function $(s) { return document.querySelector(s); }
         function optInText(name) { return $("#popup-form input[name='" + name + "']").parentNode.textContent.trim(); }
         window.SELFTEST_CASES = [
            { name: '{product} is substituted literally in title and intro', run: function () {
               ST.click('#open');
               eq(ST.title(), "Notify me: Dress $& Co $'", 'title');
               eq($('#popup-text').textContent, "Tell me about Dress $& Co $' and Dress $& Co $'", 'intro');
            } },
            { name: 'Size label and placeholder', run: function () {
               eq($("label[for='twc-nm-size']").textContent, 'Pick a size', 'label');
               eq($('#twc-nm-size option[value=""]').textContent, 'Choose one', 'placeholder');
            } },
            { name: 'emailLabel false removes the label and names the input', run: function () {
               eq(!!$("label[for='twc-nm-email']"), false, 'label');
               eq($('#twc-nm-email').getAttribute('aria-label'), 'Email "address"', 'aria-label');
               eq($('#twc-nm-email').getAttribute('placeholder'), 'Email "address"', 'placeholder');
            } },
            { name: 'Opt-in copy renders as text, never markup', run: function () {
               eq(optInText('mailList'), 'Promos & <b>deals</b>', 'email opt-in');
               eq(!!$('#popup-form b'), false, 'no <b> element');
               eq(optInText('mailListSms'), 'Texts', 'sms opt-in');
            } },
            { name: 'Submit text and disclaimer directly after it', run: function () {
               var submit = $('#popup-form .twc-nm-submit');
               eq(submit.textContent, 'NOTIFY ME', 'submit');
               var next = submit.nextElementSibling;
               eq(next && next.className, 'twc-nm-disclaimer', 'disclaimer class');
               eq(next && next.textContent, 'We try to restock.', 'disclaimer text');
            } },
            { name: 'Success message', run: async function () {
               $('#twc-nm-size').value = '41';
               $('#twc-nm-email').value = 'copy@example.com';
               $("#popup-form input[name='mobile']").value = '0400000000';
               ST.click('#popup-form .twc-nm-submit');
               await ST.waitFor(function () { return ST.status() === 'Done!'; }, 3000);
               eq($('#popup-form .twc-nm-submit').textContent, 'NOTIFY ME', 'submit restored');
            } },
         ];
      </script>
      <script src="selftest.js"></script>
      <script src="../build/notify-me-wl.min.js"></script>
   </body>
</html>
```

Append ` harness/copy.html` to the page list in `harness/run-selftest.sh`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run selftest`
Expected: earlier pages PASS; `copy.html` FAIL on `title` (shows the product title only).

- [ ] **Step 3: Create `src/ui/copy.ts`**

```ts
import type { WidgetType } from '../types';
import { warnConfig } from '../context/config-source';

// Every piece of text the widget renders, resolved from the JSON block's `copy`
// with defaults that reproduce 3.5.x exactly.
export interface ResolvedCopy {
  title: string;
  intro: string;
  sizeLabel: string;
  sizePlaceholder: string;
  // false removes the visible label; the input is then named by aria-label.
  emailLabel: string | false;
  emailPlaceholder: string;
  emailOptIn: string;
  smsOptIn: string;
  submit: string;
  success: string;
  // Null renders no disclaimer.
  disclaimer: string | null;
}

const TYPE_COPY: Record<WidgetType, { intro: string; submit: string }> = {
  'notify-me': {
    intro: 'Register to receive a notification as soon as this item is back in stock',
    submit: 'Notify Me',
  },
  'coming-soon': {
    intro: 'Register your interest to hear more about this item',
    submit: 'Register Interest',
  },
};

const STRING_KEYS = [
  'title',
  'intro',
  'sizeLabel',
  'sizePlaceholder',
  'emailPlaceholder',
  'emailOptIn',
  'smsOptIn',
  'submit',
  'success',
  'disclaimer',
] as const;

export function resolveCopy(raw: unknown, type: WidgetType): ResolvedCopy {
  const copy: ResolvedCopy = {
    // The heading has always been the product title.
    title: '{product}',
    intro: TYPE_COPY[type].intro,
    sizeLabel: 'Size',
    sizePlaceholder: 'Select a size',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    emailOptIn: 'Email me store updates',
    smsOptIn: 'Text me store updates',
    submit: TYPE_COPY[type].submit,
    success: "You're on the list. We'll be in touch.",
    disclaimer: null,
  };
  if (raw === undefined) return copy;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    warnConfig('copy', 'an object');
    return copy;
  }

  const given = raw as Record<string, unknown>;
  STRING_KEYS.forEach((key) => {
    const value = given[key];
    if (value === undefined || value === null) return;
    if (typeof value === 'string') copy[key] = value;
    else warnConfig(`copy.${key}`, 'a string');
  });

  const label = given.emailLabel;
  if (label === false || typeof label === 'string') copy.emailLabel = label;
  else if (label !== undefined && label !== null) {
    warnConfig('copy.emailLabel', 'a string or false');
  }
  return copy;
}

// Every {product} becomes the title, literally. split/join rather than
// String.replace, whose replacement string would expand "$&" in a title.
export function fillProduct(template: string, productTitle: string): string {
  return template.split('{product}').join(productTitle);
}

// For copy interpolated into the widget's markup templates.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

- [ ] **Step 4: Add `copy` to `WidgetConfig` and resolve it**

In `src/types.ts`, add at the top:

```ts
import type { ResolvedCopy } from './ui/copy';
```

and add to `interface WidgetConfig`, after `customerEmail`:

```ts
  // Every rendered string, defaults filled (data-twc-config "copy").
  copy: ResolvedCopy;
```

In `src/index.ts`, add `import { resolveCopy } from './ui/copy';` and add to the `config` object after `customerEmail: resolveCustomerEmail(attr),`:

```ts
    copy: resolveCopy(source.json('copy'), type),
```

- [ ] **Step 5: Use the copy in `src/ui/widget.ts`**

1. Delete `interface TypeCopy` and `const TYPE_CONFIG` (lines 22–35) and add the import:

```ts
import { escapeHtml, fillProduct } from './copy';
```

2. Add `copy,` to the destructuring of `config` (after `customerEmail,`).

3. In the overlay template, replace the size label and placeholder lines with:

```ts
                        <label class="twc-nm-label" for="twc-nm-size">${escapeHtml(copy.sizeLabel)}</label>
                        <select class="twc-nm-select" id="twc-nm-size" name="select-size" required>
                            <option value="" disabled selected>${escapeHtml(copy.sizePlaceholder)}</option>
                        </select>
```

4. Delete the line `popupText.innerText = TYPE_CONFIG[type].text;` and its `// Map for form fields.` comment (the intro is now set per open).

5. Replace the `email:` entry of `fieldMap` with:

```ts
    email:
      copy.emailLabel === false
        ? // No visible label: the input names itself for screen readers.
          `<div class="twc-nm-field"><input class="twc-nm-input" id="twc-nm-email" name="email" type="email" placeholder="${escapeHtml(
            copy.emailPlaceholder,
          )}" aria-label="${escapeHtml(copy.emailPlaceholder || 'Email')}" required /></div>`
        : field(
            'twc-nm-email',
            escapeHtml(copy.emailLabel),
            `<input class="twc-nm-input" id="twc-nm-email" name="email" type="email" placeholder="${escapeHtml(
              copy.emailPlaceholder,
            )}" required />`,
          ),
```

6. In the `optIns` array, replace the two label texts so the lines read:

```ts
    fields.includes('email')
      ? `<label class="twc-nm-check"><input type="checkbox" name="mailList" /> ${escapeHtml(copy.emailOptIn)}</label>`
      : '',
    fields.includes('mobile')
      ? `<label class="twc-nm-check"><input type="checkbox" name="mailListSms" /> ${escapeHtml(copy.smsOptIn)}</label>`
      : '',
```

7. Replace the submit-button insertion with:

```ts
  form.insertAdjacentHTML(
    'beforeend',
    `<button type="submit" class="twc-nm-submit">${escapeHtml(copy.submit)}</button>`,
  );
  if (copy.disclaimer) {
    form.insertAdjacentHTML(
      'beforeend',
      `<p class="twc-nm-disclaimer">${escapeHtml(copy.disclaimer)}</p>`,
    );
  }
```

8. In `renderSizeOptions`, replace the placeholder assignment with:

```ts
    sizeSelect!.innerHTML = `<option value="" disabled selected>${escapeHtml(
      copy.sizePlaceholder,
    )}</option>`;
```

9. In `showPopup`, replace `submitBtn!.textContent = TYPE_CONFIG[type].buttonText;` with `submitBtn!.textContent = copy.submit;`. In the `!resolved.ok` branch, replace `popupTitle!.textContent = '';` with:

```ts
      popupTitle!.textContent = '';
      popupText!.textContent = fillProduct(copy.intro, '');
```

and replace `popupTitle!.textContent = activeProduct.title;` with:

```ts
    popupTitle!.textContent = fillProduct(copy.title, activeProduct.title);
    popupText!.textContent = fillProduct(copy.intro, activeProduct.title);
```

10. In the submit handler, replace `setStatus('success', "You're on the list. We'll be in touch.");` with `setStatus('success', copy.success);`.

`type` is still used for the `comingSoon`/`notifyMe` payload flag; keep it in the destructuring.

- [ ] **Step 6: Add disclaimer styles to `src/ui/styles.ts`**

Insert directly after the `#twc-nm-overlay .twc-nm-submit:disabled { … }` rule:

```css
        #twc-nm-overlay .twc-nm-disclaimer {
            margin: 0;
        }
        #twc-nm-overlay .twc-nm-disclaimer:not(.twc-nm-themed) {
            font-size: 12px;
            line-height: 1.5;
            color: var(--twc-nm-muted, #6b7280);
        }
```

- [ ] **Step 7: Typecheck, self-tests, visual check**

Run: `npm run typecheck && npm run selftest && npm run visual`
Expected: typecheck clean; all seven pages `SELFTEST PASS` (including `triggers.html`'s `'Notify Me'` submit-label assertion); four `same` lines.

- [ ] **Step 8: Commit**

```bash
git add src/ui/copy.ts src/types.ts src/index.ts src/ui/widget.ts src/ui/styles.ts harness/copy.html harness/run-selftest.sh build/notify-me-wl.min.js
git commit -m "feat: make every widget string configurable through copy in data-twc-config

Adds a {product} token, an optional disclaimer under the submit button, and
emailLabel: false for a placeholder-only email field.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Product summary

**Files:**
- Modify: `src/types.ts` (`Product`, `Variant`, `WidgetConfig`)
- Create: `src/ui/summary.ts`
- Modify: `src/index.ts`, `src/ui/widget.ts`, `src/ui/styles.ts`
- Create: `harness/summary.html`
- Modify: `harness/triggers.html` (default has no summary), `harness/run-selftest.sh`

**Interfaces:**
- Consumes: `source.jsonBoolean(key)` from Task 2.
- Produces (from `src/ui/summary.ts`):
  - `safeImageUrl(value: unknown): string | null`
  - `createSummary(): HTMLElement` — root `.twc-nm-summary` containing `.twc-nm-summary-image > img`, `.twc-nm-summary-info > .twc-nm-summary-name, .twc-nm-summary-variant, .twc-nm-summary-price > .twc-nm-summary-now + .twc-nm-summary-compare`
  - `updateSummary(root: HTMLElement, product: Product, variant: Variant | null, listed: Variant[]): void`
- `WidgetConfig.productSummary: boolean`. Task 5 targets the class names above.

- [ ] **Step 1: Write the failing self-test page `harness/summary.html`**

```html
<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8" />
      <title>Notify me — product summary</title>
      <style>#selftest-result { white-space: pre-wrap; font-size: 12px; }</style>
   </head>
   <body>
      <div id="notification-widget">
         <script type="application/json" data-twc-config>{ "productSummary": true, "recommendations": false }</script>
      </div>
      <button type="button" id="t-xs" data-twc-notify-me data-variant-id="501">XS</button>
      <button type="button" id="t-none" data-twc-notify-me>Size out of stock?</button>
      <div id="card" data-twc-product='{"id":6,"title":"Card Dress","variants":[{"id":601,"title":"8","available":false,"price":"$50.00 AUD"}]}'>
         <a href="#" class="oos-link" data-twc-notify-me>Size out of stock?</a>
      </div>
      <script>
         window.currentProduct = {
            id: 5,
            title: 'Rafaela Maxi Dress',
            image: 'https://cdn.example.com/p.jpg',
            variants: [
               { id: 501, title: 'XS', available: false, price: '$199.96 AUD', compareAtPrice: '$249.95 AUD', image: 'https://cdn.example.com/xs.jpg' },
               { id: 502, title: 'S', available: false, price: '$199.96 AUD' },
               { id: 503, title: 'M', available: false, price: '$209.96 AUD', image: 'javascript:alert(1)' },
               { id: 504, title: 'L', available: true, price: '$199.96 AUD' },
            ],
         };
      </script>
      <pre id="selftest-result"></pre>
      <script>
         function $(s) { return document.querySelector('#popup-form ' + s); }
         function shown(s) { var el = $(s); return !!el && !el.hidden; }
         function choose(id) {
            var select = document.getElementById('twc-nm-size');
            select.value = id;
            select.dispatchEvent(new Event('change', { bubbles: true }));
         }
         window.SELFTEST_CASES = [
            { name: 'Selected variant: its image, name, size, now and was price', run: function () {
               ST.click('#t-xs');
               eq($('.twc-nm-summary') === document.querySelector('#popup-form').firstElementChild, true, 'summary first');
               eq($('.twc-nm-summary-image img').getAttribute('src'), 'https://cdn.example.com/xs.jpg', 'image');
               eq($('.twc-nm-summary-image img').getAttribute('alt'), 'Rafaela Maxi Dress', 'alt');
               eq($('.twc-nm-summary-name').textContent, 'Rafaela Maxi Dress', 'name');
               eq($('.twc-nm-summary-variant').textContent, 'XS', 'size');
               eq($('.twc-nm-summary-now').textContent, '$199.96 AUD', 'now');
               eq(shown('.twc-nm-summary-compare'), true, 'compare shown');
               eq($('.twc-nm-summary-compare').textContent, '$249.95 AUD', 'compare');
            } },
            { name: 'Changing size updates the summary; no compare-at hides it; image falls back to the product', run: function () {
               choose('502');
               eq($('.twc-nm-summary-variant').textContent, 'S', 'size');
               eq($('.twc-nm-summary-image img').getAttribute('src'), 'https://cdn.example.com/p.jpg', 'image');
               eq(shown('.twc-nm-summary-compare'), false, 'compare hidden');
            } },
            { name: 'A javascript: image is rejected', run: function () {
               choose('503');
               eq($('.twc-nm-summary-image img').getAttribute('src'), 'https://cdn.example.com/p.jpg', 'image');
               eq($('.twc-nm-summary-now').textContent, '$209.96 AUD', 'now');
            } },
            { name: 'Submit registers the size chosen in the drawer', run: async function () {
               choose('502');
               $("input[name='email']").value = 'sum@example.com';
               ST.click('#popup-form .twc-nm-submit');
               var call = await ST.waitFor(function () { return ST.lastFetch('/customerInterest'); }, 3000);
               eq(JSON.parse(call.init.body).variantRef, 502, 'variantRef');
            } },
            { name: 'No size selected: no size line; differing prices hide the price', run: function () {
               ST.pressEscape();
               ST.click('#t-none');
               eq(document.getElementById('twc-nm-size').value, '', 'nothing selected');
               eq(shown('.twc-nm-summary-variant'), false, 'size hidden');
               eq(shown('.twc-nm-summary-price'), false, 'price hidden');
               eq($('.twc-nm-summary-image img').getAttribute('src'), 'https://cdn.example.com/p.jpg', 'product image');
            } },
            { name: 'A second product does not keep the first one\'s image or was price', run: function () {
               ST.pressEscape();
               ST.click('#t-xs');
               ST.pressEscape();
               ST.click('#card .oos-link');
               eq($('.twc-nm-summary-name').textContent, 'Card Dress', 'name');
               eq(shown('.twc-nm-summary-image'), false, 'image box hidden');
               eq($('.twc-nm-summary-now').textContent, '$50.00 AUD', 'now');
               eq(shown('.twc-nm-summary-compare'), false, 'compare hidden');
            } },
         ];
      </script>
      <script src="selftest.js"></script>
      <script src="../build/notify-me-wl.min.js"></script>
   </body>
</html>
```

In `harness/triggers.html`, add as the first entry of `window.SELFTEST_CASES`:

```js
            { name: 'Default install renders no product summary', run: function () {
               eq(!!document.querySelector('#popup-form .twc-nm-summary'), false, 'summary');
            } },
```

Append ` harness/summary.html` to the page list in `harness/run-selftest.sh`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run selftest`
Expected: `summary.html` FAIL (`summary first` — no summary element); other pages PASS.

- [ ] **Step 3: Add the optional data fields and the flag in `src/types.ts`**

Replace `interface Variant` and `interface Product` with:

```ts
export interface Variant {
  id: number | string;
  title: string;
  // Shopify's variant.available. Omitted by legacy installs, which pre-filter
  // window.currentProduct to unavailable variants in Liquid.
  available?: boolean;
  // Product summary only. Pre-formatted by the theme (Liquid
  // money_with_currency) so the summary matches the theme's own price display.
  price?: string;
  // Sent by the theme only when it is a real discount.
  compareAtPrice?: string;
  image?: string;
}

export interface Product {
  id: number | string;
  title: string;
  variants?: Variant[];
  // Product summary only: the featured image, used when a variant has none.
  image?: string;
}
```

Add to `interface WidgetConfig`, after `copy`:

```ts
  // Product summary at the top of the form (data-twc-config "productSummary").
  productSummary: boolean;
```

In `src/index.ts`, add to the `config` object after `copy: …`:

```ts
    productSummary: source.jsonBoolean('productSummary') === true,
```

- [ ] **Step 4: Create `src/ui/summary.ts`**

```ts
import type { Product, Variant } from '../types';

// Only web URLs reach img.src; anything else (javascript:, data:, a bare path)
// is treated as no image.
export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  return /^(https?:)?\/\//i.test(url) ? url : null;
}

// Theme-supplied fields of the wrong type are treated as absent.
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function createSummary(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'twc-nm-summary';
  root.innerHTML =
    '<div class="twc-nm-summary-image"><img alt="" /></div>' +
    '<div class="twc-nm-summary-info">' +
    '<p class="twc-nm-summary-name"></p>' +
    '<p class="twc-nm-summary-variant"></p>' +
    '<p class="twc-nm-summary-price"><span class="twc-nm-summary-now"></span> <s class="twc-nm-summary-compare"></s></p>' +
    '</div>';
  return root;
}

// Show the selected variant, or the product itself while no size is chosen.
// Every part is rewritten on every call, so nothing from a previous product or
// size survives.
export function updateSummary(
  root: HTMLElement,
  product: Product,
  variant: Variant | null,
  listed: Variant[],
): void {
  const part = <T extends HTMLElement = HTMLElement>(selector: string): T =>
    root.querySelector<T>(selector)!;

  const imageBox = part('.twc-nm-summary-image');
  const image = part<HTMLImageElement>('.twc-nm-summary-image img');
  const imageUrl = (variant && safeImageUrl(variant.image)) || safeImageUrl(product.image);
  if (imageUrl) {
    image.src = imageUrl;
    image.alt = product.title;
  } else {
    image.removeAttribute('src');
  }
  imageBox.hidden = !imageUrl;

  part('.twc-nm-summary-name').textContent = product.title;

  const variantLine = part('.twc-nm-summary-variant');
  variantLine.textContent = variant ? variant.title : '';
  variantLine.hidden = !variant;

  let now = '';
  let was = '';
  if (variant) {
    now = text(variant.price);
    was = text(variant.compareAtPrice);
  } else {
    // No size chosen: a price is only meaningful when every size shares it.
    const prices = listed.map((v) => text(v.price));
    if (prices.length && prices[0] && prices.every((p) => p === prices[0])) {
      now = prices[0];
    }
  }
  if (was === now) was = '';

  part('.twc-nm-summary-now').textContent = now;
  const compare = part('.twc-nm-summary-compare');
  compare.textContent = was;
  compare.hidden = !was;
  part('.twc-nm-summary-price').hidden = !now;
}
```

- [ ] **Step 5: Render and update the summary in `src/ui/widget.ts`**

1. Add the import:

```ts
import { createSummary, updateSummary } from './summary';
```

2. Add `productSummary,` to the destructuring of `config`.

3. Directly after the `if (display === 'panel') { … }` block, add:

```ts
  // Optional product summary at the top of the form, kept in step with the
  // size select so a size changed in the drawer is what the shopper sees.
  const summaryEl = productSummary ? createSummary() : null;
  if (summaryEl) form.insertBefore(summaryEl, form.firstChild);
```

4. Directly after `function renderSizeOptions(…) { … }`, add:

```ts
  function refreshSummary(): void {
    if (!summaryEl || !activeProduct) return;
    const selected =
      activeVariants.find((variant) => String(variant.id) === sizeSelect!.value) || null;
    updateSummary(summaryEl, activeProduct, selected, activeVariants);
  }
```

5. In `showPopup`, directly after the `renderSizeOptions(activeVariants, pickPreselectedVariant(…));` call, add:

```ts
    refreshSummary();
```

6. Directly after `popupClose.addEventListener('click', closePopup);`, add:

```ts
  sizeSelect.addEventListener('change', refreshSummary);
```

- [ ] **Step 6: Add summary styles to `src/ui/styles.ts`**

Insert directly after the `.twc-nm-disclaimer:not(.twc-nm-themed)` rule from Task 3:

```css
        #twc-nm-overlay .twc-nm-summary {
            display: flex;
            align-items: flex-start;
        }
        #twc-nm-overlay .twc-nm-summary:not(.twc-nm-themed) {
            gap: 16px;
        }
        /* Theme classes often set display; hidden parts must stay hidden. */
        #twc-nm-overlay .twc-nm-summary [hidden] {
            display: none !important;
        }
        #twc-nm-overlay .twc-nm-summary-image {
            flex: none;
        }
        #twc-nm-overlay .twc-nm-summary-image:not(.twc-nm-themed) {
            width: 96px;
        }
        #twc-nm-overlay .twc-nm-summary-image img {
            display: block;
            width: 100%;
            height: auto;
        }
        #twc-nm-overlay .twc-nm-summary-info {
            flex: 1 1 auto;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        #twc-nm-overlay .twc-nm-summary-info p {
            margin: 0;
        }
        #twc-nm-overlay .twc-nm-summary-name {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }
        #twc-nm-overlay .twc-nm-summary-name:not(.twc-nm-themed) {
            font-size: 14px;
            font-weight: 600;
        }
        #twc-nm-overlay .twc-nm-summary-variant:not(.twc-nm-themed) {
            font-size: 13px;
            color: var(--twc-nm-muted, #6b7280);
        }
        #twc-nm-overlay .twc-nm-summary-price:not(.twc-nm-themed) {
            font-size: 14px;
        }
        #twc-nm-overlay .twc-nm-summary-compare:not(.twc-nm-themed) {
            margin-left: 6px;
            color: #9ca3af;
        }
```

- [ ] **Step 7: Typecheck, self-tests, visual check**

Run: `npm run typecheck && npm run selftest && npm run visual`
Expected: typecheck clean; all eight pages `SELFTEST PASS`; four `same` lines.

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/ui/summary.ts src/index.ts src/ui/widget.ts src/ui/styles.ts harness/summary.html harness/triggers.html harness/run-selftest.sh build/notify-me-wl.min.js
git commit -m "feat: optional product summary with variant image, size and now/was price

Driven by optional, theme-formatted price and image fields on the product data.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: CSS variables, header wrapper and theme class hooks

**Files:**
- Create: `src/ui/classes.ts`
- Modify: `src/types.ts`, `src/index.ts`, `src/ui/widget.ts`, `src/ui/styles.ts`
- Create: `harness/classes.html`
- Modify: `harness/run-selftest.sh`

**Interfaces:**
- Consumes: `warnConfig` and `source.json(key)` (Task 2); summary class names (Task 4); `.twc-nm-disclaimer` (Task 3).
- Produces (from `src/ui/classes.ts`):
  - `CLASS_TARGETS` (key → selector), `type ClassKey = keyof typeof CLASS_TARGETS`
  - `type ResolvedClasses = Partial<Record<ClassKey, string[]>>`
  - `THEMED_CLASS = 'twc-nm-themed'`
  - `resolveClasses(raw: unknown): ResolvedClasses`
  - `applyClasses(root: HTMLElement, classes: ResolvedClasses): void`
- `WidgetConfig.classes: ResolvedClasses`.

- [ ] **Step 1: Write the failing self-test page `harness/classes.html`**

```html
<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8" />
      <title>Notify me — theme classes and CSS variables</title>
      <style>
         #selftest-result { white-space: pre-wrap; font-size: 12px; }
         :root { --twc-nm-panel-width: 333px; --twc-nm-header-border: 1px solid rgb(0, 0, 255); }
         .Button--primary { background: rgb(200, 0, 0); }
      </style>
   </head>
   <body>
      <div id="notification-widget">
         <script type="application/json" data-twc-config>
            {
               "display": "panel",
               "fields": ["email"],
               "recommendations": false,
               "productSummary": true,
               "copy": { "disclaimer": "Small print." },
               "classes": {
                  "title": "Heading u-h4",
                  "submit": "Button Button--primary",
                  "input": "Form__Input",
                  "select": "Form__Input bad<token",
                  "close": "   ",
                  "summaryName": "CartItem__Title",
                  "disclaimer": "Text--subdued"
               }
            }
         </script>
      </div>
      <button type="button" id="open" data-twc-notify-me>Notify me</button>
      <script>
         window.WARNINGS = [];
         var nativeWarn = console.warn;
         console.warn = function () {
            WARNINGS.push(Array.prototype.join.call(arguments, ' '));
            nativeWarn.apply(console, arguments);
         };
         window.currentProduct = { id: 3, title: 'Classes Product', variants: [{ id: 31, title: 'S', available: false, price: '$1.00' }] };
      </script>
      <pre id="selftest-result"></pre>
      <script>
         function $(s) { return document.querySelector('#twc-nm-overlay ' + s); }
         function has(s, cls) { return $(s).classList.contains(cls); }
         window.SELFTEST_CASES = [
            { name: 'Theme classes and the themed marker are added', run: function () {
               ST.click('#open');
               eq(has('.twc-nm-title', 'Heading') && has('.twc-nm-title', 'u-h4'), true, 'title classes');
               eq(has('.twc-nm-title', 'twc-nm-themed'), true, 'title themed');
               eq(has('.twc-nm-submit', 'Button--primary') && has('.twc-nm-submit', 'twc-nm-themed'), true, 'submit');
               eq(has('#twc-nm-email', 'Form__Input') && has('#twc-nm-email', 'twc-nm-themed'), true, 'input');
               eq(has('.twc-nm-summary-name', 'CartItem__Title'), true, 'summary name');
               eq(has('.twc-nm-disclaimer', 'Text--subdued'), true, 'disclaimer');
            } },
            { name: 'Invalid tokens are dropped with a warning; valid ones kept', run: function () {
               eq(has('#twc-nm-size', 'Form__Input'), true, 'valid token');
               eq($('#twc-nm-size').className.indexOf('bad') === -1, true, 'invalid token dropped');
               eq(WARNINGS.some(function (w) { return w.indexOf('"classes.select"') !== -1; }), true, 'warned');
            } },
            { name: 'Whitespace-only value leaves the element unthemed', run: function () {
               eq(has('.twc-nm-close', 'twc-nm-themed'), false, 'close themed');
               eq(getComputedStyle($('.twc-nm-close')).color, 'rgb(107, 114, 128)', 'close keeps widget colour');
            } },
            { name: 'Themed elements take the theme look; unthemed keep the widget look', run: function () {
               eq(getComputedStyle($('.twc-nm-submit')).backgroundColor, 'rgb(200, 0, 0)', 'submit theme background');
               eq(getComputedStyle($("label[for='twc-nm-size']")).fontSize, '13px', 'label keeps widget size');
            } },
            { name: 'Layout still applies to themed elements', run: function () {
               eq(getComputedStyle($('.twc-nm-summary-name')).textOverflow, 'ellipsis', 'name truncates');
               eq($('.twc-nm-submit').getBoundingClientRect().width > 200, true, 'submit full width');
            } },
            { name: 'CSS variables drive the panel width and header border', run: function () {
               eq(getComputedStyle($('.twc-nm-card')).width, '333px', 'panel width');
               var header = getComputedStyle($('.twc-nm-header'));
               eq(header.borderBottomStyle + ' ' + header.borderBottomColor, 'solid rgb(0, 0, 255)', 'header border');
               eq($('.twc-nm-header').contains($('.twc-nm-title')) && $('.twc-nm-header').contains($('.twc-nm-close')), true, 'header wraps title and close');
            } },
         ];
      </script>
      <script src="selftest.js"></script>
      <script src="../build/notify-me-wl.min.js"></script>
   </body>
</html>
```

Append ` harness/classes.html` to the page list in `harness/run-selftest.sh`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run selftest`
Expected: `classes.html` FAIL on `title classes`; other pages PASS.

- [ ] **Step 3: Create `src/ui/classes.ts`**

```ts
import { warnConfig } from '../context/config-source';

// What each data-twc-config "classes" key styles. label/input/select cover every
// element of that kind in the form.
export const CLASS_TARGETS = {
  title: '.twc-nm-title',
  intro: '.twc-nm-text',
  label: '.twc-nm-label',
  input: '.twc-nm-input',
  select: '.twc-nm-select',
  checkbox: '.twc-nm-check input',
  submit: '.twc-nm-submit',
  close: '.twc-nm-close',
  disclaimer: '.twc-nm-disclaimer',
  summary: '.twc-nm-summary',
  summaryImage: '.twc-nm-summary-image',
  summaryName: '.twc-nm-summary-name',
  summaryVariant: '.twc-nm-summary-variant',
  summaryPrice: '.twc-nm-summary-price',
  summaryCompareAt: '.twc-nm-summary-compare',
} as const;

export type ClassKey = keyof typeof CLASS_TARGETS;
export type ResolvedClasses = Partial<Record<ClassKey, string[]>>;

// Marks an element whose look the theme owns: the widget's cosmetic rules are
// scoped :not(.twc-nm-themed), its layout rules are not.
export const THEMED_CLASS = 'twc-nm-themed';

const CLASS_TOKEN = /^[A-Za-z_-][A-Za-z0-9_-]*$/;

export function resolveClasses(raw: unknown): ResolvedClasses {
  const resolved: ResolvedClasses = {};
  if (raw === undefined || raw === null) return resolved;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnConfig('classes', 'an object');
    return resolved;
  }

  const given = raw as Record<string, unknown>;
  (Object.keys(CLASS_TARGETS) as ClassKey[]).forEach((key) => {
    const value = given[key];
    if (value === undefined || value === null) return;
    if (typeof value !== 'string') {
      warnConfig(`classes.${key}`, 'a string');
      return;
    }
    const tokens = value.split(/\s+/).filter(Boolean);
    const valid = tokens.filter((token) => CLASS_TOKEN.test(token));
    if (valid.length < tokens.length) {
      warnConfig(`classes.${key}`, 'class names of letters, digits, "-" and "_"');
    }
    // An empty or all-invalid value leaves the element on the widget's styles.
    if (valid.length) resolved[key] = valid;
  });
  return resolved;
}

export function applyClasses(root: HTMLElement, classes: ResolvedClasses): void {
  (Object.keys(classes) as ClassKey[]).forEach((key) => {
    const names = classes[key];
    if (!names) return;
    root.querySelectorAll<HTMLElement>(CLASS_TARGETS[key]).forEach((el) => {
      el.classList.add(...names, THEMED_CLASS);
    });
  });
}
```

- [ ] **Step 4: Add `classes` to the config**

In `src/types.ts`, add `import type { ResolvedClasses } from './ui/classes';` and add to `WidgetConfig` after `productSummary`:

```ts
  // Theme classes per element (data-twc-config "classes"); valid tokens only.
  classes: ResolvedClasses;
```

In `src/index.ts`, add `import { resolveClasses } from './ui/classes';` and add to `config` after `productSummary: …`:

```ts
    classes: resolveClasses(source.json('classes')),
```

- [ ] **Step 5: Header wrapper and class application in `src/ui/widget.ts`**

1. Add `import { applyClasses } from './classes';` and add `classes,` to the destructuring of `config`.

2. In the overlay template, replace the close-button and title lines with (same order, now wrapped):

```ts
                <div class="twc-nm-header">
                    <button type="button" id="popup-close" class="twc-nm-close" aria-label="Close"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/></svg></button>
                    <h2 id="popup-title" class="twc-nm-title"></h2>
                </div>
```

3. Directly after the disclaimer insertion from Task 3 (the `if (copy.disclaimer) { … }` block), add:

```ts
  // Every hookable element now exists (summary included), so theme classes can
  // be attached once. Later DOM updates only change text and visibility.
  applyClasses(overlayEl, classes);
```

- [ ] **Step 6: Rewrite `src/ui/styles.ts` with variables and the layout/cosmetic split**

Replace every rule from `#twc-nm-overlay {` (the first overlay rule) through `#twc-nm-overlay .twc-nm-submit:disabled { … }` with the block below. Keep `.notification-btn` rules above it, and the disclaimer and summary rules (Tasks 3–4) and everything from `#twc-nm-overlay .twc-nm-recs {` onward below it.

```css
        #twc-nm-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: var(--twc-nm-overlay-bg, rgba(17, 17, 17, 0.55));
            opacity: 0;
            visibility: hidden;
            transition: opacity var(--twc-nm-transition, 200ms ease);
        }
        #twc-nm-overlay.is-open {
            opacity: 1;
            visibility: visible;
        }
        #twc-nm-overlay * {
            box-sizing: border-box;
        }
        #twc-nm-overlay .twc-nm-card {
            position: relative;
            width: 100%;
            max-width: 400px;
            max-height: calc(100vh - 32px);
            overflow-y: auto;
            padding: var(--twc-nm-padding, 24px);
            background: var(--twc-nm-bg, #fff);
            color: var(--twc-nm-text, #111827);
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
            font: inherit;
            font-family: var(--twc-nm-font, inherit);
            transform: translateY(8px);
            transition: transform var(--twc-nm-transition, 200ms ease);
        }
        #twc-nm-overlay.is-open .twc-nm-card {
            transform: translateY(0);
        }
        /* Panel mode: same blocking backdrop, docked to the right edge and
           full height instead of centred. Declared after the modal rules so
           the shared properties are overridden. */
        #twc-nm-overlay.twc-nm--panel {
            align-items: stretch;
            justify-content: flex-end;
            padding: 0;
        }
        #twc-nm-overlay.twc-nm--panel .twc-nm-card {
            width: var(--twc-nm-panel-width, 420px);
            max-width: 100%;
            max-height: none;
            border-radius: 0;
            box-shadow: var(--twc-nm-panel-shadow, -10px 0 40px rgba(0, 0, 0, 0.18));
            transform: translateX(100%);
        }
        /* Needs the extra class to beat both the .is-open rule above and the
           panel's own resting transform. */
        #twc-nm-overlay.twc-nm--panel.is-open .twc-nm-card {
            transform: translateX(0);
        }
        @media (max-width: 480px) {
            #twc-nm-overlay.twc-nm--panel .twc-nm-card {
                width: var(--twc-nm-panel-width-mobile, 100%);
            }
        }
        /* Groups the title and close button so a theme can lay them out as a
           row. With no border it changes nothing: the close button stays
           positioned against the card. */
        #twc-nm-overlay .twc-nm-header {
            border-bottom: var(--twc-nm-header-border, none);
        }
        /* Layout below is never themed — it keeps the close button usable
           whatever classes a theme attaches. Cosmetics follow :not(themed). */
        #twc-nm-overlay .twc-nm-close {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 32px;
            height: 32px;
            min-width: 0;
            min-height: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 0;
            border: none;
            background: transparent;
            box-shadow: none;
            text-indent: 0;
            line-height: 1;
            opacity: 1;
            visibility: visible;
            cursor: pointer;
        }
        #twc-nm-overlay .twc-nm-close:not(.twc-nm-themed) {
            border-radius: 6px;
            color: var(--twc-nm-muted, #6b7280);
        }
        /* The icon is an inline SVG rather than a text glyph so host-theme
           button resets (font-size: 0, icon fonts, text-indent) can't hide it. */
        #twc-nm-overlay .twc-nm-close svg {
            display: block;
            width: 16px;
            height: 16px;
            flex: none;
            pointer-events: none;
        }
        #twc-nm-overlay .twc-nm-close::before,
        #twc-nm-overlay .twc-nm-close::after {
            content: none;
        }
        #twc-nm-overlay .twc-nm-close:not(.twc-nm-themed):hover {
            background: #f3f4f6;
            color: var(--twc-nm-text, #111827);
        }
        #twc-nm-overlay .twc-nm-title {
            margin: 0 32px 4px 0;
        }
        #twc-nm-overlay .twc-nm-title:not(.twc-nm-themed) {
            font-size: 18px;
            font-weight: 600;
        }
        #twc-nm-overlay .twc-nm-text {
            margin: 0 0 16px;
        }
        #twc-nm-overlay .twc-nm-text:not(.twc-nm-themed) {
            font-size: 14px;
            line-height: 1.5;
            color: var(--twc-nm-muted, #6b7280);
        }
        #twc-nm-overlay .twc-nm-form {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        #twc-nm-overlay .twc-nm-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        #twc-nm-overlay .twc-nm-label:not(.twc-nm-themed) {
            font-size: 13px;
            font-weight: 500;
            color: #374151;
        }
        #twc-nm-overlay .twc-nm-input,
        #twc-nm-overlay .twc-nm-select {
            width: 100%;
        }
        /* background-color, not the background shorthand, so the select's
           arrow image below survives for themed and unthemed selects alike. */
        #twc-nm-overlay .twc-nm-input:not(.twc-nm-themed),
        #twc-nm-overlay .twc-nm-select:not(.twc-nm-themed) {
            padding: 10px 12px;
            font-size: 14px;
            font-family: inherit;
            color: var(--twc-nm-text, #111827);
            background-color: #fff;
            border: 1px solid var(--twc-nm-border, #e5e7eb);
            border-radius: var(--twc-nm-radius, 8px);
        }
        #twc-nm-overlay .twc-nm-input:not(.twc-nm-themed):focus,
        #twc-nm-overlay .twc-nm-select:not(.twc-nm-themed):focus {
            outline: none;
            border-color: var(--twc-nm-text, #111827);
            box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
        }
        #twc-nm-overlay .twc-nm-select {
            appearance: none;
            -webkit-appearance: none;
            cursor: pointer;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
        }
        /* After the shared padding above, which it must override. */
        #twc-nm-overlay .twc-nm-select:not(.twc-nm-themed) {
            padding-right: 36px;
        }
        #twc-nm-overlay .twc-nm-checks {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        #twc-nm-overlay .twc-nm-check {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #374151;
            cursor: pointer;
        }
        #twc-nm-overlay .twc-nm-check input {
            width: 16px;
            height: 16px;
            margin: 0;
        }
        #twc-nm-overlay .twc-nm-check input:not(.twc-nm-themed) {
            accent-color: var(--twc-nm-text, #111827);
        }
        #twc-nm-overlay .twc-nm-status {
            font-size: 13px;
            line-height: 1.5;
            padding: 10px 12px;
            border-radius: var(--twc-nm-radius, 8px);
        }
        #twc-nm-overlay .twc-nm-status--error {
            color: #b91c1c;
            background: #fef2f2;
        }
        #twc-nm-overlay .twc-nm-status--success {
            color: #15803d;
            background: #f0fdf4;
        }
        #twc-nm-overlay .twc-nm-status--info {
            color: #374151;
            background: #f3f4f6;
        }
        #twc-nm-overlay .twc-nm-submit {
            width: 100%;
            cursor: pointer;
        }
        #twc-nm-overlay .twc-nm-submit:not(.twc-nm-themed) {
            padding: 12px 16px;
            font-size: 14px;
            font-weight: 600;
            font-family: inherit;
            color: #fff;
            background: #111827;
            border: none;
            border-radius: var(--twc-nm-radius, 8px);
            transition: background 150ms ease;
        }
        #twc-nm-overlay .twc-nm-submit:not(.twc-nm-themed):hover {
            background: #374151;
        }
        #twc-nm-overlay .twc-nm-submit:disabled {
            opacity: 0.6;
            cursor: default;
        }
```

Then, in the `#twc-nm-overlay .twc-nm-recs { … }` rule, change `border-top: 1px solid #e5e7eb;` to:

```css
            border-top: 1px solid var(--twc-nm-border, #e5e7eb);
```

- [ ] **Step 7: Typecheck and self-tests**

Run: `npm run typecheck && npm run selftest`
Expected: typecheck clean; all nine pages `SELFTEST PASS`.

- [ ] **Step 8: Visual check — the refactor must not move a pixel**

Run: `npm run visual`
Expected: four `same` lines. If a pair differs, open `harness/.visual/<display>-<size>-baseline.png` and `-current.png` side by side, find the property that drifted, and fix it in `styles.ts`. The likeliest causes are `font-family: var(--twc-nm-font, inherit)` (if so, delete that line and drop `--twc-nm-font` from the README in Task 6), the header wrapper changing margin collapse, or a rule whose specificity changed order. Do not commit until all four match.

- [ ] **Step 9: Commit**

```bash
git add src/ui/classes.ts src/types.ts src/index.ts src/ui/widget.ts src/ui/styles.ts harness/classes.html harness/run-selftest.sh build/notify-me-wl.min.js
git commit -m "feat: theme hooks — CSS custom properties and per-element theme classes

Classes from data-twc-config hand an element's cosmetic styling to the theme;
layout rules always apply. Unset variables reproduce the current look.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Documentation and 3.6.0 release

**Files:**
- Modify: `README.md`
- Modify: `package.json`, `package-lock.json` (version)
- Modify: `build/notify-me-wl.min.js`

**Interfaces:**
- Consumes: everything above. No code changes.

- [ ] **Step 1: Update the README**

1. In **Features**, add after the opt-ins bullet:

```markdown
- Configurable from one JSON block, with every string overridable — see [JSON configuration](#json-configuration) and [Copy](#copy).
- Optional product summary (image, name, size, now/was price) — see [Product summary](#product-summary).
- Theme integration through CSS custom properties and per-element theme classes — see [Styling and theme classes](#styling-and-theme-classes).
```

2. In **Configuration**, change the first sentence to: `Every attribute below can be set on #notification-widget, on #popup-open, or as a key in the JSON block (see [JSON configuration](#json-configuration)). Per setting, #popup-open wins, then #notification-widget, then the JSON block.`

3. Insert these sections directly before `### Auth modes`:

````markdown
### JSON configuration

Instead of (or as well as) attributes, put a JSON block inside `#notification-widget`:

```liquid
<div id="notification-widget" data-market-id="{{ localization.market.id }}">
  <script type="application/json" data-twc-config>
    {
      "tenant": "your-tenant",
      "type": "notify-me",
      "display": "panel",
      "fields": ["email"],
      "currency": {{ cart.currency.iso_code | json }},
      "productSummary": true,
      "copy": { "title": {{ 'Notify me when available' | json }} },
      "classes": { "submit": "Button Button--primary" }
    }
  </script>
</div>
```

- Each attribute's key is its name without `data-`, camelCased: `data-proxy-app` → `proxyApp`, `data-recommendations-count` → `recommendationsCount`. Values use real JSON types — `"fields": ["email"]`, `"recommendations": false`, `"recommendationsCount": 6`.
- `productSummary`, `copy` and `classes` exist only in JSON.
- Per setting, an attribute on `#popup-open` wins, then one on `#notification-widget`, then the JSON block, then the default. Liquid-rendered values such as `data-market-id` can stay as attributes next to the block.
- Build values with Liquid's `| json` filter so quotes and apostrophes cannot break the block.
- `null` counts as not set. A value of the wrong type is ignored with a console warning and the next layer applies. Invalid JSON is reported in the console and the widget runs as if there were no block.
- String settings accept numbers too, so `"marketId": {{ localization.market.id | json }}` works.

### Copy

`copy` in the JSON block overrides any of the widget's text. Everything is rendered as plain text.

| Key | Default |
|---|---|
| `title` | `"{product}"` — the product name |
| `intro` | "Register to receive a notification as soon as this item is back in stock" (notify-me) / "Register your interest to hear more about this item" (coming-soon) |
| `sizeLabel` | `"Size"` |
| `sizePlaceholder` | `"Select a size"` |
| `emailLabel` | `"Email"`; `false` removes the label (the input gets an `aria-label`) |
| `emailPlaceholder` | `"you@example.com"` |
| `emailOptIn` | `"Email me store updates"` (shown with the `email` field) |
| `smsOptIn` | `"Text me store updates"` (shown with the `mobile` field) |
| `submit` | `"Notify Me"` / `"Register Interest"` |
| `success` | `"You're on the list. We'll be in touch."` |
| `disclaimer` | none; when set, shown under the submit button |

`{product}` in `title` or `intro` is replaced by the product's name.

### Product summary

`"productSummary": true` shows the product at the top of the form — image, name, the selected size and its price, with the compare-at price struck through. It follows the size select, so a size changed in the widget updates the summary and is the size registered.

It reads optional fields on the product data (`window.currentProduct` or `data-twc-product`). Prices are passed already formatted, so they match the theme:

```liquid
{%- capture twc_product -%}
  {"id":{{ product.id | json }},"title":{{ product.title | json }},
   "image":{{ product.featured_image | image_url: width: 300 | json }},"variants":[
  {%- for v in product.variants -%}
    {"id":{{ v.id | json }},"title":{{ v.title | json }},"available":{{ v.available | json }},
     "price":{{ v.price | money_with_currency | json }}
     {%- if v.compare_at_price > v.price -%},"compareAtPrice":{{ v.compare_at_price | money_with_currency | json }}{%- endif -%}
     {%- if v.featured_image -%},"image":{{ v.featured_image | image_url: width: 300 | json }}{%- endif -%}}
    {%- unless forloop.last -%},{%- endunless -%}
  {%- endfor -%}]}
{%- endcapture -%}
```

A variant without an image falls back to the product image. Image URLs must be `https:`, `http:` or `//` URLs. With no size selected, the price shows only when every listed size has the same price.

### Styling and theme classes

**CSS custom properties.** Set any of these (on `:root` or an ancestor, inside your own media queries if needed); unset ones keep the default look.

| Variable | Default |
|---|---|
| `--twc-nm-panel-width` | `420px` |
| `--twc-nm-panel-width-mobile` | `100%` (≤480px) |
| `--twc-nm-padding` | `24px` |
| `--twc-nm-overlay-bg` | `rgba(17, 17, 17, 0.55)` |
| `--twc-nm-panel-shadow` | `-10px 0 40px rgba(0, 0, 0, 0.18)` |
| `--twc-nm-transition` | `200ms ease` |
| `--twc-nm-bg` | `#fff` |
| `--twc-nm-text` | `#111827` |
| `--twc-nm-muted` | `#6b7280` |
| `--twc-nm-border` | `#e5e7eb` |
| `--twc-nm-font` | `inherit` |
| `--twc-nm-radius` | `8px` |
| `--twc-nm-header-border` | `none` |

**Theme classes.** `classes` in the JSON block adds your theme's classes to the widget's elements, so they pick up your existing button, input and heading styles:

```json
"classes": {
  "title": "Heading u-h4",
  "input": "Form__Input",
  "select": "Form__Input",
  "submit": "Button Button--primary Button--full"
}
```

Keys: `title`, `intro`, `label`, `input`, `select`, `checkbox`, `submit`, `close`, `disclaimer`, `summary`, `summaryImage`, `summaryName`, `summaryVariant`, `summaryPrice`, `summaryCompareAt`. `label`, `input` and `select` apply to every element of that kind.

An element given classes drops the widget's own colours, fonts, borders, padding and hover styles, so your theme's apply cleanly. Its layout (width, position, truncation) stays the widget's. Class names may contain letters, digits, `-` and `_`; anything else is dropped with a console warning.
````

- [ ] **Step 2: Bump the version**

Run: `npm version 3.6.0 --no-git-tag-version`
Expected: `v3.6.0`; `package.json` and `package-lock.json` updated.

- [ ] **Step 3: Full verification**

Run: `npm run typecheck && npm run selftest && npm run visual`
Expected: typecheck clean; nine `SELFTEST PASS`; four `same` lines.

- [ ] **Step 4: Commit**

```bash
git add README.md package.json package-lock.json build/notify-me-wl.min.js
git commit -m "docs: document JSON config, copy, product summary and theme hooks; bump to 3.6.0

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Babyboo dev-theme snippet (local only — never committed)

**Files:**
- Modify: `babyboo/snippets/twc-notify-me.liquid` (create locally if absent; this folder is excluded from git)

**Interfaces:**
- Consumes: the 3.6.0 config, copy, `productSummary`, variables and `classes` from Tasks 2–5. Until 3.6.0 is published to npm, test by temporarily pointing the script `src` at a locally served build (e.g. an ngrok URL) — revert to the pinned CDN URL before handing over.

- [ ] **Step 1: Write the snippet**

```liquid
{%- comment -%} TWC Notify Me widget. PDP only, rendered from layout/theme.liquid. {%- endcomment -%}
{%- capture twc_product -%}
  {"id":{{ product.id | json }},"title":{{ product.title | json }}
  {%- if product.featured_image -%},"image":{{ product.featured_image | image_url: width: 300 | json }}{%- endif -%},"variants":[
  {%- for v in product.variants -%}
    {"id":{{ v.id | json }},"title":{{ v.title | json }},"available":{{ v.available | json }},
     "price":{{ v.price | money_with_currency | json }}
     {%- if v.compare_at_price > v.price -%},"compareAtPrice":{{ v.compare_at_price | money_with_currency | json }}{%- endif -%}
     {%- if v.featured_image -%},"image":{{ v.featured_image | image_url: width: 300 | json }}{%- endif -%}}
    {%- unless forloop.last -%},{%- endunless -%}
  {%- endfor -%}]}
{%- endcapture -%}

<script>
  window.currentProduct = {{ twc_product }};
  {%- if customer %}
  window.customer = { email: {{ customer.email | json }} };
  {%- endif %}
</script>

<style>
  .twc-nm-hidden { display: none !important; }
  /* This theme only: hide Swym's PDP entry points so a single Notify Me shows. */
  .swym-isa-button-bar,
  .sizeNotInStock { display: none !important; }

  /* Mini cart (#sidebar-cart, Prestige .Drawer--fromRight) as the reference. */
  :root {
    --twc-nm-panel-width: 400px;
    --twc-nm-panel-width-mobile: calc(100vw - 65px);
    --twc-nm-padding: 0 30px 30px;
    --twc-nm-overlay-bg: rgba(54, 54, 54, 0.5);
    --twc-nm-panel-shadow: none;
    --twc-nm-transition: 0.5s var(--drawer-transition-timing);
    --twc-nm-bg: var(--background);
    --twc-nm-text: var(--text-color);
    --twc-nm-muted: var(--text-color-light);
    --twc-nm-border: var(--border-color);
    --twc-nm-radius: 0;
    --twc-nm-header-border: 1px solid var(--border-color);
  }
  @media screen and (max-width: 640px) {
    :root {
      --twc-nm-panel-width: calc(100vw - 65px);
      --twc-nm-padding: 0 18px 24px 24px;
    }
  }

  /* Header row like .Drawer__Header: full-bleed border, title left, X right. */
  #twc-nm-overlay .twc-nm-card .twc-nm-header {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 60px;
    height: var(--header-height);
    max-height: 80px;
    margin: 0 -30px 24px;
    padding: 0 30px;
  }
  #twc-nm-overlay .twc-nm-card .twc-nm-title { margin: 0; text-align: left; }
  #twc-nm-overlay .twc-nm-card .twc-nm-close {
    top: calc(50% - 16px);
    right: 22px; /* 30px to the 15px icon inside the 32px hit area */
  }
  #twc-nm-overlay .twc-nm-card .twc-nm-close svg { width: 15px; height: 15px; }
  #twc-nm-overlay .twc-nm-card .twc-nm-text { margin-bottom: 24px; }
  #twc-nm-overlay .twc-nm-card .twc-nm-form { gap: 16px; }
  #twc-nm-overlay .twc-nm-card .twc-nm-summary { margin: 0 0 8px; }
  #twc-nm-overlay .twc-nm-card .twc-nm-summary-info { padding-left: 25px; gap: 0; }
  #twc-nm-overlay .twc-nm-card .twc-nm-select { padding-right: 36px; }
  #twc-nm-overlay .twc-nm-card .twc-nm-check { font-size: inherit; color: inherit; align-items: flex-start; }
  #twc-nm-overlay .twc-nm-card .twc-nm-check input { accent-color: var(--text-color); margin-top: 2px; }
  #twc-nm-overlay .twc-nm-card .twc-nm-disclaimer { font-size: 11px; }
  @media screen and (max-width: 640px) {
    #twc-nm-overlay .twc-nm-card .twc-nm-header { margin: 0 -18px 24px -24px; padding: 0 18px 0 24px; }
    #twc-nm-overlay .twc-nm-card .twc-nm-close { right: 10px; }
  }
</style>

<div id="notification-widget"
     data-currency="{{ cart.currency.iso_code }}"
     data-market-id="{{ localization.market.id }}"
     data-market-handle="{{ localization.market.handle }}"
     data-country-code="{{ localization.country.iso_code }}">
  <script type="application/json" data-twc-config>
    {
      "tenant": "babyboofashion-com-au",
      "proxyApp": "twc-sdk",
      "type": "notify-me",
      "display": "panel",
      "fields": ["email"],
      "recommendations": false,
      "productSummary": true,
      "copy": {
        "title": "Notify me when available",
        "intro": "Simply enter your email address below and we'll notify you as soon as the item or size becomes available.",
        "emailLabel": false,
        "emailPlaceholder": "Email",
        "emailOptIn": "Subscribe to marketing emails and exclusive promos",
        "submit": "NOTIFY ME",
        "disclaimer": "We try to restock all of our items, however, the timeframes can vary. By signing up you consent to receiving marketing messages from BABYBOO Fashion. You can unsubscribe at any time."
      },
      "classes": {
        "title": "Drawer__Title Heading u-h4",
        "close": "Icon-Wrapper--clickable",
        "input": "Form__Input",
        "select": "Form__Input",
        "submit": "Button Button--primary Button--full",
        "summaryImage": "CartItem__ImageWrapper",
        "summaryName": "CartItem__Title Heading",
        "summaryVariant": "CartItem__Variant",
        "summaryPrice": "CartItem__Price Price",
        "summaryCompareAt": "Price--compareAt",
        "disclaimer": "Text--subdued"
      }
    }
  </script>
</div>

<script src="https://cdn.jsdelivr.net/npm/notify-me-wl@3.6.0/build/notify-me-wl.min.js" defer></script>

<script>
  // Prestige fires variant:changed after it updates Add to Cart. Swap the two buttons:
  // a sold-out variant shows Notify Me instead of Add to Cart.
  document.addEventListener('variant:changed', function (event) {
    var scope = event.target.closest && event.target.closest('.Product');
    if (!scope) return;
    var addToCart = scope.querySelector('.ProductForm__AddToCart');
    var notifyMe = scope.querySelector('.twc-notify-me-btn');
    if (!addToCart || !notifyMe) return;

    var variant = event.detail && event.detail.variant;
    // No variant means an unavailable combination: leave the theme's "Unavailable" state alone.
    var soldOut = !!variant && !variant.available;
    addToCart.classList.toggle('twc-nm-hidden', soldOut);
    notifyMe.classList.toggle('twc-nm-hidden', !soldOut);
    if (variant) notifyMe.setAttribute('data-variant-id', variant.id);
  });
</script>
```

The Babyboo CSS rules use `#twc-nm-overlay .twc-nm-card …` (one class more than the widget's own) because the widget injects its stylesheet at runtime, after the theme's.

- [ ] **Step 2: Verify the theme variable names exist**

In the dev theme preview, run in the console:
`['--background','--text-color','--text-color-light','--border-color','--drawer-transition-timing','--header-height'].map(v => v + '=' + getComputedStyle(document.documentElement).getPropertyValue(v))`
Expected: every variable has a value. For any empty one, find the equivalent in `snippets/css-variables.liquid` and substitute it in the snippet.

- [ ] **Step 3: Side-by-side check against the mini cart**

On a PDP in the dev theme preview, open the mini cart, then close it and open Notify Me on a sold-out size; repeat at 1280px, 641px, 640px and 375px. Compare drawer width, overlay colour, header height and border, title typography, X size and position, product row (90px image, 25px gap, title truncation, price styles), input and CTA styling. Adjust only the Babyboo `<style>` rules for any mismatch.

- [ ] **Step 4: Walk the brief's acceptance criteria**

Confirm each of the 14 criteria in the brief (section 13), including: in-stock shows Add to Cart; sold-out swaps to Notify Me without reload; drawer pre-selects the size; changing size in the drawer updates image/size/price and registers the new variant; email pre-filled for logged-in customers; marketing checkbox unchecked and optional; closes on X, backdrop click and Esc; live theme and Swym untouched.

No commit — `babyboo/` stays local. Hand the snippet contents to the user for the dev theme.

---

## Self-Review Notes

- Spec coverage: §1 config → Task 2; §2 copy → Task 3; §3 summary → Task 4; §4 variables, header, classes → Task 5; §5 tests → Tasks 1–5, release and README → Task 6, Babyboo rollout → Task 7.
- The spec's "`image` omitted when no image" is implemented with the `hidden` attribute plus a `[hidden] { display: none !important }` guard, so theme classes cannot reveal an empty box.
- `.twc-nm-summary-now` is an addition to the spec's markup sketch; it gives the "now" price a stable hook.
