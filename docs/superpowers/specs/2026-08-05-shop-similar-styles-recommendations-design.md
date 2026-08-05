# Shop similar styles — product recommendations in the widget

**Date:** 2026-08-05
**Status:** Approved

## Goal

Show a "Shop similar styles" section beneath the form in the Notify Me / Coming Soon
modal, populated from the TWC recommendations service. The section gives a shopper
somewhere to go after registering interest in an out-of-stock or unreleased product.

## Scope

In scope:

- A new API client for the recommendations endpoint.
- Resolving the customer email the endpoint requires.
- Rendering a horizontally scrolling product row inside the existing modal card.
- Extracting the shared auth-token resolution the new client needs.

Out of scope:

- Click/impression analytics on the recommended products.
- Any change to how customer interest is submitted.
- Recommendations anywhere other than inside this modal.

## Customer email resolution

The endpoint takes the customer email as a path segment, so nothing renders without
one. The email is resolved in this order; the first non-empty value wins:

| Order | Source                                     | Purpose                          |
| ----- | ------------------------------------------ | -------------------------------- |
| 1     | `data-customer-email` on the open button   | Test / QA override               |
| 2     | `window.customer.email`                    | Logged-in Shopify PDP customer   |
| 3     | The email submitted through the form       | Guest fallback, after submit     |

Sources 1 and 2 are resolved when the widget initialises, so the section is already
present when a logged-in customer opens the modal. Source 3 only applies after a
successful submit and only when `email` is one of the configured `data-fields`.

If no email can be resolved the section is never created — no placeholder, no error.

**Integration note:** `window.customer` is not provided by Shopify by default. The
merchant's theme must expose it, e.g. `window.customer = {{ customer | json }}` in a
Liquid template. This must be documented in the README alongside `window.currentProduct`,
which has the same requirement. `data-customer-email` covers testing without it.

## API client

New file `src/api/recommendations.ts`.

```
GET https://api.au-aws.thewishlist.io/services/recommendations/api/v1/recommendations/{tenant}/{customerEmail}?n={fetchCount}
Authorization: <bearer token>
X-Twc-Tenant: <tenant>
```

- `tenant` is the value already resolved by `src/index.ts` (`data-tenant`, falling back
  to the bundled `TENANT_ID`). It fills both the path segment and the `X-Twc-Tenant`
  header — the service's `retailerId` and the widget's tenant are the same value.
- `customerEmail` is URL-encoded into the path.
- The base URL is added to `src/config.ts` as `RECOMMENDATIONS_URL_BASE`, alongside the
  existing `CUSTOMER_INTEREST_URL`.

### Token resolution

`src/api/customer-interest.ts` currently inlines the choice between the bundled
`ACCESS_TOKEN` and a Shopify App Proxy token. With a second consumer, that logic moves
to `src/auth/resolve-token.ts`:

```ts
// Returns the Authorization header value for the configured auth mode,
// or null when a proxy token could not be obtained (customer not logged in).
export async function resolveAuthToken(
  authMode: AuthMode,
  proxyApp: string,
): Promise<string | null>;
```

`customer-interest.ts` is refactored to call it — its existing `{ ok: false, reason: 'auth' }`
behaviour is preserved by mapping a `null` return to that result. The recommendations
client maps `null` to an empty result instead, since it has no error surface.

### Response handling

The response shape is `{ recommendations: [{ product, score, ... }] }`. The client
normalises each entry to the flat `RecommendedProduct` type declared in `src/types.ts`
and discards the rest:

```ts
export interface RecommendedProduct {
  id: string;          // product.product_id
  ref: string;         // product.product_ref
  name: string;        // product.name
  imageUrl: string;    // product.image_url
  productUrl: string;  // product.product_url
  price: number;       // product.price
  originalPrice: number | null; // product.original_price
}
```

Post-processing, in order:

1. Drop entries with no `image_url`, no `product_url`, or no `name`.
2. Dedupe by `product_ref`, keeping the highest-scoring entry. The service returns one
   entry per variant, so a single product appears several times as different colourways;
   without this, four slots can show two products.
3. Slice to the configured display count.

Because deduping discards entries, the request over-fetches: `n = displayCount * 3`.

Every failure mode resolves to `[]` — network error, non-OK status, unparseable body,
missing `recommendations` array, or an unavailable auth token. Errors are logged to the
console, matching `customer-interest.ts`, and never shown to the shopper.

Results are cached in the module for the page session, keyed by email, so opening and
closing the modal does not refetch.

## Rendering

New file `src/ui/recommendations.ts`, exporting a function that builds the section
element from a `RecommendedProduct[]` and returns it (or `null` for an empty list).
The widget owns insertion; the renderer owns markup.

Structure:

```html
<section class="twc-nm-recs" aria-labelledby="twc-nm-recs-title">
  <h3 id="twc-nm-recs-title" class="twc-nm-recs-title">Shop similar styles</h3>
  <div class="twc-nm-recs-row">
    <a class="twc-nm-rec" href="{productUrl}" target="_blank" rel="noopener noreferrer">
      <img class="twc-nm-rec-img" src="{imageUrl}" alt="{name}" loading="lazy" decoding="async" />
      <span class="twc-nm-rec-name">{name}</span>
      <span class="twc-nm-rec-price">…</span>
    </a>
    <!-- … -->
  </div>
</section>
```

Behaviour and styling:

- Placed after the form inside `.twc-nm-card`, separated by a hairline top border.
- The row is a horizontally scrolling flex container (`overflow-x: auto`) with
  `scroll-snap-type: x mandatory` and cards at a fixed width (~132px), so the next card
  is partly visible as a scroll affordance. `-webkit-overflow-scrolling: touch`.
- Cards are `<a>` elements, so they are keyboard focusable and scroll into view on focus.
  `target="_blank"` keeps the modal and any unsubmitted form state intact.
- Images sit in a fixed-aspect-ratio box (`aspect-ratio: 3 / 4`, `object-fit: cover`) so
  the row height is stable before images load.
- Product names are clamped to two lines.
- Price is formatted with `Intl.NumberFormat` using `window.Shopify.currency.active` when
  available. Without it, the number is formatted plainly with no currency symbol rather
  than guessing one. `originalPrice` renders struck through before the price when it is
  greater than `price`.
- All rules are namespaced under `#twc-nm-overlay` in `src/ui/styles.ts`, consistent with
  the rest of the widget.
- All user-derived strings are inserted as text nodes / attribute assignments via DOM
  APIs, not string-interpolated HTML, since the values come from the API.

## Configuration

New attributes on the existing `#popup-open` button:

| Attribute                     | Default  | Meaning                                       |
| ----------------------------- | -------- | --------------------------------------------- |
| `data-recommendations`        | `"true"` | Set `"false"` to disable the section entirely |
| `data-recommendations-count`  | `4`      | Number of products displayed                  |
| `data-customer-email`         | —        | Override the resolved customer email          |

`data-recommendations-count` is parsed with `parseInt`; a non-numeric or non-positive
value falls back to `4`. These are parsed in `src/index.ts` alongside the existing
attributes and carried on `WidgetConfig`.

## Widget wiring

Changes to `src/ui/widget.ts`:

1. On `showPopup`, if recommendations are enabled and an email was resolved at init,
   fetch and render the section. The modal opens immediately and the section appears
   when the fetch resolves; nothing awaits it. On reopen this runs again but the module
   cache serves the result, so no second request is made.
2. On successful submit, if no section is showing yet and recommendations are enabled,
   fetch using the submitted email and render.
3. The 1.5s auto-close on success becomes conditional: if the post-submit fetch returns
   products, the auto-close is cancelled and the shopper closes the modal themselves via
   ×, backdrop, or Esc. With no products, the current 1.5s auto-close is unchanged.
4. `closePopup` removes the rendered section so a reopen does not stack duplicates; the
   cached API result means no refetch.

Because step 3 must decide before the timer fires, the success path awaits the fetch
before scheduling the auto-close. The success status message is shown first, so the
shopper sees confirmation immediately regardless of how long the fetch takes.

## Types

Added to `src/types.ts`:

- `RecommendedProduct` (above).
- `WidgetConfig` gains `recommendationsEnabled: boolean`, `recommendationsCount: number`,
  and `customerEmail: string | null`.

`src/global.d.ts` gains `email?: string` on `Window['customer']` and
`currency?: { active?: string }` on `Window['Shopify']`.

## Error handling summary

| Condition                        | Behaviour                                  |
| -------------------------------- | ------------------------------------------ |
| No customer email resolvable     | Section never renders                      |
| `data-recommendations="false"`   | Section never renders, no request made     |
| Proxy token unavailable          | Empty result, section never renders        |
| Request fails or returns non-OK  | Empty result, logged to console            |
| Zero products after filtering    | Section never renders                      |
| An image fails to load           | Browser default; card keeps its layout box |

No failure blocks or alters the customer-interest submission.

## Testing

The repo has no test harness (`npm test` is a stub) and adding one is out of scope.
Verification is manual against `index.html`, extended with a mock `window.customer` and
the new data attributes, plus `npm run typecheck` and `npm run build`.

Manual cases to cover:

1. Logged-in customer — section present when the modal opens.
2. Guest with `email` in `data-fields` — section appears after submit, modal stays open.
3. Guest, submit returns no recommendations — modal auto-closes after 1.5s as before.
4. `data-recommendations="false"` — no section, no network request.
5. Bad email / API 4xx — no section, submission still succeeds.
6. Duplicate `product_ref` entries in the response — each product appears once.
7. Reopen after close — section reappears without a second network request.

## Documentation

README updates: the three new attributes in Configuration, the `window.customer`
requirement, and a "Shop similar styles" bullet in Features.
