import { warnConfig } from '../context/config-source';

// What each data-twc-config "classes" key styles. label/input/select cover every
// element of that kind in the form.
export const CLASS_TARGETS = {
  title: '.twc-nm-title',
  intro: '.twc-nm-text',
  label: '.twc-nm-label',
  input: '.twc-nm-input',
  select: '.twc-nm-select',
  checkbox: '.twc-nm-check input',
  submit: '.twc-nm-submit',
  close: '.twc-nm-close',
  disclaimer: '.twc-nm-disclaimer',
  summary: '.twc-nm-summary',
  summaryImage: '.twc-nm-summary-image',
  summaryName: '.twc-nm-summary-name',
  summaryVariant: '.twc-nm-summary-variant',
  summaryPrice: '.twc-nm-summary-price',
  summaryCompareAt: '.twc-nm-summary-compare',
} as const;

export type ClassKey = keyof typeof CLASS_TARGETS;
export type ResolvedClasses = Partial<Record<ClassKey, string[]>>;

// Marks an element whose look the theme owns: the widget's cosmetic rules are
// scoped :not(.twc-nm-themed), its layout rules are not.
export const THEMED_CLASS = 'twc-nm-themed';

const CLASS_TOKEN = /^[A-Za-z_-][A-Za-z0-9_-]*$/;

export function resolveClasses(raw: unknown): ResolvedClasses {
  const resolved: ResolvedClasses = {};
  if (raw === undefined || raw === null) return resolved;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnConfig('classes', 'an object');
    return resolved;
  }

  const given = raw as Record<string, unknown>;
  (Object.keys(CLASS_TARGETS) as ClassKey[]).forEach((key) => {
    const value = given[key];
    if (value === undefined || value === null) return;
    if (typeof value !== 'string') {
      warnConfig(`classes.${key}`, 'a string');
      return;
    }
    const tokens = value.split(/\s+/).filter(Boolean);
    const valid = tokens.filter((token) => CLASS_TOKEN.test(token));
    if (valid.length < tokens.length) {
      warnConfig(`classes.${key}`, 'class names of letters, digits, "-" and "_"');
    }
    // An empty or all-invalid value leaves the element on the widget's styles.
    if (valid.length) resolved[key] = valid;
  });
  return resolved;
}

export function applyClasses(root: HTMLElement, classes: ResolvedClasses): void {
  (Object.keys(classes) as ClassKey[]).forEach((key) => {
    const names = classes[key];
    if (!names) return;
    root.querySelectorAll<HTMLElement>(CLASS_TARGETS[key]).forEach((el) => {
      el.classList.add(...names, THEMED_CLASS);
    });
  });
}
