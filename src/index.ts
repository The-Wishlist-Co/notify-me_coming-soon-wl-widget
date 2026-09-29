import { injectStyles } from './ui/styles';
import { createWidget } from './ui/widget';
import { resolveLocalization } from './context/localization';
import { resolveCustomerEmail } from './context/customer-email';
import { createAttrReader } from './context/config-source';
import { TENANT_ID, PROXY_APP_NAME } from './config';
import type {
  WidgetConfig,
  FieldName,
  WidgetType,
  AuthMode,
  DisplayMode,
} from './types';

// Any element carrying this opens the widget: PLP size buttons, "Size out of
// stock?" links, and anything else a theme marks up.
const TRIGGER_SELECTOR = '[data-twc-notify-me]';

function init(): void {
  const wrapper = document.getElementById('notification-widget');
  if (!wrapper) return;

  // Optional legacy open button. When present, its attributes win over the
  // widget element's, so existing installs are unaffected.
  const openButton = document.getElementById('popup-open');
  const attr = createAttrReader(openButton, wrapper);

  injectStyles();

  const fields = JSON.parse(attr('data-fields') || '["email"]') as FieldName[];
  const type = (attr('data-type') || 'notify-me') as WidgetType;
  // Presentation: centred modal (default) or right-hand slide-in panel.
  // Anything other than "panel" falls back to the modal.
  const display: DisplayMode = attr('data-display') === 'panel' ? 'panel' : 'modal';
  // Auth mode: 'proxy' (default, Shopify App Proxy) or 'token'. The widget
  // bundles no credential, so 'token' mode needs one supplied explicitly —
  // see accessToken below.
  const authMode = (attr('data-auth') || 'proxy') as AuthMode;
  // Tenant for X-Twc-Tenant header; used in both auth modes.
  const tenant = attr('data-tenant') || TENANT_ID;
  // Shopify App Proxy app name; used by the 'proxy' auth mode to build the URL.
  const proxyApp = attr('data-proxy-app') || PROXY_APP_NAME;
  // Merchant-supplied token for 'token' mode. The attribute wins over the
  // global so a single page can override it.
  const accessToken = attr('data-access-token') || window.TWC_ACCESS_TOKEN || null;

  // "Shop similar styles" section. Opt-out via data-recommendations="false".
  const recommendationsEnabled = attr('data-recommendations') !== 'false';
  const parsedCount = parseInt(attr('data-recommendations-count') || '', 10);
  const recommendationsCount =
    Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 8;
  // Athos/Searchspring recommendation profile tag. Lets a theme supply the tag
  // when the tenant config has no profileTag/tags field of its own; the config
  // still wins wherever it does carry one.
  const recommendationsProfile =
    (attr('data-recommendations-profile') || '').trim() || null;
  // Fallback currency for price formatting; window.Shopify.currency.active
  // takes precedence when the storefront exposes it.
  const currency = attr('data-currency') || null;

  const config: WidgetConfig = {
    fields,
    type,
    display,
    auth: { mode: authMode, proxyApp, accessToken },
    tenant,
    recommendationsEnabled,
    recommendationsCount,
    recommendationsProfile,
    currency,
    customerEmail: resolveCustomerEmail(attr),
  };

  const widget = createWidget({
    wrapper,
    config,
    localization: resolveLocalization(attr),
  });
  if (!widget) return;

  // One delegated listener, so cards rendered later (filtering, infinite scroll)
  // work without re-initialising. Capture phase, so a theme handler that stops
  // propagation on its own size buttons cannot swallow the click.
  // preventDefault stops href="#" jumps and in-form button submits; the theme's
  // own handlers still run.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      const trigger =
        target instanceof Element
          ? target.closest<HTMLElement>(TRIGGER_SELECTOR)
          : null;
      if (!trigger) return;
      event.preventDefault();
      widget.open(trigger);
    },
    true,
  );

  // A legacy button that is also marked as a trigger is already handled above.
  if (openButton && !openButton.matches(TRIGGER_SELECTOR)) {
    openButton.addEventListener('click', () => widget.open(openButton));
  }
}

// A deferred or late-injected script can run after DOMContentLoaded has fired.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
