'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { getAdminDocument, setAdminDocument } from './shared';
import type { PriceBucket } from '@/lib/types';

const DEFAULT_BUCKETS: PriceBucket[] = [
  { id: 'under-99', title: 'Under 99', amount: 99, iconUrl: '', accent: '#E1352B', sortOrder: 1, active: true },
  { id: 'under-299', title: 'Under 299', amount: 299, iconUrl: '', accent: '#D99A17', sortOrder: 2, active: true },
  { id: 'under-999', title: 'Under 999', amount: 999, iconUrl: '', accent: '#0F6A5F', sortOrder: 3, active: true },
  { id: 'premium', title: 'Premium', amount: 999999, iconUrl: '', accent: '#14140F', sortOrder: 4, active: true },
];

type GeneralSiteSettings = { announcementText: string; whatsappNumber: string; freeDeliveryThreshold: number; storePolicyInfo: string; priceBuckets: PriceBucket[] };
const DEFAULT_SETTINGS: GeneralSiteSettings = { announcementText: '', whatsappNumber: '', freeDeliveryThreshold: 5, storePolicyInfo: '', priceBuckets: DEFAULT_BUCKETS };

export default function SiteSettingsManager() {
  const [settings, setSettings] = useState<GeneralSiteSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { getAdminDocument('settings', 'main').then((snapshot) => { if (snapshot.exists()) { const data = snapshot.data() as Partial<GeneralSiteSettings>; setSettings((current) => ({ ...current, ...data, priceBuckets: Array.isArray(data.priceBuckets) && data.priceBuckets.length ? data.priceBuckets : DEFAULT_BUCKETS })); } }).finally(() => setIsLoading(false)); }, []);
  const updateField = <Key extends keyof GeneralSiteSettings>(key: Key, value: GeneralSiteSettings[Key]) => { setSettings((current) => ({ ...current, [key]: value })); setToast(''); };
  const updateBucket = (index: number, patch: Partial<PriceBucket>) => updateField('priceBuckets', settings.priceBuckets.map((bucket, i) => i === index ? { ...bucket, ...patch } : bucket));
  const addBucket = () => updateField('priceBuckets', [...settings.priceBuckets, { id: `bucket-${Date.now()}`, title: 'New Bucket', amount: 999, iconUrl: '', accent: '#FFB020', sortOrder: settings.priceBuckets.length + 1, active: true }]);
  const removeBucket = (index: number) => updateField('priceBuckets', settings.priceBuckets.filter((_, i) => i !== index));

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setIsSaving(true); setToast('');
    try {
      const payload = { announcementText: settings.announcementText.trim(), whatsappNumber: settings.whatsappNumber.trim(), freeShippingCount: Number(settings.freeDeliveryThreshold || 0), freeDelivery: { enabled: true, itemThreshold: Number(settings.freeDeliveryThreshold || 0), message: 'Add {remaining} more item{plural} to unlock FREE DELIVERY', unlockedMessage: 'FREE DELIVERY UNLOCKED 🎉' }, storePolicyInfo: settings.storePolicyInfo.trim(), priceBuckets: settings.priceBuckets.map((bucket, index) => ({ ...bucket, sortOrder: index + 1, amount: Number(bucket.amount) || 0 })) };
      await setAdminDocument('settings', 'main', payload); setToast('Store settings saved successfully.');
    } catch { setToast('Unable to save settings. Please try again.'); } finally { setIsSaving(false); }
  }

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-6 text-sm text-black/50">Loading site settings...</div>;
  return <section className="mx-auto max-w-4xl px-4 py-6"><h2 className="text-2xl font-black">Store Settings</h2><p className="mt-1 text-sm text-black/55">All customer-facing header, delivery and price-bucket settings are controlled here.</p><form onSubmit={saveSettings} className="mt-5 space-y-5 rounded-2xl border border-black/10 bg-white p-5">
    <label className="block"><span className="text-xs font-bold">Top Announcement</span><textarea value={settings.announcementText} onChange={(e) => updateField('announcementText', e.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm" /></label>
    <label className="block"><span className="text-xs font-bold">WhatsApp Number</span><input value={settings.whatsappNumber} onChange={(e) => updateField('whatsappNumber', e.target.value)} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm" /></label>
    <label className="block"><span className="text-xs font-bold">Free Delivery Items</span><input type="number" min="0" value={settings.freeDeliveryThreshold} onChange={(e) => updateField('freeDeliveryThreshold', Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm" /></label>
    <div><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold">Glowing Price Buckets</p><p className="text-[11px] text-black/45">Add, rename, reorder and disable these from admin; homepage updates live.</p></div><button type="button" onClick={addBucket} className="inline-flex items-center gap-1 rounded-full bg-[#14140F] px-3 py-2 text-[10px] font-black text-white"><Plus size={13}/>Add</button></div><div className="space-y-2">{settings.priceBuckets.map((bucket, index) => <div key={bucket.id} className="grid gap-2 rounded-xl bg-[#F4F4F1] p-3 sm:grid-cols-[1fr_120px_110px_42px]"><input value={bucket.title} onChange={(e) => updateBucket(index, { title: e.target.value })} placeholder="Title" className="rounded-lg bg-white px-3 py-2 text-xs" /><input type="number" value={bucket.amount} onChange={(e) => updateBucket(index, { amount: Number(e.target.value) })} placeholder="Max price" className="rounded-lg bg-white px-3 py-2 text-xs" /><label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold"><input type="checkbox" checked={bucket.active} onChange={(e) => updateBucket(index, { active: e.target.checked })}/>Show</label><button type="button" onClick={() => removeBucket(index)} aria-label={`Delete ${bucket.title}`} className="flex items-center justify-center rounded-lg bg-white text-[#E1352B]"><Trash2 size={14}/></button></div>)}</div></div>
    <label className="block"><span className="text-xs font-bold">Store Policy / Info</span><textarea value={settings.storePolicyInfo} onChange={(e) => updateField('storePolicyInfo', e.target.value)} rows={5} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm" /></label>
    <button type="submit" disabled={isSaving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] py-3 text-sm font-bold text-white disabled:opacity-50">{isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : null}{isSaving ? 'Saving...' : 'Save Store Settings'}</button>
  </form>{toast && <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4"/>{toast}</div>}</section>;
}
