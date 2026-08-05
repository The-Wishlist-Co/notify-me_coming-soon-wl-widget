// Bundled server-issued access token (used by the default 'token' auth mode).
// NOTE: relocated verbatim from the original index.js — unchanged by this restructure.
export const ACCESS_TOKEN =
  'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJRWlJkS3JabXJmMEk3WkhXRUtqNWRLTEhQanFubWJFeV9iNmpSbHdya1drIn0.eyJleHAiOjE3ODU5Mzc5NDMsImlhdCI6MTc4NTkzNDM0MywianRpIjoiOWExNWU1NmEtN2JmMi00ZTFhLTk4NmMtODBkZTIzYTUzNmI4IiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmF1LWF3cy50aGV3aXNobGlzdC5pby9hdXRoL3JlYWxtcy90d2NNYWluIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjY4OTlkMjU4LTcyNWQtNDcwMy04YzQ5LTI2OTRiZmUyZGExYSIsInR5cCI6IkJlYXJlciIsImF6cCI6InR3Yy1wb3MtY2xpZW50Iiwic2Vzc2lvbl9zdGF0ZSI6ImFkOGFkOTE0LWNhMmEtNGE4Yy05M2M1LTNmMzA3MjliMmRkOSIsImFsbG93ZWQtb3JpZ2lucyI6WyJodHRwczovL2xvY2FsaG9zdCJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsidHdjLXBvcy11c2VyIiwiZGVmYXVsdC1yb2xlcy10d2NtYWluIiwib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIHRlbmFudGlkIHN0b3JlIHByb2ZpbGUgc3RhZmZyZWYgZW1haWwiLCJzaWQiOiJhZDhhZDkxNC1jYTJhLTRhOGMtOTNjNS0zZjMwNzI5YjJkZDkiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsInRlbmFudGlkIjoidHdjLWZhc2hpb24tZGVtbyIsIm5hbWUiOiJtYXR0IGZhc2hpb25kZW1vIiwicHJlZmVycmVkX3VzZXJuYW1lIjoibWF0dEBmYXNoaW9uZGVtby5jb20uYXUiLCJzdG9yZSI6InR3Yy1mYXNoaW9uLWRlbW8tdGVzdCIsImdpdmVuX25hbWUiOiJtYXR0IiwiZmFtaWx5X25hbWUiOiJmYXNoaW9uZGVtbyIsImVtYWlsIjoibWF0dEBmYXNoaW9uZGVtby5jb20uYXUifQ.rhW9joS8vQm13qHiXkgs-NHZM1Epva0cYGxIMXIyT6TEiDVAir8H536S8BlJKnFJWRVzsKn7VwaLoftgCPYvbsYDjC_wMnTY1oKygXs61DLaTWt90ou-4T5Ox0Ta_00dEFtmz22ouembFTrF_mumUPLGqsyc93nWIJZVQdmoqAnvxLiMs_F9PAVIq8X3ahjC9Qt_bzAa7QagQSWapQasfIQ9Wbwr9qa6JpIpYQnKf2j_Io0mNb7G2Xhvt0Pe8HqYNP50AJMvRdlQY_bHDAKtTRDGFU1jU_hVfbcWh44ZjjHHuSyM7TLvvI9M4gpLzXI25BCOf81tddVZAox4ms62TQ';

// Default tenant for the X-Twc-Tenant header; used in both auth modes.
export const TENANT_ID = 'victoria-woods';

// Default Shopify App Proxy app name; forms the `/apps/<name>/...` URL prefix
// used by the 'proxy' auth mode. Override per-merchant via `data-proxy-app`.
export const PROXY_APP_NAME = 'twc-sdk';

// Customer-interest API endpoint
export const CUSTOMER_INTEREST_URL =
  'https://api.au-aws.thewishlist.io/services/wsservice/api/wishlist/items/customerInterest';

// Recommendations API base. The retailer id (same value as the tenant) and the
// URL-encoded customer email are appended as path segments.
export const RECOMMENDATIONS_URL_BASE =
  'https://api.au-aws.thewishlist.io/services/recommendations/api/v1/recommendations';

// Tenant config endpoint. Despite the "public" path it requires the same
// Authorization + X-Twc-Tenant headers as every other TWC call — it returns
// 401 without them.
export const TENANT_CONFIG_URL =
  'https://api.au-aws.thewishlist.io/services/eventcollector/api/v1/custom/configs/public';
