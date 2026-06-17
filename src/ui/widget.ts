import type { WidgetConfig, Product, CountryContext } from '../types';
import { COUNTRY_CODES } from '../data/country-codes';
import { submitCustomerInterest } from '../api/customer-interest';

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
  const { fields, type, authMode, tenant, marketId } = config;

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

    try {
      const result = await submitCustomerInterest(formData, authMode, tenant);
      if (result.ok) {
        setStatus('success', "You're on the list. We'll be in touch.");
        setTimeout(closePopup, 1500);
      } else if (result.reason === 'auth') {
        setStatus('error', 'Please log in to your account to continue.');
      } else {
        setStatus('error', 'Something went wrong. Please try again.');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalButtonText;
    }
  });
}
