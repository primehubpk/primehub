/** Small per-tab checkout choices. Monetary totals are never trusted from browser storage. */
export type CheckoutPreferences = { selfCollect: boolean; voucherCode: string };
const KEY = 'primehub_checkout_preferences_v1';
export const emptyCheckoutPreferences: CheckoutPreferences = { selfCollect: false, voucherCode: '' };
export function readCheckoutPreferences(): CheckoutPreferences {
  if (typeof window === 'undefined') return emptyCheckoutPreferences;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(KEY) || '{}');
    return {
      selfCollect: saved.selfCollect === true,
      voucherCode: typeof saved.voucherCode === 'string' ? saved.voucherCode.trim().toUpperCase().slice(0, 24) : '',
    };
  } catch { return emptyCheckoutPreferences; }
}
export function writeCheckoutPreferences(values: CheckoutPreferences) {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(KEY, JSON.stringify(values)); } catch {}
}
export function clearCheckoutPreferences() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(KEY); } catch {}
}
