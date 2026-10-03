// Analytics is an estimate of engaged browsers, never proof of a unique person.
export function visitorRequestAllowed(input: {
  environment?: string; hostname: string; origin: string | null;
  userAgent: string; engaged: boolean; admin: boolean;
}) {
  if (input.environment !== 'production' || input.admin || !input.engaged) return false;
  if (!['primehubmall.com', 'www.primehubmall.com'].includes(input.hostname)) return false;
  try { if (!input.origin || new URL(input.origin).hostname !== input.hostname) return false; } catch { return false; }
  return !/bot|crawler|spider|headless|playwright|puppeteer|lighthouse|pagespeed|curl|wget|python|monitor|prerender/i.test(input.userAgent);
}

export function visitorTrafficSource(search: string, referrer: string, origin: string) {
  const params = new URLSearchParams(search);
  const utm = String(params.get('utm_source') || '').toLowerCase();
  let externalReferrer = referrer.toLowerCase();
  try { if (new URL(referrer).origin === origin) externalReferrer = ''; } catch {}
  const value = `${utm} ${externalReferrer}`;
  if (params.has('ttclid') || value.includes('tiktok')) return 'tiktok';
  if (value.includes('instagram')) return 'instagram';
  if (params.has('fbclid') || value.includes('facebook') || value.includes('fb.com')) return 'facebook';
  if (value.includes('whatsapp') || value.includes('wa.me')) return 'whatsapp';
  if (value.includes('youtube') || value.includes('youtu.be')) return 'youtube';
  if (params.has('gclid') || value.includes('google')) return 'google';
  return !utm && !externalReferrer ? 'direct' : 'other';
}
