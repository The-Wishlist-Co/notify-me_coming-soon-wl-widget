import type { WidgetConfig, Product, Variant, LocalizationContext } from '../types';
import { resolveProduct } from '../product/resolve-product';
import {
  listedVariants,
  readPageVariantIds,
  pickPreselectedVariant,
} from '../product/preselect';
import { applyClasses } from './classes';
import { COUNTRY_CODES } from '../data/country-codes';
import {
  submitCustomerInterest,
  type SubmitResult,
} from '../api/customer-interest';
import { resolveEngine, fetchRecommendations } from '../api/recommendations';
import {
  createRecommendationsSkeleton,
  fillRecommendationsSection,
  removeRecommendationsSection,
  RECS_SECTION_ID,
} from './recommendations';
import { escapeHtml, fillProduct } from './copy';
import { createSummary, updateSummary } from './summary';

export interface WidgetHandle {
  // Open for the product the trigger belongs to (its [data-twc-product], else
  // window.currentProduct), pre-selecting per the trigger and page state. Null
  // behaves like a trigger with no product container and no data-variant-id.
  open(trigger: HTMLElement | null): void;
}

export function createWidget(params: {
  wrapper: HTMLElement;
  config: WidgetConfig;
  localization: LocalizationContext;
}): WidgetHandle | null {
  const { wrapper, config, localization } = params;
  const {
    fields,
    type,
    display,
    auth,
    tenant,
    recommendationsEnabled,
    recommendationsCount,
    recommendationsProfile,
    currency,
    customerEmail,
    copy,
    productSummary,
    classes,
  } = config;

  // Create and append the overlay for the popup.
  const overlay = document.createElement('div');
  overlay.innerHTML = `
        <div id="twc-nm-overlay" role="dialog" aria-modal="true" aria-labelledby="popup-title">
            <div class="twc-nm-card">
                <div class="twc-nm-header">
                    <button type="button" id="popup-close" class="twc-nm-close" aria-label="Close"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/></svg></button>
                    <h2 id="popup-title" class="twc-nm-title"></h2>
                </div>
                <p id="popup-text" class="twc-nm-text"></p>
                <div id="popup-notice" class="twc-nm-status" role="status" aria-live="polite" hidden></div>
                <form id="popup-form" class="twc-nm-form">
                    <div class="twc-nm-field">
                        <label class="twc-nm-label" for="twc-nm-size">${escapeHtml(copy.sizeLabel)}</label>
                        <select class="twc-nm-select" id="twc-nm-size" name="select-size" required>
                            <option value="" disabled selected>${escapeHtml(copy.sizePlaceholder)}</option>
                        </select>
                    </div>
                </form>
            </div>
        </div>
    `;

  wrapper.appendChild(overlay);

  const overlayEl = document.getElementById('twc-nm-overlay');
  const popupClose = document.getElementById('popup-close');
  const popupTitle = document.getElementById('popup-title');
  const popupText = document.getElementById('popup-text');
  const sizeSelect = document.querySelector<HTMLSelectElement>(
    "select[name='select-size']",
  );
  const form = document.getElementById('popup-form') as HTMLFormElement | null;
  const popupNotice = document.getElementById('popup-notice');

  if (
    !overlayEl ||
    !popupClose ||
    !popupTitle ||
    !popupText ||
    !sizeSelect ||
    !form ||
    !popupNotice
  ) {
    return null;
  }

  // Panel mode is purely a geometry change — every open/close behaviour below
  // is shared, so the whole difference is this one class.
  if (display === 'panel') {
    overlayEl.classList.add('twc-nm--panel');
  }

  // Optional product summary at the top of the form, kept in step with the
  // size select so a size changed in the drawer is what the shopper sees.
  const summaryEl = productSummary ? createSummary() : null;
  if (summaryEl) form.insertBefore(summaryEl, form.firstChild);

  const countryOptions = COUNTRY_CODES.map(
    (c) =>
      `<option value="${c.code}"${
        c.code === localization.countryCode ? ' selected' : ''
      }>${c.name}</option>`,
  ).join('');

  // Wrap an input/select in a labeled field row.
  const field = (id: string, label: string, control: string): string =>
    `<div class="twc-nm-field"><label class="twc-nm-label" for="${id}">${label}</label>${control}</div>`;

  const fieldMap: Record<string, string> = {
    email:
      copy.emailLabel === false
        ? // No visible label: the input names itself for screen readers.
          `<div class="twc-nm-field"><input class="twc-nm-input" id="twc-nm-email" name="email" type="email" placeholder="${escapeHtml(
            copy.emailPlaceholder,
          )}" aria-label="${escapeHtml(copy.emailPlaceholder || 'Email')}" required /></div>`
        : field(
            'twc-nm-email',
            escapeHtml(copy.emailLabel),
            `<input class="twc-nm-input" id="twc-nm-email" name="email" type="email" placeholder="${escapeHtml(
              copy.emailPlaceholder,
            )}" required />`,
          ),
    mobile: field(
      'twc-nm-mobile',
      'Mobile',
      `<input class="twc-nm-input" id="twc-nm-mobile" name="mobile" type="tel" placeholder="Mobile number" required />`,
    ),
    firstName: field(
      'twc-nm-firstname',
      'First name',
      `<input class="twc-nm-input" id="twc-nm-firstname" name="firstName" type="text" placeholder="First name" required />`,
    ),
    lastName: field(
      'twc-nm-lastname',
      'Last name',
      `<input class="twc-nm-input" id="twc-nm-lastname" name="lastName" type="text" placeholder="Last name" required />`,
    ),
    countryCode: field(
      'twc-nm-country',
      'Country',
      `<select class="twc-nm-select" id="twc-nm-country" name="countryCode"><option value="">Select country</option>${countryOptions}</select>`,
    ),
    provinceCode: field(
      'twc-nm-province',
      'State / Province',
      `<input class="twc-nm-input" id="twc-nm-province" name="provinceCode" type="text" placeholder="State / province code" value="${
        localization.provinceCode || ''
      }" />`,
    ),
  };

  // Add fields to the form based on the parsed fields.
  fields.forEach((name) => {
    if (fieldMap[name]) {
      form.insertAdjacentHTML('beforeend', fieldMap[name]);
    }
  });

  // Each opt-in is only offered alongside the field it subscribes: there is no
  // point asking to email a shopper the form never collects an address from.
  // An absent checkbox reads as unchecked, so the payload still carries both flags.
  const optIns = [
    fields.includes('email')
      ? `<label class="twc-nm-check"><input type="checkbox" name="mailList" /> ${escapeHtml(copy.emailOptIn)}</label>`
      : '',
    fields.includes('mobile')
      ? `<label class="twc-nm-check"><input type="checkbox" name="mailListSms" /> ${escapeHtml(copy.smsOptIn)}</label>`
      : '',
  ].join('');
  if (optIns) {
    form.insertAdjacentHTML('beforeend', `<div class="twc-nm-checks">${optIns}</div>`);
  }
  form.insertAdjacentHTML(
    'beforeend',
    `<div id="popup-status" class="twc-nm-status" role="status" aria-live="polite" hidden></div>`,
  );
  form.insertAdjacentHTML(
    'beforeend',
    `<button type="submit" class="twc-nm-submit">${escapeHtml(copy.submit)}</button>`,
  );
  if (copy.disclaimer) {
    form.insertAdjacentHTML(
      'beforeend',
      `<p class="twc-nm-disclaimer">${escapeHtml(copy.disclaimer)}</p>`,
    );
  }

  // Every hookable element now exists (summary included), so theme classes can
  // be attached once. Later DOM updates only change text and visibility.
  applyClasses(overlayEl, classes);

  // Prefill the email for a known shopper. Set as a property rather than
  // interpolated into the field's HTML above, so a theme-supplied address can
  // never inject markup. The field stays editable: a shopper who wants a
  // different address just types over it, and submit reads the live value.
  if (customerEmail) {
    const emailInput = form.querySelector<HTMLInputElement>(
      "input[name='email']",
    );
    if (emailInput) emailInput.value = customerEmail;
  }

  const popupStatus = document.getElementById('popup-status');
  const submitBtn = form.querySelector<HTMLButtonElement>('.twc-nm-submit');
  if (!popupStatus || !submitBtn) return null;

  // Inline status messaging (replaces alert()).
  function setStatus(kind: 'error' | 'success', message: string): void {
    popupStatus!.textContent = message;
    popupStatus!.className = `twc-nm-status twc-nm-status--${kind}`;
    popupStatus!.hidden = false;
  }
  function clearStatus(): void {
    popupStatus!.hidden = true;
    popupStatus!.textContent = '';
  }

  // Messages that replace the form entirely (no product, nothing out of stock).
  // Rendered outside the form, which is hidden while they show.
  function showNotice(kind: 'error' | 'info', message: string): void {
    form!.hidden = true;
    popupNotice!.textContent = message;
    popupNotice!.className = `twc-nm-status twc-nm-status--${kind}`;
    popupNotice!.hidden = false;
  }
  function clearNotice(): void {
    form!.hidden = false;
    popupNotice!.hidden = true;
    popupNotice!.textContent = '';
  }

  // Null-safe form readers (preserve normal-path behavior under strict mode).
  const getValue = (selector: string): string => {
    const el = form.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
    return el ? el.value : '';
  };
  const isChecked = (selector: string): boolean => {
    const el = form.querySelector<HTMLInputElement>(selector);
    return el ? el.checked : false;
  };

  const cardEl = overlayEl.querySelector<HTMLElement>('.twc-nm-card');

  // The product and sizes of the current open. Replaced on every open, because
  // one widget instance serves every trigger on the page.
  let activeProduct: Product | null = null;
  let activeVariants: Variant[] = [];

  // Tracks an in-flight render so the on-open and post-submit paths cannot both
  // insert a section. Cleared on close, where the section is torn down anyway.
  let recsInFlight: Promise<boolean> | null = null;

  // Show placeholders immediately, then swap in products when they arrive.
  // Resolves to true only when real products are on screen — that is what tells
  // the submit path to skip the auto-close and leave room to browse.
  async function renderRecommendations(email: string): Promise<boolean> {
    // Resolve the engine before showing anything. A tenant with no engine
    // configured must not flash placeholders that are then taken away.
    const engine = await resolveEngine(tenant, auth, recommendationsProfile);
    if (!engine) return false;
    // The shopper may have closed the popup during that request.
    if (!overlayEl!.classList.contains('is-open')) return false;

    const section = createRecommendationsSkeleton(recommendationsCount);
    cardEl!.appendChild(section);

    const products = await fetchRecommendations(engine, {
      email,
      tenant,
      auth,
      count: recommendationsCount,
      productId: activeProduct ? String(activeProduct.id) : null,
    });

    // Closed (and torn down) while the request was in flight.
    if (!section.isConnected) return false;

    if (!products.length) {
      removeRecommendationsSection();
      return false;
    }

    fillRecommendationsSection(section, products, currency);
    return true;
  }

  function showRecommendations(email: string): Promise<boolean> {
    if (!recommendationsEnabled || !cardEl) return Promise.resolve(false);
    if (recsInFlight) return recsInFlight;
    // Already rendered by the on-open path — nothing to do.
    if (document.getElementById(RECS_SECTION_ID)) return Promise.resolve(true);

    const request = renderRecommendations(email);
    recsInFlight = request;
    return request.then(
      (shown) => {
        if (recsInFlight === request) recsInFlight = null;
        return shown;
      },
      (error) => {
        if (recsInFlight === request) recsInFlight = null;
        console.error('Error rendering recommendations:', error);
        return false;
      },
    );
  }

  // Open / close the popup.
  let lastFocused: HTMLElement | null = null;
  // Bumped on every open and close. Async work started during one open (a
  // submit, its auto-close) compares it after each await and drops its UI
  // updates once the shopper has closed or moved on to another product.
  let openGeneration = 0;

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') closePopup();
  }

  function openPopup(): void {
    // Reopening while already open (a second trigger fired programmatically)
    // must not replace the element focus returns to with one inside the dialog.
    if (!overlayEl!.classList.contains('is-open')) {
      lastFocused = document.activeElement as HTMLElement | null;
    }
    overlayEl!.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown);
  }

  function closePopup(): void {
    openGeneration++;
    overlayEl!.classList.remove('is-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    clearStatus();
    removeRecommendationsSection();
    // Any in-flight render now targets a detached node and will bail out.
    recsInFlight = null;
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  function renderSizeOptions(variants: Variant[], selectedId: string | null): void {
    sizeSelect!.innerHTML = `<option value="" disabled selected>${escapeHtml(
      copy.sizePlaceholder,
    )}</option>`;
    variants.forEach((variant) => {
      const option = document.createElement('option');
      option.value = String(variant.id);
      option.textContent = variant.title;
      sizeSelect!.appendChild(option);
    });
    if (selectedId) sizeSelect!.value = selectedId;
  }

  function refreshSummary(): void {
    if (!summaryEl || !activeProduct) return;
    const selected =
      activeVariants.find((variant) => String(variant.id) === sizeSelect!.value) || null;
    updateSummary(summaryEl, activeProduct, selected, activeVariants);
  }

  function showPopup(trigger: HTMLElement | null): void {
    // Opening again while open (another card) starts from a clean slate,
    // including a submit button left on "Sending…" by an earlier open.
    openGeneration++;
    submitBtn!.disabled = false;
    submitBtn!.textContent = copy.submit;
    clearStatus();
    clearNotice();
    removeRecommendationsSection();
    recsInFlight = null;
    openPopup();

    const resolved = resolveProduct(trigger);
    if (!resolved.ok) {
      activeProduct = null;
      activeVariants = [];
      popupTitle!.textContent = '';
      popupText!.textContent = fillProduct(copy.intro, '');
      showNotice('error', 'Product information is unavailable. Please refresh the page.');
      return;
    }

    activeProduct = resolved.product;
    activeVariants = listedVariants(activeProduct);
    popupTitle!.textContent = fillProduct(copy.title, activeProduct.title);
    popupText!.textContent = fillProduct(copy.intro, activeProduct.title);

    if (!activeVariants.length) {
      showNotice('info', 'All sizes are currently in stock.');
      return;
    }

    const triggerVariantId = trigger ? trigger.getAttribute('data-variant-id') : null;
    const candidates =
      resolved.source === 'page'
        ? [triggerVariantId, ...readPageVariantIds()]
        : [triggerVariantId];
    renderSizeOptions(activeVariants, pickPreselectedVariant(activeVariants, candidates));
    refreshSummary();

    // Logged-in customers (or a data-customer-email override) get the section
    // straight away. Deliberately not awaited — the modal opens immediately and
    // the section appears when the request resolves.
    if (customerEmail) {
      void showRecommendations(customerEmail);
    }

    const firstControl = form!.querySelector<HTMLElement>('select, input');
    if (firstControl) firstControl.focus();
  }

  popupClose.addEventListener('click', closePopup);
  sizeSelect.addEventListener('change', refreshSummary);
  // Close when clicking the backdrop (but not the card).
  overlayEl.addEventListener('click', (event) => {
    if (event.target === overlayEl) closePopup();
  });

  // Form submission handler.
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const selectedVariant = activeVariants.find(
      (variant) => String(variant.id) === sizeSelect.value,
    );
    if (!selectedVariant) {
      setStatus('error', 'Please select a size.');
      return;
    }

    const formData: Record<string, unknown> = {
      variantRef: selectedVariant.id,
      email: getValue("input[name='email']"),
      subscribe: isChecked("input[name='mailList']"),
      subscribeSms: isChecked("input[name='mailListSms']"),
    };

    if (type === 'coming-soon') {
      formData.comingSoon = true;
    } else {
      formData.notifyMe = true;
    }
    if (fields.includes('firstName')) {
      formData.firstName = getValue("input[name='firstName']");
    }
    if (fields.includes('lastName')) {
      formData.lastName = getValue("input[name='lastName']");
    }
    if (fields.includes('mobile')) {
      formData.mobile = getValue("input[name='mobile']");
    }

    // Country / province / market — a shown, non-empty form field beats the
    // resolved context.
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
    if (localization.marketHandle) {
      formData.marketHandle = localization.marketHandle;
    }

    clearStatus();
    const generation = openGeneration;
    const originalButtonText = submitBtn.textContent || '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    let result: SubmitResult = { ok: false, reason: 'error' };
    try {
      result = await submitCustomerInterest(formData, auth, tenant);
    } finally {
      // Restore the button before any recommendations request, so it is not
      // stuck on "Sending…" while that resolves. A later open has already
      // reset it, so leave it alone then.
      if (generation === openGeneration) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalButtonText;
      }
    }

    // The shopper closed the popup or opened another product meanwhile; this
    // result belongs to a product no longer on screen.
    if (generation !== openGeneration) return;

    if (result.ok) {
      setStatus('success', copy.success);

      // Guests have no email until now — use the one they just submitted.
      const email = customerEmail || getValue("input[name='email']");
      const showingRecs = email ? await showRecommendations(email) : false;

      // Leave the modal open when there is something to browse; otherwise keep
      // the original auto-close — unless the shopper has moved on by then.
      if (!showingRecs && generation === openGeneration) {
        setTimeout(() => {
          if (generation === openGeneration) closePopup();
        }, 1500);
      }
    } else if (result.reason === 'auth') {
      // In proxy mode a missing token means the shopper is not logged in, which
      // they can act on. In token mode it means the install has no token
      // configured — a setup problem, so don't send the shopper to a login page.
      setStatus(
        'error',
        auth.mode === 'proxy'
          ? 'Please log in to your account to continue.'
          : 'Something went wrong. Please try again.',
      );
    } else {
      setStatus('error', 'Something went wrong. Please try again.');
    }
  });

  return { open: showPopup };
}
