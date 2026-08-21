'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import GeneralSettings from './settings/GeneralSettings';
import WeeklyDealsSettings from './settings/WeeklyDealsSettings';
import ContactSettings from './settings/ContactSettings';
import PolicySettings from './settings/PolicySettings';
import SettingsPassword from './settings/SettingsPassword';
import useSiteSettings from './settings/useSiteSettings';

export default function SiteSettingsManager() {
  const site = useSiteSettings();
  if (site.loading) return <div className="mx-auto max-w-4xl px-4 py-6 text-sm text-black/50">Loading site settings...</div>;
  return <section className="mx-auto max-w-5xl px-4 py-6"><h2 className="text-2xl font-black">Store Settings</h2><p className="mt-1 text-sm text-black/55">Header, Big Deal, delivery, contact, policies and storefront settings.</p><form onSubmit={site.save} className="mt-5 space-y-5 rounded-2xl border border-black/10 bg-white p-5"><GeneralSettings settings={site.settings} update={site.update}/><WeeklyDealsSettings settings={site.settings} updateBig={site.updateBig} updateBucket={site.updateBucket} addBucket={site.addBucket} removeBucket={site.removeBucket} moveBucket={site.moveBucket} uploading={site.uploading} fileRef={site.fileRef} uploadBig={site.uploadBig}/><ContactSettings settings={site.settings} update={site.update}/><PolicySettings settings={site.settings} update={site.update}/><button type="submit" disabled={site.saving||site.uploading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] py-3 text-sm font-bold text-white disabled:opacity-50">{site.saving?<Loader2 className="h-4 w-4 animate-spin"/>:null}{site.saving?'Saving...':'Save Store Settings'}</button></form><SettingsPassword currentPassword={site.currentPassword} newPassword={site.newPassword} showNewPassword={site.showNewPassword} changingPassword={site.changingPassword} setCurrentPassword={site.setCurrentPassword} setNewPassword={site.setNewPassword} setShowNewPassword={site.setShowNewPassword} changeAdminPassword={site.changeAdminPassword}/>{site.toast&&<div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4"/>{site.toast}</div>}</section>;
}
