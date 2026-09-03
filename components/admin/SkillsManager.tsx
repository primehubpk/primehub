'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { ImagePlus, Loader2, Pencil, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import {
  adminCollection,
  createAdminDocument,
  deleteAdminDocument,
  getAdminDocument,
  setAdminDocument,
  updateAdminDocument,
  uploadImageToImgBB,
} from './shared';

type MediaType = 'image' | 'video-link' | 'external-link';
type SkillItem = {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  thumbnailUrl: string;
  mediaType: MediaType;
  externalUrl: string;
  whatsapp: string;
  buttonText: string;
  active: boolean;
  sortOrder: number;
};

type PageSettings = {
  eyebrow: string;
  title: string;
  description: string;
  ctaText: string;
  ctaWhatsapp: string;
};

const EMPTY_ITEM: Omit<SkillItem, 'id'> = {
  title: '', subtitle: '', price: 0, thumbnailUrl: '', mediaType: 'image', externalUrl: '', whatsapp: '', buttonText: 'Contact on WhatsApp', active: true, sortOrder: 1,
};
const DEFAULT_PAGE: PageSettings = {
  eyebrow: 'Prime Skills',
  title: 'Aap kya karte hain?',
  description: 'Apni skill ya service PrimeHub par add karwa sakte hain. Humein WhatsApp par batayein — hum aapki service, image, video ya link yahan professionally add kar denge.',
  ctaText: 'Apni Skill Add Karwayein',
  ctaWhatsapp: '03238878009',
};

export default function SkillsManager() {
  const [items, setItems] = useState<SkillItem[]>([]);
  const [page, setPage] = useState<PageSettings>(DEFAULT_PAGE);
  const [form, setForm] = useState<Omit<SkillItem, 'id'>>(EMPTY_ITEM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(adminCollection('prime_skills'), (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SkillItem);
      setItems(rows);
      setLoading(false);
    }, () => {
      setToast('Unable to load Prime Skills.');
      setLoading(false);
    });
    getAdminDocument('settings', 'main').then((snapshot) => {
      const saved = snapshot.exists() ? snapshot.data()?.skillsPage : null;
      if (saved) setPage({ ...DEFAULT_PAGE, ...saved });
    }).catch(() => setToast('Unable to load Prime Skills page settings.'));
    return unsubscribe;
  }, []);

  const sorted = useMemo(() => [...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), [items]);

  async function uploadThumbnail(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageToImgBB(file);
      setForm((current) => ({ ...current, thumbnailUrl: url }));
      setToast('Thumbnail uploaded.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Thumbnail upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function savePageSettings() {
    setSaving(true);
    try {
      await setAdminDocument('settings', 'main', { skillsPage: page });
      setToast('Prime Skills page settings saved.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to save page settings.');
    } finally {
      setSaving(false);
    }
  }

  async function saveItem() {
    if (!form.title.trim()) return setToast('Title is required.');
    if (!form.thumbnailUrl.trim()) return setToast('Thumbnail is required.');
    setSaving(true);
    const payload = { ...form, title: form.title.trim(), subtitle: form.subtitle.trim(), externalUrl: form.externalUrl.trim(), whatsapp: form.whatsapp.trim(), buttonText: form.buttonText.trim() || 'Contact on WhatsApp', price: Number(form.price) || 0, sortOrder: Number(form.sortOrder) || 0, updatedAt: new Date().toISOString() };
    try {
      if (editingId) await updateAdminDocument('prime_skills', editingId, payload);
      else await createAdminDocument('prime_skills', { ...payload, createdAt: new Date().toISOString() });
      setForm({ ...EMPTY_ITEM, sortOrder: Math.max(1, items.length + 1) });
      setEditingId(null);
      setToast(editingId ? 'Skill updated.' : 'Skill added.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to save skill.');
    } finally {
      setSaving(false);
    }
  }

  function editItem(item: SkillItem) {
    const { id, ...rest } = item;
    setEditingId(id);
    setForm({ ...EMPTY_ITEM, ...rest });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeItem(id: string) {
    if (!window.confirm('Delete this Prime Skill listing?')) return;
    try {
      await deleteAdminDocument('prime_skills', id);
      if (editingId === id) { setEditingId(null); setForm(EMPTY_ITEM); }
      setToast('Skill deleted.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to delete skill.');
    }
  }

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-black/50">Loading Prime Skills manager...</div>;

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center gap-2 text-[#0F6A5F]"><Sparkles size={16}/><span className="text-[10px] font-black uppercase tracking-[.16em]">Prime Skills</span></div>
      <h2 className="mt-1 text-2xl font-black">Skills & Services Manager</h2>
      <p className="mt-1 text-sm text-black/50">Manage page text, thumbnails, prices, WhatsApp contacts and external links. Storefront card connection comes in Phase 3.</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">Page Settings</h3><button onClick={savePageSettings} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-[#14140F] px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"><Save size={13}/>{saving ? 'Saving...' : 'Save'}</button></div>
            <div className="grid gap-3">
              <Field label="Small label" value={page.eyebrow} onChange={(value)=>setPage({...page,eyebrow:value})}/>
              <Field label="Main heading" value={page.title} onChange={(value)=>setPage({...page,title:value})}/>
              <label className="text-[10px] font-black text-black/55">Description<textarea value={page.description} onChange={(e)=>setPage({...page,description:e.target.value})} rows={4} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"/></label>
              <Field label="CTA button text" value={page.ctaText} onChange={(value)=>setPage({...page,ctaText:value})}/>
              <Field label="CTA WhatsApp" value={page.ctaWhatsapp} onChange={(value)=>setPage({...page,ctaWhatsapp:value})}/>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">{editingId ? 'Edit Listing' : 'Add Listing'}</h3>{editingId && <button onClick={()=>{setEditingId(null);setForm(EMPTY_ITEM)}} className="text-[10px] font-black text-[#E1352B]">Cancel edit</button>}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" value={form.title} onChange={(value)=>setForm({...form,title:value})}/>
              <Field label="Price" type="number" value={String(form.price)} onChange={(value)=>setForm({...form,price:Number(value)})}/>
              <div className="sm:col-span-2"><Field label="Short description" value={form.subtitle} onChange={(value)=>setForm({...form,subtitle:value})}/></div>
              <label className="text-[10px] font-black text-black/55">Media type<select value={form.mediaType} onChange={(e)=>setForm({...form,mediaType:e.target.value as MediaType})} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"><option value="image">Image</option><option value="video-link">Video link</option><option value="external-link">External link</option></select></label>
              <Field label="Sort order" type="number" value={String(form.sortOrder)} onChange={(value)=>setForm({...form,sortOrder:Number(value)})}/>
              <div className="sm:col-span-2"><Field label="External URL (YouTube / TikTok / Website)" value={form.externalUrl} onChange={(value)=>setForm({...form,externalUrl:value})}/></div>
              <Field label="WhatsApp number" value={form.whatsapp} onChange={(value)=>setForm({...form,whatsapp:value})}/>
              <Field label="Button text" value={form.buttonText} onChange={(value)=>setForm({...form,buttonText:value})}/>
              <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form,active:e.target.checked})}/> Active</label>
              <div className="sm:col-span-2">
                <input ref={inputRef} type="file" accept="image/*" onChange={uploadThumbnail} className="hidden"/>
                <button type="button" onClick={()=>inputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 text-xs font-black"><ImagePlus size={14}/>{uploading ? 'Uploading...' : form.thumbnailUrl ? 'Replace Thumbnail' : 'Upload Thumbnail'}</button>
                {form.thumbnailUrl && <div className="mt-3 aspect-video overflow-hidden rounded-xl bg-[#F4F4F1]"><img src={form.thumbnailUrl} alt="Thumbnail preview" className="h-full w-full object-cover"/></div>}
              </div>
              <button onClick={saveItem} disabled={saving || uploading} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#E1352B] px-4 py-3 text-xs font-black text-white disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin"/> : editingId ? <Save size={15}/> : <Plus size={15}/>} {saving ? 'Saving...' : editingId ? 'Update Listing' : 'Add Listing'}</button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black">Current Listings ({items.length})</h3>
          <div className="mt-4 space-y-3">
            {sorted.length === 0 && <div className="rounded-xl bg-[#F4F4F1] p-6 text-center text-xs font-bold text-black/40">No skills added yet.</div>}
            {sorted.map((item) => <div key={item.id} className="grid grid-cols-[120px_1fr] gap-3 rounded-xl border border-black/8 p-3 sm:grid-cols-[160px_1fr]">
              <div className="aspect-video overflow-hidden rounded-lg bg-[#F4F4F1]"><img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover"/></div>
              <div className="min-w-0"><div className="flex items-start justify-between gap-2"><div><p className="truncate text-sm font-black">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-black/50">{item.subtitle}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black ${item.active?'bg-[#0F6A5F]/10 text-[#0F6A5F]':'bg-black/5 text-black/40'}`}>{item.active?'ACTIVE':'HIDDEN'}</span></div><p className="mt-2 text-xs font-black">Rs {Number(item.price||0).toLocaleString()}</p><div className="mt-3 flex gap-2"><button onClick={()=>editItem(item)} className="inline-flex items-center gap-1 rounded-lg bg-black/5 px-2.5 py-1.5 text-[10px] font-black"><Pencil size={12}/>Edit</button><button onClick={()=>removeItem(item.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#E1352B]/10 px-2.5 py-1.5 text-[10px] font-black text-[#E1352B]"><Trash2 size={12}/>Delete</button></div></div>
            </div>)}
          </div>
        </div>
      </div>

      {toast && <div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-[#14140F] px-4 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>}
    </section>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-[10px] font-black text-black/55">{label}<input type={type} value={value} onChange={(e)=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"/></label>;
}
