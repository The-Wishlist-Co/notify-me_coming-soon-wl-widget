# JSON config, configurable copy, product summary, and theme styling hooks

**Date:** 2026-10-05
**Status:** Draft — awaiting review

## Goal

Let a merchant make the widget look and read like part of their own theme, without a
per-merchant fork. Driven by babyboofashion-com-au, whose brief asks for the Notify Me
drawer to match their Prestige mini cart (width, position, overlay, typography,
inputs, CTA, close control, product row) and to carry their own copy, a product
summary, and a disclaimer.

Every addition is generic and opt-in. With none of the new configuration present, the
widget renders and behaves exactly as 3.5.x.

## Scope

In scope:

1. A JSON configuration block holding every setting, layered under the existing
   attributes.
2. A `copy` object overriding the widget's text.
3. An opt-in product summary (image, name, size, now/was price) driven by optional
   product data fields.
4. CSS custom properties for the widget's geometry and colours.
5. A `classes` object that attaches theme classes to the widget's elements and hands
   their cosmetic styling to the theme.
6. Self-test coverage, a default-rendering visual check, README documentation, and the
   3.6.0 release.

Out of scope:

- Babyboo's theme files. Their snippet, Liquid data, JSON block and CSS live in their
  theme, not in this repo.
- Copy keys for mobile, first/last name, country and province fields.
- Markup (links) inside copy strings. All copy is plain text.
- Server-side (tenant config) copy or styling.
- A headless mode where the theme supplies the widget's markup.

## 1. Configuration sources

### The JSON block

```html
<div id="notification-widget" data-market-id="{{ localization.market.id }}">
  <script type="application/json" data-twc-config>
    { "tenant": "babyboofashion-com-au", "type": "notify-me", "display": "panel",
      "fields": ["email"], "productSummary": true, "copy": { … }, "classes": { … } }
  </script>
</div>
```

- The widget reads the first `script[type="application/json"][data-twc-config]` inside
  `#notification-widget`, once, at init.
- Invalid JSON, or a top-level value that is not an object, logs
  `notify-me-wl: invalid data-twc-config JSON` and the widget continues as if there were
  no block.
- Liquid themes should build values with the `| json` filter so quotes cannot break the
  block.

### Precedence

Per setting, first present wins:

1. Attribute on `#popup-open`
2. Attribute on `#notification-widget`
3. JSON block
4. Built-in default

`copy`, `classes` and `productSummary` have no attribute form and come only from the JSON
block (or the default).

### Keys

| Attribute | JSON key | JSON type |
|---|---|---|
| `data-type` | `type` | string |
| `data-display` | `display` | string |
| `data-fields` | `fields` | string[] |
| `data-auth` | `auth` | string |
| `data-tenant` | `tenant` | string |
| `data-proxy-app` | `proxyApp` | string |
| `data-access-token` | `accessToken` | string |
| `data-recommendations` | `recommendations` | boolean |
| `data-recommendations-count` | `recommendationsCount` | number |
| `data-recommendations-profile` | `recommendationsProfile` | string |
| `data-currency` | `currency` | string |
| `data-customer-email` | `customerEmail` | string |
| `data-market-id` | `marketId` | string or number |
| `data-market-handle` | `marketHandle` | string |
| `data-country-code` | `countryCode` | string |
| — | `productSummary` | boolean |
| — | `copy` | object |
| — | `classes` | object |

The meaning of each value is unchanged from its attribute; the JSON key only removes the
string encoding. `window.TWC_ACCESS_TOKEN` remains the last fallback for `accessToken`,
below the JSON block.

### Validation

A JSON value of the wrong type is ignored with a `console.warn` naming the key, and that
setting falls through to the next layer. Values of the right type are validated exactly
as their attribute equivalents are today (unknown `display` → modal, non-positive count
→ 8, malformed market id dropped).

### Code shape

- `src/context/config-source.ts` gains a JSON layer: it parses the block and exposes a
  reader that, per setting, returns the attribute value (string) if present, else the
  JSON value, else null — typed per key.
- `index.ts` keeps its per-setting parsing and defaults, now reading through that
  reader. `localization.ts` and `customer-email.ts` read through it as well.
- `WidgetConfig` gains `productSummary: boolean`, `copy: ResolvedCopy` and
  `classes: ResolvedClasses`, with every default filled in, so `widget.ts` never handles
  missing values.

## 2. Copy

All keys optional; values must be strings unless noted. Inserted with `textContent` (or
as an attribute value), never as HTML.

| Key | Default | Notes |
|---|---|---|
| `title` | `"{product}"` | Heading |
| `intro` | type text: "Register to receive a notification as soon as this item is back in stock" / "Register your interest to hear more about this item" | Paragraph under the heading |
| `sizeLabel` | `"Size"` | |
| `sizePlaceholder` | `"Select a size"` | First, disabled option |
| `emailLabel` | `"Email"` | String, or `false` to remove the visible label |
| `emailPlaceholder` | `"you@example.com"` | |
| `emailOptIn` | `"Email me store updates"` | Only rendered with the `email` field |
| `smsOptIn` | `"Text me store updates"` | Only rendered with the `mobile` field |
| `submit` | type text: "Notify Me" / "Register Interest" | |
| `success` | `"You're on the list. We'll be in touch."` | |
| `disclaimer` | none | Rendered only when set |

- **`{product}`**: in `title` and `intro`, every `{product}` is replaced by the opened
  product's title on each open. The default title is `"{product}"`, which reproduces
  today's behaviour (heading = product title).
- **`emailLabel: false`**: no `<label>` is rendered; the input gets
  `aria-label` = the email placeholder, or `"Email"` when the placeholder is empty.
- **Disclaimer**: `<p class="twc-nm-disclaimer">` placed directly after the submit button.
- **Form order**: summary (if enabled) → size → configured fields → opt-ins → status →
  submit → disclaimer.

## 3. Product summary

Enabled with `"productSummary": true`. Off by default; when off, none of the fields
below are read and no summary markup exists.

### Data

Optional fields on the objects the widget already reads (`window.currentProduct`, and
`data-twc-product` on cards):

```ts
interface Product { id; title; variants?; image?: string }
interface Variant { id; title; available?; price?: string; compareAtPrice?: string; image?: string }
```

- `price` and `compareAtPrice` are **pre-formatted strings** from Liquid
  (`money_with_currency`), so the summary always agrees with the theme's own price
  display, currency and market. The widget never formats these.
- The theme supplies `compareAtPrice` only when it is a real discount. The widget shows
  it when present, non-empty, and different from `price`.
- `image` values must be `https:`, `http:` or protocol-relative (`//`) URLs; anything else
  is treated as absent. Set via `img.src`, never via HTML.
- Fields of the wrong type are treated as absent; they never invalidate the product.

### Rendering

```html
<div class="twc-nm-summary">
  <div class="twc-nm-summary-image"><img alt="{product title}"></div>   <!-- omitted when no image -->
  <div class="twc-nm-summary-info">
    <p class="twc-nm-summary-name">…</p>
    <p class="twc-nm-summary-variant">…</p>                               <!-- hidden when no size -->
    <p class="twc-nm-summary-price"><span>{price}</span> <s class="twc-nm-summary-compare">{was}</s></p>
  </div>
</div>
```

Updated on every open and on every `change` of the size select:

- **Size selected**: image = variant image, else product image, else no image box; name =
  product title; variant line = variant title; price = variant price (hidden if absent)
  with compare-at as above.
- **No size selected** (placeholder): image = product image; no variant line; price shown
  only when every listed variant has the same `price` string, else hidden.
- The name is a single line truncated with an ellipsis.
- The submitted `variantRef` is unchanged in source: it is whatever the size select holds
  at submit time, so a size changed in the drawer registers the new variant.

## 4. Styling

### CSS custom properties

Every rule reads `var(--twc-nm-*, <current value>)`. The widget never declares the
variables, so a theme may set them on `:root` or any ancestor, inside its own media
queries. Unset variables reproduce 3.5.x exactly.

| Variable | Default | Applies to |
|---|---|---|
| `--twc-nm-panel-width` | `420px` | Panel width |
| `--twc-nm-panel-width-mobile` | `100%` | Panel width at ≤480px |
| `--twc-nm-padding` | `24px` | Card padding (modal and panel) |
| `--twc-nm-overlay-bg` | `rgba(17, 17, 17, 0.55)` | Backdrop |
| `--twc-nm-panel-shadow` | `-10px 0 40px rgba(0, 0, 0, 0.18)` | Panel shadow |
| `--twc-nm-transition` | `200ms ease` | Backdrop fade and card slide |
| `--twc-nm-bg` | `#fff` | Card background |
| `--twc-nm-text` | `#111827` | Primary text |
| `--twc-nm-muted` | `#6b7280` | Intro, close icon |
| `--twc-nm-border` | `#e5e7eb` | Inputs, recommendations divider |
| `--twc-nm-font` | `inherit` | Card font |
| `--twc-nm-radius` | `8px` | Inputs, submit, status |
| `--twc-nm-header-border` | `none` | Bottom border of the header row |

The modal card's own radius (12px) and shadow, and every recommendations-section colour
not listed, stay as they are.

### Header wrapper

The title and close button move into `<div class="twc-nm-header">`. With no variables set
the header has no layout effect beyond today's (the close button stays absolutely
positioned at the card's top right), so default rendering is unchanged. It carries
`--twc-nm-header-border` and gives themes one element to lay out as a row.

### Class hooks

`classes` keys: `title`, `intro`, `label`, `input`, `select`, `checkbox`, `submit`,
`close`, `disclaimer`, `summary`, `summaryImage`, `summaryName`, `summaryVariant`,
`summaryPrice`, `summaryCompareAt`.

- Each value is a space-separated class list. Tokens not matching `^[A-Za-z_-][A-Za-z0-9_-]*$`
  are dropped with a `console.warn`; a key left with no valid tokens is treated as unset.
- The widget appends the classes and the marker class `twc-nm-themed` to every element of
  that kind (`label` and `input` apply to all labels and text inputs).
- Widget rules are split into **layout** (display, width, flex, gaps, positioning,
  truncation) and **cosmetic** (colour, background, font, border, radius, padding,
  shadow, hover). Cosmetic rules are scoped `:not(.twc-nm-themed)`, so a themed element
  takes its look from the theme; layout rules always apply.

## 5. Testing and release

### Self-tests (`npm run selftest`)

- `index.html` and `harness/triggers.html` (no JSON block) pass unchanged.
- New `harness/config.html` with a JSON block covers: attribute beats JSON; `#popup-open`
  beats both; invalid JSON falls back to defaults; a wrong-type value falls back; each
  `copy` key applies; `{product}` substitution; `emailLabel: false` removes the label and
  sets `aria-label`; disclaimer follows submit; summary renders image, name, size and
  prices; a size change updates the summary and the submitted `variantRef`; a missing
  compare-at hides it; variant image falls back to product image; a `javascript:` image is
  rejected; classes and `twc-nm-themed` are applied; an invalid class token is dropped.

### Default-rendering check

Headless Chrome screenshots of the open modal and the open panel on the harness pages,
taken on 3.5.x `main` and on the branch, must be pixel-identical.

### Release

- 3.6.0 (minor): additive, defaults unchanged.
- README: JSON config and precedence, `copy` keys, `productSummary` and its data fields
  with a Liquid capture, CSS variables, `classes`.
- Branch `babyboo-theming-config`, one PR to `main`.

### Babyboo rollout (outside this repo)

On the "TWC Notify me implementation" theme only: pin 3.6.0, extend the Liquid product
capture with prices and images, add the JSON block, `classes` and Babyboo CSS, then walk
the brief's 14 acceptance criteria on desktop, at 375px, and either side of 640/641px.
Prestige classes that pull in unwanted positioning outside a `.Drawer` (e.g.
`.Drawer__Close`) are dropped in favour of a variable or a Babyboo CSS rule.
