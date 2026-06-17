# Design: TypeScript + Rollup Restructure

**Date:** 2026-06-17
**Repo:** `notify-me_coming-soon-wl-widget`
**Status:** Approved (pending spec review)

## Summary

Convert the single-file vanilla-JS widget (`index.js`, ~700 lines) into a
maintainable TypeScript source tree compiled by Rollup into a distributable
`build/` folder. This is a **pure restructure**: runtime behavior must remain
identical. No features added, removed, or changed.

## Goals

- Readable, maintainable TypeScript source under `src/`, split along the code's
  existing natural seams.
- Rollup build producing browser-ready IIFE bundles in `build/`.
- Clean project structure (source vs. distributable separation).

## Non-Goals

- No behavior changes. Output bundle must do exactly what `index.js` does today.
- No auth/security rework. The hardcoded (expired) demo JWT in the current
  `index.js` is relocated verbatim into `src/config.ts`; we do not change how
  auth works.
- No ESM/UMD/npm-import support. Browser `<script>` (IIFE) only.
- No CSS extraction to a separate file or PostCSS pipeline. CSS stays as a
  string constant in TypeScript.

## Distribution Decisions (settled with user)

- **Output location:** compiled bundles go to `build/`. The documented CDN URL
  changes from `.../notify-me-wl/index.js` to
  `.../notify-me-wl/build/notify-me-wl.min.js`.
- **Backward compatibility:** this is a breaking change to the embed path,
  handled via a **major version bump to `2.0.0`** and a README note. Retailers
  must update their `<script src>`.
- **Bundle formats:** IIFE only — a readable bundle plus a minified variant.

## Source Layout (`src/`)

The current `index.js` splits along its existing sections:

```
src/
  index.ts                  // entry: DOMContentLoaded bootstrap, reads data-* attrs, wires modules together
  config.ts                 // ACCESS_TOKEN, TENANT_ID, API base URL + endpoint path
  types.ts                  // Product, Variant, CountryContext, AuthMode, WidgetType, FieldName, WidgetConfig
  data/country-codes.ts     // COUNTRY_CODES list (code/name pairs)
  auth/proxy-token.ts       // getProxyAccessToken() + module-level session cache
  context/detect-country.ts // detectCountryContext() priority fallback chain
  ui/styles.ts              // CSS string constant + injectStyles(): appends <style> to <head>
  ui/widget.ts              // modal DOM creation, field rendering, open/close, Esc/backdrop, focus mgmt, status messaging
  api/customer-interest.ts  // builds the request payload + POSTs; resolves Authorization token by auth mode
```

### Module responsibilities & boundaries

- **`config.ts`** — exports `ACCESS_TOKEN`, `TENANT_ID`, and the API URL
  (`https://api.au-sandbox.thewishlist.io/services/wsservice/api/wishlist/items/customerInterest`).
  No logic. Single source of truth for these constants.
- **`types.ts`** — shared type definitions only. Depends on nothing.
  - `Variant { id: number | string; title: string }`
  - `Product { id; title: string; variants: Variant[] }`
  - `CountryContext { countryCode: string | null; provinceCode: string | null; marketId: string | null }`
  - `AuthMode = 'token' | 'proxy'`
  - `WidgetType = 'notify-me' | 'coming-soon'`
  - `FieldName = 'email' | 'mobile' | 'firstName' | 'lastName' | 'countryCode' | 'provinceCode'`
  - `WidgetConfig { fields: FieldName[]; type: WidgetType; authMode: AuthMode; tenant: string; marketId: string | null }`
- **`data/country-codes.ts`** — exports `COUNTRY_CODES: { code: string; name: string }[]`.
  Pure data.
- **`auth/proxy-token.ts`** — exports `getProxyAccessToken(): Promise<string | null>`.
  Owns the `cachedProxyToken` session cache. Depends on nothing else in `src/`.
- **`context/detect-country.ts`** — exports `detectCountryContext(): CountryContext`.
  Reads `window.Shopify`, `window.customer`, `navigator.language`. Depends on `types.ts`.
- **`ui/styles.ts`** — exports the CSS string and `injectStyles(): void`.
- **`ui/widget.ts`** — exports a function (e.g. `createWidget(wrapper, config, productData, countryCtx)`)
  that builds the overlay DOM, renders fields per `config.fields`, wires
  open/close/Esc/backdrop/focus, and on submit delegates to
  `api/customer-interest.ts`. Depends on `types`, `data/country-codes`,
  `api/customer-interest`.
- **`api/customer-interest.ts`** — exports the submit function that assembles the
  payload from form values + context, resolves the token (`token` mode uses
  `ACCESS_TOKEN`; `proxy` mode calls `getProxyAccessToken()`), POSTs, and returns
  a result the UI can render. Depends on `config`, `auth/proxy-token`, `types`.
- **`index.ts`** — the only module with top-level side effects: registers the
  `DOMContentLoaded` listener, finds `#notification-widget` and `#popup-open`,
  parses `data-fields` / `data-type` / `data-auth` / `data-tenant` /
  `data-market-id` into a `WidgetConfig`, then calls into `ui/widget.ts`.

### Behavior parity checklist (must all hold after restructure)

- `data-fields` JSON parsing with `["email"]` default; `data-type` default
  `notify-me`; `data-auth` default `token`; `data-tenant` falls back to
  `TENANT_ID`; `data-market-id` falls back to detected `marketId`.
- Always-present required Size selector populated from `productData.variants`.
- Type config copy/button text for `notify-me` vs `coming-soon`.
- Country `<select>` pre-selects detected `countryCode`; province input
  pre-filled from detected `provinceCode`.
- Manual country/province fields take precedence over auto-detected values;
  payload sets `comingSoon`/`notifyMe`, optional `firstName`/`lastName`/`mobile`,
  `subscribe`/`subscribeSms`, `marketId` when resolved.
- Open/close via button, × , backdrop click, and `Esc`; background scroll lock;
  focus restoration; `prefers-reduced-motion`.
- Inline status messages (no `alert`), "Sending…" disabled-button state,
  success auto-close after 1500ms, popup never closes on failure.
- Proxy mode: missing token → inline "Please log in…" and submission blocked.
- Missing `productData` → form hidden + "Product information is unavailable" error.

## Build (Rollup)

`rollup.config.js`:

- Input: `src/index.ts`.
- Plugins: `@rollup/plugin-node-resolve`, `@rollup/plugin-typescript`,
  `@rollup/plugin-terser` (applied to the minified output only).
- Two outputs:
  - `build/notify-me-wl.js` — `format: 'iife'`, not minified (readable for debugging).
  - `build/notify-me-wl.min.js` — `format: 'iife'`, minified via terser.
- No external dependencies; everything bundles in.

`tsconfig.json`:

- `target: "ES2018"` (async/await, optional chaining `?.`, nullish are used).
- `lib: ["DOM", "DOM.Iterable", "ES2018"]`.
- `module: "ESNext"`, `moduleResolution: "bundler"`.
- `strict: true`, `noEmit` is fine for `typecheck` (Rollup plugin handles the
  build emit); `rootDir: "src"`.

## `package.json` Changes

- `version`: `1.4.4` → `2.0.0`.
- `main`: `index.js` → `build/notify-me-wl.min.js`.
- Add `files: ["build"]` so only the distributable ships to npm.
- Scripts:
  - `build`: `rollup -c`
  - `dev`: `rollup -c -w`
  - `typecheck`: `tsc --noEmit`
- `devDependencies`: `rollup`, `typescript`, `tslib`,
  `@rollup/plugin-typescript`, `@rollup/plugin-node-resolve`,
  `@rollup/plugin-terser`.
- Populate `description`, keep `author`/`license` as-is.
- The old root `index.js` is removed (its logic now lives in `src/` and the
  build output replaces it).

## Demo + Docs

- **`index.html`** — keep at repo root as a local demo; update the script tag
  from `index.js` to `build/notify-me-wl.js`.
- **`README.md`** — update the CDN URL to
  `https://cdn.jsdelivr.net/npm/notify-me-wl/build/notify-me-wl.min.js`, add a
  short "Development / Build" section (`npm install`, `npm run build`,
  `npm run dev`), and a note that v2.0.0 changed the embed path.

## Housekeeping

- `.gitignore`: add `node_modules/`. Decide whether `build/` is committed —
  jsDelivr serves from the published npm tarball/git tag, so committing `build/`
  is not required, but doing so keeps the GitHub-served path working. **Decision:
  commit `build/`** so both npm and direct-from-GitHub CDN paths resolve.

## Verification

- `npm run typecheck` passes (no TS errors).
- `npm run build` produces both files in `build/`.
- Opening `index.html` (served locally) shows the widget, opens the modal,
  populates sizes from the mock product, and submits — matching current behavior.
- Diff the bundled output logic against the original `index.js` to confirm parity.
