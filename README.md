### Coming Soon/Notify Me Widget

This JavaScript widget allows users to register their interest in a product that is either "coming soon" or "out of stock" (aka "notify me"). Depending on the `data-type` attribute provided, the widget will display appropriate messages and functionality.

### Official docs

The full implementation guide lives in the TWC documentation site — start here:

- [Notify Me & Coming Soon — Overview](https://the-wishlist-documentation.gitbook.io/the-wishlist-documentation-docs/notify-me-and-coming-soon/overview)

This README covers installation and the widget's configuration attributes; the docs
site is the primary reference for integration, the Customer Interest API, and
related guides.

#### Features:
- Clean, centered modal that inherits the host store's font and stays out of the theme's way (all styles are namespaced under `#twc-nm-overlay`).
- Dynamically display a labeled form to collect user information (email, mobile, first/last name, country, province).
- Adjust form copy and button text based on the widget type (`notify-me` or `coming-soon`).
- Inline success/error feedback (no browser `alert`s); the submit button shows a "Sending…" loading state.
- Closes on the × button, clicking the backdrop, or pressing `Esc`; locks background scroll while open and respects `prefers-reduced-motion`.
- Optional email/SMS marketing opt-ins.
- Two display modes: a centred modal (default) or a right-hand slide-in panel — see [Display modes](#display-modes).
- Two auth modes: Shopify App Proxy (default) or a merchant-supplied token — see [Configuration](#configuration).
- Optional "Shop similar styles" section under the form, showing personalised product recommendations for the customer.

### Installation

Add the following script to your HTML to include the widget:

```html
<script src="https://cdn.jsdelivr.net/npm/notify-me-wl/build/notify-me-wl.min.js"></script>
```

### Development / Build

Source lives in `src/` (TypeScript) and is bundled with Rollup into `build/`.

```bash
npm install       # install dev dependencies
npm run build     # emit build/notify-me-wl.min.js
npm run dev       # rebuild on change (watch mode)
npm run typecheck # type-check without emitting
```

> **v2.0.0 path change:** the distributed bundle moved from `index.js` to
> `build/notify-me-wl.min.js`. Update embeds to the new CDN URL above.

### Usage

Add a button to your HTML where you want the widget to appear. The button should have an `id` of `popup-open`, a `data-fields` attribute with the fields you want to include in the form (as a JSON string), and a `data-type` attribute to specify the widget type (`notify-me` or `coming-soon`).

```html
<div id="notification-widget"></div>
<button id="popup-open" data-fields='["mobile", "firstName", "lastName"]' data-type="notify-me">Open Popup</button>
```

### Configuration

- `data-fields`: A JSON array specifying the optional fields to include in the form. Possible values are `"email"`, `"mobile"`, `"firstName"`, `"lastName"`, `"countryCode"`, and `"provinceCode"`. Defaults to `["email"]`. (A required Size selector is always shown and populated from the product's variants.)
- `data-type`: Specifies the type of the widget. Possible values are `"notify-me"` and `"coming-soon"`.
- `data-display`: How the widget presents itself. `"modal"` (default) is a centred dialog; `"panel"` slides in from the right edge at full height. Any other value falls back to `"modal"`. See [Display modes](#display-modes).
- `data-auth`: Auth mode. `"proxy"` (default) uses the Shopify App Proxy at `/apps/<proxy-app>/auth/token` to obtain a tenant-scoped token (requires the customer to be logged in to the storefront). `"token"` sends a token you supply via `data-access-token` or `window.TWC_ACCESS_TOKEN`. **The widget bundles no credential of its own** — see [Auth modes](#auth-modes).
- `data-tenant`: The TWC tenant sent as the `X-Twc-Tenant` header. Used in both auth modes. Falls back to the bundled `TENANT_ID` if omitted.
- `data-proxy-app`: The Shopify App Proxy subpath, forming the `/apps/<proxy-app>/...` URL prefix used by the `"proxy"` auth mode. Falls back to the bundled `PROXY_APP_NAME` (`twc-sdk`) if omitted.
- `data-access-token`: Access token for the `"token"` auth mode, with or without the `Bearer ` prefix. Takes precedence over `window.TWC_ACCESS_TOKEN`. Ignored in `"proxy"` mode. Anything rendered here is visible to anyone viewing the page — use a short-lived, narrowly scoped token, never a staff or POS credential.
- `data-market-id`: The Shopify market the shopper is browsing in. Accepts either the numeric id or the full GID — `gid://shopify/Market/12345` and `12345` both send `12345`. Falls back to `window.Shopify.markets.currentMarket.id` when omitted. See [Shopify markets](#shopify-markets).
- `data-market-handle`: The market handle (e.g. `"au"`). Attribute only — there is no runtime fallback, so a theme that does not render it reports no handle.
- `data-country-code`: Two-letter ISO country code for the market the shopper is browsing in. Takes priority over the automatic detection chain, but a country the shopper picks in the form still wins over both.
- `data-recommendations`: Set to `"false"` to disable the "Shop similar styles" section. Enabled by default.
- `data-recommendations-count`: How many products to show. Defaults to `8`. Non-numeric or non-positive values fall back to `8`.
- `data-currency`: Fallback ISO currency code (e.g. `"AUD"`) for formatting recommendation prices, used only when the storefront does not expose `window.Shopify.currency.active`. Without either, prices render as bare numbers rather than risking the wrong symbol.
- `data-customer-email`: Overrides the customer email used to request recommendations. Intended for testing — in production the email comes from the Shopify customer context, or from the email the shopper submits.

### Auth modes

Every TWC API call needs an `Authorization` header and an `X-Twc-Tenant` header.
`data-auth` chooses where the token comes from. **The distributed bundle contains no
access token** — a `"token"` install that supplies none will fail to submit.

#### `"proxy"` (default)

The widget lazily fetches a tenant-scoped token from the same-origin Shopify App Proxy
endpoint `/apps/<proxy-app>/auth/token` on form submit (where `<proxy-app>` comes from
`data-proxy-app`, defaulting to `twc-sdk`; Shopify signs and forwards the request). The
token is cached for the page session and reused across submissions.

Because the proxy only issues a token for a logged-in customer, if the token cannot be
obtained the popup stays open and shows an inline "Please log in to your account to
continue." message; submission is blocked until a token is available.

#### `"token"`

Sends a token you supply, from `data-access-token` on the open button or
`window.TWC_ACCESS_TOKEN`. The attribute wins if both are present, and the `Bearer `
prefix is added if you omit it.

```html
<button id="popup-open" data-type="notify-me" data-auth="token"
        data-access-token="{{ twc_widget_token }}">Notify Me</button>
```

Anything you render here ships to the browser and is readable by anyone who views the
page or the bundle. Mint a short-lived token scoped to customer-interest writes for the
single tenant — never a staff, POS, or store-owner credential. If you cannot mint one
that narrow, use `"proxy"` instead.

When `"token"` mode has no token, the widget logs a setup error to the console and the
submission fails with the generic error message.

> **Breaking change in 3.0.0:** the default `data-auth` moved from `"token"` to
> `"proxy"`, and the previously bundled access token was removed. Installs that relied
> on the bundled token must either set up the App Proxy or supply their own token via
> `data-access-token`.

### Display modes

`data-display` selects the widget's geometry. Both modes are blocking and behave
identically otherwise — same dimmed backdrop, same locked page scroll, and the same
close paths (× button, backdrop click, `Esc`).

| | `"modal"` (default) | `"panel"` |
| --- | --- | --- |
| Position | Centred | Docked to the right edge |
| Size | 400px wide, fits the viewport | 420px wide, full height |
| Corners | Rounded | Square |
| Entry | Fades and lifts | Slides in from the right |
| Below 480px | Unchanged | Spans the full viewport width |

```html
<button id="popup-open" data-type="notify-me" data-display="panel"
        data-fields='["email"]'>Notify Me</button>
```

Panel mode is a CSS-only variation — it adds a `twc-nm--panel` class to the overlay and
changes nothing about the widget's behaviour, so anything documented elsewhere in this
README applies to both modes. Under `prefers-reduced-motion` the panel appears without
sliding.

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

#### Choosing an engine

Which engine powers the section is a per-tenant server-side setting, not a data
attribute. On first open the widget fetches the tenant config from:

```
GET /services/eventcollector/api/v1/custom/configs/public
```

with the same `Authorization` and `X-Twc-Tenant` headers as every other call — despite
the path, this endpoint is not anonymous — and reads `websiteRecommendations`:

```json
"websiteRecommendations": { "engine": "TWC" }
```

```json
"websiteRecommendations": { "engine": "ATHOS", "siteIdentifier": "abc123" }
```

**If `websiteRecommendations` is absent, the section does not render at all** — no engine
request is made and no placeholders appear. The older top-level `recommendationsEngine`
field is ignored. The section is likewise skipped when the engine is unrecognised, or
when `ATHOS` has no `siteIdentifier`. The config is fetched once per page session, and a
failed config request is not cached, so a transient outage does not disable the section
for the rest of the visit.

For `ATHOS`, `siteIdentifier` is the Searchspring site ID and is used in both the
subdomain and the path:

```
https://{siteIdentifier}.a.searchspring.io/boost/{siteIdentifier}/recommend
```

The recommendation profile comes from `profileTag` (or `tags`) on
`websiteRecommendations`, defaulting to `similar`. Searchspring is called with **no** TWC
credentials — it is a third-party host and must never receive a tenant-scoped token.

#### Deduping and result counts

The TWC service returns one entry per product variant, so several entries can describe
the same product in different colourways. The widget requests three times the display
count and dedupes by `product_ref`, keeping the highest-scoring entry, so a row never
repeats a product. **That API rejects `n` above 20 with a 422**, so the over-fetch is
clamped to 20 — at the default count of 8 that means `n=20`. Athos returns products
rather than variants, so it is asked for exactly `limits={count}` with no over-fetch.

Placeholder cards are shown while the request is in flight, so the section reserves its
space instead of the modal jumping when the products land. If the request returns
nothing usable, the placeholders are removed and the section disappears.

Prices use `window.Shopify.currency.active` when the storefront exposes it, falling back
to `data-currency`. With neither, prices render as bare numbers — showing `A$` on a GBP
price would be worse than showing no symbol at all.

If no email can be resolved, or the request fails or returns nothing, the section is
simply not rendered. It never blocks or alters the notify-me submission.

### Example

```html
<div id="notification-widget"></div>
<button id="popup-open" data-fields='["mobile"]' data-type="notify-me">Open Popup</button>

<script>
  // The script provided will be included here
</script>
```

### How It Works

1. **Initialization**: The script listens for the `DOMContentLoaded` event to initialize the widget.
2. **Styles Injection**: It injects the modal/form styles, all namespaced under `#twc-nm-overlay` so they don't collide with the host theme.
3. **Modal Creation**: Creates the modal structure and appends it to the `notification-widget` div.
4. **Dynamic Content**: Based on the `data-type`, it sets the appropriate copy and button text, and builds the fields listed in `data-fields` plus the always-present Size selector.
5. **Form Submission**: On submit, the button enters a "Sending…" state, the configured auth token is resolved, and the form data is POSTed to the API. The result is shown inline (success message then auto-close, or an error message); the popup is never closed on failure.

### API Request Example

``` 
https://api.au-aws.thewishlist.io/services/wsservice/api/wishlist/items/customerInterest
```

Authenticate with an `Authorization: Bearer <token>` header and an
`X-Twc-Tenant: <tenant>` header. The widget resolves the token per
[Auth modes](#auth-modes) and the tenant from `data-tenant`; there is no
`ACCESS_TOKEN` constant in the bundle to replace.
