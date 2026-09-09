'use client';
import type { SettingsUpdate, Settings } from './SiteSettingsTypes';

export default function GeneralSettings({ settings, update }: { settings: Settings; update: SettingsUpdate }) {
  return <>
    <label className="block"><span className="text-xs font-bold">Top Announcement</span><textarea value={settings.announcementText} onChange={e=>update('announcementText',e.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm"/></label>
    <label className="block"><span className="text-xs font-bold">WhatsApp Number</span><input value={settings.whatsappNumber} onChange={e=>update('whatsappNumber',e.target.value)} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm"/></label>
    <label className="block"><span className="text-xs font-bold">YouTube Guide URL</span><input type="url" placeholder="https://www.youtube.com/watch?v=..." value={settings.youtubeGuideUrl} onChange={e=>update('youtubeGuideUrl',e.target.value)} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm" /></label>
    <label className="block"><span className="text-xs font-bold">Free Delivery Items</span><input type="number" min="0" value={settings.freeDeliveryThreshold} onChange={e=>update('freeDeliveryThreshold',Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm"/></label>
    <label className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white px-3 py-3">
      <span><span className="block text-xs font-bold">Show Reseller Club on Home</span><span className="mt-0.5 block text-[11px] text-black/55">One master switch. Home uses the same Reseller Club rewards, tiers, tasks, vouchers, wallet and gifts data.</span></span>
      <input type="checkbox" checked={settings.resellerHomeEnabled} onChange={e=>update('resellerHomeEnabled',e.target.checked)} className="h-5 w-5 shrink-0" />
    </label>
  </>;
}