# CLAUDE.md — The Wishlist Company (TWC / Wishlist.io)

This file gives Claude Code persistent context about the TWC platform so every session starts informed. Update it as the platform evolves.

---

## This Repository

**Repo:** `notify-me_coming-soon-wl-widget`
**GitHub:** https://github.com/The-Wishlist-Co/notify-me_coming-soon-wl-widget

Customer-facing widget for 'Notify Me' and 'Coming Soon' wishlist functionality. Embedded on retailer product pages.

---

---

## Platform Overview

**Wishlist.io** is a SaaS retail platform focused on capturing and activating consumer intent data, primarily in fashion retail. It surfaces wishlist and engagement data to frontline retail staff and powers personalised outreach via messaging templates.

**GitHub org:** https://github.com/The-Wishlist-Co

---

## Service Architecture

Microservices stack deployed on **AWS EKS**, service mesh via **Istio + Consul**. Netflix OSS for gateway/resilience. All services are **Spring Boot / JHipster**, Java 13.

| Service | Role |
|---|---|
| `twcgateway` | API gateway (Zuul) |
| `wsservice` | Wishlist core service |
| `customerservice` | Customer profile service |
| `productsvc` | Product catalogue service |
| `eventcollector` | Event ingestion |
| `inventorysvc` | Inventory service |
| `merchantsvc` | Merchant/retailer management |
| `ordersvc` | Order service |

**Observability:** OpenTelemetry + Datadog. Logs via Filebeat → Elasticsearch (`twc-ops` cluster, ECK on EKS, Elasticsearch 8.3.3, 4-node).

---

## Critical Infrastructure Constraints

### Java / JVM (ALL services)

All services run Java 13 in containers and **cannot auto-detect CPU limits correctly via cgroups**. Every service deployment MUST include:

```
-XX:ActiveProcessorCount=N
```

in `JAVA_OPTS`, where N matches the container's CPU allocation. Omitting this causes Undertow thread pool over-sizing → Consul health check failures → Hystrix circuit breaker trips → 500 SHORTCIRCUIT errors at the gateway.

Affected services (apply to all eight): `twcgateway`, `wsservice`, `customerservice`, `productsvc`, `eventcollector`, `inventorysvc`, `merchantsvc`, `ordersvc`.

### Elasticsearch / ECK

- Cluster: `twc-ops`, 4 nodes on EKS via ECK operator
- **Memory:** each node must be configured with **4Gi** (`-Xms2g -Xmx2g`). Nodes with 2Gi will OOM-kill under load.
- **ILM:** Filebeat data stream indices require an ILM policy with **3-day retention** to prevent disk exhaustion.
- Yellow cluster state will block ECK rolling restarts — resolve unassigned shards before patching the CR.

### EKS Scaling Lambda

A Lambda (`eks_node_scaleup`) has hardcoded node group values and will override manual EKS scaling changes. Do not rely on manual scaling being durable — any fix must go into the Lambda source.

---

## Data Architecture

### ClickHouse (Analytics / Reporting)

Used for conversion reporting and analytics. All ETL queries follow strict conventions — see Query Conventions below.

### DynamoDB (Operational)

Key tables:

| Table | PK | SK | Notes |
|---|---|---|---|
| `TWCTEMPLATE_TOPIC` | `tenantId` | `topicId` | Soft-delete via `active` flag |
| `MESSAGE` | — | — | `messageTopic` stored directly at send time — single source of truth |

`messageTopic` is captured on the MESSAGE record at send time and is **not** looked up from `TWCTEMPLATE_TOPIC` at query time. This is intentional.

---

## ClickHouse Query Conventions

These conventions are non-negotiable. All new queries must follow them.

### Named Queries (Conversion Reporting Dashboard)

| Query ID | Description |
|---|---|
| `CONV_KPI_SUMMARY` | Top-level KPI summary |
| `CONV_TREND_DAILY` | Daily trend over period |
| `CONV_BREAKDOWN_STORE` | Breakdown by store |
| `CONV_BREAKDOWN_STAFF` | Breakdown by staff |
| `CONV_BREAKDOWN_TOPIC` | Breakdown by message topic |
| `CONV_BREAKDOWN_TEMPLATE_TAG` | Breakdown by template tag |
| `CONV_BREAKDOWN_CUSTOMER_TAG` | Breakdown by customer tag |
| `CONV_BREAKDOWN_CHANNEL` | Breakdown by channel |

### API Parameter Naming Convention

| Parameter | Maps to |
|---|---|
| `value1` | channel |
| `value2` | topic |
| `value3` | templateTag |
| `value4` | customerTag |
| `param5` | storeRefs (array) |
| `param6` | staffRefs (array) |

### Filter Syntax Rules

**`storeRef` and `staffRef` are ALWAYS multi-select.** These are never single-value filters.

```sql
-- ✅ CORRECT — always use IN with empty() guard
AND (empty({param5: Array(String)}) OR storeRef IN {param5: Array(String)})
AND (empty({param6: Array(String)}) OR staffRef IN {param6: Array(String)})

-- ❌ WRONG — never use equality for store or staff
AND storeRef = {param5: String}
AND staffRef = {param6: String}
```

All other filters (`value1`–`value4`) follow the same array pattern if they are multi-select dropdowns.

---

## Integrations

### Shopify

- Custom pixel integration on `twc-fashion-demo.myshopify.com` (pixel `87425273`)
- Pixels require `analytics.subscribe('init', ...)` capture and `Content-Type: application/json` header
- App updates auto-deploy to all merchants unless new OAuth permission scopes are required

### Gorgias

Backend proxy integration surfacing support ticket data on customer profile screens.

- Per-customer credentials stored encrypted (AES-256) in `gorgias_credentials` table
- Ticket data cached in `gorgias_ticket_cache`
- Cache TTLs: 15 min (summary), 2 min (full ticket list)
- Five API endpoints for credential management and ticket retrieval

### Emarsys

Marketing automation platform integration. Customer data synced from TWC to Emarsys for campaign targeting. Webhook updates received via `emarsys-webhook-updates` Lambda.

### Newstore

POS platform integration. TWC builds plugins/webviews for the Newstore POS environment. Webhooks received via `twc-newstore-webhook`. Proxy via `infinityAPI` for Triquestra Infinity POS.

---

## Development Conventions

### General

- Full-stack ownership: data modelling, API design, backend, infra/DevOps, frontend
- Prefer explicit over implicit — document intent in code comments for complex query logic
- All schema changes should consider soft-delete patterns (see `TWCTEMPLATE_TOPIC` above)
- Default branch: `main`
- Feature branches cut from `main`, kebab-case description (e.g. `suppression-change`)
- PR back to `main` when complete

### Code Review Checklist (for Claude Code to apply)

Before suggesting or approving any change, verify:

- [ ] All ClickHouse queries touching store/staff use `IN` + `empty()` guard, not `=`
- [ ] Any new or modified Spring Boot service includes `-XX:ActiveProcessorCount` in JAVA_OPTS config
- [ ] DynamoDB table designs include `tenantId` as PK for all multi-tenant tables
- [ ] New Elasticsearch indices have an ILM policy assigned
- [ ] API parameter names follow the `value1`–`value4` / `param5`/`param6` convention

---

## Key External References

- Anthropic Claude Code docs: https://docs.claude.com/en/docs/claude-code/overview
- ECK operator docs: https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html
- Shopify custom pixels: https://shopify.dev/docs/api/web-pixels-api

---

*Last updated: May 2026. Keep this file current as the platform evolves — it is the primary context source for all Claude Code sessions.*

## References
- **Engineering Standards:** https://github.com/The-Wishlist-Co/twc-api-specs/blob/main/standards/TWC-STANDARDS.md
- **API Specifications:** https://github.com/The-Wishlist-Co/twc-api-specs/blob/main/apis/
