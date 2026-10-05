// Configuration reader. Per setting, the first layer that has it wins:
//   1. an attribute on the legacy #popup-open button
//   2. an attribute on #notification-widget
//   3. the JSON block inside #notification-widget:
//        <script type="application/json" data-twc-config>{ … }</script>
// A setting's JSON key is its attribute name without "data-", camelCased:
// data-proxy-app -> proxyApp. copy, classes and productSummary exist only in JSON.
export type AttrReader = (name: string) => string | null;

export type JsonConfig = Record<string, unknown>;

export interface ConfigReader {
  // String settings. Also the AttrReader handed to localization and
  // customer-email, which predate the JSON layer.
  string: AttrReader;
  boolean(name: string): boolean | null;
  number(name: string): number | null;
  stringArray(name: string): string[] | null;
  // JSON-only settings, by key. Undefined when absent or null.
  json(key: string): unknown;
  jsonBoolean(key: string): boolean | null;
}

const CONFIG_SELECTOR = 'script[type="application/json"][data-twc-config]';

export function readJsonConfig(wrapper: HTMLElement): JsonConfig {
  const block = wrapper.querySelector(CONFIG_SELECTOR);
  if (!block) return {};
  try {
    const parsed: unknown = JSON.parse(block.textContent || '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as JsonConfig;
    }
  } catch {
    // Reported below.
  }
  console.error('notify-me-wl: invalid data-twc-config JSON');
  return {};
}

export function jsonKey(attrName: string): string {
  return attrName
    .replace(/^data-/, '')
    .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function warnConfig(key: string, expected: string): void {
  console.warn(`notify-me-wl: ignoring data-twc-config "${key}": expected ${expected}`);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function createConfigReader(
  primary: HTMLElement | null,
  fallback: HTMLElement,
  json: JsonConfig,
): ConfigReader {
  const attr = (name: string): string | null => {
    if (primary && primary.hasAttribute(name)) return primary.getAttribute(name);
    return fallback.hasAttribute(name) ? fallback.getAttribute(name) : null;
  };
  // Liquid renders nil as null, so null means "not set" rather than a bad value.
  const raw = (key: string): unknown => (json[key] === null ? undefined : json[key]);

  const jsonBoolean = (key: string): boolean | null => {
    const value = raw(key);
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value;
    warnConfig(key, 'true or false');
    return null;
  };

  return {
    string(name) {
      const fromAttr = attr(name);
      if (fromAttr !== null) return fromAttr;
      const key = jsonKey(name);
      const value = raw(key);
      if (value === undefined) return null;
      if (typeof value === 'string') return value;
      // `localization.market.id | json` renders a number.
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
      warnConfig(key, 'a string');
      return null;
    },
    boolean(name) {
      const fromAttr = attr(name);
      if (fromAttr !== null) return fromAttr !== 'false';
      return jsonBoolean(jsonKey(name));
    },
    number(name) {
      const fromAttr = attr(name);
      if (fromAttr !== null) {
        const parsed = parseInt(fromAttr, 10);
        if (Number.isFinite(parsed)) return parsed;
      }
      const key = jsonKey(name);
      const value = raw(key);
      if (value === undefined) return null;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      warnConfig(key, 'a number');
      return null;
    },
    stringArray(name) {
      const fromAttr = attr(name);
      if (fromAttr !== null) {
        try {
          const parsed: unknown = JSON.parse(fromAttr);
          if (isStringArray(parsed)) return parsed;
        } catch {
          // Reported below.
        }
        console.warn(`notify-me-wl: ignoring invalid ${name} attribute`);
      }
      const key = jsonKey(name);
      const value = raw(key);
      if (value === undefined) return null;
      if (isStringArray(value)) return value;
      warnConfig(key, 'an array of strings');
      return null;
    },
    json: raw,
    jsonBoolean,
  };
}
