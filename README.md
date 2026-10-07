# Notify Me / Coming Soon widget

A drop-in widget that lets shoppers register interest in an out-of-stock size ("Notify Me") or an upcoming product ("Coming Soon"). It opens as a modal or a slide-in panel, collects an email (and optionally more), and sends it to The Wishlist's Customer Interest API.

Full integration guide: [TWC docs — Notify Me & Coming Soon](https://the-wishlist-documentation.gitbook.io/the-wishlist-documentation-docs/notify-me-and-coming-soon/overview)

**Contents:** [Quick start](#quick-start) · [Product data](#product-data) · [Opening the widget](#opening-the-widget) · [Configuration](#configuration) · [Copy](#copy) · [Styling](#styling) · [Authentication](#authentication) · [Recommendations](#recommendations) · [What gets sent](#what-gets-sent) · [Development](#development) · [Upgrading](#upgrading)

---

## Quick start

Three pieces go into the theme. This example is a Shopify product page.

**1. The product**, so the widget knows which sizes are out of stock:

```liquid
<script>
  window.currentProduct = {
    id: {{ product.id | json }},
    title: {{ product.title | json }},
    variants: [
      {%- for v in product.variants -%}
        { id: {{ v.id | json }}, title: {{ v.title | json }}, available: {{ v.available | json }} }{% unless forloop.last %},{% endunless %}
      {%- endfor -%}
    ]
  };
</script>
```

**2. The widget and its configuration**, once per page:

```liquid
<div id="notification-widget"
     data-market-id="{{ localization.market.id }}"
     data-market-handle="{{ localization.market.handle }}"
     data-country-code="{{ localization.country.iso_code }}">
  <script type="application/json" data-twc-config>
    {
      "tenant": "your-tenant",
      "type": "notify-me",
      "display": "panel",
      "fields": ["email"]
    }
  </script>
</div>
<script src="https://cdn.jsdelivr.net/npm/notify-me-wl@3.6.2/build/notify-me-wl.min.js" defer></script>
```

**3. A button that opens it:**

```html
<button type="button" data-twc-notify-me>Notify me</button>
```

That's a working install. Always pin the script to an exact version (`@3.6.2`), so a new release never reaches a live store until you choose to upgrade.

---

## Product data

The widget reads the product from the clicked element's closest `[data-twc-product]`, or from `window.currentProduct` on a product page.

| Field | Required | Meaning |
|---|---|---|
| `id`, `title` | yes | Product id and name |
| `variants[].id`, `variants[].title` | yes | Each size. `title` is what the size dropdown shows |
| `variants[].available` | recommended | Only sizes that are not `true` are offered. Without it, every listed variant is offered (older installs pre-filter in Liquid) |
| `image` | for the summary | Product image URL, used when a variant has none |
| `variants[].price` | for the summary | Already-formatted price, e.g. `"$199.96 AUD"` |
| `variants[].compareAtPrice` | for the summary | Already-formatted "was" price. Only send it when it is a real discount |
| `variants[].image` | for the summary | Variant image URL |

The last four only matter with `"productSummary": true` (see [Configuration](#configuration)). Prices are passed pre-formatted so they always match the theme's own price display. Image URLs must start with `https:`, `http:` or `//`.

A full capture, including summary fields, that works for both product pages and cards:

```liquid
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

{%- comment -%} Product page {%- endcomment -%}
<script>window.currentProduct = {{ twc_product }};</script>

{%- comment -%} Product card — | escape is required inside an attribute {%- endcomment -%}
<div class="product-card" data-twc-product="{{ twc_product | escape }}">…</div>
```

Keep the `{%- if … -%}` guards: `image_url` on a missing image renders a Liquid error and breaks the JSON.

---

## Opening the widget

Any element with `data-twc-notify-me` opens the widget for its product. No theme JavaScript is needed, and cards added later (filters, infinite scroll) work too.

```liquid
<div class="product-card" data-twc-product="{{ twc_product | escape }}">
  {%- for v in product.variants -%}
    <button type="button" data-variant-id="{{ v.id }}" {% unless v.available %}data-twc-notify-me{% endunless %}>{{ v.title }}</button>
  {%- endfor -%}
  <a href="#" data-twc-notify-me>Size out of stock?</a>
</div>
```

- Don't put `disabled` on a sold-out size button. Browsers don't fire clicks on disabled buttons, so use a class or `aria-disabled="true"` instead.
- The click's default action is prevented (`href="#"` won't jump), but the theme's own handlers still run.

**Which size is pre-selected.** The first of these that matches an out-of-stock size wins:

1. `data-variant-id` on the clicked element.
2. On a product page only: `?variant=` in the URL, then the product form's `select[name="id"]` (inside `form[action*="/cart/add"]`).
3. The only out-of-stock size, if there is exactly one.
4. Otherwise "Select a size".

A product with nothing out of stock shows "All sizes are currently in stock." instead of the form.

---

## Configuration

Put settings in the JSON block inside `#notification-widget`. Every setting except `productSummary`, `copy` and `classes` can also be an attribute: the attribute name is `data-` plus the key in kebab-case (`proxyApp` → `data-proxy-app`). Attributes are handy for values Liquid renders, like the market id.

| Key | Attribute | Default | Description |
|---|---|---|---|
| `tenant` | `data-tenant` | bundled demo tenant | Your TWC tenant. **Always set it** |
| `type` | `data-type` | `"notify-me"` | `"notify-me"` or `"coming-soon"`. Changes the default copy and the payload flag |
| `display` | `data-display` | `"modal"` | `"modal"` (centred dialog) or `"panel"` (full-height, slides in from the right) |
| `fields` | `data-fields` | `["email"]` | Form fields, any of `"email"`, `"mobile"`, `"firstName"`, `"lastName"`, `"countryCode"`, `"provinceCode"`. The size dropdown is always shown |
| `auth` | `data-auth` | `"proxy"` | `"proxy"` or `"token"`; see [Authentication](#authentication) |
| `proxyApp` | `data-proxy-app` | `"twc-sdk"` | Shopify App Proxy subpath (`/apps/<proxyApp>/…`) |
| `accessToken` | `data-access-token` | — | Token for `"token"` auth. Falls back to `window.TWC_ACCESS_TOKEN` |
| `marketId` | `data-market-id` | `window.Shopify` market | Shopify market id; a full `gid://…` is fine |
| `marketHandle` | `data-market-handle` | — | Market handle, e.g. `"au"` |
| `countryCode` | `data-country-code` | detected | ISO country code. A country chosen in the form wins |
| `currency` | `data-currency` | `window.Shopify.currency.active` | Fallback currency for recommendation prices |
| `customerEmail` | `data-customer-email` | Shopify customer | Overrides the shopper's email (testing) |
| `recommendations` | `data-recommendations` | `true` | `false` hides the "Shop similar styles" row |
| `recommendationsCount` | `data-recommendations-count` | `8` | Products in that row |
| `recommendationsProfile` | `data-recommendations-profile` | — | Searchspring profile tag, if the tenant config has none |
| `productSummary` | — | `false` | Show image, name, size and price at the top of the form |
| `copy` | — | — | Text overrides; see [Copy](#copy) |
| `classes` | — | — | Theme classes per element; see [Styling](#styling) |

**Rules**

- **Precedence:** an attribute on the legacy `#popup-open` button wins, then an attribute on `#notification-widget`, then the JSON block, then the default. An empty attribute counts as not set.
- **Use Liquid's `| json` filter** for any value you render into the block, so quotes and apostrophes can't break it.
- **Bad values are skipped, not fatal.** A value of the wrong type is ignored with a console warning, and `null` counts as not set. Invalid JSON is logged and the widget runs with the remaining settings.
- **One `#notification-widget` per page.** If there are two, the first is used.

---

## Copy

`copy` overrides the widget's main text. Everything is shown as plain text, never HTML.

```json
"copy": {
  "title": "Notify me when available",
  "intro": "We'll email you as soon as {product} is back.",
  "emailLabel": false,
  "emailPlaceholder": "Email",
  "submit": "NOTIFY ME",
  "disclaimer": "You can unsubscribe at any time."
}
```

| Key | Default |
|---|---|
| `title` | `"{product}"` (the product name) |
| `intro` | "Register to receive a notification as soon as this item is back in stock" / "Register your interest to hear more about this item" |
| `sizeLabel` / `sizePlaceholder` | `"Size"` / `"Select a size"` |
| `emailLabel` | `"Email"`. `false` hides the label; the input keeps an accessible name |
| `emailPlaceholder` | `"you@example.com"` |
| `emailOptIn` | `"Email me store updates"` (shown when `fields` includes `email`) |
| `smsOptIn` | `"Text me store updates"` (shown when `fields` includes `mobile`) |
| `submit` | `"Notify Me"` / `"Register Interest"` |
| `success` | `"You're on the list. We'll be in touch."` |
| `disclaimer` | none. When set, it is shown under the submit button |

`{product}` in `title` or `intro` becomes the product name. Not yet configurable: the status messages ("Sending…", "Please select a size.", errors), the close button label, and the mobile, name, country and province field labels.

---

## Styling

All widget styles are scoped under `#twc-nm-overlay`, and the widget uses the page's font. There are two ways to match a theme. They can be combined.

### CSS variables

Set any of these on `:root` (or any ancestor, inside media queries if needed). Anything you don't set keeps the default look.

| Variable | Default |
|---|---|
| `--twc-nm-panel-width` | `420px` |
| `--twc-nm-panel-width-mobile` | `100%` (at ≤480px) |
| `--twc-nm-padding` | `24px` |
| `--twc-nm-overlay-bg` | `rgba(17, 17, 17, 0.55)` |
| `--twc-nm-panel-shadow` | `-10px 0 40px rgba(0, 0, 0, 0.18)` |
| `--twc-nm-transition` | `200ms ease` |
| `--twc-nm-bg` / `--twc-nm-text` / `--twc-nm-muted` / `--twc-nm-border` | `#fff` / `#111827` / `#6b7280` / `#e5e7eb` |
| `--twc-nm-font` | `inherit` |
| `--twc-nm-radius` | `8px` |
| `--twc-nm-header-border` | `none` |

```css
:root { --twc-nm-panel-width: 400px; --twc-nm-radius: 0; --twc-nm-overlay-bg: rgba(54, 54, 54, 0.5); }
```

### Theme classes

`classes` adds your theme's own classes to the widget's elements, so buttons, inputs and headings look exactly like the rest of the store:

```json
"classes": {
  "title": "Heading u-h4",
  "input": "Form__Input",
  "select": "Form__Input",
  "submit": "Button Button--primary Button--full"
}
```

**Keys:**
- Form elements: `title`, `intro`, `label`, `input`, `select`, `checkbox`, `submit`, `close`, `disclaimer`.
- Product summary: `summary`, `summaryImage`, `summaryName`, `summaryVariant`, `summaryPrice`, `summaryCompareAt`.
- `label`, `input` and `select` apply to every element of that kind.

**How styling is split:**
- An element with classes drops the widget's own colours, fonts, borders, padding and hover styles, so the theme's apply cleanly.
- Layout (width, positioning, text truncation) always stays the widget's.
- A themed select keeps the widget's dropdown arrow, so give it about 36px of right padding.
- Class names may only contain letters, digits, `-` and `_`. Anything else is dropped, with a warning in the console.

**Header row.** When the JSON block is present, the title and close button sit in a `.twc-nm-header` row you can style. This is also what `--twc-nm-header-border` applies to. Without a JSON block, the markup is exactly as in earlier versions.

**Overriding widget rules.** The widget injects its stylesheet when it loads, after your theme's CSS. A theme rule must therefore be more specific than the widget's to win, e.g. `#twc-nm-overlay .twc-nm-card .twc-nm-title`.

---

## Authentication

Every request carries `Authorization: Bearer <token>` and `X-Twc-Tenant: <tenant>`. The bundle ships no credential.

- **`"proxy"` (default):** on submit, the widget fetches a tenant-scoped token from the store's Shopify App Proxy at `/apps/<proxyApp>/auth/token` and reuses it for the page session. If the proxy returns no token, the widget shows "Please log in to your account to continue." and keeps the form open.
- **`"token"`:** the widget sends the token you supply in `accessToken` / `data-access-token` or `window.TWC_ACCESS_TOKEN`. Anything rendered into the page is public, so only use a short-lived token scoped to customer-interest writes for one tenant. Never use a staff or POS credential. If you can't mint one that narrow, use `"proxy"`.

---

## Recommendations

A "Shop similar styles" row can appear under the form. It shows only when **all** of these hold:

- `recommendations` is not `false`.
- The tenant's config defines an engine (`websiteRecommendations`, see below).
- A shopper email is known. It comes from the first of these that is set:
  - `customerEmail`.
  - `window.customer.email`.
  - `window.customerEmail`.
  - The email just submitted. In this case the row appears after submit, and the widget stays open instead of auto-closing.

A known email also pre-fills the form's email field. Shopify doesn't expose the customer's email by default; add it in the theme:

```liquid
<script>{% if customer %}window.customer = { email: {{ customer.email | json }} };{% endif %}</script>
```

The row never blocks or changes the notify-me submission. If anything fails, it simply doesn't appear.

<details>
<summary>Engine selection and internals</summary>

- **Engine:** read once per page from `GET /services/eventcollector/api/v1/custom/configs/public` (authenticated like every other call) → `websiteRecommendations`:
  - `{ "engine": "TWC" }`: TWC's recommendations API, `/services/recommendations/api/v1/recommendations/<tenant>/<email>`.
  - `{ "engine": "ATHOS", "siteIdentifier": "abc123" }`: Searchspring, `https://abc123.a.searchspring.io/boost/abc123/recommend`, called with **no** TWC credentials.
  - When the field is missing, the engine is unknown, or ATHOS has no `siteIdentifier`, no row is shown. A failed config request is retried on the next open.
- **Searchspring profile tag:** `profileTag`, then `tags` from the tenant config, then `recommendationsProfile`, then `"similar"`. The tag must exist on the Searchspring site; an unknown tag returns no results. Check with:
  `curl -s "https://{site}.a.searchspring.io/boost/{site}/recommend?tags={tag}&limits=3&products={productId}"`
- **TWC results** come per variant, so the widget over-fetches (up to the API's limit of `n=20`) and dedupes by product.
- **Prices** use `window.Shopify.currency.active`, then `currency`; with neither they render as bare numbers.

</details>

---

## What gets sent

`POST https://api.au-aws.thewishlist.io/services/wsservice/api/wishlist/items/customerInterest`

| Field | When |
|---|---|
| `variantRef` | Always: the size selected in the widget |
| `email` | Always (empty if the form has no email field) |
| `subscribe`, `subscribeSms` | Always: the opt-in checkboxes (`false` when not shown) |
| `notifyMe: true` or `comingSoon: true` | Depending on `type` |
| `mobile`, `firstName`, `lastName` | When those fields are in the form |
| `countryCode`, `provinceCode` | From the form if shown, otherwise detected |
| `marketId`, `marketHandle` | When known. `marketId` is always the bare number, never a `gid://` |

Marketing opt-ins are separate from the notify-me registration: shoppers can register without subscribing.

---

## Development

TypeScript in `src/`, bundled by Rollup into `build/notify-me-wl.min.js`. The bundle is committed and is what jsDelivr serves from npm.

```bash
npm install
npm run build      # build/notify-me-wl.min.js
npm run dev        # rebuild on change
npm run typecheck
npm run selftest   # build, then run harness/*.html cases in headless Chrome
npm run visual     # build, then pixel-compare default rendering against main
```

- **`selftest`** runs each page listed in `harness/run-selftest.sh`. Each page defines `window.SELFTEST_CASES`, and `harness/selftest.js` stubs every network call. Add a page to the list when you add one.
- **`visual`** screenshots the open widget (modal and panel, desktop and mobile, with and without hostile host CSS) using `main`'s bundle and yours, and fails on any pixel difference. It protects every existing install from unintended visual change. Use `BASELINE_REF=<ref>` to compare against another ref.
- Both scripts need Chrome. Set `CHROME=/path/to/chrome` off macOS.
- `index.html` is a manual demo page. Add `?mockSubmit=1` to log the payload instead of sending it.

---

## Upgrading

- **3.6.2:** on touch devices, opening the widget focuses the dialog rather than the size select, which iOS Safari otherwise would not open on the first tap. Desktop is unchanged.
- **3.6.0:** adds the JSON config block, `copy`, `productSummary`, CSS variables and `classes`. Existing installs need no changes: without the new settings the widget renders and behaves as 3.5.
- **3.0.0:** the default auth moved from `"token"` to `"proxy"`, and the bundled access token was removed. Set up the App Proxy or supply your own token.
- **2.0.0:** the bundle moved from `index.js` to `build/notify-me-wl.min.js`.
- **Legacy `#popup-open` button:** older installs put their attributes on a `<button id="popup-open">`. This still works, and its attributes win over everything else. New installs should use `data-twc-notify-me` triggers instead.
