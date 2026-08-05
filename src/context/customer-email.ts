// Resolve the customer email that the recommendations API takes as a path
// segment. Order of precedence:
//   1. data-customer-email on the open button — a test/QA override.
//   2. window.customer.email — a logged-in Shopify customer. Shopify does not
//      expose this by default; the merchant's theme must inject it, the same
//      way it injects window.currentProduct.
// Returns null when neither is available. The widget then falls back to the
// email the shopper submits through the form.
export function resolveCustomerEmail(openButton: HTMLElement): string | null {
  const override = openButton.getAttribute('data-customer-email');
  if (override && override.trim()) return override.trim();

  const themeEmail = window.customer && window.customer.email;
  if (themeEmail && themeEmail.trim()) return themeEmail.trim();

  return null;
}
