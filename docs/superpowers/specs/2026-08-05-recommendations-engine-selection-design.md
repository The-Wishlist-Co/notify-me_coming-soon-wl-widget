# Recommendations engine selection — TWC and Athos

**Date:** 2026-08-05
**Status:** Approved
**Builds on:** `2026-08-05-shop-similar-styles-recommendations-design.md`

## Goal

Let each tenant choose which engine powers the "Shop similar styles" section, driven by
the `websiteRecommendations` field in the tenant's remote config. Two engines are
supported: the current TWC recommendations service, and Athos (Searchspring). When the
tenant has no `websiteRecommendations` configured, the section does not render at all.

## Scope

In scope:

- Fetching and caching the tenant config, and reading `websiteRecommendations` from it.
- An Athos (Searchspring) recommendations client.
- Dispatching to the right client, behind the existing `fetchRecommendations` interface.

Out of scope:

- Any change to how recommendations are rendered. Both engines normalise to the existing
  `RecommendedProduct`, so `src/ui/recommendations.ts` and `src/ui/widget.ts` are
  untouched apart from passing the current product through.
- Searchspring beacon/tracking integration.
- A backend proxy for Searchspring (see Open Questions).

## The config gate

New file `src/api/tenant-config.ts`.

```
GET https://api.au-aws.thewishlist.io/services/eventcollector/api/v1/custom/configs/public
Authorization: <bearer>
X-Twc-Tenant: <tenant>
```

**The endpoint is not public despite its path.** It returns 401 with no credentials and
401 with only `X-Twc-Tenant`; it needs both headers, exactly like the customer-interest
and TWC recommendations calls. It reuses `resolveAuthToken` accordingly. CORS is
permissive — the service echoes the request `Origin`, including `http://localhost`.

The base URL is added to `src/config.ts` as `TENANT_CONFIG_URL`.

The response is large (~20KB+; it carries a serialised `preferences` blob and several
other subsystems' settings). The widget reads exactly one field from it and ignores the
rest. The whole response is fetched once per page session and cached in-module, keyed by
tenant.

### Parsing `websiteRecommendations`

```ts
export type EngineConfig =
  | { engine: 'TWC' }
  | { engine: 'ATHOS'; siteIdentifier: string; profileTag: string };

export async function getEngineConfig(
  tenant: string,
  authMode: AuthMode,
  proxyApp: string,
): Promise<EngineConfig | null>;
```

Resolves to `null` — meaning *render no section* — in every one of these cases:

| Condition | Why null |
| --- | --- |
| No auth token available | Cannot call the config endpoint |
| Request failed, non-OK, or unparseable | Engine unknown |
| `websiteRecommendations` absent | Explicit product rule: no config, no section |
| `engine` is neither `TWC` nor `ATHOS` | Unknown engine, nothing to call |
| `engine` is `ATHOS` with no `siteIdentifier` | Cannot build a Searchspring URL |

`engine` is compared case-insensitively after trimming, because it is merchant-entered
configuration rather than a closed enum in the widget.

The legacy top-level `recommendationsEngine` field is deliberately **not** consulted.
Only `websiteRecommendations` decides.

### Profile tag

Searchspring requires a `tags` query parameter naming one or more recommendation
profiles; the config's documented shape does not yet carry one. Resolution order:

1. `websiteRecommendations.profileTag`
2. `websiteRecommendations.tags` (alias — the Searchspring parameter is named `tags`)
3. `'similar'`

The fallback exists so the two config shapes as documented today work unchanged, and so
the real value is picked up automatically when the backend adds the field. `similar`
matches the section's own copy ("Shop similar styles").

## Engine dispatch

`src/api/recommendations.ts` is replaced by a folder:

| File | Responsibility |
| --- | --- |
| `src/api/recommendations/index.ts` | Resolve the engine, dispatch, cache the result |
| `src/api/recommendations/twc.ts` | TWC client — existing logic, moved verbatim |
| `src/api/recommendations/athos.ts` | Searchspring client |
| `src/api/recommendations/normalize.ts` | Shared dedupe/trim helper used by both |

The public interface the widget already calls keeps its shape, with one addition:

```ts
export async function fetchRecommendations(params: {
  email: string;
  tenant: string;
  authMode: AuthMode;
  proxyApp: string;
  count: number;
  productId: string | null; // NEW — Searchspring's `products` param
}): Promise<RecommendedProduct[]>;
```

`index.ts` awaits `getEngineConfig`, returns `[]` when it is null, and otherwise calls
the matching client. The per-session result cache key becomes
`${engine}|${tenant}|${email}|${count}` so switching engines cannot serve stale results.

### TWC client

Unchanged behaviour, moved as-is: Bearer + `X-Twc-Tenant`, over-fetch `count * 3` clamped
to the service's documented maximum of 20, dedupe by `product_ref` keeping the
highest-scoring entry, trim to `count`.

### Athos client

```
GET https://{siteIdentifier}.a.searchspring.io/boost/{siteIdentifier}/recommend
      ?tags={profileTag}
      &limits={count}
      &products={productId}    // omitted when unknown
      &shopper={email}         // omitted when unknown
```

**No `Authorization` header and no `X-Twc-Tenant` header.** Searchspring is a third-party
host; sending a tenant-scoped TWC bearer token to it would leak a credential. Keeping the
two engines in separate modules makes this structurally impossible rather than a rule
someone has to remember.

Response mapping, from `results[].mappings.core`:

| `RecommendedProduct` | Searchspring source |
| --- | --- |
| `id`, `ref` | `uid` (falling back to `sku`, then `url`) |
| `name` | `name` |
| `imageUrl` | `imageUrl` (falling back to `thumbnailImageUrl`) |
| `productUrl` | `url` |
| `price` | `price`, coerced from string when needed |
| `originalPrice` | `msrp` when greater than `price`, else null |

Searchspring returns products rather than variants, so deduping is not strictly required;
the shared helper is still applied, keyed on the resolved `ref`, so a malformed feed
cannot produce a row with the same product twice.

Searchspring returns `price`/`msrp` as strings in some feeds. Values are parsed with
`parseFloat` and entries whose price cannot be parsed are kept with price `0` rather than
dropped, matching how the TWC client already treats a missing price.

Entries missing `name`, `imageUrl`, or `productUrl` are dropped, same rule as TWC. Unlike
TWC there is no over-fetch, because there are no variant duplicates to absorb; if a feed
contains unusable entries the row simply renders fewer than `count` products.

## Timing

The config request is made lazily on the first attempt to show recommendations, and is
awaited **before** the skeleton is inserted. A tenant with no engine configured must not
flash a skeleton and then have it removed.

This is deliberately not fetched eagerly at page load: the payload is large and most PDP
visitors never open the modal. The cost is that the section appears one extra round-trip
later; the modal itself still opens instantly, and nothing blocks on the config.

`data-recommendations="false"` short-circuits before any config request is made.

## Error handling

| Condition | Behaviour |
| --- | --- |
| `data-recommendations="false"` | No config request, no section |
| No customer email resolvable | No config request, no section |
| Config request fails / 401 / unparseable | Empty result, logged, no section |
| `websiteRecommendations` absent | Empty result, no section, no engine request |
| Engine request fails | Empty result, logged, no section |
| Zero products after filtering | No section |

No failure in this path blocks or alters the customer-interest submission. Config
failures are logged once via `console.error`, consistent with the existing clients.

## Types

`src/types.ts` gains `EngineName = 'TWC' | 'ATHOS'` and the `EngineConfig` union above.
`WidgetConfig` is unchanged — the engine is a server-side decision, not a data attribute.

`src/ui/widget.ts` passes `productData?.id` through to `fetchRecommendations` as
`productId`; that is its only change.

## Testing

Same approach as the base feature: `npm run typecheck`, `npm run build`, and manual
verification in headless Chrome against the demo page.

Verifiable locally:

1. Config returning `{"engine":"TWC"}` — section renders from the TWC service.
2. Config with no `websiteRecommendations` — no section, and no TWC request is made.
3. Config returning `{"engine":"ATHOS","siteIdentifier":"abc123"}` against a stubbed
   Searchspring response in the documented shape — section renders, and the outgoing
   request carries **no** `Authorization` header.
4. Config 401/500 — no section, submission unaffected.
5. `ATHOS` with no `siteIdentifier` — no section.
6. Unknown engine value — no section.
7. Config fetched once per page session across repeated opens.
8. No skeleton flash when the config disqualifies the section.

The demo page's `?mockRecs=1` harness is extended to stub the config endpoint and the
Searchspring host alongside the existing TWC stub, with query params to select the
scenario.

## Known gaps

**`twc-fashion-demo` will go dark.** Its live config has no `websiteRecommendations` —
only the legacy `recommendationsEngine: "TWC"`, which this design deliberately ignores.
The section will stop rendering for that tenant until `{"engine": "TWC"}` is added to its
config. This is the agreed strict behaviour, but the backend change should land before
this ships.

**The Athos path cannot be verified end to end from here.** There is no real Searchspring
`siteId` and no tenant configured for `ATHOS`. It is built to Searchspring's documented
contract and verified against a stub matching that contract; the first real call will be
in a live environment.

## Open questions

**What `siteIdentifier` actually holds.** This design assumes it is the Searchspring
`siteId` — the 6-character alphanumeric identifier from the Searchspring Management
Console, used in both the subdomain and the path. The example value circulated with the
requirement (`acme-au-flagship-01`) does not match that shape and reads like a
human-friendly label. If it is instead a TWC-side identifier that the backend maps to a
siteId, the widget would need to call a TWC proxy endpoint rather than Searchspring
directly — a different design, and a backend decision. Worth confirming before the Athos
path goes live.
