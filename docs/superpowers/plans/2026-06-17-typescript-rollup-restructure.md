# TypeScript + Rollup Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-file `index.js` widget into a maintainable TypeScript source tree compiled by Rollup into a distributable `build/` folder, with runtime behavior unchanged.

**Architecture:** Split the monolith along its existing seams into focused TS modules under `src/`. Leaf modules (types, config, data, auth, context, styles, api) have no DOM side effects; `ui/widget.ts` owns all DOM; `src/index.ts` is the only module with top-level side effects (the `DOMContentLoaded` bootstrap). Rollup bundles `src/index.ts` into IIFE outputs in `build/`.

**Tech Stack:** TypeScript 5, Rollup 4, `@rollup/plugin-typescript`, `@rollup/plugin-node-resolve`, `@rollup/plugin-terser`.

## Global Constraints

- **Pure restructure** — runtime behavior must remain identical to the current `index.js`. No features added/removed/changed.
- **No test framework introduced** (YAGNI / out of scope). The per-task verification loop is `npm run typecheck` and, for integration tasks, `npm run build` + manual demo parity. There are no unit-test steps.
- **Verbatim copies:** three large static blocks are copied byte-for-byte from the original `index.js`, not retyped — the JWT in `config.ts` (original `index.js:3`), the `COUNTRY_CODES` array (original `index.js:38-150`), and the CSS string + overlay HTML (original `index.js:196-413`). Copy them exactly; do not edit their contents.
- **Output:** `build/notify-me-wl.js` (IIFE) and `build/notify-me-wl.min.js` (IIFE, minified). Both committed to git.
- **Version:** bump to `2.0.0`. `main` → `build/notify-me-wl.min.js`. CDN URL becomes `.../notify-me-wl/build/notify-me-wl.min.js`.
- **TS target:** `ES2018`, `strict: true`, `lib: ["DOM","DOM.Iterable","ES2018"]`.

---

### Task 1: Build tooling scaffold

Sets up the toolchain and proves the Rollup pipeline emits both bundles from a minimal entry. Later tasks fill `src/` with real modules.

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `rollup.config.mjs`
- Create: `.gitignore`
- Create: `src/index.ts` (temporary stub, replaced in Task 9)

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm run build` (emits `build/notify-me-wl.js` + `build/notify-me-wl.min.js`), `npm run dev`, `npm run typecheck`.

- [ ] **Step 1: Replace `package.json` with the new manifest**

```json
{
  "name": "notify-me-wl",
  "version": "2.0.0",
  "description": "Coming Soon / Notify Me wishlist widget for retailer product pages.",
  "main": "build/notify-me-wl.min.js",
  "files": [
    "build"
  ],
  "scripts": {
    "build": "rollup -c",
    "dev": "rollup -c -w",
    "typecheck": "tsc --noEmit",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "@rollup/plugin-node-resolve": "^16.0.0",
    "@rollup/plugin-terser": "^0.4.4",
    "@rollup/plugin-typescript": "^12.1.2",
    "rollup": "^4.21.0",
    "tslib": "^2.7.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["DOM", "DOM.Iterable", "ES2018"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Note: `noEmit` is NOT set here so `@rollup/plugin-typescript` can emit into the Rollup pipeline; the `typecheck` script passes `--noEmit` on the CLI instead.

- [ ] **Step 3: Create `rollup.config.mjs`**

```js
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'build/notify-me-wl.js',
      format: 'iife',
    },
    {
      file: 'build/notify-me-wl.min.js',
      format: 'iife',
      plugins: [terser()],
    },
  ],
  plugins: [resolve(), typescript()],
};
```

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules/
```

- [ ] **Step 5: Create the temporary stub `src/index.ts`**

```ts
// Temporary bootstrap stub — replaced with the full implementation in Task 9.
document.addEventListener('DOMContentLoaded', () => {
  // intentionally empty for now
});
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: completes without errors; `node_modules/` populated.

- [ ] **Step 7: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0, no output (no type errors).

- [ ] **Step 8: Verify build emits both bundles**

Run: `npm run build`
Expected: exits 0; `build/notify-me-wl.js` and `build/notify-me-wl.min.js` both exist.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json rollup.config.mjs .gitignore src/index.ts
git commit -m "build: scaffold TypeScript + Rollup toolchain"
```

---

### Task 2: Foundations — types, config, country data, globals

Three pure-declaration modules plus the `window` global augmentation. No logic, so they are reviewed together.

**Files:**
- Create: `src/types.ts`
- Create: `src/global.d.ts`
- Create: `src/config.ts`
- Create: `src/data/country-codes.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `types.ts`: `Variant`, `Product`, `CountryContext`, `AuthMode`, `WidgetType`, `FieldName`, `WidgetConfig`.
  - `config.ts`: `ACCESS_TOKEN: string`, `TENANT_ID: string`, `CUSTOMER_INTEREST_URL: string`.
  - `data/country-codes.ts`: `COUNTRY_CODES: { code: string; name: string }[]`.

- [ ] **Step 1: Create `src/types.ts`**

```ts
export interface Variant {
  id: number | string;
  title: string;
}

export interface Product {
  id: number | string;
  title: string;
  variants?: Variant[];
}

export interface CountryContext {
  countryCode: string | null;
  provinceCode: string | null;
  marketId: string | null;
}

export type AuthMode = 'token' | 'proxy';

export type WidgetType = 'notify-me' | 'coming-soon';

export type FieldName =
  | 'email'
  | 'mobile'
  | 'firstName'
  | 'lastName'
  | 'countryCode'
  | 'provinceCode';

export interface WidgetConfig {
  fields: FieldName[];
  type: WidgetType;
  authMode: AuthMode;
  tenant: string;
  marketId: string | null;
}
```

- [ ] **Step 2: Create `src/global.d.ts`**

```ts
import type { Product } from './types';

declare global {
  interface Window {
    Shopify?: {
      country?: string;
      locale?: string;
      markets?: {
        currentMarket?: {
          countryCode?: string;
          id?: string | number;
        };
      };
    };
    customer?: {
      default_address?: {
        country_code?: string;
        province_code?: string;
      };
    };
    currentProduct?: Product;
  }
}

export {};
```

- [ ] **Step 3: Create `src/config.ts`**

Copy the full `Bearer ...` JWT string **verbatim** from the original `index.js:3` (do not abbreviate it).

```ts
// Bundled server-issued access token (used by the default 'token' auth mode).
// NOTE: relocated verbatim from the original index.js — unchanged by this restructure.
export const ACCESS_TOKEN =
  'Bearer <COPY THE EXACT TOKEN STRING FROM THE ORIGINAL index.js:3>';

// Default tenant for the X-Twc-Tenant header; used in both auth modes.
export const TENANT_ID = 'victoria-woods';

// Customer-interest API endpoint (sandbox).
export const CUSTOMER_INTEREST_URL =
  'https://api.au-sandbox.thewishlist.io/services/wsservice/api/wishlist/items/customerInterest';
```

- [ ] **Step 4: Create `src/data/country-codes.ts`**

Copy every `{ code, name }` entry **verbatim** from the original `index.js:38-150`.

```ts
export const COUNTRY_CODES: { code: string; name: string }[] = [
  { code: 'AF', name: 'Afghanistan' },
  // ... copy ALL remaining entries verbatim from the original index.js:38-150 ...
  { code: 'ZW', name: 'Zimbabwe' },
];
```

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/global.d.ts src/config.ts src/data/country-codes.ts
git commit -m "feat: add foundational types, config, and country data modules"
```

---

### Task 3: Auth — proxy token

**Files:**
- Create: `src/auth/proxy-token.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getProxyAccessToken(): Promise<string | null>` (caches the token for the page session in a module-level variable).

- [ ] **Step 1: Create `src/auth/proxy-token.ts`**

```ts
// Session-cached access token obtained from the Shopify App Proxy (proxy auth mode).
let cachedProxyToken: string | null = null;

// Fetch a tenant-scoped access token from the Shopify App Proxy.
// The path is relative/same-origin, so Shopify's App Proxy layer appends and
// signs `shop`, `logged_in_customer_id`, `timestamp`, and `signature`.
// Returns the access token string, or null on failure (e.g. customer not logged in).
export async function getProxyAccessToken(): Promise<string | null> {
  if (cachedProxyToken) return cachedProxyToken;
  try {
    const response = await fetch('/apps/twc-sdk/auth/token', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const body = await response.json().catch(() => null);
    if (
      response.ok &&
      body &&
      body.success &&
      body.data &&
      body.data.access_token
    ) {
      cachedProxyToken = body.data.access_token;
      return cachedProxyToken;
    }
    return null;
  } catch (error) {
    console.error('Error fetching proxy access token:', error);
    return null;
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/auth/proxy-token.ts
git commit -m "feat: add proxy access token module"
```

---

### Task 4: Context — country detection

**Files:**
- Create: `src/context/detect-country.ts`

**Interfaces:**
- Consumes: `CountryContext` from `../types`; `window.Shopify`, `window.customer`, `navigator.language` (declared in `global.d.ts`).
- Produces: `detectCountryContext(): CountryContext`.

- [ ] **Step 1: Create `src/context/detect-country.ts`**

```ts
import type { CountryContext } from '../types';

// Detect country/province/market context using priority fallback chain.
export function detectCountryContext(): CountryContext {
  const ctx: CountryContext = {
    countryCode: null,
    provinceCode: null,
    marketId: null,
  };

  // Priority 1: Shopify localization/country context
  const shopify = window.Shopify;
  if (shopify) {
    if (typeof shopify.country === 'string') ctx.countryCode = shopify.country;
    const mkt = shopify.markets?.currentMarket;
    if (mkt) {
      if (mkt.countryCode) ctx.countryCode = mkt.countryCode;
      if (mkt.id != null) ctx.marketId = String(mkt.id);
    }
    if (!ctx.countryCode && typeof shopify.locale === 'string') {
      const parts = shopify.locale.split('-');
      if (parts.length > 1) ctx.countryCode = parts[parts.length - 1].toUpperCase();
    }
  }

  // Priority 2: Existing customer shipping country
  if (!ctx.countryCode || !ctx.provinceCode) {
    const addr = window.customer?.default_address;
    if (addr) {
      if (!ctx.countryCode && addr.country_code) ctx.countryCode = addr.country_code;
      if (!ctx.provinceCode && addr.province_code) ctx.provinceCode = addr.province_code;
    }
  }

  // Priority 3: Browser locale fallback
  if (!ctx.countryCode) {
    const parts = (navigator.language || '').split('-');
    if (parts.length > 1) ctx.countryCode = parts[parts.length - 1].toUpperCase();
  }

  return ctx;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/context/detect-country.ts
git commit -m "feat: add country context detection module"
```

---

### Task 5: UI — styles

**Files:**
- Create: `src/ui/styles.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `injectStyles(): void` (appends a `<style>` element to `document.head`).

- [ ] **Step 1: Create `src/ui/styles.ts`**

Copy the CSS string **verbatim** from the original `index.js:196-388` into the `STYLES` template literal.

```ts
const STYLES = `
<COPY THE EXACT CSS STRING FROM THE ORIGINAL index.js:196-388 (the contents of the `styles` template literal)>
`;

// Inject the widget styles once. All rules are namespaced under #twc-nm-overlay
// (plus .notification-btn) so they don't collide with the host store theme.
export function injectStyles(): void {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = STYLES;
  document.head.appendChild(styleSheet);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/styles.ts
git commit -m "feat: add style injection module"
```

---

### Task 6: API — customer interest submission

Owns token resolution (by auth mode) and the POST. Receives a ready payload from the UI and returns a discriminated result the UI renders.

**Files:**
- Create: `src/api/customer-interest.ts`

**Interfaces:**
- Consumes: `ACCESS_TOKEN`, `CUSTOMER_INTEREST_URL` from `../config`; `getProxyAccessToken` from `../auth/proxy-token`; `AuthMode` from `../types`.
- Produces:
  - `type SubmitResult = { ok: true } | { ok: false; reason: 'auth' | 'error' }`
  - `submitCustomerInterest(payload: Record<string, unknown>, authMode: AuthMode, tenant: string): Promise<SubmitResult>`

- [ ] **Step 1: Create `src/api/customer-interest.ts`**

```ts
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
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/customer-interest.ts
git commit -m "feat: add customer-interest submission module"
```

---

### Task 7: UI — widget

The full DOM layer: builds the overlay, renders fields per config, wires open/close/Esc/backdrop/focus and inline status, and on submit assembles the payload and delegates to the API module.

**Files:**
- Create: `src/ui/widget.ts`

**Interfaces:**
- Consumes: `WidgetConfig`, `Product`, `CountryContext` from `../types`; `COUNTRY_CODES` from `../data/country-codes`; `submitCustomerInterest` from `../api/customer-interest`.
- Produces: `createWidget(params: { wrapper: HTMLElement; openButton: HTMLElement; config: WidgetConfig; productData: Product | undefined; countryCtx: CountryContext }): void`.

**Behavior note (TS strict null-safety):** the original reads form values via `form.querySelector(...).value` with no null check. The `getValue`/`isChecked` helpers below preserve the normal-path behavior while satisfying strict mode (returning `''`/`false` instead of throwing if a control is absent). This is the only behavioral concession and it cannot change observable behavior on the supported field configurations.

- [ ] **Step 1: Create `src/ui/widget.ts`**

For the overlay markup, copy the inner HTML string **verbatim** from the original `index.js:397-413` into the `overlay.innerHTML` assignment below.

```ts
import type { WidgetConfig, Product, CountryContext } from '../types';
import { COUNTRY_CODES } from '../data/country-codes';
import { submitCustomerInterest } from '../api/customer-interest';

interface TypeCopy {
  text: string;
  buttonText: string;
}

const TYPE_CONFIG: Record<WidgetConfig['type'], TypeCopy> = {
  'notify-me': {
    text: 'Register to receive a notification as soon as this item is back in stock',
    buttonText: 'Notify Me',
  },
  'coming-soon': {
    text: 'Register your interest to hear more about this item',
    buttonText: 'Register Interest',
  },
};

export function createWidget(params: {
  wrapper: HTMLElement;
  openButton: HTMLElement;
  config: WidgetConfig;
  productData: Product | undefined;
  countryCtx: CountryContext;
}): void {
  const { wrapper, openButton, config, productData, countryCtx } = params;
  const { fields, type, authMode, tenant, marketId } = config;

  // Create and append the overlay for the popup.
  const overlay = document.createElement('div');
  overlay.innerHTML = `
<COPY THE EXACT overlay innerHTML STRING FROM THE ORIGINAL index.js:397-413>
  `;
  wrapper.appendChild(overlay);

  const overlayEl = document.getElementById('twc-nm-overlay');
  const popupClose = document.getElementById('popup-close');
  const popupTitle = document.getElementById('popup-title');
  const popupText = document.getElementById('popup-text');
  const sizeSelect = document.querySelector<HTMLSelectElement>(
    "select[name='select-size']",
  );
  const form = document.getElementById('popup-form') as HTMLFormElement | null;

  if (!overlayEl || !popupClose || !popupTitle || !popupText || !sizeSelect || !form) {
    return;
  }

  // Map for form fields.
  popupText.innerText = TYPE_CONFIG[type].text;

  const countryOptions = COUNTRY_CODES.map(
    (c) =>
      `<option value="${c.code}"${
        c.code === countryCtx.countryCode ? ' selected' : ''
      }>${c.name}</option>`,
  ).join('');

  // Wrap an input/select in a labeled field row.
  const field = (id: string, label: string, control: string): string =>
    `<div class="twc-nm-field"><label class="twc-nm-label" for="${id}">${label}</label>${control}</div>`;

  const fieldMap: Record<string, string> = {
    email: field(
      'twc-nm-email',
      'Email',
      `<input class="twc-nm-input" id="twc-nm-email" name="email" type="email" placeholder="you@example.com" required />`,
    ),
    mobile: field(
      'twc-nm-mobile',
      'Mobile',
      `<input class="twc-nm-input" id="twc-nm-mobile" name="mobile" type="tel" placeholder="Mobile number" required />`,
    ),
    firstName: field(
      'twc-nm-firstname',
      'First name',
      `<input class="twc-nm-input" id="twc-nm-firstname" name="firstName" type="text" placeholder="First name" required />`,
    ),
    lastName: field(
      'twc-nm-lastname',
      'Last name',
      `<input class="twc-nm-input" id="twc-nm-lastname" name="lastName" type="text" placeholder="Last name" required />`,
    ),
    countryCode: field(
      'twc-nm-country',
      'Country',
      `<select class="twc-nm-select" id="twc-nm-country" name="countryCode"><option value="">Select country</option>${countryOptions}</select>`,
    ),
    provinceCode: field(
      'twc-nm-province',
      'State / Province',
      `<input class="twc-nm-input" id="twc-nm-province" name="provinceCode" type="text" placeholder="State / province code" value="${
        countryCtx.provinceCode || ''
      }" />`,
    ),
  };

  // Add fields to the form based on the parsed fields.
  fields.forEach((name) => {
    if (fieldMap[name]) {
      form.insertAdjacentHTML('beforeend', fieldMap[name]);
    }
  });

  form.insertAdjacentHTML(
    'beforeend',
    `<div class="twc-nm-checks">
        <label class="twc-nm-check"><input type="checkbox" name="mailList" /> Email me store updates</label>
        <label class="twc-nm-check"><input type="checkbox" name="mailListSms" /> Text me store updates</label>
    </div>`,
  );
  form.insertAdjacentHTML(
    'beforeend',
    `<div id="popup-status" class="twc-nm-status" role="status" aria-live="polite" hidden></div>`,
  );
  form.insertAdjacentHTML(
    'beforeend',
    `<button type="submit" class="twc-nm-submit">${TYPE_CONFIG[type].buttonText}</button>`,
  );

  const popupStatus = document.getElementById('popup-status');
  const submitBtn = form.querySelector<HTMLButtonElement>('.twc-nm-submit');
  if (!popupStatus || !submitBtn) return;

  // Inline status messaging (replaces alert()).
  function setStatus(kind: 'error' | 'success', message: string): void {
    popupStatus!.textContent = message;
    popupStatus!.className = `twc-nm-status twc-nm-status--${kind}`;
    popupStatus!.hidden = false;
  }
  function clearStatus(): void {
    popupStatus!.hidden = true;
    popupStatus!.textContent = '';
  }

  // Null-safe form readers (preserve normal-path behavior under strict mode).
  const getValue = (selector: string): string => {
    const el = form.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
    return el ? el.value : '';
  };
  const isChecked = (selector: string): boolean => {
    const el = form.querySelector<HTMLInputElement>(selector);
    return el ? el.checked : false;
  };

  // Open / close the popup.
  let variantsPopulated = false;
  let lastFocused: HTMLElement | null = null;

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') closePopup();
  }

  function openPopup(): void {
    lastFocused = document.activeElement as HTMLElement | null;
    overlayEl!.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown);
  }

  function closePopup(): void {
    overlayEl!.classList.remove('is-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    clearStatus();
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  function showPopup(): void {
    openPopup();

    if (!productData) {
      form!.hidden = true;
      setStatus('error', 'Product information is unavailable. Please refresh the page.');
      return;
    }

    popupTitle!.textContent = productData.title;

    if (!variantsPopulated) {
      (productData.variants || []).forEach((variant) => {
        const option = document.createElement('option');
        option.value = variant.title;
        option.textContent = variant.title;
        sizeSelect!.appendChild(option);
      });
      variantsPopulated = true;
    }

    const firstControl = form!.querySelector<HTMLElement>('select, input');
    if (firstControl) firstControl.focus();
  }

  openButton.addEventListener('click', showPopup);
  popupClose.addEventListener('click', closePopup);
  // Close when clicking the backdrop (but not the card).
  overlayEl.addEventListener('click', (event) => {
    if (event.target === overlayEl) closePopup();
  });

  // Form submission handler.
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const selectedVariant = (productData?.variants || []).find(
      (variant) => variant.title === sizeSelect.value,
    );
    if (!selectedVariant) {
      setStatus('error', 'Please select a size.');
      return;
    }

    const formData: Record<string, unknown> = {
      variantRef: selectedVariant.id,
      email: getValue("input[name='email']"),
      subscribe: isChecked("input[name='mailList']"),
      subscribeSms: isChecked("input[name='mailListSms']"),
    };

    if (type === 'coming-soon') {
      formData.comingSoon = true;
    } else {
      formData.notifyMe = true;
    }
    if (fields.includes('firstName')) {
      formData.firstName = getValue("input[name='firstName']");
    }
    if (fields.includes('lastName')) {
      formData.lastName = getValue("input[name='lastName']");
    }
    if (fields.includes('mobile')) {
      formData.mobile = getValue("input[name='mobile']");
    }

    // Country / province / market — manual fields take precedence over auto-detected values.
    if (fields.includes('countryCode')) {
      const selected = getValue("select[name='countryCode']");
      if (selected) formData.countryCode = selected;
    } else if (countryCtx.countryCode) {
      formData.countryCode = countryCtx.countryCode;
    }

    if (fields.includes('provinceCode')) {
      const val = getValue("input[name='provinceCode']");
      if (val) formData.provinceCode = val;
    } else if (countryCtx.provinceCode) {
      formData.provinceCode = countryCtx.provinceCode;
    }

    if (marketId) formData.marketId = marketId;

    clearStatus();
    const originalButtonText = submitBtn.textContent || '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      const result = await submitCustomerInterest(formData, authMode, tenant);
      if (result.ok) {
        setStatus('success', "You're on the list. We'll be in touch.");
        setTimeout(closePopup, 1500);
      } else if (result.reason === 'auth') {
        setStatus('error', 'Please log in to your account to continue.');
      } else {
        setStatus('error', 'Something went wrong. Please try again.');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalButtonText;
    }
  });
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/widget.ts
git commit -m "feat: add widget DOM/UI module"
```

---

### Task 8: Entry — bootstrap wiring

Replaces the Task 1 stub with the real bootstrap, removes the old root `index.js`, and produces the final bundle.

**Files:**
- Modify: `src/index.ts` (replace stub)
- Delete: `index.js` (old monolith at repo root)

**Interfaces:**
- Consumes: `injectStyles` from `./ui/styles`; `createWidget` from `./ui/widget`; `detectCountryContext` from `./context/detect-country`; `TENANT_ID` from `./config`; `WidgetConfig`, `FieldName`, `WidgetType`, `AuthMode` from `./types`; `window.currentProduct` (from `global.d.ts`).
- Produces: the IIFE bundle entry (top-level `DOMContentLoaded` side effect).

- [ ] **Step 1: Replace `src/index.ts` with the full bootstrap**

```ts
import { injectStyles } from './ui/styles';
import { createWidget } from './ui/widget';
import { detectCountryContext } from './context/detect-country';
import { TENANT_ID } from './config';
import type { WidgetConfig, FieldName, WidgetType, AuthMode } from './types';

document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('notification-widget');
  if (!wrapper) return;

  const openButton = document.getElementById('popup-open');
  if (!openButton) return;

  injectStyles();

  // Parse configuration from the host button's data-* attributes.
  const fields = JSON.parse(
    openButton.getAttribute('data-fields') || '["email"]',
  ) as FieldName[];
  const type = (openButton.getAttribute('data-type') || 'notify-me') as WidgetType;
  // Auth mode: 'token' (default, bundled ACCESS_TOKEN) or 'proxy' (Shopify App Proxy).
  const authMode = (openButton.getAttribute('data-auth') || 'token') as AuthMode;
  // Tenant for X-Twc-Tenant header; used in both auth modes.
  const tenant = openButton.getAttribute('data-tenant') || TENANT_ID;

  const countryCtx = detectCountryContext();
  const marketId =
    openButton.getAttribute('data-market-id') || countryCtx.marketId;

  const config: WidgetConfig = { fields, type, authMode, tenant, marketId };
  const productData = window.currentProduct;

  createWidget({ wrapper, openButton, config, productData, countryCtx });
});
```

- [ ] **Step 2: Delete the old root monolith**

Run: `git rm index.js`
Expected: `index.js` removed from the working tree and staged for deletion.

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 4: Build the final bundle**

Run: `npm run build`
Expected: exits 0; `build/notify-me-wl.js` and `build/notify-me-wl.min.js` regenerated.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts index.js
git commit -m "feat: wire bootstrap entry and remove legacy index.js"
```

---

### Task 9: Demo + docs + commit build output

Updates the local demo and README to the new build path, commits the build artifacts, and does the final parity check.

**Files:**
- Modify: `index.html`
- Modify: `README.md`
- Add: `build/notify-me-wl.js`, `build/notify-me-wl.min.js` (commit artifacts)

**Interfaces:**
- Consumes: the built bundle from Task 8.
- Produces: nothing (final deliverable).

- [ ] **Step 1: Point the demo at the build output**

In `index.html`, change the script tag from `index.js` to the build bundle:

```html
      <script src="build/notify-me-wl.js"></script>
```

(Replace the existing `<script src="index.js"></script>` line; everything else in `index.html` stays unchanged.)

- [ ] **Step 2: Update the CDN URL in `README.md`**

Replace the Installation snippet URL:

```html
<script src="https://cdn.jsdelivr.net/npm/notify-me-wl/build/notify-me-wl.min.js"></script>
```

- [ ] **Step 3: Add Development / Build and v2 notes to `README.md`**

Add a section (e.g. after Installation):

```markdown
### Development / Build

Source lives in `src/` (TypeScript) and is bundled with Rollup into `build/`.

```bash
npm install      # install dev dependencies
npm run build    # emit build/notify-me-wl.js and build/notify-me-wl.min.js
npm run dev      # rebuild on change (watch mode)
npm run typecheck # type-check without emitting
```

> **v2.0.0 path change:** the distributed bundle moved from `index.js` to
> `build/notify-me-wl.min.js`. Update embeds to the new CDN URL above.
```

- [ ] **Step 4: Manual parity check in the browser**

Run (serve the repo root so the relative script path resolves):
`npx http-server -p 8080 .` (or `python3 -m http.server 8080`)

Open `http://localhost:8080/index.html` and confirm, matching current behavior:
- The "Notify Me - Join Waitlist" button renders.
- Clicking it opens the modal with title "Sample Product".
- The Size selector lists Small / Medium / Large; First name / Last name / Email fields render (per the demo's `data-fields`).
- Esc, the × button, and a backdrop click all close the modal.
- Submitting with no size selected shows the inline "Please select a size." error.

Expected: all behaviors match the pre-restructure widget.

- [ ] **Step 5: Commit docs, demo, and build artifacts**

```bash
git add index.html README.md build/notify-me-wl.js build/notify-me-wl.min.js
git commit -m "docs: update demo and README for build/ output; commit bundles"
```

---

## Self-Review

**Spec coverage:**
- Source layout (9 modules) → Tasks 2–8. ✓
- Rollup build (IIFE + min, plugins) → Task 1 (`rollup.config.mjs`). ✓
- tsconfig (ES2018, strict, lib) → Task 1. ✓
- package.json (v2.0.0, main, files, scripts, devDeps) → Task 1. ✓
- Demo `index.html` update → Task 9. ✓
- README CDN URL + dev section + v2 note → Task 9. ✓
- `.gitignore` node_modules → Task 1. ✓
- Commit `build/` → Task 9. ✓
- Remove old `index.js` → Task 8. ✓
- Behavior parity checklist → preserved in Tasks 4/6/7/8 ports; verified Task 9 Step 4. ✓

**Type consistency:** `WidgetConfig` shape (`fields`, `type`, `authMode`, `tenant`, `marketId`) is defined in Task 2 and consumed identically in Tasks 7–8. `SubmitResult`/`submitCustomerInterest` signature defined in Task 6 matches the call site in Task 7. `createWidget` param object defined in Task 7 matches the call in Task 8. `detectCountryContext`/`CountryContext` consistent across Tasks 2/4/7/8. ✓

**Placeholder scan:** The three `<COPY ... verbatim>` markers (JWT, country data, CSS/overlay HTML) are deliberate verbatim-copy instructions with exact source line refs, per the Global Constraints — not logic placeholders. All logic steps contain complete code. ✓
