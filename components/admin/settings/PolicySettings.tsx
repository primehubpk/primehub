'use client';
import type { Settings, SettingsUpdate } from './SiteSettingsTypes';

const textareaClass = 'mt-1.5 min-h-40 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-black/30';

export default function PolicySettings({ settings, update }: { settings: Settings; update: SettingsUpdate }) {
  return (
    <section className="space-y-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
      <div>
        <h3 className="text-base font-black">Policy Settings</h3>
        <p className="mt-1 text-xs text-black/50">Manage the policy content shown on the storefront.</p>
      </div>
      <label className="block">
        <span className="text-xs font-bold">Store Policy / Info</span>
        <textarea value={settings.storePolicyInfo} onChange={e => update('storePolicyInfo', e.target.value)} rows={5} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm" />
      </label>
      <label className="block">
        <span className="text-xs font-bold">Privacy Policy</span>
        <textarea value={settings.privacyPolicy} onChange={e => update('privacyPolicy', e.target.value)} rows={10} className={textareaClass} placeholder="Enter your full privacy policy..." />
      </label>
      <label className="block">
        <span className="text-xs font-bold">Return Policy</span>
        <textarea value={settings.returnPolicy} onChange={e => update('returnPolicy', e.target.value)} rows={10} className={textareaClass} placeholder="Enter your full return policy..." />
      </label>
    </section>
  );
}
