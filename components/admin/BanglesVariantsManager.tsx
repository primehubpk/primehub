'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { ImagePlus, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { adminCollection, getAdminDocument, updateAdminDocument, uploadImageToImgBB, type Product } from './shared';

const QUICK_SIZES = ['2.4', '2.6', '2.8', '2.10', 'Free Size'];
type Color = { name: string; imageUrl: string };
type Row = { id: string; color: string; size: string; stock: string; imageUrl: string };

function id() { return Math.random().toString(36).slice(2, 10); }
function imagesOf(product?: Product | null) { return [...new Set([...(product?.images || []), product?.imageUrl].filter(Boolean) as string[])].slice(0, 6); }

export default function BanglesVariantsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [customSize, setCustomSize] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => onSnapshot(adminCollection('products'), snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Product))), []);
  const product = useMemo(() => products.find(p => p.id === productId) || null, [products, productId]);
  const productImages = useMemo(() => imagesOf(product), [product]);

  useEffect(() => {
    if (!product) { setColors([]); setSizes([]); setRows([]); return; }
    const rawColors = Array.isArray((product as any).variantColors) ? (product as any).variantColors : [];
    const rawOptions = Array.isArray((product as any).variantOptions) ? (product as any).variantOptions : [];
    const colorOption = rawOptions.find((o: any) => o.id === 'color');
    const sizeOption = rawOptions.find((o: any) => o.id === 'size');
    const colorImages = (product as any).colorImages || {};
    setColors(rawColors.length ? rawColors : (colorOption?.values || []).map((name: string) => ({ name, imageUrl: colorImages[name] || productImages[0] || '' })));
    setSizes(sizeOption?.values || []);
    setRows(Array.isArray((product as any).variantMatrix) ? (product as any).variantMatrix.map((r: any) => ({ id: r.id || id(), color: r.color || String(r.label || '').split(' / ')[0] || '', size: r.size || String(r.label || '').split(' / ')[1] || '', stock: String(r.stock ?? 0), imageUrl: r.imageUrl || productImages[0] || '' })) : []);
  }, [productId]);

  function addColor() { setColors(c => [...c, { name: '', imageUrl: productImages[0] || '' }]); }
  function addSize(size = '') { if (!size || sizes.includes(size)) return; setSizes(s => [...s, size]); }
  function removeColor(index: number) { setColors(c => c.filter((_, i) => i !== index)); }
  function removeSize(size: string) { setSizes(s => s.filter(v => v !== size)); }
  function generate() {
    const validColors = colors.map(c => c.name.trim()).filter(Boolean);
    const validSizes = sizes.filter(Boolean);
    setRows(validColors.flatMap(color => validSizes.map(size => ({ id: id(), color, size, stock: String(product?.stock ?? 0), imageUrl: colors.find(c => c.name.trim() === color)?.imageUrl || productImages[0] || '' }))));
  }
  async function uploadColor(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setUploading(String(index));
    try { const url = await uploadImageToImgBB(file); setColors(c => c.map((item, i) => i === index ? { ...item, imageUrl: url } : item)); setMessage('Color image uploaded.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Image upload failed.'); }
    finally { setUploading(null); event.target.value = ''; }
  }
  async function save() {
    if (!product) return; setSaving(true); setMessage('');
    try {
      const variantColors = colors.map(c => ({ name: c.name.trim(), imageUrl: c.imageUrl })).filter(c => c.name);
      const variantOptions = [
        { id: 'color', name: 'Color', values: variantColors.map(c => c.name) },
        { id: 'size', name: 'Size', values: sizes },
      ];
      const variantMatrix = rows.map(r => ({ ...r, label: `${r.color} / ${r.size}`, sku: '', price: String(product.price ?? ''), salePrice: '', active: true }));
      const colorImages = Object.fromEntries(variantColors.map(c => [c.name, c.imageUrl]));
      await updateAdminDocument('products', product.id, { variantColors, variantOptions, variantMatrix, colorImages, updatedAt: new Date().toISOString() });
      setMessage('Bangles variants saved successfully.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save variants.'); }
    finally { setSaving(false); }
  }

  return <section className="mx-auto max-w-6xl px-4 pb-6">
    <div className="rounded-3xl border border-black/8 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#0F6A5F]">Product configuration</p><h3 className="mt-1 text-xl font-black">Bangles Variants</h3><p className="mt-1 text-xs text-black/45">Shopify-style colors, image binding, quick bangle sizes and clean combinations.</p></div>
        <select value={productId} onChange={e => setProductId(e.target.value)} className="w-full rounded-xl border border-black/8 bg-[#F8F8F5] p-3 text-sm md:w-80"><option value="">Select a product</option>{products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
      </div>
      {!product ? <div className="mt-5 rounded-2xl bg-[#F8F8F5] p-8 text-center text-sm text-black/40">Select a product to manage its bangle colors and sizes.</div> : <>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-black/8 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-black">Colors</p><p className="text-[10px] text-black/40">Attach a product image or upload a dedicated color photo.</p></div><button type="button" onClick={addColor} className="rounded-xl bg-[#0F6A5F]/10 px-3 py-2 text-[10px] font-black text-[#0F6A5F]"><Plus size={13} className="mr-1 inline"/>Add Color</button></div><div className="mt-3 space-y-2">{colors.map((color, index) => <div key={index} className="flex items-center gap-2 rounded-xl bg-[#F8F8F5] p-2"><img src={color.imageUrl || productImages[0] || ''} alt="" className="h-10 w-10 rounded-lg object-cover"/><input value={color.name} onChange={e => setColors(c => c.map((x, i) => i === index ? { ...x, name: e.target.value } : x))} placeholder="Red / Golden / Bottle Green" className="min-w-0 flex-1 rounded-lg bg-white p-2 text-xs font-semibold"/><select value={color.imageUrl} onChange={e => setColors(c => c.map((x, i) => i === index ? { ...x, imageUrl: e.target.value } : x))} className="max-w-32 rounded-lg bg-white p-2 text-[10px]"><option value="">Main image</option>{productImages.map((url, i) => <option key={url} value={url}>Image {i + 1}</option>)}</select><label className="cursor-pointer rounded-lg bg-black px-2.5 py-2 text-[9px] font-black text-white">{uploading === String(index) ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>}<input type="file" accept="image/*" className="hidden" onChange={e => uploadColor(index, e)}/></label><button type="button" onClick={() => removeColor(index)} className="rounded-lg bg-red-50 p-2 text-[#E1352B]"><Trash2 size={13}/></button></div>)}</div></div>
          <div className="rounded-2xl border border-black/8 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-black">Sizes</p><p className="text-[10px] text-black/40">One-click standard bangle sizes plus custom sizes.</p></div></div><div className="mt-3 flex flex-wrap gap-2">{QUICK_SIZES.map(size => <button type="button" key={size} onClick={() => addSize(size)} className={`rounded-full px-3 py-2 text-[10px] font-black ${sizes.includes(size) ? 'bg-[#14140F] text-white' : 'bg-[#F8F8F5] text-black/65'}`}>{size}</button>)}</div><div className="mt-3 flex gap-2"><input value={customSize} onChange={e => setCustomSize(e.target.value)} placeholder="Custom size" className="min-w-0 flex-1 rounded-xl bg-[#F8F8F5] p-3 text-xs"/><button type="button" onClick={() => { addSize(customSize.trim()); setCustomSize(''); }} className="rounded-xl bg-[#0F6A5F] px-4 text-xs font-black text-white">Add</button></div><div className="mt-3 flex flex-wrap gap-2">{sizes.map(size => <button type="button" key={size} onClick={() => removeSize(size)} className="rounded-full bg-black/5 px-3 py-1.5 text-[10px] font-bold">{size} ×</button>)}</div></div>
        </div>
        <div className="mt-4 rounded-2xl border border-black/8 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">Generated Combinations</p><p className="text-[10px] text-black/40">Each row keeps its selected image, color, size and stock.</p></div><button type="button" onClick={generate} className="rounded-xl bg-[#14140F] px-4 py-2.5 text-[10px] font-black text-white">Generate Combinations</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead><tr className="border-b border-black/8 text-[10px] uppercase tracking-wider text-black/35"><th className="p-2">Image</th><th className="p-2">Color</th><th className="p-2">Size</th><th className="p-2">Stock Quantity</th><th className="p-2 text-right">Delete</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id} className="border-b border-black/5"><td className="p-2"><img src={row.imageUrl || productImages[0] || ''} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-black/5"/></td><td className="p-2 font-bold">{row.color}</td><td className="p-2">{row.size}</td><td className="p-2"><input type="number" min="0" value={row.stock} onChange={e => setRows(r => r.map((x, i) => i === index ? { ...x, stock: e.target.value } : x))} className="w-28 rounded-lg bg-[#F8F8F5] p-2"/></td><td className="p-2 text-right"><button type="button" onClick={() => setRows(r => r.filter((_, i) => i !== index))} className="rounded-lg bg-red-50 p-2 text-[#E1352B]"><Trash2 size={13}/></button></td></tr>)}</tbody></table>{!rows.length && <div className="py-8 text-center text-xs text-black/35"><ImagePlus className="mx-auto mb-2" size={20}/>Generate combinations to see the premium table.</div>}</div></div>
        <div className="mt-4 flex justify-end"><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-6 py-3 text-xs font-black text-white disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin"/>}{saving ? 'Saving…' : 'Save Bangles Variants'}</button></div>
        {message && <p className="mt-3 rounded-xl bg-[#0F6A5F] px-4 py-3 text-xs font-bold text-white">{message}</p>}
      </>}
    </div>
  </section>;
}
