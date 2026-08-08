'use client';

// app/admin/page.tsx
//
// PrimeHub Deals — Admin Panel.
// Single-file, flat, paragraph-commented on purpose (per your code style
// request) so every section is easy to find/edit/delete independently.
//
// NOTE ON SECURITY: the password gate below is a client-side PIN screen
// only. It hides the admin UI from casual visitors, but it does NOT
// protect your Firestore data on its own. Make sure your Firestore
// security rules require real authentication before allowing reads/
// writes to `products`, `orders`, and `settings` — a PIN alone is not
// enough once this is live with real customer data.

import { useEffect, useState } from 'react';
import {
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
import { db } from '@/lib/firebase';
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
} from 'lucide-react';

// ==========================================
// SECTION: ADMIN AUTHENTICATION (PASSWORD GATE)
// ==========================================
// Simple PIN gate. Default password is "prime123" — change it below.
// Auth flag is remembered in localStorage so you're not re-entering the
// PIN on every page refresh.

const ADMIN_PASSWORD = 'prime123';

function AdminLoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === ADMIN_PASSWORD) {
      localStorage.setItem('ph_admin_authed', 'true');
      setError('');
      onSuccess();
    } else {
      setError('Incorrect password. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-[#14140F] flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-6 w-full max-w-xs flex flex-col gap-3"
      >
        <div className="w-12 h-12 rounded-full bg-[#0F6A5F] text-white flex items-center justify-center mx-auto mb-1">
          <Lock className="w-5 h-5" aria-hidden="true" />
        </div>
        <h1 className="text-center font-bold text-lg">phdeals Admin</h1>
        <p className="text-center text-xs text-black/50 mb-2">Enter the admin password to continue</p>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Password"
          autoFocus
          className="border border-black/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0F6A5F]"
        />
        {error && <p className="text-xs text-[#E1352B]">{error}</p>}
        <button
          type="submit"
          className="bg-[#14140F] text-white rounded-lg py-2.5 text-sm font-semibold mt-1"
        >
          Log In
        </button>
      </form>
    </div>
  );
}

// ==========================================
// SECTION: ADMIN HEADER & TAB NAVIGATION
// ==========================================

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

// ==========================================
// TAB 1: DASHBOARD OVERVIEW
// ==========================================

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

// ==========================================
// TAB 2: SITE SETTINGS MANAGER
// ==========================================

function SiteSettingsTab() {
  const [form, setForm] = useState<SiteSettings>({
    announcementText: '',
    whatsappNumber: '',
    freeShippingCount: 8,
    heroTitle: '',
    heroDiscountText: '',
    heroCountdownEndTime: '',
  });
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await setDoc(doc(db, 'settings', 'main'), form, { merge: true });
    setSaved(true);
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

// ==========================================
// TAB 3: PRODUCTS MANAGER (ADD / EDIT / DELETE)
// ==========================================

function ProductsTab({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [isWeekendSpecial, setIsWeekendSpecial] = useState(false);
  const [isFlashSale, setIsFlashSale] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  // File upload converts the chosen image to a base64 string and drops
  // it straight into the same imageUrl field. You can also just paste
  // an external URL (e.g. from ImgBB) into the text input instead.
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

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
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Delete this product?')) return;
    await deleteDoc(doc(db, 'products', id));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="font-bold text-base mb-4">Products Manager</h2>

      {/* Add product form */}
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

        <div>
          <label className="text-xs font-semibold block mb-1">Image URL (or upload below)</label>
          <input
            type="text"
            value={imageUrl.startsWith('data:') ? '' : imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://... or ImgBB link"
            className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
          <input type="file" accept="image/*" onChange={handleFileUpload} className="text-xs mt-1.5" />
          {imageUrl && (
            <img src={imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg mt-2 border border-black/10" />
          )}
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
          className="bg-[#14140F] text-white rounded-lg py-2.5 text-sm font-semibold md:col-span-2"
        >
          Add Product
        </button>
      </form>

      {/* Live product table */}
      <div className="bg-white rounded-xl border border-black/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-black/50 border-b border-black/10">
              <th className="p-3">Image</th>
              <th className="p-3">Title</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// TAB 4: CATEGORIES MANAGER
// ==========================================

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

// ==========================================
// TAB 5: REAL CUSTOMER ORDERS DASHBOARD
// ==========================================

function OrdersTab({ orders }: { orders: Order[] }) {
  async function handleStatusChange(id: string, status: string) {
    await updateDoc(doc(db, 'orders', id), { status });
  }

  function buildWhatsAppLink(order: Order) {
    const itemsList = order.items.map((i) => `${i.name} x${i.qty}`).join(', ');
    const text = `Hi ${order.customerName}, this is PrimeHub Deals regarding your order (Rs ${order.total}): ${itemsList}. Current status: ${order.status}.`;
    return `https://wa.me/${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="font-bold text-base mb-4">Customer Orders</h2>

      <div className="bg-white rounded-xl border border-black/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-black/50 border-b border-black/10">
              <th className="p-3">Customer</th>
              <th className="p-3">Items</th>
              <th className="p-3">Total</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-black/5 last:border-0 align-top">
                <td className="p-3">
                  <p className="font-medium">{o.customerName}</p>
                  <p className="text-black/50">{o.phone}</p>
                  <p className="text-black/40 text-[10px] max-w-[160px]">{o.address}</p>
                </td>
                <td className="p-3">
                  {o.items?.map((i, idx) => (
                    <p key={idx}>
                      {i.name} x{i.qty}
                    </p>
                  ))}
                </td>
                <td className="p-3 font-medium">Rs {o.total}</td>
                <td className="p-3">{o.paymentStatus}</td>
                <td className="p-3">
                  <select
                    value={o.status}
                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                    className="border border-black/15 rounded-lg px-2 py-1 text-xs outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="p-3">
                  <a
                    href={buildWhatsAppLink(o)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-[#0F6A5F] text-white px-2.5 py-1.5 rounded-full text-[11px] font-semibold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> Chat
                  </a>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-black/40">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// SECTION: MAIN ADMIN PAGE (AUTH GATE + TAB SWITCHER + FIRESTORE LISTENERS)
// ==========================================

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // check localStorage auth flag on mount
  useEffect(() => {
    setAuthed(localStorage.getItem('ph_admin_authed') === 'true');
    setCheckedAuth(true);
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

  function handleLogout() {
    localStorage.removeItem('ph_admin_authed');
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
