export interface Variant {
  id: number | string;
  title: string;
}

export interface Product {
  id: number | string;
  title: string;
  variants?: Variant[];
}

export interface CountryContext {
  countryCode: string | null;
  provinceCode: string | null;
  marketId: string | null;
}

export type AuthMode = 'token' | 'proxy';

export type WidgetType = 'notify-me' | 'coming-soon';

export type FieldName =
  | 'email'
  | 'mobile'
  | 'firstName'
  | 'lastName'
  | 'countryCode'
  | 'provinceCode';

export interface WidgetConfig {
  fields: FieldName[];
  type: WidgetType;
  authMode: AuthMode;
  tenant: string;
  marketId: string | null;
}
