// Access token for the API
const ACCESS_TOKEN =
  'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJRWlJkS3JabXJmMEk3WkhXRUtqNWRLTEhQanFubWJFeV9iNmpSbHdya1drIn0.eyJleHAiOjE3MjMwMzI3NzIsImlhdCI6MTcyMzAyOTE3MiwianRpIjoiNDJiNGYwM2QtMDNiNS00NmZlLTk5YmItZDQ2NTdhNjk5NGNiIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmF1LWF3cy50aGV3aXNobGlzdC5pby9hdXRoL3JlYWxtcy90d2NNYWluIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjI2YTIyNTAyLWRhNzQtNDhkMC1iZWFiLTgzY2E0YTlmMDdlOSIsInR5cCI6IkJlYXJlciIsImF6cCI6InR3Yy1wb3MtY2xpZW50Iiwic2Vzc2lvbl9zdGF0ZSI6IjQxYWQwMDc4LWVmYTItNGVjMi1hM2I2LTIzYjBkNDM3YjEzOCIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiaHR0cHM6Ly9sb2NhbGhvc3QiXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbInR3Yy1wb3MtdXNlciIsIm9mZmxpbmVfYWNjZXNzIiwidHdjLXN0b3JlLW93bmVyIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6InRlbmFudGlkIHN0b3JlIHByb2ZpbGUgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsInRlbmFudGlkIjoidmlrdG9yaWEtd29vZHMiLCJuYW1lIjoiTWF0dCBIYW1wc2hpcmUiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJtYXR0QHRoZXdpc2hsaXN0LmlvIiwic3RvcmUiOiIyMDUiLCJnaXZlbl9uYW1lIjoiTWF0dCIsImZhbWlseV9uYW1lIjoiSGFtcHNoaXJlIiwiZW1haWwiOiJtYXR0QHRoZXdpc2hsaXN0LmlvIn0.iZkMgwH74njjXUWvImkJomHYr91Lr8ZGrZGwslEGcV3vbNuoNc5CocvNWW476o-LoSh-LsKf-MLiYN1XvOuPDF3fGoGCEbMh6_M0RJcrhVWogkj81fx4ukvDPCFIjgoDCV9WIuehV9dsSWa7E0irZeE6MUVhLwRIaTzKtxgzUUKrAqBtI_HKpyo8TUGQBiYlrc85QFUyuoKbKg-QaRn_SObRLDB8ooIBJvIlgklXQt1ZYBM2HUOc5L1bAQwfzcrWEvl6eYiQHXCSPqS0rPGoaGC6v5ydBo9VMxtVHGladDHLrO3Gt2BnIGMBoYrKTAmt7j0KABwPyB3CmAIwj_pOBQ'; // Replace `ACCESS_TOKEN` with your actual access token to authenticate API requests.
const TENANT_ID = 'victoria-woods'; // Replace `TENANT_ID` with your actual tenant ID.

const COUNTRY_CODES = [
  { code: 'AF', name: 'Afghanistan' }, { code: 'AX', name: 'Åland Islands' },
  { code: 'AL', name: 'Albania' }, { code: 'DZ', name: 'Algeria' },
  { code: 'AS', name: 'American Samoa' }, { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' }, { code: 'AI', name: 'Anguilla' },
  { code: 'AG', name: 'Antigua and Barbuda' }, { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' }, { code: 'AW', name: 'Aruba' },
  { code: 'AU', name: 'Australia' }, { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' }, { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' }, { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' }, { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' }, { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' }, { code: 'BM', name: 'Bermuda' },
  { code: 'BT', name: 'Bhutan' }, { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' }, { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' }, { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' }, { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' }, { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' }, { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' }, { code: 'KY', name: 'Cayman Islands' },
  { code: 'CF', name: 'Central African Republic' }, { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' }, { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' }, { code: 'CD', name: 'Congo, DR' },
  { code: 'CK', name: 'Cook Islands' }, { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croatia' }, { code: 'CU', name: 'Cuba' },
  { code: 'CW', name: 'Curaçao' }, { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' }, { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' }, { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' }, { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' }, { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' }, { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' }, { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' }, { code: 'FO', name: 'Faroe Islands' },
  { code: 'FJ', name: 'Fiji' }, { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' }, { code: 'GF', name: 'French Guiana' },
  { code: 'PF', name: 'French Polynesia' }, { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' }, { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' }, { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' }, { code: 'GR', name: 'Greece' },
  { code: 'GL', name: 'Greenland' }, { code: 'GD', name: 'Grenada' },
  { code: 'GP', name: 'Guadeloupe' }, { code: 'GU', name: 'Guam' },
  { code: 'GT', name: 'Guatemala' }, { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' }, { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' }, { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' }, { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' }, { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' }, { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' }, { code: 'IE', name: 'Ireland' },
  { code: 'IM', name: 'Isle of Man' }, { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' }, { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' }, { code: 'JE', name: 'Jersey' },
  { code: 'JO', name: 'Jordan' }, { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' }, { code: 'KI', name: 'Kiribati' },
  { code: 'KR', name: 'Korea, South' }, { code: 'XK', name: 'Kosovo' },
  { code: 'KW', name: 'Kuwait' }, { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' }, { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' }, { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' }, { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' }, { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' }, { code: 'MO', name: 'Macao' },
  { code: 'MG', name: 'Madagascar' }, { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' }, { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' }, { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' }, { code: 'MQ', name: 'Martinique' },
  { code: 'MR', name: 'Mauritania' }, { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' }, { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' }, { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' }, { code: 'ME', name: 'Montenegro' },
  { code: 'MS', name: 'Montserrat' }, { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' }, { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' }, { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' }, { code: 'NL', name: 'Netherlands' },
  { code: 'NC', name: 'New Caledonia' }, { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' }, { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' }, { code: 'NU', name: 'Niue' },
  { code: 'MK', name: 'North Macedonia' }, { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' }, { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' }, { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' }, { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' }, { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' }, { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' }, { code: 'PR', name: 'Puerto Rico' },
  { code: 'QA', name: 'Qatar' }, { code: 'RE', name: 'Réunion' },
  { code: 'RO', name: 'Romania' },
  { code: 'RW', name: 'Rwanda' }, { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' }, { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' }, { code: 'SM', name: 'San Marino' },
  { code: 'SA', name: 'Saudi Arabia' }, { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' }, { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' }, { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' }, { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' }, { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' }, { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' }, { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' }, { code: 'SR', name: 'Suriname' },
  { code: 'SE', name: 'Sweden' }, { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' }, { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' }, { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' }, { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' }, { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' }, { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' }, { code: 'TM', name: 'Turkmenistan' },
  { code: 'TC', name: 'Turks and Caicos Islands' }, { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' }, { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' }, { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' }, { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' }, { code: 'VN', name: 'Vietnam' },
  { code: 'VG', name: 'Virgin Islands, British' }, { code: 'VI', name: 'Virgin Islands, U.S.' },
  { code: 'YE', name: 'Yemen' }, { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

// Detect country/province/market context using priority fallback chain
function detectCountryContext() {
  const ctx = { countryCode: null, provinceCode: null, marketId: null };

  // Priority 1: Shopify localization/country context
  const shopify = window.Shopify;
  if (shopify) {
    if (typeof shopify.country === 'string') ctx.countryCode = shopify.country;
    const mkt = shopify.markets?.currentMarket;
    if (mkt) {
      if (mkt.countryCode) ctx.countryCode = mkt.countryCode;
      if (mkt.id != null) ctx.marketId = String(mkt.id);
    }
    if (!ctx.countryCode && typeof shopify.locale === 'string') {
      const parts = shopify.locale.split('-');
      if (parts.length > 1) ctx.countryCode = parts[parts.length - 1].toUpperCase();
    }
  }

  // Priority 2: Existing customer shipping country
  if (!ctx.countryCode || !ctx.provinceCode) {
    const addr = window.customer?.default_address;
    if (addr) {
      if (!ctx.countryCode && addr.country_code) ctx.countryCode = addr.country_code;
      if (!ctx.provinceCode && addr.province_code) ctx.provinceCode = addr.province_code;
    }
  }

  // Priority 3: Browser locale fallback
  if (!ctx.countryCode) {
    const parts = (navigator.language || '').split('-');
    if (parts.length > 1) ctx.countryCode = parts[parts.length - 1].toUpperCase();
  }

  return ctx;
}

document.addEventListener('DOMContentLoaded', function () {
  const wrapper = document.getElementById('notification-widget');
  if (!wrapper) return;

  // Define and apply styles for the popup and button
  const styles = `
        .notification-btn {
            background-color: #fff;
            border: 1px solid black;
            color: black;
            padding: 12px 24px;
            text-align: center;
            width: 100%;
            cursor: pointer;
            text-transform: uppercase;
        }
        #popup-body.overlay {
            position: fixed;
            z-index: 9998;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0, 0, 0, 0.7);
            transition: opacity 200ms;
            visibility: hidden;
            opacity: 0;
        }
        #popup-wrapper {
            margin: 70px auto;
            z-index: 9999;
            padding: 15px;
            background: #fff;
            border-radius: 5px;
            max-width: 360px;
            position: relative;
        }
        #popup-close {
            position: absolute;
            top: 5px;
            right: 15px;
            transition: all 200ms;
            font-size: 30px;
            font-weight: bold;
            text-decoration: none;
            color: #333;
            cursor: pointer;
        }
        #popup-close:hover {
            color: #d80606;
        }
        #popup-title {
            margin: 0;
            font-size: 20px;
            max-width: 350px;
            text-transform: uppercase;
        }
        #popup-text {
            margin: 10px 0;
            font-size: 14px;
        }
        #popup-form {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        #popup-form input {
            padding: 0.475em 1em;
            border: 1px solid #caced1;
            border-radius: 0.25rem;
            font-size: 1.15rem;
            max-width: 100%;
        }
        #popup-form input::placeholder {
            font-size: 1rem;
        }
        #popup-form button {
            font-size: 0.85rem;
            padding: 0.975em 1em;
            font-weight: 600;
            border: none;
            text-transform: uppercase;
            background: #aca475;
            color: #fff;
            cursor: pointer;
        }
      .checkbox-item {
         display: flex;
         align-items: center;
         gap: 8px;
      }
      .checkbox-item input[type="checkbox"] {
         width: auto;
         margin: 0;
      }
        .custom-select {
            position: relative;
        }
        .custom-select select {
            appearance: none;
            width: 100%;
            font-size: 1.15rem;
            padding: 0.475em 1em;
            background-color: #fff;
            border: 1px solid #caced1;
            border-radius: 0.25rem;
            color: #000;
            cursor: pointer;
        }
        .custom-select::before,
        .custom-select::after {
            --size: 0.3rem;
            content: "";
            position: absolute;
            right: 1rem;
            pointer-events: none;
        }
        .custom-select::before {
            border-left: var(--size) solid transparent;
            border-right: var(--size) solid transparent;
            border-bottom: var(--size) solid black;
            top: 40%;
        }
        .custom-select::after {
            border-left: var(--size) solid transparent;
            border-right: var(--size) solid transparent;
            border-top: var(--size) solid black;
            top: 55%;
        }
    `;

  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  // Create and append the overlay for the popup
  const overlay = document.createElement('div');
  overlay.innerHTML = `
        <div id="popup-body" class="overlay">
            <div id="popup-wrapper">
                <h3 id="popup-title"></h3>
                <span id="popup-close">&times;</span>
                <div id="popup-text"></div>
                <form id="popup-form">
                    <div class="custom-select">
                        <select name="select-size" required>
                        </select>
                    </div>
                    <input name="email" placeholder="Email" type="email" required />
                </form>
            </div>
        </div>
    `;

  wrapper.appendChild(overlay);

  const popupBody = document.getElementById('popup-body');
  const popupClose = document.getElementById('popup-close');
  const popupOpenButton = document.getElementById('popup-open');
  const popupTitle = document.getElementById('popup-title');
  const popupText = document.getElementById('popup-text');
  const sizeSelect = document.querySelector("select[name='select-size']");
  const form = overlay.querySelector('#popup-form');

  if (
    !popupBody ||
    !popupClose ||
    !popupOpenButton ||
    !popupTitle ||
    !sizeSelect
  )
    return;

  // Parse fields and type to be included in the form from data attribute
  const fields = JSON.parse(
    popupOpenButton.getAttribute('data-fields') || '["email"]',
  );
  const type = popupOpenButton.getAttribute('data-type') || 'notify-me';
  const typeConfig = {
    'notify-me': {
      text: 'Register to receive a notification as soon as this item is back in stock',
      buttonText: 'Notify me',
    },
    'coming-soon': {
      text: 'Register your interest to hear more about this item',
      buttonText: 'Register Interest',
    },
  };

  // Get product data from Shopify's global variable
  const productData = window?.currentProduct;

  const countryCtx = detectCountryContext();
  const resolvedMarketId =
    popupOpenButton.getAttribute('data-market-id') || countryCtx.marketId;

  // Map for form fields
  popupText.innerText = typeConfig[type].text;

  const countryOptions = COUNTRY_CODES.map(
    (c) =>
      `<option value="${c.code}"${c.code === countryCtx.countryCode ? ' selected' : ''}>${c.name}</option>`,
  ).join('');

  const fieldMap = {
    email: `<input name="email" placeholder="Email" type="email" required />`,
    mobile: `<input name="mobile" placeholder="Mobile" type="tel" required />`,
    firstName: `<input name="firstName" placeholder="First name" type="text" required />`,
    lastName: `<input name="lastName" placeholder="Last name" type="text" required />`,
    countryCode: `<div class="custom-select"><select name="countryCode"><option value="">Select country</option>${countryOptions}</select></div>`,
    provinceCode: `<input name="provinceCode" placeholder="State / Province code" type="text" value="${countryCtx.provinceCode || ''}" />`,
  };

  // Add fields to the form based on the parsed fields
  fields.forEach((field) => {
    if (fieldMap[field]) {
      form.insertAdjacentHTML('beforeend', fieldMap[field]);
    }
  });

  form.insertAdjacentHTML('beforeend', `<div id="checkbox-wrapper"></div>`);
  const checkboxWrapper = document.getElementById('checkbox-wrapper');
  checkboxWrapper.insertAdjacentHTML(
    'beforeend',
    `<div class="checkbox-item"><input type="checkbox" name="mailList" id="mailList" /><label for="mailList">Subscribe to our mailing list</label></div>`,
  );
  checkboxWrapper.insertAdjacentHTML(
    'beforeend',
    `<div class="checkbox-item"><input type="checkbox" name="mailListSms" id="mailListSms" /><label for="mailListSms">Subscribe to our mailing list via SMS</label></div>`,
  );
  form.insertAdjacentHTML(
    'beforeend',
    `<button type="submit">${typeConfig[type].buttonText}</button>`,
  );

  // Show/hide the popup
  function showPopup() {
    if (!productData) {
      alert('Product data not found');
      return;
    }
    // Set the popup title and populate the size dropdown
    popupTitle.innerHTML = productData.title;
    productData.variants.forEach((variant) => {
      const option = document.createElement('option');
      option.value = variant.title;
      option.textContent = variant.title;
      sizeSelect.appendChild(option);
    });
    popupBody.style.visibility = 'visible';
    popupBody.style.opacity = 1;
  }

  function hidePopup() {
    popupBody.style.visibility = 'hidden';
    popupBody.style.opacity = 0;
  }

  popupOpenButton.addEventListener('click', showPopup);
  popupClose.addEventListener('click', hidePopup);

  // Form submission handler
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      const selectedSize = sizeSelect.value;
      const selectedVariant = productData.variants.find(
        (variant) => variant.title === selectedSize,
      );

      if (selectedVariant) {
        const formData = {
          variantRef: selectedVariant.id,
          email: form.querySelector("input[name='email']").value,
          subscribe: form.querySelector("input[name='mailList']").checked,
          subscribeSms: form.querySelector("input[name='mailListSms']").checked,
        };

        if (type === 'coming-soon') {
          formData.comingSoon = true;
          // formData.productRef = productData.id;
        } else {
          formData.notifyMe = true;
        }
        if (fields.includes('firstName')) {
          formData.firstName = form.querySelector(
            "input[name='firstName']",
          ).value;
        }
        if (fields.includes('lastName')) {
          formData.lastName = form.querySelector(
            "input[name='lastName']",
          ).value;
        }
        if (fields.includes('mobile')) {
          formData.mobile = form.querySelector("input[name='mobile']").value;
          // formData.phone = form.querySelector("input[name='mobile']").value;
        }

        // Country / province / market — manual fields take precedence over auto-detected values
        if (fields.includes('countryCode')) {
          const selected = form.querySelector("select[name='countryCode']").value;
          if (selected) formData.countryCode = selected;
        } else if (countryCtx.countryCode) {
          formData.countryCode = countryCtx.countryCode;
        }

        if (fields.includes('provinceCode')) {
          const val = form.querySelector("input[name='provinceCode']").value;
          if (val) formData.provinceCode = val;
        } else if (countryCtx.provinceCode) {
          formData.provinceCode = countryCtx.provinceCode;
        }

        if (resolvedMarketId) formData.marketId = resolvedMarketId;

        let url = `https://api.au-sandbox.thewishlist.io/services/wsservice/api/wishlist/items/customerInterest`;

        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: ACCESS_TOKEN,
            'X-Twc-Tenant': TENANT_ID,
          },
          body: JSON.stringify(formData),
        })
          .then((response) => {
            if (response.ok) {
              alert('Form submitted');
              hidePopup();
            } else {
              alert('Form submission failed');
            }
          })
          .catch((error) => {
            console.error('Error submitting form:', error);
            alert('Form submission failed');
          });
      } else {
        alert('Selected variant not found');
      }
    });
  }
});
