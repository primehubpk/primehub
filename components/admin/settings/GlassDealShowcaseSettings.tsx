'use client';

import BogoDealSettings from './BogoDealSettings';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { getAdminDocument, listAdminDocuments, setAdminDocument } from '../shared';
import { DEFAULT_GLASS_OFFERS, resolveGlassOffers, resolveUnifiedDealCollection, type GlassOfferSettings } from '@/lib/glassOffers';

type AdminProduct = { id: string; title: string; price: number; imageUrl?: string; active?: boolean };

export default function GlassDealShowcaseSettings() {
  const [config, setConfig] = useState<GlassOfferSettings>(DEFAULT_GLASS_OFFERS);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const selected = useMemo(() => new Set(config.items.map((item) => item.productId)), [config.items]);
  const suggestions = useMemo(() => products.filter((product) =>
    !selected.has(product.id) && product.active !== false && (
      !search.trim() || (product.title + ' ' + product.id).toLowerCase().includes(search.trim().toLowerCase())
    )).slice(0, 12), [products, search, selected]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAdminDocument('settings', 'main'), listAdminDocuments('products')])
      .then(([settings, catalog]) => {
        if (cancelled) return;
        setConfig(resolveUnifiedDealCollection(settings.exists() ? settings.data() : {}));
        setProducts(catalog.docs.map((doc: { id: string; data: () => Record<string, any> }) => {
          const row = doc.data();
          return { id: doc.id, title: String(row.title || row.name || doc.id), price: Number(row.price) || 0,
            imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : '', active: row.active !== false };
        }));
      })
      .catch(() => { if (!cancelled) setNotice('Unable to load deals. Refresh Admin Panel and try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const patch = (next: Partial<GlassOfferSettings>) => setConfig((current) => ({ ...current, ...next }));
  const remove = (id: string) => patch({ items: config.items.filter((item) => item.productId !== id) });
  const move = (i: number, step: number) => {
    const target = i + step;
    if (target < 0 || target >= config.items.length) return;
    const items = [...config.items];
    [items[i], items[target]] = [items[target], items[i]];
    patch({ items });
  };

  async function save() {
    if (saving || loading) return;
    setSaving(true);
    setNotice('');
    try {
      const clean = resolveGlassOffers({ ...config, collectionVersion: 2 });
      if (clean.enabled && clean.items.length === 0) throw new Error('Select at least one product first.');
      if (clean.items.some((item) => !productMap.has(item.productId))) throw new Error('Some selected products no longer exist.');
      await setAdminDocument('settings', 'main', { glassDealShowcase: clean });
      setNotice('Mega Deals saved. These prices apply every day on Home, Deals, product pages and checkout.');
      setConfig(clean);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Saving failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <section className="mt-7 rounded-2xl border border-rose-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-xl font-black">Mega Deals — All Products</h3>
          <p className="mt-1 text-sm text-black/60">All former Weekly and Big Deal products are here at their same deal prices, available every day. Add products from any category.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={config.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />
          Show collection
        </label>
      </div>
      {loading ? <p className="mt-5 text-sm text-black/60">Loading products...</p> : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {([
              ['heading', 'Collection heading'],
              ['subtitle', 'Short description'],
            ] as const).map(([field, label]) => (
              <label key={field} className="text-xs font-bold">{label}
                <input className="mt-1 w-full rounded-xl border border-black/15 p-2.5 text-sm font-medium" value={config[field]}
                  maxLength={field === 'subtitle' ? 180 : field === 'heading' ? 90 : 28}
                  onChange={(event) => patch({ [field]: event.target.value })} />
              </label>
            ))}
          </div>
          <p className="mt-4 text-xs text-amber-800">Selling price is the price customers pay every day. Leave it blank to use the catalog price. Savings on the banner and cards are calculated from verified previous prices.</p>
          <div className="mt-4 rounded-xl border border-black/10 bg-stone-50 p-3">
            <label className="text-xs font-bold">Search any catalog category to add deals
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product title or ID" className="mt-1 w-full rounded-lg border border-black/15 bg-white p-2.5 text-sm" />
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {suggestions.map((product) => (
                <button type="button" key={product.id} disabled={config.items.length >= 100}
                  onClick={() => { patch({ items: [...config.items, { productId: product.id }] }); setSearch(''); }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-3 py-2 text-left text-xs hover:border-[#0f6a5f] disabled:opacity-40">
                  <span className="line-clamp-2">{product.title} <b className="text-[#c4261d]">Rs. {product.price.toLocaleString('en-PK')}</b></span>
                  <Plus size={16} className="shrink-0 text-[#0f6a5f]" />
                </button>
              ))}
            </div>
          </div>
          <p className="mt-4 text-sm font-black">{config.items.length} selected offers (drag-free reorder with arrows)</p>
          <div className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1">
            {config.items.map((item, index) => {
              const product = productMap.get(item.productId);
              return (
                <div key={item.productId} className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white p-2">
                  <span className="w-5 text-center text-xs font-black text-black/45">{index + 1}</span>
                  <span className="min-w-[150px] flex-1 text-xs font-semibold">{product?.title || item.productId}
                    <span className="block text-[#0f6a5f]">Selling Rs. {(item.dealPrice || product?.price || 0).toLocaleString('en-PK')}</span>
                  </span>
                  <label className="text-[10px] font-bold text-[#0f6a5f]">Selling price Rs.
                    <input type="number" min="1" step="1" value={item.dealPrice || ''} placeholder="Catalog price" className="ml-1 w-28 rounded-lg border p-1.5 text-xs"
                      onChange={(event) => patch({ items: config.items.map((entry, i) => i === index ? { ...entry, dealPrice: event.target.value ? Math.max(1, Number(event.target.value)) : undefined } : entry) })} />
                  </label>
                  <label className="text-[10px] font-bold text-black/70">Verified previous Rs.
                    <input type="number" min="0" step="1" value={item.referencePrice || ''}
                      placeholder="Optional" className="ml-1 w-24 rounded-lg border p-1.5 text-xs"
                      onChange={(event) => patch({ items: config.items.map((entry, i) =>
                        i === index ? { ...entry, referencePrice: event.target.value ? Math.max(0, Number(event.target.value)) : undefined } : entry) })} />
                  </label>
                  <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} className="p-1 disabled:opacity-20"><ArrowUp size={17} /></button>
                  <button type="button" aria-label="Move down" disabled={index === config.items.length - 1} onClick={() => move(index, 1)} className="p-1 disabled:opacity-20"><ArrowDown size={17} /></button>
                  <button type="button" aria-label="Remove deal" onClick={() => remove(item.productId)} className="p-1 text-red-600"><Trash2 size={17} /></button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={save} disabled={saving || config.items.length === 0}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f6a5f] px-4 py-3 text-sm font-black text-white disabled:opacity-50">
            {saving ? <Loader2 size={17} className="animate-spin" /> : null} Save Mega Deals
          </button>
          {notice ? <p role="status" className="mt-3 text-sm font-medium">{notice}</p> : null}
        </>
      )}
    </section>
    <BogoDealSettings />
    </>
  );
}
