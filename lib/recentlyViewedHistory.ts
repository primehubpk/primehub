export function rememberProduct(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const key = String(id || '').trim();
    if (!key) return;
    const stored = JSON.parse(window.localStorage.getItem('phdeals-recent') || '[]');
    const ids = Array.isArray(stored)
      ? stored.map((value) => String(value || '')).filter((value) => value && value !== key)
      : [];
    window.localStorage.setItem('phdeals-recent', JSON.stringify([key, ...ids].slice(0, 12)));
  } catch {
    // Recent history is optional and must never block product navigation.
  }
}
