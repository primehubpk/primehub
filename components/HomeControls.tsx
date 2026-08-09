'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Megaphone,
  Save,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { db } from '@/lib/firebase';

type HomeConfig = {
  topBarText: string;
  topBarEnabled: boolean;
  heroImageUrl: string;
  heroLink: string;
  heroEnabled: boolean;
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
  dailyDealLabel: string;
  dailyDealPrice: string;
  dailyDealOldPrice: string;
  dailyDealImageUrl: string;
  dailyDealEndsText: string;
  rewardsEnabled: boolean;
};

const defaults: HomeConfig = {
  topBarText: 'WORLDWIDE DELIVERY AVAILABLE',
  topBarEnabled: true,
  heroImageUrl: '',
  heroLink: '/shop',
  heroEnabled: true,
  heroTitle: 'TODAY’S DEAL',
  heroSubtitle: 'Limited-time price. Updated daily.',
  heroCta: 'SHOP DEAL',
  dailyDealLabel: 'DAILY DEAL',
  dailyDealPrice: '',
  dailyDealOldPrice: '',
  dailyDealImageUrl: '',
  dailyDealEndsText: 'Ends today',
  rewardsEnabled: true,
};

export default function HomeControls() {
  const [form, setForm] = useState<HomeConfig>(defaults);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'home'), (snap) => {
      if (snap.exists()) setForm({ ...defaults, ...(snap.data() as Partial<HomeConfig>) });
    });
  }, []);

  const update = (key: keyof HomeConfig, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, 'settings', 'home'), form, { merge: true });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[30px] bg-[#F4F4F1] p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">
            Homepage Command Center
          </p>
          <h2 className="mt-1 text-xl font-black">Home Page Controls</h2>
          <p className="mt-1 text-[10px] leading-4 text-black/40">
            Daily hero deal, announcement bar and homepage content can be changed here.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#14140F] px-5 py-3 text-[10px] font-black text-white disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Home Settings'}
        </button>
      </div>

      {saved && (
        <div className="mt-3 rounded-2xl bg-[#0F6A5F] p-3 text-[10px] font-black text-white">
          ✓ Homepage settings saved. Storefront will update from Firestore.
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-4">
          <div className="flex items-center gap-2">
            <Megaphone size={16} />
            <h3 className="text-xs font-black">Announcement Bar</h3>
          </div>

          <label className="mt-4 flex items-center justify-between rounded-2xl bg-[#F4F4F1] p-3">
            <span className="text-[10px] font-black">Show top bar</span>
            <input
              type="checkbox"
              checked={form.topBarEnabled}
              onChange={(e) => update('topBarEnabled', e.target.checked)}
            />
          </label>

          <input
            value={form.topBarText}
            onChange={(e) => update('topBarText', e.target.value)}
            className="mt-2 w-full rounded-2xl bg-[#F4F4F1] px-3 py-3 text-xs font-bold outline-none"
            placeholder="Announcement text"
          />
        </div>

        <div className="rounded-3xl bg-white p-4">
          <div className="flex items-center gap-2">
            <Settings2 size={16} />
            <h3 className="text-xs font-black">Rewards</h3>
          </div>

          <label className="mt-4 flex items-center justify-between rounded-2xl bg-[#F4F4F1] p-3">
            <span className="text-[10px] font-black">Show Rewards section</span>
            <input
              type="checkbox"
              checked={form.rewardsEnabled}
              onChange={(e) => update('rewardsEnabled', e.target.checked)}
            />
          </label>
        </div>

        <div className="rounded-3xl bg-white p-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <ImageIcon size={16} />
            <h3 className="text-xs font-black">Main Daily Deal Hero</h3>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-2xl bg-[#F4F4F1] p-3 md:col-span-2">
              <span className="text-[10px] font-black">Show daily hero</span>
              {form.heroEnabled ? <Eye size={15} /> : <EyeOff size={15} />}
              <input
                type="checkbox"
                checked={form.heroEnabled}
                onChange={(e) => update('heroEnabled', e.target.checked)}
              />
            </label>

            <input
              value={form.heroTitle}
              onChange={(e) => update('heroTitle', e.target.value)}
              className="rounded-2xl bg-[#F4F4F1] px-3 py-3 text-xs font-bold outline-none"
              placeholder="Hero title"
            />
            <input
              value={form.heroCta}
              onChange={(e) => update('heroCta', e.target.value)}
              className="rounded-2xl bg-[#F4F4F1] px-3 py-3 text-xs font-bold outline-none"
              placeholder="CTA text"
            />
            <input
              value={form.heroSubtitle}
              onChange={(e) => update('heroSubtitle', e.target.value)}
              className="rounded-2xl bg-[#F4F4F1] px-3 py-3 text-xs font-bold outline-none md:col-span-2"
              placeholder="Hero subtitle"
            />
            <div className="relative md:col-span-2">
              <ImageIcon className="absolute left-3 top-3.5 text-black/25" size={15} />
              <input
                value={form.heroImageUrl}
                onChange={(e) => update('heroImageUrl', e.target.value)}
                className="w-full rounded-2xl bg-[#F4F4F1] py-3 pl-9 pr-3 text-xs font-bold outline-none"
                placeholder="Daily deal image URL (ImgBB)"
              />
            </div>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-3.5 text-black/25" size={15} />
              <input
                value={form.heroLink}
                onChange={(e) => update('heroLink', e.target.value)}
                className="w-full rounded-2xl bg-[#F4F4F1] py-3 pl-9 pr-3 text-xs font-bold outline-none"
                placeholder="/shop"
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            <h3 className="text-xs font-black">Daily Deal Price Card</h3>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={form.dailyDealLabel}
              onChange={(e) => update('dailyDealLabel', e.target.value)}
              className="rounded-2xl bg-[#F4F4F1] px-3 py-3 text-xs font-bold outline-none"
              placeholder="DAILY DEAL"
            />
            <input
              value={form.dailyDealEndsText}
              onChange={(e) => update('dailyDealEndsText', e.target.value)}
              className="rounded-2xl bg-[#F4F4F1] px-3 py-3 text-xs font-bold outline-none"
              placeholder="Ends today"
            />
            <input
              value={form.dailyDealPrice}
              onChange={(e) => update('dailyDealPrice', e.target.value)}
              className="rounded-2xl bg-[#F4F4F1] px-3 py-3 text-xs font-bold outline-none"
              placeholder="Today price e.g. 999"
            />
            <input
              value={form.dailyDealOldPrice}
              onChange={(e) => update('dailyDealOldPrice', e.target.value)}
              className="rounded-2xl bg-[#F4F4F1] px-3 py-3 text-xs font-bold outline-none"
              placeholder="Old price e.g. 1999"
            />
            <input
              value={form.dailyDealImageUrl}
              onChange={(e) => update('dailyDealImageUrl', e.target.value)}
              className="rounded-2xl bg-[#F4F4F1] px-3 py-3 text-xs font-bold outline-none md:col-span-2"
              placeholder="Daily deal card image URL"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
