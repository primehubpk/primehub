'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { ImagePlus, Loader2, Pencil, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { PRIME_SKILLS_SEED } from '@/lib/primeSkillsSeed';
import { adminCollection, createAdminDocument, deleteAdminDocument, getAdminDocument, setAdminDocument, updateAdminDocument, uploadImageToImgBB } from './shared';

type MediaType = 'image' | 'video-link' | 'external-link';
type SkillPackage = { id: string; name: string; price: number; description: string; active: boolean };
type SkillItem = { id: string; title: string; subtitle: string; price: number; thumbnailUrl: string; mediaType: MediaType; externalUrl: string; whatsapp: string; buttonText: string; active: boolean; sortOrder: number; packages?: SkillPackage[] };
type PageSettings = { eyebrow: string; title: string; description: string; ctaText: string; ctaWhatsapp: string };

type SkillForm = Omit<SkillItem, 'id'> & { packages: SkillPackage[] };
const EMPTY_ITEM: SkillForm = { title: '', subtitle: '', price: 0, thumbnailUrl: '', mediaType: 'image', externalUrl: '', whatsapp: '', buttonText: 'Order on WhatsApp', active: true, sortOrder: 1, packages: [] };
const DEFAULT_PAGE: PageSettings = { eyebrow: 'Prime Skills', title: 'Aap kya karte hain?', description: 'Apni skill ya service PrimeHub par add karwa sakte hain. Humein WhatsApp par batayein — hum aapki service, image, video ya link yahan professionally add kar denge.', ctaText: 'Apni Skill Add Karwayein', ctaWhatsapp: '03238878009' };

function newPackage(index: number): SkillPackage {
  return { id: `package-${Date.now()}-${index}`, name: '', price: 0, description: '', active: true };
}

export default function SkillsManager() {
  const [items, setItems] = useState<SkillItem[]>([]);
  const [page, setPage] = useState<PageSettings>(DEFAULT_PAGE);
  const [form, setForm] = useState<SkillForm>(EMPTY_ITEM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(adminCollection('prime_skills'), (snapshot) => {
      setItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SkillItem));
      setLoading(false);
    }, () => { setToast('Unable to load Prime Skills.'); setLoading(false); });
    getAdminDocument('settings', 'main').then((snapshot) => {
      const saved = snapshot.exists() ? snapshot.data()?.skillsPage : null;
      if (saved) setPage({ ...DEFAULT_PAGE, ...saved });
    }).catch(() => setToast('Unable to load Prime Skills page settings.'));
    return unsubscribe;
  }, []);

  const sorted = useMemo(() => [...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), [items]);

  async function uploadThumbnail(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setUploading(true);
    try { const url = await uploadImageToImgBB(file); setForm((current) => ({ ...current, thumbnailUrl: url })); setToast('Thumbnail uploaded.'); }
    catch (error) { setToast(error instanceof Error ? error.message : 'Thumbnail upload failed.'); }
    finally { setUploading(false); }
  }

  async function savePageSettings() {
    setSaving(true);
    try { await setAdminDocument('settings', 'main', { skillsPage: page }); setToast('Prime Skills page settings saved.'); }
    catch (error) { setToast(error instanceof Error ? error.message : 'Unable to save page settings.'); }
    finally { setSaving(false); }
  }

  async function seedStarterListings() {
    if (items.length > 0) return setToast('Starter listings are only available when the Prime Skills collection is empty.');
    setSaving(true);
    try {
      for (const starter of PRIME_SKILLS_SEED) {
        const { id: _seedId, ...payload } = starter;
        await createAdminDocument('prime_skills', { ...payload, packages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
      setToast('5 starter Prime Skills listings added.');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Unable to add starter listings.'); }
    finally { setSaving(false); }
  }

  function addPackage() {
    setForm((current) => ({ ...current, packages: [...current.packages, newPackage(current.packages.length + 1)] }));
  }

  function updatePackage(id: string, patch: Partial<SkillPackage>) {
    setForm((current) => ({ ...current, packages: current.packages.map((pkg) => pkg.id === id ? { ...pkg, ...patch } : pkg) }));
  }

  function removePackage(id: string) {
    setForm((current) => ({ ...current, packages: current.packages.filter((pkg) => pkg.id !== id) }));
  }

  async function saveItem() {
    if (!form.title.trim()) return setToast('Title is required.');
    if (!form.thumbnailUrl.trim()) return setToast('Thumbnail is required.');
    const packages = form.packages
      .map((pkg) => ({ ...pkg, name: pkg.name.trim(), description: pkg.description.trim(), price: Number(pkg.price) || 0 }))
      .filter((pkg) => pkg.name);
    setSaving(true);
    const payload = { ...form, packages, title: form.title.trim(), subtitle: form.subtitle.trim(), externalUrl: form.externalUrl.trim(), whatsapp: form.whatsapp.trim(), buttonText: form.buttonText.trim() || 'Order on WhatsApp', price: Number(form.price) || 0, sortOrder: Number(form.sortOrder) || 0, updatedAt: new Date().toISOString() };
    try {
      if (editingId) await updateAdminDocument('prime_skills', editingId, payload); else await createAdminDocument('prime_skills', { ...payload, createdAt: new Date().toISOString() });
      setForm({ ...EMPTY_ITEM, sortOrder: Math.max(1, items.length + 1), packages: [] }); setEditingId(null); setToast(editingId ? 'Skill updated.' : 'Skill added.');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Unable to save skill.'); }
    finally { setSaving(false); }
  }

  function editItem(item: SkillItem) {
    const { id, ...rest } = item;
    setEditingId(id);
    setForm({ ...EMPTY_ITEM, ...rest, packages: Array.isArray(item.packages) ? item.packages : [] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeItem(id: string) {
    if (!window.confirm('Delete this Prime Skill listing?')) return;
    try { await deleteAdminDocument('prime_skills', id); if (editingId === id) { setEditingId(null); setForm(EMPTY_ITEM); } setToast('Skill deleted.'); }
    catch (error) { setToast(error instanceof Error ? error.message : 'Unable to delete skill.'); }
  }

  if (loading) return <div className="mx-auto max-w-6xl px-3 py-6 text-sm text-black/50">Loading Prime Skills manager...</div>;

  return <section className="mx-auto max-w-6xl overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
    <div className="flex items-center gap-2 text-[#0F6A5F]"><Sparkles size={16}/><span className="text-[10px] font-black uppercase tracking-[.16em]">Prime Skills</span></div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="mt-1 text-xl font-black sm:text-2xl">Skills & Services Manager</h2><p className="mt-1 text-[13px] text-black/50">Manage skills, prices, custom packages and WhatsApp orders.</p></div>{items.length === 0 && <button onClick={seedStarterListings} disabled={saving} className="rounded-xl bg-[#0F6A5F] px-4 py-3 text-xs font-black text-white">Add 5 Starter Listings</button>}</div>

    <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">Page Settings</h3><button onClick={savePageSettings} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-[#14140F] px-3 py-2 text-[10px] font-black text-white"><Save size={13}/>Save</button></div><div className="grid gap-3"><Field label="Small label" value={page.eyebrow} onChange={(value)=>setPage({...page,eyebrow:value})}/><Field label="Main heading" value={page.title} onChange={(value)=>setPage({...page,title:value})}/><label className="text-[10px] font-black text-black/55">Description<textarea value={page.description} onChange={(e)=>setPage({...page,description:e.target.value})} rows={4} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"/></label><Field label="CTA button text" value={page.ctaText} onChange={(value)=>setPage({...page,ctaText:value})}/><Field label="CTA WhatsApp" value={page.ctaWhatsapp} onChange={(value)=>setPage({...page,ctaWhatsapp:value})}/></div></div>

        <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">{editingId ? 'Edit Listing' : 'Add Listing'}</h3>{editingId && <button onClick={()=>{setEditingId(null);setForm(EMPTY_ITEM)}} className="text-[10px] font-black text-[#E1352B]">Cancel edit</button>}</div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Title" value={form.title} onChange={(value)=>setForm({...form,title:value})}/><Field label="Base price (used if no packages)" type="number" value={String(form.price)} onChange={(value)=>setForm({...form,price:Number(value)})}/><div className="sm:col-span-2"><Field label="Short description" value={form.subtitle} onChange={(value)=>setForm({...form,subtitle:value})}/></div><Field label="WhatsApp number" value={form.whatsapp} onChange={(value)=>setForm({...form,whatsapp:value})}/><Field label="Button text" value={form.buttonText} onChange={(value)=>setForm({...form,buttonText:value})}/><Field label="Sort order" type="number" value={String(form.sortOrder)} onChange={(value)=>setForm({...form,sortOrder:Number(value)})}/><label className="flex min-h-11 items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form,active:e.target.checked})}/>Active</label><div className="sm:col-span-2"><Field label="External URL (optional)" value={form.externalUrl} onChange={(value)=>setForm({...form,externalUrl:value})}/></div>

            <div className="sm:col-span-2 rounded-2xl border border-[#0F6A5F]/15 bg-[#F3FAF8] p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#0F6A5F]">Packages</p><h4 className="mt-0.5 text-sm font-black">Silver, Gold, Premium — ya koi bhi naam</h4><p className="mt-1 text-[10px] text-black/45">Har skill ke liye jitne chahein packages add karein.</p></div><button type="button" onClick={addPackage} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#0F6A5F] px-3 py-2 text-[10px] font-black text-white"><Plus size={12}/>Add Package</button></div><div className="mt-3 space-y-2">{form.packages.length === 0 && <div className="rounded-xl border border-dashed border-black/10 bg-white px-3 py-4 text-center text-[10px] font-bold text-black/35">No packages. Base price will be used.</div>}{form.packages.map((pkg, index) => <div key={pkg.id} className="rounded-xl border border-black/8 bg-white p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-black uppercase text-black/35">Package {index + 1}</span><button type="button" onClick={()=>removePackage(pkg.id)} className="text-[#E1352B]"><Trash2 size={14}/></button></div><div className="grid gap-2 sm:grid-cols-2"><Field label="Package name" value={pkg.name} onChange={(value)=>updatePackage(pkg.id,{name:value})}/><Field label="Package price" type="number" value={String(pkg.price)} onChange={(value)=>updatePackage(pkg.id,{price:Number(value)})}/><label className="sm:col-span-2 text-[10px] font-black text-black/55">Package details<textarea value={pkg.description} onChange={(e)=>updatePackage(pkg.id,{description:e.target.value})} rows={3} placeholder="Example: 5 pages, responsive design, 2 revisions..." className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"/></label><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={pkg.active} onChange={(e)=>updatePackage(pkg.id,{active:e.target.checked})}/>Show this package</label></div></div>)}</div></div>

            <div className="sm:col-span-2"><input ref={inputRef} type="file" accept="image/*" onChange={uploadThumbnail} className="hidden"/><button type="button" onClick={()=>inputRef.current?.click()} disabled={uploading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-black/5 px-3 py-2 text-xs font-black"><ImagePlus size={14}/>{uploading ? 'Uploading...' : form.thumbnailUrl ? 'Replace Thumbnail' : 'Upload Thumbnail'}</button>{form.thumbnailUrl && <div className="mt-3 aspect-video overflow-hidden rounded-xl bg-[#F4F4F1]"><img src={form.thumbnailUrl} alt="Thumbnail preview" className="h-full w-full object-cover"/></div>}</div>
            <button onClick={saveItem} disabled={saving || uploading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#E1352B] px-4 py-3 text-xs font-black text-white disabled:opacity-50 sm:col-span-2">{saving ? <Loader2 size={15} className="animate-spin"/> : editingId ? <Save size={15}/> : <Plus size={15}/>} {saving ? 'Saving...' : editingId ? 'Update Listing' : 'Add Listing'}</button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"><h3 className="text-sm font-black">Current Listings ({items.length})</h3><div className="mt-4 space-y-3">{sorted.length === 0 && <div className="rounded-xl bg-[#F4F4F1] p-5 text-center text-xs font-bold text-black/40">No saved skills yet.</div>}{sorted.map((item) => { const packageCount = (item.packages || []).filter((pkg)=>pkg.active!==false).length; return <div key={item.id} className="grid gap-3 rounded-xl border border-black/8 p-3 sm:grid-cols-[150px_1fr]"><div className="aspect-video overflow-hidden rounded-lg bg-[#F4F4F1]"><img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover"/></div><div><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-black">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-black/50">{item.subtitle}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black ${item.active?'bg-[#0F6A5F]/10 text-[#0F6A5F]':'bg-black/5 text-black/40'}`}>{item.active?'ACTIVE':'HIDDEN'}</span></div><p className="mt-2 text-xs font-black">Rs {Number(item.price||0).toLocaleString()}</p>{packageCount > 0 && <p className="mt-1 text-[10px] font-black text-[#0F6A5F]">{packageCount} package{packageCount===1?'':'s'} configured</p>}<div className="mt-3 flex gap-2"><button onClick={()=>editItem(item)} className="inline-flex items-center gap-1 rounded-lg bg-black/5 px-3 py-2 text-[10px] font-black"><Pencil size={12}/>Edit</button><button onClick={()=>removeItem(item.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#E1352B]/10 px-3 py-2 text-[10px] font-black text-[#E1352B]"><Trash2 size={12}/>Delete</button></div></div></div>; })}</div></div>
    </div>

    {toast && <div role="status" className="fixed inset-x-3 bottom-20 z-50 rounded-xl bg-[#14140F] px-4 py-3 text-sm font-semibold text-white shadow-xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:max-w-sm">{toast}</div>}
  </section>;
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="min-w-0 text-[10px] font-black text-black/55">{label}<input type={type} value={value} onChange={(e)=>onChange(e.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"/></label>;
}
