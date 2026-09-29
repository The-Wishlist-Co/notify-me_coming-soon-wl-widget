# Opening the widget from product listing pages, with size pre-selection

**Date:** 2026-09-29
**Status:** Approved

## Goal

Let a theme open the Notify Me / Coming Soon widget from anywhere on a page, for any
product on it, with the right size already selected. Driven by stfrock-au:

1. **PLP:** clicking an out-of-stock size on a product card opens the widget for that
   product with that size pre-selected.
2. **PLP and PDP:** clicking a "Size out of stock?" link opens the widget for that
   product.
3. **PDP:** the size currently selected in the theme's variant picker is pre-selected.
4. **Everywhere:** when exactly one size is out of stock, it is pre-selected.

The widget is shared across merchants, so the mechanism is generic — the theme opts in
with `data-*` attributes and no theme JavaScript. Existing installs (a single
`#popup-open` button plus `window.currentProduct`) keep working unchanged.

## Scope

In scope:

- Reading store-wide configuration from `#notification-widget` when there is no
  `#popup-open` button.
- Delegated click handling for `[data-twc-notify-me]` triggers.
- Resolving the product per open, from the trigger's card or `window.currentProduct`.
- Filtering sizes by `available`, rebuilding the size select on every open, keyed on
  variant id.
- The pre-selection rules below.
- README documentation of the new contract, including Liquid snippets; harness
  scenarios in `index.html`.

Out of scope:

- A public JavaScript API (`window.TWCNotifyMe.open`). The internal open function is
  shaped so it can be exposed later, but it is not exposed now.
- Knowledge of any specific theme's markup (`product-block`, `.product-block-options__item`
  and so on). The theme adds attributes; the widget never queries theme classes.
- Suppressing the theme's own click behaviour on a size button.
- Opening the widget from an in-stock size, or pre-selecting an in-stock size.
- Any change to the submit payload, auth, or recommendations engines.
- An automated test runner.

## Configuration source

Store-wide attributes (`data-tenant`, `data-auth`, `data-proxy-app`,
`data-access-token`, `data-fields`, `data-type`, `data-display`,
`data-recommendations*`, `data-currency`, `data-customer-email`, `data-market-*`,
`data-country-code`) are read per attribute from:

1. `#popup-open`, when present and it carries the attribute;
2. otherwise `#notification-widget`.

`#notification-widget` becomes the only element required for the widget to initialise.
A PLP renders it once, with the configuration on it:

```liquid
<div id="notification-widget"
     data-tenant="stfrock-au"
     data-auth="proxy"
     data-fields='["email"]'
     data-type="notify-me"
     data-currency="{{ cart.currency.iso_code }}"
     data-market-id="{{ localization.market.id }}"
     data-market-handle="{{ localization.market.handle }}"
     data-country-code="{{ localization.country.iso_code }}"
     data-recommendations-profile="similar-snap"></div>
```

## Theme contract

| Attribute | Where | Meaning |
|---|---|---|
| `data-twc-product` | A product container (e.g. `<product-block>`) | JSON `{ id, title, variants: [{ id, title, available }] }` |
| `data-twc-notify-me` | Any clickable element | Clicking it opens the widget |
| `data-variant-id` | Optional, on the same element | Variant to pre-select |

`data-twc-product` is built from a compact Liquid capture, not `product | json`, which
is too heavy to repeat on every card. The capture is HTML-escaped into a double-quoted
attribute so titles containing quotes or apostrophes cannot break the markup:

```liquid
{%- capture twc_product -%}
  {"id":{{ product.id | json }},"title":{{ product.title | json }},"variants":[
  {%- for v in product.variants -%}
    {"id":{{ v.id | json }},"title":{{ v.title | json }},"available":{{ v.available | json }}}
    {%- unless forloop.last -%},{%- endunless -%}
  {%- endfor -%}]}
{%- endcapture -%}
<product-block data-twc-product="{{ twc_product | escape }}" …>
```

On stfrock the size buttons already carry `data-variant-id`, so an out-of-stock button
only needs `data-twc-notify-me` added:

```liquid
<button type="button" class="product-block-options__item"
        data-variant-id="{{ variant.id }}"
        data-variant-available="{{ variant.available }}"
        {% unless variant.available %}data-twc-notify-me{% endunless %}>…</button>
```

The "Size out of stock?" link is `<a href="#" data-twc-notify-me>` inside the card on
the PLP, and anywhere on the PDP.

## Opening flow

A single delegated `click` listener on `document` handles
`event.target.closest('[data-twc-notify-me]')`. The legacy `#popup-open` button calls
the same open path. On open:

1. **Product.** The trigger's closest `[data-twc-product]` ancestor (inclusive), parsed
   as JSON. If there is no such ancestor, `window.currentProduct`. The source is
   remembered as `card` or `page` for rule 2 below.
2. **Sizes.** Variants with `available === false`. A variant with no `available` field
   is kept, because existing PDP installs already filter `window.currentProduct` to
   unavailable variants in Liquid. The size select is emptied and rebuilt on every
   open. Option values are variant ids, not titles.
3. **Pre-selection**, first match wins, each candidate used only if it is one of the
   listed (out-of-stock) sizes:
   1. `data-variant-id` on the trigger.
   2. Page source only: `?variant=` in the URL, then the value of the first
      `form[action*="/cart/add"] select[name="id"]`. Read at open time so it reflects
      the shopper's latest choice. A hidden `input[name="id"]` is deliberately not
      used: stfrock's PDP has an installments form whose hidden input does not follow
      the variant picker. Themes that keep the trigger's `data-variant-id` in sync
      with the picker (stfrock's `dynamic-variant-id`) are covered by rule 1. Never
      applied to a card product, so PDP state cannot leak into a PLP card.
   3. Exactly one listed size — that size.
   4. Otherwise the "Select a size" placeholder.
4. **Title and recommendations** use the opened product. `productId` passed to the
   recommendations engine is the opened product's id, so "Shop similar styles" is
   seeded per card.
5. **State.** The status message is cleared and the form is shown on every open.
   Typed fields (email and the rest) are kept between opens.

The widget calls `preventDefault()` on every trigger click, so `href="#"` does not
scroll or navigate and a trigger `<button>` inside a theme form does not submit it. It
never calls `stopPropagation()`; the theme's own handlers still run. The listener runs
in the capture phase, so a theme handler that stops propagation on its size buttons
cannot swallow the click.

Submission reads the selected variant by id from the currently opened product. The
payload is unchanged — `variantRef` is the selected variant id.

## Error handling

Both notices below replace the form entirely, so they render in a notice element
outside the form (the existing `#popup-status` lives inside the form and is hidden with
it — which is why today's "Product information is unavailable" message never shows).

- `data-twc-product` is not valid JSON, or lacks an `id` and `title`: console error
  naming the element, and the existing "Product information is unavailable. Please
  refresh the page." status with the form hidden.
- No product from either source: the same message.
- No out-of-stock sizes: new status "All sizes are currently in stock." with the form
  hidden.
- A pre-selection candidate that is not a listed size: ignored, fall through to the
  next rule.

## Documentation

README:

- New "Opening from product listing pages" section: the theme contract table, the
  Liquid capture, the size-button and link examples, and the stfrock-shaped example.
- New "Size pre-selection" section listing the rules in order.
- Configuration section: note that every attribute may live on `#notification-widget`,
  with `#popup-open` winning when both carry it; `#popup-open` is now optional.
- Usage section: `variants` may include `available`; unfiltered lists are now fine.

## Testing

No test runner is added. A headless self-test harness is:

- `harness/triggers.html` — `#notification-widget` configuration with no `#popup-open`,
  a mock PLP of cards (mixed availability, exactly one out-of-stock size, none, invalid
  JSON), and a mock PDP (`window.currentProduct`, an installments form with a hidden
  `name="id"`, and a product form with `select[name="id"]`).
- `index.html` — the existing legacy `#popup-open` install, as a regression check.
- `harness/selftest.js` — active only with `?selfTest=1`; stubs `fetch`, runs each
  page's cases on load, and writes `SELFTEST PASS n/n` or `SELFTEST FAIL …` to the page.
- `npm run selftest` — runs both pages in headless Chrome and fails on any `FAIL`.

`npm run typecheck` and `npm run build` must pass.

## Release

Minor version bump to 3.5.0. 3.4.0 was published from this branch before the feature
was implemented and carries only the close-icon fix.

Once 3.5.0 is live on stfrock, the theme drops its interim bridge script (which clicks
a hidden `#popup-open`), the hidden button, and the empty `#notification-widget` in the
PDP `buy_buttons` block — a second, empty `#notification-widget` earlier in the DOM
would win `getElementById` and supply no configuration.
