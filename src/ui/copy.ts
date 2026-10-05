import type { WidgetType } from '../types';
import { warnConfig } from '../context/config-source';

// Every piece of text the widget renders, resolved from the JSON block's `copy`
// with defaults that reproduce 3.5.x exactly.
export interface ResolvedCopy {
  title: string;
  intro: string;
  sizeLabel: string;
  sizePlaceholder: string;
  // false removes the visible label; the input is then named by aria-label.
  emailLabel: string | false;
  emailPlaceholder: string;
  emailOptIn: string;
  smsOptIn: string;
  submit: string;
  success: string;
  // Null renders no disclaimer.
  disclaimer: string | null;
}

const TYPE_COPY: Record<WidgetType, { intro: string; submit: string }> = {
  'notify-me': {
    intro: 'Register to receive a notification as soon as this item is back in stock',
    submit: 'Notify Me',
  },
  'coming-soon': {
    intro: 'Register your interest to hear more about this item',
    submit: 'Register Interest',
  },
};

const STRING_KEYS = [
  'title',
  'intro',
  'sizeLabel',
  'sizePlaceholder',
  'emailPlaceholder',
  'emailOptIn',
  'smsOptIn',
  'submit',
  'success',
  'disclaimer',
] as const;

export function resolveCopy(raw: unknown, type: WidgetType): ResolvedCopy {
  const copy: ResolvedCopy = {
    // The heading has always been the product title.
    title: '{product}',
    intro: TYPE_COPY[type].intro,
    sizeLabel: 'Size',
    sizePlaceholder: 'Select a size',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    emailOptIn: 'Email me store updates',
    smsOptIn: 'Text me store updates',
    submit: TYPE_COPY[type].submit,
    success: "You're on the list. We'll be in touch.",
    disclaimer: null,
  };
  if (raw === undefined) return copy;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    warnConfig('copy', 'an object');
    return copy;
  }

  const given = raw as Record<string, unknown>;
  STRING_KEYS.forEach((key) => {
    const value = given[key];
    if (value === undefined || value === null) return;
    if (typeof value === 'string') copy[key] = value;
    else warnConfig(`copy.${key}`, 'a string');
  });

  const label = given.emailLabel;
  if (label === false || typeof label === 'string') copy.emailLabel = label;
  else if (label !== undefined && label !== null) {
    warnConfig('copy.emailLabel', 'a string or false');
  }
  return copy;
}

// Every {product} becomes the title, literally. split/join rather than
// String.replace, whose replacement string would expand "$&" in a title.
export function fillProduct(template: string, productTitle: string): string {
  return template.split('{product}').join(productTitle);
}

// For copy interpolated into the widget's markup templates.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
