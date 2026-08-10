'use client';

// ==================== SITE SETTINGS MANAGEMENT ====================
import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { getAdminDocument, setAdminDocument, type SiteSettings } from './shared';

interface GeneralSiteSettings extends SiteSettings {
  freeDeliveryThreshold?: number;
  storePolicyInfo?: string;
}

const DEFAULT_SETTINGS: GeneralSiteSettings = {
  announcementText: '',
  whatsappNumber: '',
  freeDeliveryThreshold: 1999,
  storePolicyInfo: '',
};

export default function SiteSettingsManager() {
  const [settings, setSettings] = useState<GeneralSiteSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');

  // ==================== SETTINGS DOCUMENT LOAD ====================
  useEffect(() => {
    async function loadSettings() {
      try {
        const snapshot = await getAdminDocument('settings', 'general');
        if (snapshot.exists()) {
          setSettings((current) => ({ ...current, ...(snapshot.data() as GeneralSiteSettings) }));
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, []);

  // ==================== FORM AND SAVE HANDLERS ====================
  function updateField<Key extends keyof GeneralSiteSettings>(key: Key, value: GeneralSiteSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setToast('');
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setToast('');

    try {
      await setAdminDocument('settings', 'general', {
        announcementText: settings.announcementText?.trim() || '',
        whatsappNumber: settings.whatsappNumber?.trim() || '',
        freeDeliveryThreshold: Number(settings.freeDeliveryThreshold || 0),
        storePolicyInfo: settings.storePolicyInfo?.trim() || '',
      });
      setToast('Settings saved successfully.');
    } catch {
      setToast('Unable to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-black/50">Loading site settings...</div>;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-6">
      <h2 className="text-2xl font-black">Site Settings</h2>
      <p className="mt-1 text-sm text-black/55">Manage the store-wide information customers see while shopping.</p>

      {/* ==================== SETTINGS FORM ==================== */}
      <form onSubmit={saveSettings} className="mt-5 space-y-5 rounded-2xl border border-black/10 bg-white p-5">
        <label className="block">
          <span className="text-xs font-bold">Top Announcement Bar Text</span>
          <textarea value={settings.announcementText || ''} onChange={(event) => updateField('announcementText', event.target.value)} rows={3} placeholder="Free delivery on orders above Rs. 1,999" className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#0F6A5F]" />
        </label>

        <label className="block">
          <span className="text-xs font-bold">Global Store WhatsApp Number</span>
          <input type="tel" value={settings.whatsappNumber || ''} onChange={(event) => updateField('whatsappNumber', event.target.value)} placeholder="923001234567 (country code, no +)" className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#0F6A5F]" />
          <span className="mt-1 block text-[11px] text-black/45">Used for storefront WhatsApp ordering and customer inquiries.</span>
        </label>

        <label className="block">
          <span className="text-xs font-bold">Free Delivery Order Limit (Rs.)</span>
          <input type="number" min="0" value={settings.freeDeliveryThreshold ?? 0} onChange={(event) => updateField('freeDeliveryThreshold', Number(event.target.value))} placeholder="1999" className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#0F6A5F]" />
          <span className="mt-1 block text-[11px] text-black/45">For example, enter 1999 for free shipping above Rs. 1,999.</span>
        </label>

        <label className="block">
          <span className="text-xs font-bold">Store Policy / Info</span>
          <textarea value={settings.storePolicyInfo || ''} onChange={(event) => updateField('storePolicyInfo', event.target.value)} rows={7} placeholder="Add delivery, return, payment, or other store policy information." className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#0F6A5F]" />
        </label>

        <button type="submit" disabled={isSaving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] py-3 text-sm font-bold text-white disabled:opacity-50">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {isSaving ? 'Saving settings...' : 'Save Settings'}
        </button>
      </form>

      {/* ==================== SAVE TOAST FEEDBACK ==================== */}
      {toast && (
        <div role="status" className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${toast.startsWith('Unable') ? 'bg-[#E1352B] text-white' : 'bg-[#0F6A5F] text-white'}`}>
          {!toast.startsWith('Unable') && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          {toast}
        </div>
      )}
    </section>
  );
}
