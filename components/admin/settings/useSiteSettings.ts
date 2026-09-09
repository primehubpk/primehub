'use client';

import { useEffect, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { getAdminDocument, setAdminDocument } from '../shared';
import { auth } from '@/lib/firebase';
import type { PriceBucket } from '@/lib/types';
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
  const [uploading] = useState(false);
  const [toast, setToast] = useState('');
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
      setSettings((current) => ({
        ...current,
        ...main,
        whatsappNumber: contactWhatsApp || mainWhatsApp,
        contactEmail: typeof contact.email === 'string' ? contact.email : '',
        physicalAddress: typeof contact.physicalAddress === 'string' ? contact.physicalAddress : '',
        privacyPolicy: typeof policy.privacyPolicy === 'string' ? policy.privacyPolicy : '',
        returnPolicy: typeof policy.returnPolicy === 'string' ? policy.returnPolicy : '',
        // Kept in state for compatibility only. Store Settings no longer edits or writes Big Deal.
        dailyDeal: { ...DEFAULT_BIG_DEAL, ...(main.dailyDeal || {}) },
        priceBuckets: Array.isArray(main.priceBuckets) && main.priceBuckets.length ? main.priceBuckets : DEFAULT_BUCKETS,
        youtubeGuideUrl: typeof main.youtubeGuideUrl === 'string' ? main.youtubeGuideUrl : '',
      }));
    }).catch(() => setToast('Unable to load site settings.')).finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const updateBucket = (index: number, patch: Partial<PriceBucket>) => update('priceBuckets', settings.priceBuckets.map((bucket, itemIndex) => itemIndex === index ? { ...bucket, ...patch } : bucket));
  const addBucket = () => update('priceBuckets', [...settings.priceBuckets, { id: `bucket-${Date.now()}`, title: 'New Bucket', amount: 999, iconUrl: '', accent: '#FFB020', sortOrder: settings.priceBuckets.length + 1, active: true }]);
  const removeBucket = (index: number) => update('priceBuckets', settings.priceBuckets.filter((_, itemIndex) => itemIndex !== index));
  const moveBucket = (index: number, direction: -1 | 1) => {
    const next = [...settings.priceBuckets];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update('priceBuckets', next.map((bucket, itemIndex) => ({ ...bucket, sortOrder: itemIndex + 1 })));
  };

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const whatsappNumber = normalizeWhatsAppNumber(settings.whatsappNumber);
      await Promise.all([
        setAdminDocument('settings', 'main', {
          announcementText: settings.announcementText.trim(),
          whatsappNumber,
          youtubeGuideUrl: settings.youtubeGuideUrl.trim(),
          freeShippingCount: Number(settings.freeDeliveryThreshold || 0),
          freeDelivery: { enabled: true, itemThreshold: Number(settings.freeDeliveryThreshold || 0), message: 'Add {remaining} more item{plural} to unlock FREE DELIVERY', unlockedMessage: 'FREE DELIVERY UNLOCKED 🎉' },
          storePolicyInfo: settings.storePolicyInfo.trim(),
          priceBuckets: settings.priceBuckets.map((bucket, index) => ({ ...bucket, sortOrder: index + 1, amount: Number(bucket.amount) || 0 })),
          // dailyDeal is intentionally omitted. The dedicated Big Deal icon is the only owner.
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
      setSettings((current) => ({ ...current, whatsappNumber, youtubeGuideUrl: settings.youtubeGuideUrl.trim() }));
      setToast('Settings, contact and policies saved.');
    } catch {
      setToast('Unable to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function changeAdminPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user?.email) { setToast('Please sign in again before changing the password.'); return; }
    if (newPassword.length < 8) { setToast('New password must be at least 8 characters.'); return; }
    if (currentPassword === newPassword) { setToast('New password must be different from the current password.'); return; }
    setChangingPassword(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setToast('Admin password changed successfully.');
    } catch (error) {
      console.error(error);
      setToast('Password change failed. Verify the current password and try again.');
    } finally {
      setChangingPassword(false);
    }
  }

  return {
    settings,
    loading,
    saving,
    uploading,
    toast,
    currentPassword,
    newPassword,
    showNewPassword,
    changingPassword,
    setCurrentPassword,
    setNewPassword,
    setShowNewPassword,
    update,
    updateBucket,
    addBucket,
    removeBucket,
    moveBucket,
    save,
    changeAdminPassword,
  };
}
