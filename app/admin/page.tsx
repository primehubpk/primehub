'use client';

// app/admin/page.tsx
//
// PrimeHub Deals — Admin Panel.
// Single-file, flat, paragraph-commented on purpose so every section is
// easy to find/edit/delete independently.
//
// NOTE ON SECURITY: the admin login uses Firebase Authentication.
// Firestore rules additionally require the authenticated user
// to match the configured Firebase Authentication admin UID.

import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Product, Category, Order, SiteSettings } from '@/lib/types';
import {
  LayoutDashboard,
  Settings,
  Package,
  Tags,
  ClipboardList,
  Trash2,
  Lock,
  LogOut,
  MessageCircle,
  Loader2,
} from 'lucide-react';

// ==========================================================================
// SECTION: IMGBB CONFIG
// ==========================================================================
// Free image hosting used by the Products tab's file upload. Get your own
// key at https://api.imgbb.com/ if you ever need to rotate this one.
const IMGBB_API_KEY = 'f38fa84b03c7eaaeda2a4d3a164b116f';
const IMGBB_UPLOAD_URL = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;

// IMPORTANT: This must match the exact Firebase Authentication UID used
// in firebase/firestore.rules before production deployment.
// Set NEXT_PUBLIC_FIREBASE_ADMIN_UID in the deployment environment.
// Never put an email/password here.
const ADMIN_UID = process.env.NEXT_PUBLIC_FIREBASE_ADMIN_UID || 'REPLACE_WITH_ADMIN_UID';

// ==========================================================================
// SECTION 1: ADMIN LOGIN GATE
// ==========================================================================
// Firebase Authentication email/password login.

function AdminLoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);

      // Match the same admin UID used by Firestore Rules. A valid Firebase
      // login alone must never unlock the Admin UI.
      if (ADMIN_UID === 'REPLACE_WITH_ADMIN_UID') {
        await signOut(auth);
        setError('Admin UID is not configured yet. Set NEXT_PUBLIC_FIREBASE_ADMIN_UID before using the Admin panel.');
        return;
      }

      if (credential.user.uid !== ADMIN_UID) {
        await signOut(auth);
        setError('This Firebase account is not authorized for the PrimeHub Deals Admin panel.');
        return;
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      setError('Login failed. Check your Firebase Authentication email/password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#14140F] flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-3">
        <div className="w-12 h-12 rounded-full bg-[#0F6A5F] text-white flex items-center justify-center mx-auto mb-1">
          <Lock className="w-5 h-5" aria-hidden="true" />
        </div>
        <h1 className="text-center font-bold text-lg">phdeals Admin</h1>
        <p className="text-center text-xs text-black/50 mb-2">Sign in with the Firebase admin account.</p>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin email" autoFocus className="border border-black/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0F6A5F]" />
        <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="border border-black/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0F6A5F]" />
        {error && <p className="text-xs text-[#E1352B]">{error}</p>}
        <button disabled={busy} type="submit" className="bg-[#14140F] text-white rounded-lg py-2.5 text-sm font-semibold mt-1 disabled:opacity-50">
          {busy ? 'Signing in…' : 'Log In'}
        </button>
      </form>
    </div>
  );
}

// ==========================================================================
// SECTION 2: ADMIN NAVIGATION & HEADER
// ==========================================================================

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'settings', label: 'Site Settings', icon: Settings },
  { key: 'products', label: 'Products', icon: Package },
  { key: 'categories', label: 'Categories', icon: Tags },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
];

function AdminHeader({
  activeTab,
  setActiveTab,
  onLogout,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}) {
  return (
    <div className="bg-white border-b border-black/10 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">
          ph<span className="text-[#E1352B]">deals</span> <span className="text-black/40 font-normal text-sm">Admin</span>
        </h1>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1 text-xs text-black/50 hover:text-[#E1352B]"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" /> Logout
        </button>
      </div>
      <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto pb-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full whitespace-nowrap transition ${
              activeTab === key
                ? 'bg-[#14140F] text-white'
                : 'bg-black/5 text-black/60 hover:bg-black/10'
            }`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ==========================================================================
// TAB 1: DASHBOARD OVERVIEW
// ==========================================================================

function DashboardTab({ products, orders }: { products: Product[]; orders: Order[] }) {
  const totalProducts = products.length;

  const todaysOrders = orders.filter((o) => {
    if (!o.createdAt?.toDate) return false;
    const orderDate = o.createdAt.toDate();
    const now = new Date();
    return (
      orderDate.getDate() === now.getDate() &&
      orderDate.getMonth() === now.getMonth() &&
      orderDate.getFullYear() === now.getFullYear()
    );
  });

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const lowStockProducts = products.filter((p) => p.stock < 5);

  const stats = [
    { label: 'Total Products', value: totalProducts },
    { label: "Today's Orders", value: todaysOrders.length },
    { label: 'Total Revenue', value: `Rs ${totalRevenue.toLocaleString()}` },
    { label: 'Low Stock Alerts', value: lowStockProducts.length, alert: lowStockProducts.length > 0 },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="font-bold text-base mb-4">Dashboard Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border p-4 ${
              s.alert ? 'bg-[#FDECEC] border-[#E1352B]/30' : 'bg-white border-black/10'
            }`}
          >
            <p className="text-[11px] text-black/50 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.alert ? 'text-[#E1352B]' : 'text-[#14140F]'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {lowStockProducts.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2">Low Stock Products</h3>
          <ul className="bg-white rounded-xl border border-black/10 divide-y divide-black/5">
            {lowStockProducts.map((p) => (
              <li key={p.id} className="px-4 py-2.5 text-xs flex justify-between">
                <span>{p.title}</span>
                <span className="text-[#E1352B] font-semibold">{p.stock} left</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// TAB 2: SITE SETTINGS MANAGER
// ==========================================================================

function SiteSettingsTab() {
  const [form, setForm] = useState<SiteSettings>({
    announcementText: '',
    whatsappNumber: '',
    freeShippingCount: 5,
    heroTitle: '',
    heroDiscountText: '',
    heroCountdownEndTime: '',
    heroImageUrl: '',
    heroButtonText: 'Shop Today\'s Deal',
    heroButtonLink: '#',
    dailyDeal: {
      productId: '',
      imageUrl: '',
      title: '',
      originalPrice: 0,
      dealPrice: 0,
      startAt: '',
      endAt: '',
      buttonText: 'Shop Deal',
      buttonLink: '#',
      active: false,
    },
    weeklyDeals: [],
    youtubeGuide: {
      enabled: true,
      title: 'How To Order & List Products on PrimeHub Deals',
      videoId: 'dQw4w9WgXcQ',
      description: 'Watch this quick guide to learn how to order and list products on PrimeHub Deals.',
    },
    policies: {
      privacyPolicy: {
        title: 'Privacy Policy',
        content: 'This page explains how PrimeHub Deals handles customer information and order-related data. Please contact the store team if you need clarification about our privacy practices.',
      },
      terms: {
        title: 'Terms of Service',
        content: 'By using PrimeHub Deals, you agree to use the website for lawful shopping and communication. Product availability, pricing, delivery and other details may change as the store is updated.',
      },
      returnPolicy: {
        title: 'Return Policy',
        content: 'Please contact the PrimeHub Deals team for return or order assistance. Return eligibility and handling depend on the product and order circumstances.',
      },
    },
    priceBuckets: [
      { id: 'under-99', title: 'Under 99', amount: 99, iconUrl: '', accent: '#E1352B', sortOrder: 1, active: true },
      { id: 'under-300', title: 'Under 300', amount: 300, iconUrl: '', accent: '#0F6A5F', sortOrder: 2, active: true },
      { id: 'under-500', title: 'Under 500', amount: 500, iconUrl: '', accent: '#FFB020', sortOrder: 3, active: true },
      { id: 'under-1000', title: 'Under 1000', amount: 1000, iconUrl: '', accent: '#14140F', sortOrder: 4, active: true },
    ],
  });
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isHeroUploading, setIsHeroUploading] = useState(false);
  const [heroUploadError, setHeroUploadError] = useState('');
  const [isDailyDealUploading, setIsDailyDealUploading] = useState(false);
  const [dailyDealUploadError, setDailyDealUploadError] = useState('');
  const [isWeeklyDealUploading, setIsWeeklyDealUploading] = useState<string | null>(null);
  const [weeklyDealUploadError, setWeeklyDealUploadError] = useState<Record<string, string>>({});
  const [isBucketUploading, setIsBucketUploading] = useState<string | null>(null);
  const [bucketUploadError, setBucketUploadError] = useState<Record<string, string>>({});

  // Load existing settings once on mount
  useEffect(() => {
    async function loadSettings() {
      const snap = await getDoc(doc(db, 'settings', 'main'));
      if (snap.exists()) {
        setForm((prev) => ({ ...prev, ...(snap.data() as SiteSettings) }));
      }
      setLoaded(true);
    }
    loadSettings();
  }, []);

  function handleChange(field: keyof SiteSettings, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleDailyDealImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDailyDealUploading(true);
    setDailyDealUploadError('');

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(IMGBB_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (result.success) {
        setForm((prev: any) => ({
          ...prev,
          dailyDeal: { ...(prev.dailyDeal || {}), imageUrl: result.data.url },
        }));
      } else {
        setDailyDealUploadError('Daily Deal image upload failed. Try again.');
      }
    } catch {
      setDailyDealUploadError('Daily Deal image upload failed. Please check your connection.');
    } finally {
      setIsDailyDealUploading(false);
    }
  }

  async function handleWeeklyDealImageUpload(day: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsWeeklyDealUploading(day);
    setWeeklyDealUploadError((prev) => ({ ...prev, [day]: '' }));

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(IMGBB_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (!result.success) {
        setWeeklyDealUploadError((prev) => ({
          ...prev,
          [day]: 'Upload failed. Try again.',
        }));
        return;
      }

      setForm((prev: any) => ({
        ...prev,
        weeklyDeals: (prev.weeklyDeals || []).map((deal: any) =>
          deal.day === day ? { ...deal, imageUrl: result.data.url } : deal
        ),
      }));
    } catch {
      setWeeklyDealUploadError((prev) => ({
        ...prev,
        [day]: 'Upload failed. Please check your connection.',
      }));
    } finally {
      setIsWeeklyDealUploading(null);
    }
  }

  async function handleBucketIconUpload(bucketId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBucketUploading(bucketId);
    setBucketUploadError((prev) => ({ ...prev, [bucketId]: '' }));

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(IMGBB_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (!result.success) {
        setBucketUploadError((prev) => ({ ...prev, [bucketId]: 'Upload failed.' }));
        return;
      }

      setForm((prev: any) => ({
        ...prev,
        priceBuckets: (prev.priceBuckets || []).map((bucket: any) =>
          bucket.id === bucketId ? { ...bucket, iconUrl: result.data.url } : bucket
        ),
      }));
    } catch {
      setBucketUploadError((prev) => ({
        ...prev,
        [bucketId]: 'Upload failed. Please check your connection.',
      }));
    } finally {
      setIsBucketUploading(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await setDoc(doc(db, 'settings', 'main'), form, { merge: true });
    setSaved(true);
  }

  async function handleHeroImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsHeroUploading(true);
    setHeroUploadError('');

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(IMGBB_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (result.success) {
        handleChange('heroImageUrl', result.data.url);
      } else {
        setHeroUploadError('Hero image upload failed. Please try again or paste a URL.');
      }
    } catch {
      setHeroUploadError('Hero image upload failed. Please check your connection.');
    } finally {
      setIsHeroUploading(false);
    }
  }

  if (!loaded) {
    return <div className="max-w-5xl mx-auto px-4 py-6 text-sm text-black/50">Loading settings...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="font-bold text-base mb-4">Site Settings</h2>
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-black/10 p-5 flex flex-col gap-4 max-w-lg">

        <div>
          <label className="text-xs font-semibold block mb-1">Top Announcement Bar Text</label>
          <textarea
            value={form.announcementText}
            onChange={(e) => handleChange('announcementText', e.target.value)}
            rows={2}
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">WhatsApp Business Number</label>
          <input
            type="text"
            value={form.whatsappNumber}
            onChange={(e) => handleChange('whatsappNumber', e.target.value)}
            placeholder="923001234567 (no + or leading zero)"
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Free Shipping Minimum Items</label>
          <input
            type="number"
            value={form.freeShippingCount}
            onChange={(e) => handleChange('freeShippingCount', Number(e.target.value))}
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Hero Banner Title</label>
          <input
            type="text"
            value={form.heroTitle}
            onChange={(e) => handleChange('heroTitle', e.target.value)}
            placeholder="Flash Sale"
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Hero Banner Discount Text</label>
          <input
            type="text"
            value={form.heroDiscountText}
            onChange={(e) => handleChange('heroDiscountText', e.target.value)}
            placeholder="Up to 70% Off"
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>





        <div className="border-t border-black/10 pt-5">
          <div className="mb-3">
            <p className="text-sm font-black">PRICE BUCKETS — SHOP BY BUDGET</p>
            <p className="text-[11px] text-black/50">
              Set the budget tiles customers use to filter products.
            </p>
          </div>

          <div className="space-y-2">
            {[...(form.priceBuckets || [])]
              .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
              .map((bucket: any) => {
                const updateBucket = (patch: Record<string, any>) => {
                  setForm((prev: any) => ({
                    ...prev,
                    priceBuckets: (prev.priceBuckets || []).map((item: any) =>
                      item.id === bucket.id ? { ...item, ...patch } : item
                    ),
                  }));
                };

                return (
                  <div key={bucket.id} className="rounded-2xl border border-black/10 bg-[#F4F4F1] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <input
                        type="text"
                        value={bucket.title || ''}
                        onChange={(e) => updateBucket({ title: e.target.value })}
                        className="min-w-0 flex-1 border border-black/15 rounded-lg bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#0F6A5F]"
                      />
                      <label className="flex shrink-0 items-center gap-2 text-xs font-bold">
                        <input
                          type="checkbox"
                          checked={Boolean(bucket.active)}
                          onChange={(e) => updateBucket({ active: e.target.checked })}
                        />
                        ON
                      </label>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        min="1"
                        value={bucket.amount ?? 0}
                        onChange={(e) => updateBucket({ amount: Number(e.target.value) })}
                        placeholder="Amount"
                        className="border border-black/15 rounded-lg bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                      />
                      <input
                        type="text"
                        value={bucket.accent || ''}
                        onChange={(e) => updateBucket({ accent: e.target.value })}
                        placeholder="Accent"
                        className="border border-black/15 rounded-lg bg-white px-3 py-2 text-xs outline-none focus:border-[#0F6A5F]"
                      />
                      <input
                        type="number"
                        min="1"
                        value={bucket.sortOrder ?? 1}
                        onChange={(e) => updateBucket({ sortOrder: Number(e.target.value) })}
                        placeholder="Order"
                        className="border border-black/15 rounded-lg bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                      />
                    </div>

                    <div className="mt-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleBucketIconUpload(bucket.id, e)}
                        disabled={isBucketUploading === bucket.id}
                        className="text-xs"
                      />
                      {isBucketUploading === bucket.id && (
                        <p className="mt-1 text-[10px] text-[#0F6A5F]">Uploading...</p>
                      )}
                      {bucketUploadError[bucket.id] && (
                        <p className="mt-1 text-[10px] text-[#E1352B]">{bucketUploadError[bucket.id]}</p>
                      )}
                      <input
                        type="text"
                        value={bucket.iconUrl || ''}
                        onChange={(e) => updateBucket({ iconUrl: e.target.value })}
                        placeholder="Or paste icon/image URL"
                        className="mt-2 w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-xs outline-none focus:border-[#0F6A5F]"
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="border-t border-black/10 pt-5">
          <div className="mb-3">
            <p className="text-sm font-black">YOUTUBE GUIDE</p>
            <p className="text-[11px] text-black/50">
              Control the customer-facing tutorial without changing code. Video ID only; do not paste the full YouTube URL.
            </p>
          </div>

          <div className="grid gap-3">
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={Boolean(form.youtubeGuide?.enabled)}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    youtubeGuide: { ...(prev.youtubeGuide || {}), enabled: e.target.checked },
                  }))
                }
              />
              Show YouTube Guide
            </label>

            <input
              type="text"
              value={form.youtubeGuide?.title || ''}
              onChange={(e) =>
                setForm((prev: any) => ({
                  ...prev,
                  youtubeGuide: { ...(prev.youtubeGuide || {}), title: e.target.value },
                }))
              }
              placeholder="Guide title"
              className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
            />

            <input
              type="text"
              value={form.youtubeGuide?.videoId || ''}
              onChange={(e) =>
                setForm((prev: any) => ({
                  ...prev,
                  youtubeGuide: { ...(prev.youtubeGuide || {}), videoId: e.target.value.trim() },
                }))
              }
              placeholder="YouTube video ID, e.g. dQw4w9WgXcQ"
              className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
            />

            <textarea
              value={form.youtubeGuide?.description || ''}
              onChange={(e) =>
                setForm((prev: any) => ({
                  ...prev,
                  youtubeGuide: { ...(prev.youtubeGuide || {}), description: e.target.value },
                }))
              }
              placeholder="Short guide description"
              rows={2}
              className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
            />
          </div>
        </div>

        <div className="border-t border-black/10 pt-5">
          <div className="mb-3">
            <p className="text-sm font-black">POLICY PAGES</p>
            <p className="text-[11px] text-black/50">
              Edit customer-facing Privacy Policy, Terms of Service and Return Policy. Changes are saved to settings/main.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              ['privacyPolicy', 'Privacy Policy'],
              ['terms', 'Terms of Service'],
              ['returnPolicy', 'Return Policy'],
            ].map(([key, label]) => {
              const policy = (form.policies as any)?.[key] || { title: label, content: '' };

              return (
                <div key={key} className="rounded-2xl border border-black/10 bg-[#F4F4F1] p-3">
                  <input
                    type="text"
                    value={policy.title || ''}
                    onChange={(e) =>
                      setForm((prev: any) => ({
                        ...prev,
                        policies: {
                          ...(prev.policies || {}),
                          [key]: { ...policy, title: e.target.value },
                        },
                      }))
                    }
                    placeholder={`${label} title`}
                    className="w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                  />
                  <textarea
                    value={policy.content || ''}
                    onChange={(e) =>
                      setForm((prev: any) => ({
                        ...prev,
                        policies: {
                          ...(prev.policies || {}),
                          [key]: { ...policy, content: e.target.value },
                        },
                      }))
                    }
                    placeholder={`${label} content`}
                    rows={6}
                    className="mt-2 w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#0F6A5F]"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-black/10 pt-5">
          <div className="mb-3">
            <p className="text-sm font-black">WEEKLY DEALS — SUNDAY TO SATURDAY</p>
            <p className="text-[11px] text-black/50">
              Create one premium deal for each day. Cards appear in Sunday → Saturday order.
            </p>
          </div>

          <div className="space-y-3">
            {[
              ['sunday', 'Sunday'],
              ['monday', 'Monday'],
              ['tuesday', 'Tuesday'],
              ['wednesday', 'Wednesday'],
              ['thursday', 'Thursday'],
              ['friday', 'Friday'],
              ['saturday', 'Saturday'],
            ].map(([day, dayLabel]) => {
              const existing = (form.weeklyDeals || []).find((item: any) => item.day === day) || {
                id: `${day}-deal`,
                day,
                label: `${dayLabel} Deal`,
                productId: '',
                imageUrl: '',
                title: '',
                originalPrice: 0,
                dealPrice: 0,
                startAt: '',
                endAt: '',
                buttonText: 'View Deal',
                buttonLink: '#',
                active: false,
              };

              const update = (patch: Record<string, any>) => {
                setForm((prev: any) => {
                  const list = [...(prev.weeklyDeals || [])];
                  const index = list.findIndex((item: any) => item.day === day);
                  const next = { ...existing, ...patch };
                  if (index >= 0) list[index] = next;
                  else list.push(next);
                  return { ...prev, weeklyDeals: list };
                });
              };

              return (
                <div key={day} className="rounded-2xl border border-black/10 bg-[#F4F4F1] p-3">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-black">{dayLabel} Deal</p>
                      <p className="text-[10px] text-black/45">Premium daily weekly card</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={Boolean(existing.active)}
                        onChange={(e) => update({ active: e.target.checked })}
                      />
                      Active
                    </label>
                  </div>

                  <div className="grid gap-2">
                    <input
                      type="text"
                      value={existing.title || ''}
                      onChange={(e) => update({ title: e.target.value })}
                      placeholder={`${dayLabel} Deal title`}
                      className="w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                    />

                    <input
                      type="text"
                      value={existing.label || ''}
                      onChange={(e) => update({ label: e.target.value })}
                      placeholder={`${dayLabel} Deal`}
                      className="w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                    />

                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleWeeklyDealImageUpload(day, e)}
                        disabled={isWeeklyDealUploading === day}
                        className="text-xs"
                      />
                      {isWeeklyDealUploading === day && (
                        <p className="text-[10px] text-[#0F6A5F] mt-1">Uploading...</p>
                      )}
                      {weeklyDealUploadError[day] && (
                        <p className="text-[10px] text-[#E1352B] mt-1">{weeklyDealUploadError[day]}</p>
                      )}
                      <input
                        type="text"
                        value={existing.imageUrl || ''}
                        onChange={(e) => update({ imageUrl: e.target.value })}
                        placeholder="Or paste image URL"
                        className="mt-2 w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-xs outline-none focus:border-[#0F6A5F]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0"
                        value={existing.originalPrice ?? 0}
                        onChange={(e) => update({ originalPrice: Number(e.target.value) })}
                        placeholder="Original price"
                        className="w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                      />
                      <input
                        type="number"
                        min="0"
                        value={existing.dealPrice ?? 0}
                        onChange={(e) => update({ dealPrice: Number(e.target.value) })}
                        placeholder="Deal price"
                        className="w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="datetime-local"
                        value={existing.startAt || ''}
                        onChange={(e) => update({ startAt: e.target.value })}
                        className="w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-xs outline-none focus:border-[#0F6A5F]"
                      />
                      <input
                        type="datetime-local"
                        value={existing.endAt || ''}
                        onChange={(e) => update({ endAt: e.target.value })}
                        className="w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-xs outline-none focus:border-[#0F6A5F]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={existing.buttonText || ''}
                        onChange={(e) => update({ buttonText: e.target.value })}
                        placeholder="Button text"
                        className="w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                      />
                      <input
                        type="text"
                        value={existing.buttonLink || ''}
                        onChange={(e) => update({ buttonLink: e.target.value })}
                        placeholder="Button link"
                        className="w-full border border-black/15 rounded-lg bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                      />
                    </div>

                    {existing.imageUrl && (
                      <img
                        src={existing.imageUrl}
                        alt={`${dayLabel} Deal preview`}
                        className="h-28 w-full rounded-xl object-cover border border-black/10"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-black/10 pt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-black">DAILY DEAL — ONE DAY OFFER</p>
              <p className="text-[11px] text-black/50">This controls the large homepage deal.</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={Boolean(form.dailyDeal?.active)}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    dailyDeal: { ...(prev.dailyDeal || {}), active: e.target.checked },
                  }))
                }
              />
              Active
            </label>
          </div>

          <div className="grid gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1">Deal Title</label>
              <input
                type="text"
                value={form.dailyDeal?.title || ''}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    dailyDeal: { ...(prev.dailyDeal || {}), title: e.target.value },
                  }))
                }
                placeholder="Today's Big Deal"
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Deal Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleDailyDealImageUpload}
                disabled={isDailyDealUploading}
                className="text-xs"
              />
              {isDailyDealUploading && (
                <p className="text-xs text-[#0F6A5F] mt-1">Uploading to ImgBB...</p>
              )}
              {dailyDealUploadError && (
                <p className="text-xs text-[#E1352B] mt-1">{dailyDealUploadError}</p>
              )}
              <input
                type="text"
                value={form.dailyDeal?.imageUrl || ''}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    dailyDeal: { ...(prev.dailyDeal || {}), imageUrl: e.target.value },
                  }))
                }
                placeholder="Or paste image URL"
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm mt-2 outline-none focus:border-[#0F6A5F]"
              />
              {form.dailyDeal?.imageUrl && (
                <img
                  src={form.dailyDeal.imageUrl}
                  alt="Daily Deal preview"
                  className="w-full h-32 object-cover rounded-xl mt-2 border border-black/10"
                />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Product ID (optional for now)</label>
              <input
                type="text"
                value={form.dailyDeal?.productId || ''}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    dailyDeal: { ...(prev.dailyDeal || {}), productId: e.target.value },
                  }))
                }
                placeholder="We'll add product picker next"
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Original Price</label>
                <input
                  type="number"
                  min="0"
                  value={form.dailyDeal?.originalPrice ?? 0}
                  onChange={(e) =>
                    setForm((prev: any) => ({
                      ...prev,
                      dailyDeal: { ...(prev.dailyDeal || {}), originalPrice: Number(e.target.value) },
                    }))
                  }
                  className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Today&apos;s Deal Price</label>
                <input
                  type="number"
                  min="0"
                  value={form.dailyDeal?.dealPrice ?? 0}
                  onChange={(e) =>
                    setForm((prev: any) => ({
                      ...prev,
                      dailyDeal: { ...(prev.dailyDeal || {}), dealPrice: Number(e.target.value) },
                    }))
                  }
                  className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Start</label>
                <input
                  type="datetime-local"
                  value={form.dailyDeal?.startAt || ''}
                  onChange={(e) =>
                    setForm((prev: any) => ({
                      ...prev,
                      dailyDeal: { ...(prev.dailyDeal || {}), startAt: e.target.value },
                    }))
                  }
                  className="w-full border border-black/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#0F6A5F]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">End</label>
                <input
                  type="datetime-local"
                  value={form.dailyDeal?.endAt || ''}
                  onChange={(e) =>
                    setForm((prev: any) => ({
                      ...prev,
                      dailyDeal: { ...(prev.dailyDeal || {}), endAt: e.target.value },
                    }))
                  }
                  className="w-full border border-black/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#0F6A5F]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Button Text</label>
                <input
                  type="text"
                  value={form.dailyDeal?.buttonText || ''}
                  onChange={(e) =>
                    setForm((prev: any) => ({
                      ...prev,
                      dailyDeal: { ...(prev.dailyDeal || {}), buttonText: e.target.value },
                    }))
                  }
                  className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Button Link</label>
                <input
                  type="text"
                  value={form.dailyDeal?.buttonLink || ''}
                  onChange={(e) =>
                    setForm((prev: any) => ({
                      ...prev,
                      dailyDeal: { ...(prev.dailyDeal || {}), buttonLink: e.target.value },
                    }))
                  }
                  className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-black/10 pt-4">
          <p className="text-sm font-bold mb-3">Daily Deal Hero Image</p>
          <input
            type="file"
            accept="image/*"
            onChange={handleHeroImageUpload}
            disabled={isHeroUploading}
            className="text-xs mb-2"
          />

          {isHeroUploading && (
            <p className="text-xs text-[#0F6A5F] mb-2">Uploading hero image to ImgBB...</p>
          )}
          {heroUploadError && (
            <p className="text-xs text-[#E1352B] mb-2">{heroUploadError}</p>
          )}

          <input
            type="text"
            value={form.heroImageUrl}
            onChange={(e) => handleChange('heroImageUrl', e.target.value)}
            placeholder="Or paste the hero image URL"
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />

          {form.heroImageUrl && (
            <img
              src={form.heroImageUrl}
              alt="Daily deal preview"
              className="w-full h-36 object-cover rounded-xl mt-3 border border-black/10"
            />
          )}
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Hero Button Text</label>
          <input
            type="text"
            value={form.heroButtonText}
            onChange={(e) => handleChange('heroButtonText', e.target.value)}
            placeholder="Shop Today's Deal"
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Hero Button Link</label>
          <input
            type="text"
            value={form.heroButtonLink}
            onChange={(e) => handleChange('heroButtonLink', e.target.value)}
            placeholder="/shop or product URL"
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Countdown Timer End Time</label>
          <input
            type="datetime-local"
            value={form.heroCountdownEndTime?.slice(0, 16) || ''}
            onChange={(e) => handleChange('heroCountdownEndTime', new Date(e.target.value).toISOString())}
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>

        <button
          type="submit"
          className="bg-[#0F6A5F] text-white rounded-lg py-2.5 text-sm font-semibold mt-1"
        >
          Save Settings
        </button>
        {saved && <p className="text-xs text-[#0F6A5F] font-medium">Saved successfully.</p>}
      </form>
    </div>
  );
}

// ==========================================================================
// TAB 3: PRODUCTS MANAGER (WITH IMGBB & VIDEO LINK)
// ==========================================================================

function ProductsTab({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [isWeekendSpecial, setIsWeekendSpecial] = useState(false);
  const [isFlashSale, setIsFlashSale] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // ------------------------------------------------------------------------
  // PARAGRAPH: IMGBB IMAGE UPLOAD HANDLER
  // When the admin picks a file, it is sent straight to ImgBB. The
  // returned CDN URL (data.url) becomes the product's imageUrl. A small
  // "Uploading..." indicator shows while the request is in flight.
  // ------------------------------------------------------------------------
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(IMGBB_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setImageUrl(result.data.url);
      } else {
        setUploadError('Upload failed. Please try again or paste a URL instead.');
      }
    } catch (err) {
      setUploadError('Upload failed. Please check your connection and try again.');
    } finally {
      setIsUploading(false);
    }
  }

  // ------------------------------------------------------------------------
  // PARAGRAPH: ADD PRODUCT SUBMIT HANDLER
  // ------------------------------------------------------------------------
  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !price || !category) return;

    await addDoc(collection(db, 'products'), {
      title,
      price: Number(price),
      originalPrice: Number(originalPrice) || Number(price),
      category,
      stock: Number(stock) || 0,
      isWeekendSpecial,
      isFlashSale,
      imageUrl,
      videoUrl,
      createdAt: serverTimestamp(),
    });

    // reset form
    setTitle('');
    setPrice('');
    setOriginalPrice('');
    setCategory('');
    setStock('');
    setIsWeekendSpecial(false);
    setIsFlashSale(false);
    setImageUrl('');
    setVideoUrl('');
    setUploadError('');
  }

  // ------------------------------------------------------------------------
  // PARAGRAPH: DELETE PRODUCT HANDLER
  // ------------------------------------------------------------------------
  async function handleDeleteProduct(id: string) {
    if (!confirm('Delete this product?')) return;
    await deleteDoc(doc(db, 'products', id));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="font-bold text-base mb-4">Products Manager</h2>

      {/* ---------------------------------------------------------------- */}
      {/* PARAGRAPH: ADD PRODUCT FORM                                       */}
      {/* ---------------------------------------------------------------- */}
      <form
        onSubmit={handleAddProduct}
        className="bg-white rounded-xl border border-black/10 p-5 grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"
      >
        <div>
          <label className="text-xs font-semibold block mb-1">Product Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.title}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Price (Rs.)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Original Price (Rs.)</label>
          <input
            type="number"
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Stock Quantity</label>
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* PARAGRAPH: PRODUCT IMAGE — IMGBB UPLOAD + URL FALLBACK             */}
        {/* ---------------------------------------------------------------- */}
        <div className="md:col-span-2">
          <label className="text-xs font-semibold block mb-1">Product Image</label>

          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="text-xs mb-2"
          />

          {isUploading && (
            <p className="flex items-center gap-1.5 text-xs text-[#0F6A5F] mb-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              Uploading image to ImgBB...
            </p>
          )}

          {uploadError && <p className="text-xs text-[#E1352B] mb-2">{uploadError}</p>}

          <p className="text-[11px] text-black/40 mb-1">Or paste a direct image URL instead:</p>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />

          {imageUrl && (
            <img src={imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg mt-2 border border-black/10" />
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* PARAGRAPH: PRODUCT VIDEO / REEL LINK (OPTIONAL)                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="md:col-span-2">
          <label className="text-xs font-semibold block mb-1">Product Video / Reel Link (optional)</label>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="YouTube Shorts, Instagram Reel, or direct .mp4 link"
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
          <p className="text-[11px] text-black/40 mt-1">
            Shown on the storefront as a "Watch Video" badge on this product's card.
          </p>
        </div>

        <div className="flex items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-1.5 text-xs font-medium">
            <input
              type="checkbox"
              checked={isWeekendSpecial}
              onChange={(e) => setIsWeekendSpecial(e.target.checked)}
            />
            Saturday Special Deal?
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium">
            <input
              type="checkbox"
              checked={isFlashSale}
              onChange={(e) => setIsFlashSale(e.target.checked)}
            />
            Flash Sale Item?
          </label>
        </div>

        <button
          type="submit"
          disabled={isUploading}
          className="bg-[#14140F] text-white rounded-lg py-2.5 text-sm font-semibold md:col-span-2 disabled:opacity-40"
        >
          Add Product
        </button>
      </form>

      {/* ---------------------------------------------------------------- */}
      {/* PARAGRAPH: LIVE PRODUCT TABLE                                     */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-black/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-black/50 border-b border-black/10">
              <th className="p-3">Image</th>
              <th className="p-3">Title</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Video</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-black/5 last:border-0">
                <td className="p-3">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="w-10 h-10 object-cover rounded-lg" />
                  ) : (
                    <div className="w-10 h-10 bg-black/5 rounded-lg" />
                  )}
                </td>
                <td className="p-3 font-medium">{p.title}</td>
                <td className="p-3">Rs {p.price}</td>
                <td className="p-3">
                  <span className={p.stock < 5 ? 'text-[#E1352B] font-semibold' : ''}>{p.stock}</span>
                </td>
                <td className="p-3">{p.videoUrl ? '🎬 Yes' : '—'}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(p.id)}
                    className="text-[#E1352B] flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-black/40">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================================================
// TAB 4: CATEGORIES MANAGER
// ==========================================================================

function CategoriesTab({ categories }: { categories: Category[] }) {
  const [title, setTitle] = useState('');
  const [iconUrl, setIconUrl] = useState('');

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    await addDoc(collection(db, 'categories'), { title, iconUrl });
    setTitle('');
    setIconUrl('');
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('Delete this category?')) return;
    await deleteDoc(doc(db, 'categories', id));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="font-bold text-base mb-4">Categories Manager</h2>

      <form
        onSubmit={handleAddCategory}
        className="bg-white rounded-xl border border-black/10 p-5 flex flex-col md:flex-row gap-3 mb-6"
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Category title (e.g. Bangles)"
          required
          className="flex-1 border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
        />
        <input
          type="text"
          value={iconUrl}
          onChange={(e) => setIconUrl(e.target.value)}
          placeholder="Icon/image URL"
          className="flex-1 border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
        />
        <button type="submit" className="bg-[#14140F] text-white rounded-lg px-5 py-2 text-sm font-semibold">
          Add
        </button>
      </form>

      <div className="bg-white rounded-xl border border-black/10 divide-y divide-black/5">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              {c.iconUrl ? (
                <img src={c.iconUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-black/5" />
              )}
              <span className="text-sm font-medium">{c.title}</span>
            </div>
            <button
              type="button"
              onClick={() => handleDeleteCategory(c.id)}
              className="text-[#E1352B]"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================================================
// TAB 5: CUSTOMER ORDERS DASHBOARD
// ==========================================================================

function OrdersTab({ orders }: { orders: Order[] }) {
  async function handleStatusChange(id: string, status: Order['status']) {
    await updateDoc(doc(db, 'orders', id), { status, updatedAt: serverTimestamp() });
  }

  function buildWhatsAppLink(order: Order) {
    const itemsList = order.items.map((i) => `${i.title} x${i.quantity}`).join(', ');
    const phone = order.customer.phone.replace(/\D/g, '');
    const text = `Hi ${order.customer.name}, this is PrimeHub Deals regarding your order (Rs ${order.total}): ${itemsList}. Current status: ${order.status}.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="font-bold text-base mb-4">Customer Orders</h2>
      <div className="bg-white rounded-xl border border-black/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-black/50 border-b border-black/10">
            <th className="p-3">Customer</th><th className="p-3">Items</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-black/5 last:border-0 align-top">
                <td className="p-3"><p className="font-medium">{o.customer?.name || 'Customer'}</p><p className="text-black/50">{o.customer?.phone || '—'}</p><p className="text-black/40 text-[10px] max-w-[180px]">{o.customer?.address || '—'}, {o.customer?.city || ''}</p></td>
                <td className="p-3">{o.items?.map((i, idx) => <p key={idx}>{i.title} x{i.quantity}</p>)}</td>
                <td className="p-3 font-medium">Rs {Number(o.total || 0).toLocaleString()}</td>
                <td className="p-3">
                  <select value={o.status} onChange={(e) => handleStatusChange(o.id, e.target.value as Order['status'])} className="border border-black/15 rounded-lg px-2 py-1 text-xs outline-none">
                    <option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="p-3"><a href={buildWhatsAppLink(o)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-[#0F6A5F] text-white px-2.5 py-1.5 rounded-full text-[11px] font-semibold"><MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> Chat</a></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-black/40">No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================================================
// SECTION: MAIN ADMIN PAGE (AUTH GATE + TAB SWITCHER + FIRESTORE LISTENERS)
// ==========================================================================

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthed(false);
        setCheckedAuth(true);
        return;
      }

      // Keep UI authorization aligned with Firestore Rules. Any signed-in
      // non-admin account is immediately signed out.
      if (ADMIN_UID === 'REPLACE_WITH_ADMIN_UID' || user.uid !== ADMIN_UID) {
        await signOut(auth);
        setAuthed(false);
        setCheckedAuth(true);
        return;
      }

      setAuthed(true);
      setCheckedAuth(true);
    });
  }, []);

  // live Firestore listeners — only run once logged in
  useEffect(() => {
    if (!authed) return;

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]);
    });

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[]);
    });

    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(ordersQuery, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]);
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubOrders();
    };
  }, [authed]);

  async function handleLogout() {
    await signOut(auth);
    setAuthed(false);
  }

  if (!checkedAuth) return null; // avoid flash of login screen on refresh

  if (!authed) {
    return <AdminLoginGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F4F1]">
      <AdminHeader activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      {activeTab === 'dashboard' && <DashboardTab products={products} orders={orders} />}
      {activeTab === 'settings' && <SiteSettingsTab />}
      {activeTab === 'products' && <ProductsTab products={products} categories={categories} />}
      {activeTab === 'categories' && <CategoriesTab categories={categories} />}
      {activeTab === 'orders' && <OrdersTab orders={orders} />}
    </div>
  );
}
