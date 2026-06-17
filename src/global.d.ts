import type { Product } from './types';

declare global {
  interface Window {
    Shopify?: {
      country?: string;
      locale?: string;
      markets?: {
        currentMarket?: {
          countryCode?: string;
          id?: string | number;
        };
      };
    };
    customer?: {
      default_address?: {
        country_code?: string;
        province_code?: string;
      };
    };
    currentProduct?: Product;
  }
}

export {};
