import type { Product } from './types';

declare global {
  interface Window {
    Shopify?: {
      country?: string;
      locale?: string;
      currency?: {
        active?: string;
      };
      markets?: {
        currentMarket?: {
          countryCode?: string;
          id?: string | number;
        };
      };
    };
    customer?: {
      // Not provided by Shopify by default — the merchant's theme must expose it,
      // e.g. `window.customer = {{ customer | json }}` in a Liquid template.
      email?: string;
      default_address?: {
        country_code?: string;
        province_code?: string;
      };
    };
    currentProduct?: Product;
    // Some themes expose the logged-in shopper's address as a bare global
    // instead of `window.customer`. It is commonly written as
    // `{{ customer.email | json }} || false`, so it is boolean false for guests.
    customerEmail?: string | boolean;
    // Optional access token for the 'token' auth mode, set by the merchant's
    // theme. `data-access-token` on the open button takes precedence.
    TWC_ACCESS_TOKEN?: string;
  }
}

export {};
