import { injectStyles } from './ui/styles';
import { createWidget } from './ui/widget';
import { detectCountryContext } from './context/detect-country';
import { resolveCustomerEmail } from './context/customer-email';
import { TENANT_ID, PROXY_APP_NAME } from './config';
import type { WidgetConfig, FieldName, WidgetType, AuthMode } from './types';

document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('notification-widget');
  if (!wrapper) return;

  const openButton = document.getElementById('popup-open');
  if (!openButton) return;

  injectStyles();

  // Parse configuration from the host button's data-* attributes.
  const fields = JSON.parse(
    openButton.getAttribute('data-fields') || '["email"]',
  ) as FieldName[];
  const type = (openButton.getAttribute('data-type') || 'notify-me') as WidgetType;
  // Auth mode: 'token' (default, bundled ACCESS_TOKEN) or 'proxy' (Shopify App Proxy).
  const authMode = (openButton.getAttribute('data-auth') || 'token') as AuthMode;
  // Tenant for X-Twc-Tenant header; used in both auth modes.
  const tenant = openButton.getAttribute('data-tenant') || TENANT_ID;
  // Shopify App Proxy app name; used by the 'proxy' auth mode to build the URL.
  const proxyApp = openButton.getAttribute('data-proxy-app') || PROXY_APP_NAME;

  // "Shop similar styles" section. Opt-out via data-recommendations="false".
  const recommendationsEnabled =
    openButton.getAttribute('data-recommendations') !== 'false';
  const parsedCount = parseInt(
    openButton.getAttribute('data-recommendations-count') || '',
    10,
  );
  const recommendationsCount =
    Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 4;

  const countryCtx = detectCountryContext();
  const marketId =
    openButton.getAttribute('data-market-id') || countryCtx.marketId;

  const config: WidgetConfig = {
    fields,
    type,
    authMode,
    tenant,
    proxyApp,
    marketId,
    recommendationsEnabled,
    recommendationsCount,
    customerEmail: resolveCustomerEmail(openButton),
  };
  const productData = window.currentProduct;

  createWidget({ wrapper, openButton, config, productData, countryCtx });
});
