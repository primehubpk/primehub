'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { getAdminDocument, setAdminDocument, uploadImageToImgBB, createAdminDocument } from '../shared';
import { auth } from '@/lib/firebase';
import type { DailyDeal, PriceBucket } from '@/lib/types';
import { DEFAULT_BIG_DEAL, DEFAULT_BUCKETS, DEFAULT_SETTINGS, Settings } from './SiteSettingsTypes';

function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return digits;
}

export default function useSiteSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    Promise.all([
      getAdminDocument('settings', 'main'),
      getAdminDocument('settings', 'policy'),
      getAdminDocument('settings', 'contact'),
    ]).then(([mainSnap, policySnap, contactSnap]) => {
      const main = mainSnap.exists() ? (mainSnap.data() as Partial<Settings>) : {};
      const policy = policySnap.exists() ? policySnap.data() : {};
      const contact = contactSnap.exists() ? contactSnap.data() : {};
      const mainWhatsApp = typeof main.whatsappNumber === 'string' ? main.whatsappNumber : '';
      const contactWhatsApp = typeof contact.whatsappNumber === 'string' ? contact.whatsappNumber : '';
      setSettings((s) => ({
        ...s,
        ...main,
        whatsappNumber: contactWhatsApp || mainWhatsApp,
        contactEmail: typeof contact.email === 'string' ? contact.email : '',
        physicalAddress: typeof contact.physicalAddress === 'string' ? contact.physicalAddress : '',
        privacyPolicy: typeof policy.privacyPolicy === 'string' ? policy.privacyPolicy : '',
        returnPolicy: typeof policy.returnPolicy === 'string' ? policy.returnPolicy : '',
        dailyDeal: { ...DEFAULT_BIG_DEAL, ...(main.dailyDeal || {}) },
        priceBuckets: Array.isArray(main.priceBuckets) && main.priceBuckets.length ? main.priceBuckets : DEFAULT_BUCKETS,
      }));
    }).catch(() => setToast('Unable to load site settings.')).finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));
  const updateBig = (patch: Partial<DailyDeal>) => update('dailyDeal', { ...settings.dailyDeal, ...patch });
  const updateBucket = (i: number, patch: Partial<PriceBucket>) => update('priceBuckets', settings.priceBuckets.map((b, n) => n === i ? { ...b, ...patch } : b));
  const addBucket = () => update('priceBuckets', [...settings.priceBuckets, { id: `bucket-${Date.now()}`, title: 'New Bucket', amount: 999, iconUrl: '', accent: '#FFB020', sortOrder: settings.priceBuckets.length + 1, active: true }]);
  const removeBucket = (i: number) => update('priceBuckets', settings.priceBuckets.filter((_, n) => n !== i));
  const moveBucket = (i: number, d: -1 | 1) => { const next = [...settings.priceBuckets]; const j = i + d; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]]; update('priceBuckets', next.map((b, n) => ({ ...b, sortOrder: n + 1 }))); };

  async function uploadBig(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageToImgBB(file);
      updateBig({ imageUrl: url });
      await createAdminDocument('media_assets', { name: file.name, url, type: file.type, size: file.size, createdAt: new Date().toISOString(), source: 'big-deal' });
      setToast('Big Deal image uploaded.');
    } catch (e) { setToast(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setUploading(false); }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = settings.dailyDeal;
    if (d.active && (!d.title.trim() || !Number(d.originalPrice) || !Number(d.dealPrice))) { setToast('Big Deal needs title, original price and deal price.'); return; }
    if (d.active && Number(d.dealPrice) >= Number(d.originalPrice)) { setToast('Big Deal price must be lower than original price.'); return; }
    setSaving(true);
    try {
      const whatsappNumber = normalizeWhatsAppNumber(settings.whatsappNumber);
      await Promise.all([
        setAdminDocument('settings', 'main', {
          announcementText: settings.announcementText.trim(),
          whatsappNumber,
          freeShippingCount: Number(settings.freeDeliveryThreshold || 0),
          freeDelivery: { enabled: true, itemThreshold: Number(settings.freeDeliveryThreshold || 0), message: 'Add {remaining} more item{plural} to unlock FREE DELIVERY', unlockedMessage: 'FREE DELIVERY UNLOCKED 🎉' },
          storePolicyInfo: settings.storePolicyInfo.trim(),
          priceBuckets: settings.priceBuckets.map((b, i) => ({ ...b, sortOrder: i + 1, amount: Number(b.amount) || 0 })),
          dailyDeal: { ...d, title: d.title.trim(), originalPrice: Number(d.originalPrice) || 0, dealPrice: Number(d.dealPrice) || 0, buttonLink: d.buttonLink.trim() || '/deals/big', buttonText: d.buttonText.trim() || 'Shop Big Deal' },
        }),
        setAdminDocument('settings', 'policy', {
          privacyPolicy: settings.privacyPolicy.trim(),
          returnPolicy: settings.returnPolicy.trim(),
        }),
        setAdminDocument('settings', 'contact', {
          whatsappNumber,
          email: settings.contactEmail.trim(),
          physicalAddress: settings.physicalAddress.trim(),
        }),
      ]);
      setSettings((s) => ({ ...s, whatsappNumber }));
      setToast('Settings, contact and policies saved.');
    } catch { setToast('Unable to save settings.'); }
    finally { setSaving(false); }
  }

  async function changeAdminPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user?.email) { setToast('Please sign in again before changing the password.'); return; }
    if (newPassword.length < 8) { setToast('New password must be at least 8 characters.'); return; }
    if (currentPassword === newPassword) { setToast('New password must be different from the current password.'); return; }
    setChangingPassword(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
      await updatePassword(user, newPassword);
      setCurrentPassword(''); setNewPassword(''); setToast('Admin password changed successfully.');
    } catch (error) { console.error(error); setToast('Password change failed. Verify the current password and try again.'); }
    finally { setChangingPassword(false); }
  }

  return { settings, loading, saving, uploading, toast, fileRef, currentPassword, newPassword, showNewPassword, changingPassword, setCurrentPassword, setNewPassword, setShowNewPassword, update, updateBig, updateBucket, addBucket, removeBucket, moveBucket, uploadBig, save, changeAdminPassword };
}
