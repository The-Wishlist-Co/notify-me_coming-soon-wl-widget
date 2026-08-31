import { injectStyles } from './ui/styles';
import { createWidget } from './ui/widget';
import { resolveLocalization } from './context/localization';
import { resolveCustomerEmail } from './context/customer-email';
import { TENANT_ID, PROXY_APP_NAME } from './config';
import type {
  WidgetConfig,
  FieldName,
  WidgetType,
  AuthMode,
  DisplayMode,
} from './types';

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
  // Presentation: centred modal (default) or right-hand slide-in panel.
  // Anything other than "panel" falls back to the modal.
  const display: DisplayMode =
    openButton.getAttribute('data-display') === 'panel' ? 'panel' : 'modal';
  // Auth mode: 'proxy' (default, Shopify App Proxy) or 'token'. The widget
  // bundles no credential, so 'token' mode needs one supplied explicitly —
  // see accessToken below.
  const authMode = (openButton.getAttribute('data-auth') || 'proxy') as AuthMode;
  // Tenant for X-Twc-Tenant header; used in both auth modes.
  const tenant = openButton.getAttribute('data-tenant') || TENANT_ID;
  // Shopify App Proxy app name; used by the 'proxy' auth mode to build the URL.
  const proxyApp = openButton.getAttribute('data-proxy-app') || PROXY_APP_NAME;
  // Merchant-supplied token for 'token' mode. The attribute wins over the
  // global so a single page can override it.
  const accessToken =
    openButton.getAttribute('data-access-token') ||
    window.TWC_ACCESS_TOKEN ||
    null;

  // "Shop similar styles" section. Opt-out via data-recommendations="false".
  const recommendationsEnabled =
    openButton.getAttribute('data-recommendations') !== 'false';
  const parsedCount = parseInt(
    openButton.getAttribute('data-recommendations-count') || '',
    10,
  );
  const recommendationsCount =
    Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 8;
  // Fallback currency for price formatting; window.Shopify.currency.active
  // takes precedence when the storefront exposes it.
  const currency = openButton.getAttribute('data-currency') || null;

  const localization = resolveLocalization(openButton);

  const config: WidgetConfig = {
    fields,
    type,
    display,
    auth: { mode: authMode, proxyApp, accessToken },
    tenant,
    recommendationsEnabled,
    recommendationsCount,
    currency,
    customerEmail: resolveCustomerEmail(openButton),
  };
  const productData = window.currentProduct;

  createWidget({ wrapper, openButton, config, productData, localization });
});
