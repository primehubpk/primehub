'use client';
import type { SettingsUpdate, Settings } from './SiteSettingsTypes';

export default function GeneralSettings({ settings, update }: { settings: Settings; update: SettingsUpdate }) {
  return <>
    <label className="block"><span className="text-xs font-bold">Top Announcement</span><textarea value={settings.announcementText} onChange={e=>update('announcementText',e.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm"/></label>
    <label className="block"><span className="text-xs font-bold">WhatsApp Number</span><input value={settings.whatsappNumber} onChange={e=>update('whatsappNumber',e.target.value)} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm"/></label>
    <div className="rounded-2xl border border-black/10 bg-[#F8F7F3] p-4">
      <p className="text-xs font-black">Homepage Opening Guide Video</p>
      <p className="mt-1 text-[11px] text-black/50">Control the opening preview here. The full guide remains available inside the 3-line menu.</p>

      <label className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white px-3 py-3">
        <span>
          <span className="block text-xs font-bold">Show Opening Video on Home</span>
          <span className="mt-0.5 block text-[11px] text-black/55">Turn this off to hide only the homepage opening preview. The 3-line menu guide stays available.</span>
        </span>
        <input type="checkbox" checked={settings.youtubeGuideHomeEnabled} onChange={e=>update('youtubeGuideHomeEnabled',e.target.checked)} className="h-5 w-5 shrink-0" />
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-bold">YouTube Guide URL</span>
        <input type="url" placeholder="https://www.youtube.com/watch?v=..." value={settings.youtubeGuideUrl} onChange={e=>update('youtubeGuideUrl',e.target.value)} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm" />
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-bold">Opening Video Title</span>
        <input value={settings.youtubeGuideTitle} onChange={e=>update('youtubeGuideTitle',e.target.value)} placeholder="PrimeHubMall Se Order Kaise Karein?" className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm" />
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-bold">Opening Preview Seconds</span>
        <input
          type="number"
          min="1"
          max="30"
          value={Number.isFinite(settings.youtubeGuidePreviewSeconds) ? settings.youtubeGuidePreviewSeconds : ''}
          onChange={e=>update('youtubeGuidePreviewSeconds',e.target.value === '' ? Number.NaN : Number(e.target.value))}
          onBlur={e=>{
            const value = Number(e.target.value);
            update('youtubeGuidePreviewSeconds',Number.isFinite(value) && value >= 1 ? Math.min(30,value) : 5);
          }}
          className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm"
        />
        <span className="mt-1 block text-[10px] text-black/45">Default 5 seconds. Allowed range: 1–30 seconds.</span>
      </label>
    </div>
    <label className="block"><span className="text-xs font-bold">Free Delivery Items</span><input type="number" min="0" value={settings.freeDeliveryThreshold} onChange={e=>update('freeDeliveryThreshold',Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm"/></label>
    <label className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white px-3 py-3">
      <span><span className="block text-xs font-bold">Show Reseller Club on Home</span><span className="mt-0.5 block text-[11px] text-black/55">One master switch. Home uses the same Reseller Club rewards, tiers, tasks, vouchers, wallet and gifts data.</span></span>
      <input type="checkbox" checked={settings.resellerHomeEnabled} onChange={e=>update('resellerHomeEnabled',e.target.checked)} className="h-5 w-5 shrink-0" />
    </label>
  </>;
}