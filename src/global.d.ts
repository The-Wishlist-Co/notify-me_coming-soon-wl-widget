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
  }
}

export {};
