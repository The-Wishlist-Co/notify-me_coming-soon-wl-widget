### Coming Soon/Notify Me Widget

This JavaScript widget allows users to register their interest in a product that is either "coming soon" or "out of stock" (aka "notify me"). Depending on the `data-type` attribute provided, the widget will display appropriate messages and functionality.

#### Features:
- Clean, centered modal that inherits the host store's font and stays out of the theme's way (all styles are namespaced under `#twc-nm-overlay`).
- Dynamically display a labeled form to collect user information (email, mobile, first/last name, country, province).
- Adjust form copy and button text based on the widget type (`notify-me` or `coming-soon`).
- Inline success/error feedback (no browser `alert`s); the submit button shows a "Sending…" loading state.
- Closes on the × button, clicking the backdrop, or pressing `Esc`; locks background scroll while open and respects `prefers-reduced-motion`.
- Optional email/SMS marketing opt-ins.
- Two auth modes: bundled server token (default) or Shopify App Proxy — see [Configuration](#configuration).

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
- `data-auth`: Auth mode. `"token"` (default) uses the bundled server-issued access token. `"proxy"` uses the Shopify App Proxy at `/apps/<proxy-app>/auth/token` to obtain a tenant-scoped token (requires the customer to be logged in to the storefront).
- `data-tenant`: The TWC tenant sent as the `X-Twc-Tenant` header. Used in both auth modes. Falls back to the bundled `TENANT_ID` if omitted.
- `data-proxy-app`: The Shopify App Proxy subpath, forming the `/apps/<proxy-app>/...` URL prefix used by the `"proxy"` auth mode. Falls back to the bundled `PROXY_APP_NAME` (`twc-sdk`) if omitted.

### Proxy auth mode

When `data-auth="proxy"` is set, the widget does not use the bundled access token. Instead, on form submit it lazily fetches a tenant-scoped access token from the same-origin Shopify App Proxy endpoint `/apps/<proxy-app>/auth/token` (where `<proxy-app>` comes from `data-proxy-app`, defaulting to `twc-sdk`; Shopify signs and forwards the request). The token is cached for the page session and reused across submissions.

Because the proxy only issues a token for a logged-in customer, if the token cannot be obtained the popup stays open and shows an inline "Please log in to your account to continue." message; submission is blocked until a token is available.

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

Replace `ACCESS_TOKEN` with your actual access token to authenticate API requests.
Replace `TENANT_ID` with your actual tenant to authenticate API requests.
