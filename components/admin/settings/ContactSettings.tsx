'use client';
import type { Settings, SettingsUpdate } from './SiteSettingsTypes';

export default function ContactSettings({ settings, update }: { settings: Settings; update: SettingsUpdate }) {
  return (
    <section className="space-y-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
      <div>
        <h3 className="text-base font-black">Contact Settings</h3>
        <p className="mt-1 text-xs text-black/50">These details are used for customer contact information.</p>
      </div>
      <label className="block">
        <span className="text-xs font-bold">WhatsApp Number</span>
        <input value={settings.whatsappNumber} onChange={e => update('whatsappNumber', e.target.value)} inputMode="tel" className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm" placeholder="+92 303 598 676" />
        <span className="mt-1 block text-[11px] text-black/45">Saved automatically as digits, e.g. 92303598676.</span>
      </label>
      <label className="block">
        <span className="text-xs font-bold">Email</span>
        <input type="email" value={settings.contactEmail} onChange={e => update('contactEmail', e.target.value)} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm" placeholder="support@example.com" />
      </label>
      <label className="block">
        <span className="text-xs font-bold">Physical Address</span>
        <textarea value={settings.physicalAddress} onChange={e => update('physicalAddress', e.target.value)} rows={4} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm" placeholder="Enter your shop or office address..." />
      </label>
    </section>
  );
}
