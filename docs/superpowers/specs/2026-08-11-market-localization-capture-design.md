# Capturing Shopify market and country on customer interest

**Date:** 2026-08-11
**Status:** Approved

## Goal

Record which Shopify market and country a shopper was browsing in when they register a
"Notify Me" or "Coming Soon" interest. Three values are captured — the market's numeric
id, the market handle, and the country ISO code — and sent on the existing
`customerInterest` POST, whose DTO has been updated to accept them.

The market id must be the **number only**. `gid://shopify/Market/12345` is sent as
`12345`.

## Scope

In scope:

- Reading the three values from Liquid-rendered `data-*` attributes on the widget's
  open button.
- Normalising the market id from a GID to its numeric portion.
- Adding `marketHandle` to the outgoing payload, alongside the `marketId` and
  `countryCode` the widget already sends.
- Consolidating the existing country/market detection into one module, removing the
  `marketId` duplication between `WidgetConfig` and `CountryContext`.

Out of scope:

- Any change to the recommendations path, the auth modes, or the form UI.
- Backfilling `marketId` on interest records already stored as full GIDs (see Known
  gaps).
- Market-aware pricing or currency. `data-currency` is unrelated and untouched.

## Where the values come from

Liquid renders server-side, so the theme hands the values to the widget. They go on the
existing `#popup-open` button, matching every other configuration knob:

```html
<button id="popup-open"
        data-type="notify-me"
        data-market-id="{{ localization.market.id }}"
        data-market-handle="{{ localization.market.handle }}"
        data-country-code="{{ localization.country.iso_code }}">
  Notify Me
</button>
```

`data-market-id` is not new — `src/index.ts` already reads it, though the README never
documented it. The other two are new.

A `window.twcLocalization` global was considered and rejected: it would introduce a
second configuration mechanism alongside `data-*` for no benefit here.

## The localization module

`src/context/detect-country.ts` becomes `src/context/localization.ts`, exporting one
function that takes the button and returns the whole context:

```ts
export function resolveLocalization(button: HTMLElement): LocalizationContext
```

In `src/types.ts`, `CountryContext` is renamed `LocalizationContext` and gains
`marketHandle`:

```ts
export interface LocalizationContext {
  countryCode: string | null;
  provinceCode: string | null;
  marketId: string | null;
  marketHandle: string | null;
}
```

`marketId` is removed from `WidgetConfig`. It was held in both places, and this change
would otherwise deepen that duplication.

### Precedence

First non-null wins.

| Field | Order |
|---|---|
| `marketId` | `data-market-id` → `window.Shopify.markets.currentMarket.id` |
| `marketHandle` | `data-market-handle` only |
| `countryCode` | `data-country-code` → the existing chain, unchanged |
| `provinceCode` | unchanged: `window.customer.default_address.province_code` |

`marketHandle` has no runtime fallback because no `window.Shopify` field exposes it. A
storefront that does not render the attribute simply does not report a handle.

The existing `countryCode` chain is preserved verbatim below the new attribute:
`window.Shopify.markets.currentMarket.countryCode` → `window.Shopify.country` →
`window.Shopify.locale` suffix → `window.customer.default_address.country_code` →
`navigator.language` suffix.

### Normalisation

The market id is normalised regardless of which source it came from. `window.Shopify`
is not a documented API and its shape is not guaranteed, so both paths get the same
treatment:

```ts
// gid://shopify/Market/12345 -> "12345"; a bare "12345" passes through.
// Anything that is not all digits after the last "/" is treated as absent, which
// also catches an unrendered "{{ localization.market.id }}".
function normalizeMarketId(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const tail = value.split('?')[0].split('/').pop() ?? '';
  return /^\d+$/.test(tail) ? tail : null;
}
```

The other two attributes are validated the same way — a value that does not look right
is dropped rather than sent:

- `marketHandle` must match `/^[a-z0-9_-]+$/i`.
- `data-country-code` must be two letters, and is upper-cased before use.

These two format checks apply to the **attributes** only — the pre-existing detection
sources keep sending whatever they hold. `normalizeMarketId` is the exception: it applies
to both sources, which is a deliberate behaviour change for storefronts currently
reporting a GID (see Known gaps).

Liquid renders an empty string when a storefront has no market configured, so empty is a
normal, silent case at every step — not an error and not a warning.

## Payload

`src/index.ts` drops its own `data-market-id` read and its `marketId` config field,
calls `resolveLocalization(openButton)`, and passes the result to `createWidget` as
`localization`. In `src/ui/widget.ts` the `countryCtx` parameter is renamed to match, and
`marketId` is read from it rather than from `config`.

The payload block becomes:

```ts
// Country / province — a shown, non-empty form field beats the resolved context.
if (fields.includes('countryCode')) {
  const selected = getValue("select[name='countryCode']");
  if (selected) formData.countryCode = selected;
} else if (localization.countryCode) {
  formData.countryCode = localization.countryCode;
}

if (fields.includes('provinceCode')) {
  const val = getValue("input[name='provinceCode']");
  if (val) formData.provinceCode = val;
} else if (localization.provinceCode) {
  formData.provinceCode = localization.provinceCode;
}

if (localization.marketId) formData.marketId = localization.marketId;
if (localization.marketHandle) formData.marketHandle = localization.marketHandle;
```

Absent values are omitted, not sent as `null`, consistent with every other optional field
in this payload. `marketId` is sent as a JSON string, as it is today.

### Why the shopper's country selection still wins

When `data-fields` includes `"countryCode"`, the form shows a country dropdown, and that
selection currently takes precedence over anything detected. That behaviour is kept.

The two values mean different things — `{{ localization.country.iso_code }}` is the
country the shopper is browsing in, while the dropdown is a country they chose — but the
DTO has one `countryCode` field. Letting the Liquid value override would silently discard
what the shopper entered for merchants using that field today. So the Liquid value sits
at the top of the *auto-detect* chain and is used whenever the dropdown is not shown or is
left blank.

## Documentation

The README Configuration list gains all three attributes, including `data-market-id`,
which is read today but undocumented. A short "Shopify markets" subsection shows the
Liquid snippet and states plainly that the numeric id is sent, not the GID.

`index.html` gets the three attributes on its demo button so the local harness exercises
the path.

## Verification

This repo has no test runner — `npm test` is a stub — so this is verified the same way
the previous two features were: `npm run typecheck` and `npm run build`, then the local
harness with the network tab open, checking the POST body in each case.

1. All three attributes rendered normally — `marketId` numeric, `marketHandle` and
   `countryCode` present.
2. `data-market-id="gid://shopify/Market/12345"` — sends `12345`.
3. `data-market-id="12345"` — sends `12345` unchanged.
4. Attributes absent — falls back to `window.Shopify` detection, `marketHandle` omitted,
   nothing throws.
5. Attributes present but empty, as Liquid renders when no market is configured — all
   three omitted.
6. Unrendered literal `{{ localization.market.id }}` — omitted, not sent as garbage.
7. `data-fields` includes `countryCode` and the shopper picks a different country — the
   shopper's choice is in the payload.
8. Same, but the dropdown is left blank — the `data-country-code` value is used.

## Known gaps

**Existing GID values are not backfilled.** A merchant whose storefront exposes
`window.Shopify.markets.currentMarket.id` as a full GID has been sending
`gid://shopify/Market/12345` until now. After this change they send `12345`, so old and
new rows for that merchant will not match on `marketId` without a backfill on the
backend. That is the intended outcome of the change, but reporting that groups by
`marketId` should expect both shapes in historical data.

**Merchants must update their theme.** The three attributes only appear if the theme is
edited. Until then, `marketId` and `countryCode` keep working from the existing detection
chain, and `marketHandle` is simply never reported.
