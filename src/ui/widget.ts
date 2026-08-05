import type { WidgetConfig, Product, CountryContext } from '../types';
import { COUNTRY_CODES } from '../data/country-codes';
import {
  submitCustomerInterest,
  type SubmitResult,
} from '../api/customer-interest';
import { fetchRecommendations } from '../api/recommendations';
import {
  createRecommendationsSkeleton,
  fillRecommendationsSection,
  removeRecommendationsSection,
  RECS_SECTION_ID,
} from './recommendations';

interface TypeCopy {
  text: string;
  buttonText: string;
}

const TYPE_CONFIG: Record<WidgetConfig['type'], TypeCopy> = {
  'notify-me': {
    text: 'Register to receive a notification as soon as this item is back in stock',
    buttonText: 'Notify Me',
  },
  'coming-soon': {
    text: 'Register your interest to hear more about this item',
    buttonText: 'Register Interest',
  },
};

export function createWidget(params: {
  wrapper: HTMLElement;
  openButton: HTMLElement;
  config: WidgetConfig;
  productData: Product | undefined;
  countryCtx: CountryContext;
}): void {
  const { wrapper, openButton, config, productData, countryCtx } = params;
  const {
    fields,
    type,
    authMode,
    tenant,
    proxyApp,
    marketId,
    recommendationsEnabled,
    recommendationsCount,
    currency,
    customerEmail,
  } = config;

  // Create and append the overlay for the popup.
  const overlay = document.createElement('div');
  overlay.innerHTML = `
        <div id="twc-nm-overlay" role="dialog" aria-modal="true" aria-labelledby="popup-title">
            <div class="twc-nm-card">
                <button type="button" id="popup-close" class="twc-nm-close" aria-label="Close">&times;</button>
                <h2 id="popup-title" class="twc-nm-title"></h2>
                <p id="popup-text" class="twc-nm-text"></p>
                <form id="popup-form" class="twc-nm-form">
                    <div class="twc-nm-field">
                        <label class="twc-nm-label" for="twc-nm-size">Size</label>
                        <select class="twc-nm-select" id="twc-nm-size" name="select-size" required>
                            <option value="" disabled selected>Select a size</option>
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

  if (!overlayEl || !popupClose || !popupTitle || !popupText || !sizeSelect || !form) {
    return;
  }

  // Map for form fields.
  popupText.innerText = TYPE_CONFIG[type].text;

  const countryOptions = COUNTRY_CODES.map(
    (c) =>
      `<option value="${c.code}"${
        c.code === countryCtx.countryCode ? ' selected' : ''
      }>${c.name}</option>`,
  ).join('');

  // Wrap an input/select in a labeled field row.
  const field = (id: string, label: string, control: string): string =>
    `<div class="twc-nm-field"><label class="twc-nm-label" for="${id}">${label}</label>${control}</div>`;

  const fieldMap: Record<string, string> = {
    email: field(
      'twc-nm-email',
      'Email',
      `<input class="twc-nm-input" id="twc-nm-email" name="email" type="email" placeholder="you@example.com" required />`,
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
        countryCtx.provinceCode || ''
      }" />`,
    ),
  };

  // Add fields to the form based on the parsed fields.
  fields.forEach((name) => {
    if (fieldMap[name]) {
      form.insertAdjacentHTML('beforeend', fieldMap[name]);
    }
  });

  form.insertAdjacentHTML(
    'beforeend',
    `<div class="twc-nm-checks">
        <label class="twc-nm-check"><input type="checkbox" name="mailList" /> Email me store updates</label>
        <label class="twc-nm-check"><input type="checkbox" name="mailListSms" /> Text me store updates</label>
    </div>`,
  );
  form.insertAdjacentHTML(
    'beforeend',
    `<div id="popup-status" class="twc-nm-status" role="status" aria-live="polite" hidden></div>`,
  );
  form.insertAdjacentHTML(
    'beforeend',
    `<button type="submit" class="twc-nm-submit">${TYPE_CONFIG[type].buttonText}</button>`,
  );

  const popupStatus = document.getElementById('popup-status');
  const submitBtn = form.querySelector<HTMLButtonElement>('.twc-nm-submit');
  if (!popupStatus || !submitBtn) return;

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

  // Tracks an in-flight render so the on-open and post-submit paths cannot both
  // insert a section. Cleared on close, where the section is torn down anyway.
  let recsInFlight: Promise<boolean> | null = null;

  // Show placeholders immediately, then swap in products when they arrive.
  // Resolves to true only when real products are on screen — that is what tells
  // the submit path to skip the auto-close and leave room to browse.
  async function renderRecommendations(email: string): Promise<boolean> {
    const section = createRecommendationsSkeleton(recommendationsCount);
    cardEl!.appendChild(section);

    const products = await fetchRecommendations({
      email,
      tenant,
      authMode,
      proxyApp,
      count: recommendationsCount,
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
  let variantsPopulated = false;
  let lastFocused: HTMLElement | null = null;

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') closePopup();
  }

  function openPopup(): void {
    lastFocused = document.activeElement as HTMLElement | null;
    overlayEl!.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown);
  }

  function closePopup(): void {
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

  function showPopup(): void {
    openPopup();

    if (!productData) {
      form!.hidden = true;
      setStatus('error', 'Product information is unavailable. Please refresh the page.');
      return;
    }

    popupTitle!.textContent = productData.title;

    if (!variantsPopulated) {
      (productData.variants || []).forEach((variant) => {
        const option = document.createElement('option');
        option.value = variant.title;
        option.textContent = variant.title;
        sizeSelect!.appendChild(option);
      });
      variantsPopulated = true;
    }

    // Logged-in customers (or a data-customer-email override) get the section
    // straight away. Deliberately not awaited — the modal opens immediately and
    // the section appears when the request resolves.
    if (customerEmail) {
      void showRecommendations(customerEmail);
    }

    const firstControl = form!.querySelector<HTMLElement>('select, input');
    if (firstControl) firstControl.focus();
  }

  openButton.addEventListener('click', showPopup);
  popupClose.addEventListener('click', closePopup);
  // Close when clicking the backdrop (but not the card).
  overlayEl.addEventListener('click', (event) => {
    if (event.target === overlayEl) closePopup();
  });

  // Form submission handler.
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const selectedVariant = (productData?.variants || []).find(
      (variant) => variant.title === sizeSelect.value,
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

    // Country / province / market — manual fields take precedence over auto-detected values.
    if (fields.includes('countryCode')) {
      const selected = getValue("select[name='countryCode']");
      if (selected) formData.countryCode = selected;
    } else if (countryCtx.countryCode) {
      formData.countryCode = countryCtx.countryCode;
    }

    if (fields.includes('provinceCode')) {
      const val = getValue("input[name='provinceCode']");
      if (val) formData.provinceCode = val;
    } else if (countryCtx.provinceCode) {
      formData.provinceCode = countryCtx.provinceCode;
    }

    if (marketId) formData.marketId = marketId;

    clearStatus();
    const originalButtonText = submitBtn.textContent || '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    let result: SubmitResult = { ok: false, reason: 'error' };
    try {
      result = await submitCustomerInterest(
        formData,
        authMode,
        tenant,
        proxyApp,
      );
    } finally {
      // Restore the button before any recommendations request, so it is not
      // stuck on "Sending…" while that resolves.
      submitBtn.disabled = false;
      submitBtn.textContent = originalButtonText;
    }

    if (result.ok) {
      setStatus('success', "You're on the list. We'll be in touch.");

      // Guests have no email until now — use the one they just submitted.
      const email = customerEmail || getValue("input[name='email']");
      const showingRecs = email ? await showRecommendations(email) : false;

      // Leave the modal open when there is something to browse; otherwise keep
      // the original auto-close.
      if (!showingRecs) setTimeout(closePopup, 1500);
    } else if (result.reason === 'auth') {
      setStatus('error', 'Please log in to your account to continue.');
    } else {
      setStatus('error', 'Something went wrong. Please try again.');
    }
  });
}
