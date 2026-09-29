// Reads a configuration attribute. Configuration can live on the legacy
// #popup-open button or on #notification-widget; per attribute, the button wins
// when it carries it, so existing installs behave exactly as before while PLPs
// (which have no button) configure the widget element instead.
export type AttrReader = (name: string) => string | null;

export function createAttrReader(
  primary: HTMLElement | null,
  fallback: HTMLElement,
): AttrReader {
  return (name) =>
    primary && primary.hasAttribute(name)
      ? primary.getAttribute(name)
      : fallback.getAttribute(name);
}
