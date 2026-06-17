(function () {
    'use strict';

    const STYLES = `
        .notification-btn {
            display: inline-block;
            width: 100%;
            padding: 12px 24px;
            background: #fff;
            border: 1px solid #111827;
            border-radius: 8px;
            color: #111827;
            font: inherit;
            text-align: center;
            text-transform: uppercase;
            cursor: pointer;
        }
        .notification-btn:hover {
            background: #111827;
            color: #fff;
        }
        #twc-nm-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(17, 17, 17, 0.55);
            opacity: 0;
            visibility: hidden;
            transition: opacity 200ms ease;
        }
        #twc-nm-overlay.is-open {
            opacity: 1;
            visibility: visible;
        }
        #twc-nm-overlay * {
            box-sizing: border-box;
        }
        #twc-nm-overlay .twc-nm-card {
            position: relative;
            width: 100%;
            max-width: 400px;
            max-height: calc(100vh - 32px);
            overflow-y: auto;
            padding: 24px;
            background: #fff;
            color: #111827;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
            font: inherit;
            transform: translateY(8px);
            transition: transform 200ms ease;
        }
        #twc-nm-overlay.is-open .twc-nm-card {
            transform: translateY(0);
        }
        #twc-nm-overlay .twc-nm-close {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            border: none;
            background: transparent;
            border-radius: 6px;
            font-size: 24px;
            line-height: 1;
            color: #6b7280;
            cursor: pointer;
        }
        #twc-nm-overlay .twc-nm-close:hover {
            background: #f3f4f6;
            color: #111827;
        }
        #twc-nm-overlay .twc-nm-title {
            margin: 0 32px 4px 0;
            font-size: 18px;
            font-weight: 600;
        }
        #twc-nm-overlay .twc-nm-text {
            margin: 0 0 16px;
            font-size: 14px;
            line-height: 1.5;
            color: #6b7280;
        }
        #twc-nm-overlay .twc-nm-form {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        #twc-nm-overlay .twc-nm-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        #twc-nm-overlay .twc-nm-label {
            font-size: 13px;
            font-weight: 500;
            color: #374151;
        }
        #twc-nm-overlay .twc-nm-input,
        #twc-nm-overlay .twc-nm-select {
            width: 100%;
            padding: 10px 12px;
            font-size: 14px;
            font-family: inherit;
            color: #111827;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
        }
        #twc-nm-overlay .twc-nm-input:focus,
        #twc-nm-overlay .twc-nm-select:focus {
            outline: none;
            border-color: #111827;
            box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
        }
        #twc-nm-overlay .twc-nm-select {
            appearance: none;
            -webkit-appearance: none;
            padding-right: 36px;
            cursor: pointer;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
        }
        #twc-nm-overlay .twc-nm-checks {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        #twc-nm-overlay .twc-nm-check {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #374151;
            cursor: pointer;
        }
        #twc-nm-overlay .twc-nm-check input {
            width: 16px;
            height: 16px;
            margin: 0;
            accent-color: #111827;
        }
        #twc-nm-overlay .twc-nm-status {
            font-size: 13px;
            line-height: 1.5;
            padding: 10px 12px;
            border-radius: 8px;
        }
        #twc-nm-overlay .twc-nm-status--error {
            color: #b91c1c;
            background: #fef2f2;
        }
        #twc-nm-overlay .twc-nm-status--success {
            color: #15803d;
            background: #f0fdf4;
        }
        #twc-nm-overlay .twc-nm-submit {
            width: 100%;
            padding: 12px 16px;
            font-size: 14px;
            font-weight: 600;
            font-family: inherit;
            color: #fff;
            background: #111827;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: background 150ms ease;
        }
        #twc-nm-overlay .twc-nm-submit:hover {
            background: #374151;
        }
        #twc-nm-overlay .twc-nm-submit:disabled {
            opacity: 0.6;
            cursor: default;
        }
        @media (prefers-reduced-motion: reduce) {
            #twc-nm-overlay,
            #twc-nm-overlay .twc-nm-card {
                transition: none;
            }
            #twc-nm-overlay .twc-nm-card {
                transform: none;
            }
        }
    `;
    // Inject the widget styles once. All rules are namespaced under #twc-nm-overlay
    // (plus .notification-btn) so they don't collide with the host store theme.
    function injectStyles() {
        const styleSheet = document.createElement('style');
        styleSheet.type = 'text/css';
        styleSheet.innerText = STYLES;
        document.head.appendChild(styleSheet);
    }

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

    // Bundled server-issued access token (used by the default 'token' auth mode).
    // NOTE: relocated verbatim from the original index.js — unchanged by this restructure.
    const ACCESS_TOKEN = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJRWlJkS3JabXJmMEk3WkhXRUtqNWRLTEhQanFubWJFeV9iNmpSbHdya1drIn0.eyJleHAiOjE3MjMwMzI3NzIsImlhdCI6MTcyMzAyOTE3MiwianRpIjoiNDJiNGYwM2QtMDNiNS00NmZlLTk5YmItZDQ2NTdhNjk5NGNiIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmF1LWF3cy50aGV3aXNobGlzdC5pby9hdXRoL3JlYWxtcy90d2NNYWluIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjI2YTIyNTAyLWRhNzQtNDhkMC1iZWFiLTgzY2E0YTlmMDdlOSIsInR5cCI6IkJlYXJlciIsImF6cCI6InR3Yy1wb3MtY2xpZW50Iiwic2Vzc2lvbl9zdGF0ZSI6IjQxYWQwMDc4LWVmYTItNGVjMi1hM2I2LTIzYjBkNDM3YjEzOCIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiaHR0cHM6Ly9sb2NhbGhvc3QiXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbInR3Yy1wb3MtdXNlciIsIm9mZmxpbmVfYWNjZXNzIiwidHdjLXN0b3JlLW93bmVyIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6InRlbmFudGlkIHN0b3JlIHByb2ZpbGUgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsInRlbmFudGlkIjoidmlrdG9yaWEtd29vZHMiLCJuYW1lIjoiTWF0dCBIYW1wc2hpcmUiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJtYXR0QHRoZXdpc2hsaXN0LmlvIiwic3RvcmUiOiIyMDUiLCJnaXZlbl9uYW1lIjoiTWF0dCIsImZhbWlseV9uYW1lIjoiSGFtcHNoaXJlIiwiZW1haWwiOiJtYXR0QHRoZXdpc2hsaXN0LmlvIn0.iZkMgwH74njjXUWvImkJomHYr91Lr8ZGrZGwslEGcV3vbNuoNc5CocvNWW476o-LoSh-LsKf-MLiYN1XvOuPDF3fGoGCEbMh6_M0RJcrhVWogkj81fx4ukvDPCFIjgoDCV9WIuehV9dsSWa7E0irZeE6MUVhLwRIaTzKtxgzUUKrAqBtI_HKpyo8TUGQBiYlrc85QFUyuoKbKg-QaRn_SObRLDB8ooIBJvIlgklXQt1ZYBM2HUOc5L1bAQwfzcrWEvl6eYiQHXCSPqS0rPGoaGC6v5ydBo9VMxtVHGladDHLrO3Gt2BnIGMBoYrKTAmt7j0KABwPyB3CmAIwj_pOBQ';
    // Default tenant for the X-Twc-Tenant header; used in both auth modes.
    const TENANT_ID = 'victoria-woods';
    // Customer-interest API endpoint (sandbox).
    const CUSTOMER_INTEREST_URL = 'https://api.au-sandbox.thewishlist.io/services/wsservice/api/wishlist/items/customerInterest';

    // Session-cached access token obtained from the Shopify App Proxy (proxy auth mode).
    let cachedProxyToken = null;
    // Fetch a tenant-scoped access token from the Shopify App Proxy.
    // The path is relative/same-origin, so Shopify's App Proxy layer appends and
    // signs `shop`, `logged_in_customer_id`, `timestamp`, and `signature`.
    // Returns the access token string, or null on failure (e.g. customer not logged in).
    async function getProxyAccessToken() {
        if (cachedProxyToken)
            return cachedProxyToken;
        try {
            const response = await fetch('/apps/twc-sdk/auth/token', {
                method: 'GET',
                headers: { Accept: 'application/json' },
            });
            const body = await response.json().catch(() => null);
            if (response.ok &&
                body &&
                body.success &&
                body.data &&
                body.data.access_token) {
                cachedProxyToken = body.data.access_token;
                return cachedProxyToken;
            }
            return null;
        }
        catch (error) {
            console.error('Error fetching proxy access token:', error);
            return null;
        }
    }

    // Resolve the Authorization token for the configured auth mode, then POST the
    // customer-interest payload. 'auth' means a proxy token could not be obtained
    // (customer not logged in); 'error' means the request failed or returned non-OK.
    async function submitCustomerInterest(payload, authMode, tenant) {
        let authToken = ACCESS_TOKEN;
        if (authMode === 'proxy') {
            const proxyToken = await getProxyAccessToken();
            if (!proxyToken)
                return { ok: false, reason: 'auth' };
            authToken = `Bearer ${proxyToken}`;
        }
        try {
            const response = await fetch(CUSTOMER_INTEREST_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: authToken,
                    'X-Twc-Tenant': tenant,
                },
                body: JSON.stringify(payload),
            });
            return response.ok ? { ok: true } : { ok: false, reason: 'error' };
        }
        catch (error) {
            console.error('Error submitting form:', error);
            return { ok: false, reason: 'error' };
        }
    }

    const TYPE_CONFIG = {
        'notify-me': {
            text: 'Register to receive a notification as soon as this item is back in stock',
            buttonText: 'Notify Me',
        },
        'coming-soon': {
            text: 'Register your interest to hear more about this item',
            buttonText: 'Register Interest',
        },
    };
    function createWidget(params) {
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
        const sizeSelect = document.querySelector("select[name='select-size']");
        const form = document.getElementById('popup-form');
        if (!overlayEl || !popupClose || !popupTitle || !popupText || !sizeSelect || !form) {
            return;
        }
        // Map for form fields.
        popupText.innerText = TYPE_CONFIG[type].text;
        const countryOptions = COUNTRY_CODES.map((c) => `<option value="${c.code}"${c.code === countryCtx.countryCode ? ' selected' : ''}>${c.name}</option>`).join('');
        // Wrap an input/select in a labeled field row.
        const field = (id, label, control) => `<div class="twc-nm-field"><label class="twc-nm-label" for="${id}">${label}</label>${control}</div>`;
        const fieldMap = {
            email: field('twc-nm-email', 'Email', `<input class="twc-nm-input" id="twc-nm-email" name="email" type="email" placeholder="you@example.com" required />`),
            mobile: field('twc-nm-mobile', 'Mobile', `<input class="twc-nm-input" id="twc-nm-mobile" name="mobile" type="tel" placeholder="Mobile number" required />`),
            firstName: field('twc-nm-firstname', 'First name', `<input class="twc-nm-input" id="twc-nm-firstname" name="firstName" type="text" placeholder="First name" required />`),
            lastName: field('twc-nm-lastname', 'Last name', `<input class="twc-nm-input" id="twc-nm-lastname" name="lastName" type="text" placeholder="Last name" required />`),
            countryCode: field('twc-nm-country', 'Country', `<select class="twc-nm-select" id="twc-nm-country" name="countryCode"><option value="">Select country</option>${countryOptions}</select>`),
            provinceCode: field('twc-nm-province', 'State / Province', `<input class="twc-nm-input" id="twc-nm-province" name="provinceCode" type="text" placeholder="State / province code" value="${countryCtx.provinceCode || ''}" />`),
        };
        // Add fields to the form based on the parsed fields.
        fields.forEach((name) => {
            if (fieldMap[name]) {
                form.insertAdjacentHTML('beforeend', fieldMap[name]);
            }
        });
        form.insertAdjacentHTML('beforeend', `<div class="twc-nm-checks">
        <label class="twc-nm-check"><input type="checkbox" name="mailList" /> Email me store updates</label>
        <label class="twc-nm-check"><input type="checkbox" name="mailListSms" /> Text me store updates</label>
    </div>`);
        form.insertAdjacentHTML('beforeend', `<div id="popup-status" class="twc-nm-status" role="status" aria-live="polite" hidden></div>`);
        form.insertAdjacentHTML('beforeend', `<button type="submit" class="twc-nm-submit">${TYPE_CONFIG[type].buttonText}</button>`);
        const popupStatus = document.getElementById('popup-status');
        const submitBtn = form.querySelector('.twc-nm-submit');
        if (!popupStatus || !submitBtn)
            return;
        // Inline status messaging (replaces alert()).
        function setStatus(kind, message) {
            popupStatus.textContent = message;
            popupStatus.className = `twc-nm-status twc-nm-status--${kind}`;
            popupStatus.hidden = false;
        }
        function clearStatus() {
            popupStatus.hidden = true;
            popupStatus.textContent = '';
        }
        // Null-safe form readers (preserve normal-path behavior under strict mode).
        const getValue = (selector) => {
            const el = form.querySelector(selector);
            return el ? el.value : '';
        };
        const isChecked = (selector) => {
            const el = form.querySelector(selector);
            return el ? el.checked : false;
        };
        // Open / close the popup.
        let variantsPopulated = false;
        let lastFocused = null;
        function onKeydown(event) {
            if (event.key === 'Escape')
                closePopup();
        }
        function openPopup() {
            lastFocused = document.activeElement;
            overlayEl.classList.add('is-open');
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', onKeydown);
        }
        function closePopup() {
            overlayEl.classList.remove('is-open');
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onKeydown);
            clearStatus();
            if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus();
            }
        }
        function showPopup() {
            openPopup();
            if (!productData) {
                form.hidden = true;
                setStatus('error', 'Product information is unavailable. Please refresh the page.');
                return;
            }
            popupTitle.textContent = productData.title;
            if (!variantsPopulated) {
                (productData.variants || []).forEach((variant) => {
                    const option = document.createElement('option');
                    option.value = variant.title;
                    option.textContent = variant.title;
                    sizeSelect.appendChild(option);
                });
                variantsPopulated = true;
            }
            const firstControl = form.querySelector('select, input');
            if (firstControl)
                firstControl.focus();
        }
        openButton.addEventListener('click', showPopup);
        popupClose.addEventListener('click', closePopup);
        // Close when clicking the backdrop (but not the card).
        overlayEl.addEventListener('click', (event) => {
            if (event.target === overlayEl)
                closePopup();
        });
        // Form submission handler.
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const selectedVariant = ((productData === null || productData === void 0 ? void 0 : productData.variants) || []).find((variant) => variant.title === sizeSelect.value);
            if (!selectedVariant) {
                setStatus('error', 'Please select a size.');
                return;
            }
            const formData = {
                variantRef: selectedVariant.id,
                email: getValue("input[name='email']"),
                subscribe: isChecked("input[name='mailList']"),
                subscribeSms: isChecked("input[name='mailListSms']"),
            };
            if (type === 'coming-soon') {
                formData.comingSoon = true;
            }
            else {
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
                if (selected)
                    formData.countryCode = selected;
            }
            else if (countryCtx.countryCode) {
                formData.countryCode = countryCtx.countryCode;
            }
            if (fields.includes('provinceCode')) {
                const val = getValue("input[name='provinceCode']");
                if (val)
                    formData.provinceCode = val;
            }
            else if (countryCtx.provinceCode) {
                formData.provinceCode = countryCtx.provinceCode;
            }
            if (marketId)
                formData.marketId = marketId;
            clearStatus();
            const originalButtonText = submitBtn.textContent || '';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending…';
            try {
                const result = await submitCustomerInterest(formData, authMode, tenant);
                if (result.ok) {
                    setStatus('success', "You're on the list. We'll be in touch.");
                    setTimeout(closePopup, 1500);
                }
                else if (result.reason === 'auth') {
                    setStatus('error', 'Please log in to your account to continue.');
                }
                else {
                    setStatus('error', 'Something went wrong. Please try again.');
                }
            }
            finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalButtonText;
            }
        });
    }

    // Detect country/province/market context using priority fallback chain.
    function detectCountryContext() {
        var _a, _b;
        const ctx = {
            countryCode: null,
            provinceCode: null,
            marketId: null,
        };
        // Priority 1: Shopify localization/country context
        const shopify = window.Shopify;
        if (shopify) {
            if (typeof shopify.country === 'string')
                ctx.countryCode = shopify.country;
            const mkt = (_a = shopify.markets) === null || _a === void 0 ? void 0 : _a.currentMarket;
            if (mkt) {
                if (mkt.countryCode)
                    ctx.countryCode = mkt.countryCode;
                if (mkt.id != null)
                    ctx.marketId = String(mkt.id);
            }
            if (!ctx.countryCode && typeof shopify.locale === 'string') {
                const parts = shopify.locale.split('-');
                if (parts.length > 1)
                    ctx.countryCode = parts[parts.length - 1].toUpperCase();
            }
        }
        // Priority 2: Existing customer shipping country
        if (!ctx.countryCode || !ctx.provinceCode) {
            const addr = (_b = window.customer) === null || _b === void 0 ? void 0 : _b.default_address;
            if (addr) {
                if (!ctx.countryCode && addr.country_code)
                    ctx.countryCode = addr.country_code;
                if (!ctx.provinceCode && addr.province_code)
                    ctx.provinceCode = addr.province_code;
            }
        }
        // Priority 3: Browser locale fallback
        if (!ctx.countryCode) {
            const parts = (navigator.language || '').split('-');
            if (parts.length > 1)
                ctx.countryCode = parts[parts.length - 1].toUpperCase();
        }
        return ctx;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const wrapper = document.getElementById('notification-widget');
        if (!wrapper)
            return;
        const openButton = document.getElementById('popup-open');
        if (!openButton)
            return;
        injectStyles();
        // Parse configuration from the host button's data-* attributes.
        const fields = JSON.parse(openButton.getAttribute('data-fields') || '["email"]');
        const type = (openButton.getAttribute('data-type') || 'notify-me');
        // Auth mode: 'token' (default, bundled ACCESS_TOKEN) or 'proxy' (Shopify App Proxy).
        const authMode = (openButton.getAttribute('data-auth') || 'token');
        // Tenant for X-Twc-Tenant header; used in both auth modes.
        const tenant = openButton.getAttribute('data-tenant') || TENANT_ID;
        const countryCtx = detectCountryContext();
        const marketId = openButton.getAttribute('data-market-id') || countryCtx.marketId;
        const config = { fields, type, authMode, tenant, marketId };
        const productData = window.currentProduct;
        createWidget({ wrapper, openButton, config, productData, countryCtx });
    });

})();
