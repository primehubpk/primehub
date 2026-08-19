'use client';
import type { Settings, SettingsUpdate } from './SiteSettingsTypes';
export default function PolicySettings({settings,update}:{settings:Settings;update:SettingsUpdate}){return <label className="block"><span className="text-xs font-bold">Store Policy / Info</span><textarea value={settings.storePolicyInfo} onChange={e=>update('storePolicyInfo',e.target.value)} rows={5} className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm"/></label>}
