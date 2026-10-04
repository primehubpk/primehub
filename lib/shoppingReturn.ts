const KEY = 'ph-shopping-return';

export function safeShoppingPath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) return '';
  try {
    const url = new URL(value, 'https://primehubmall.com');
    if (url.origin !== 'https://primehubmall.com' || /^\/(cart|checkout)(\/|$)/.test(url.pathname)) return '';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return ''; }
}

export function rememberShoppingReturnPath() {
  if (typeof window === 'undefined') return;
  const path = safeShoppingPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  if (!path) return;
  try { window.sessionStorage.setItem(KEY, path); } catch { /* Private mode. */ }
}

export function readShoppingReturnPath() {
  if (typeof window === 'undefined') return '/';
  try { return safeShoppingPath(window.sessionStorage.getItem(KEY) || '') || '/'; } catch { return '/'; }
}
