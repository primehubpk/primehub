'use client';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { adminCollection, createAdminDocument, deleteAdminDocument, getAdminDocument, setAdminDocument, updateAdminDocument, uploadImageToImgBB } from '../shared';
import type { PriceBucket } from '@/lib/types';
import { normalizePriceBuckets, sortPriceBuckets } from '@/lib/priceBucketUtils';
import { DEFAULT_BUCKETS, EMPTY_BUCKET, EMPTY_FORM, slugify, type CategoryFormState, type CategoryWithMeta, type GalleryTarget, type MediaAsset } from './CategoryTypes';

export function useCategoriesManager() {
  const [tab, setTab] = useState<'categories' | 'buckets'>('categories');
  const [categories, setCategories] = useState<CategoryWithMeta[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<PriceBucket[]>([]);
  const [bucketForm, setBucketForm] = useState<PriceBucket>(EMPTY_BUCKET);
  const [editingBucketId, setEditingBucketId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryTarget, setGalleryTarget] = useState<GalleryTarget>('category');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slugEditedRef = useRef(false);

  useEffect(() => onSnapshot(adminCollection('categories'), (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CategoryWithMeta).sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999)))), []);
  useEffect(() => onSnapshot(adminCollection('media_assets'), (snapshot) => setMedia(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MediaAsset))), []);
  useEffect(() => { getAdminDocument('settings', 'main').then((snapshot) => { const data = snapshot.exists() ? snapshot.data() : {}; const saved = Array.isArray(data.priceBuckets) ? data.priceBuckets as PriceBucket[] : []; setBuckets(saved.length ? sortPriceBuckets(saved) : DEFAULT_BUCKETS); }); }, []);

  const gallery = useMemo(() => media.filter((asset) => `${asset.name || ''} ${asset.url}`.toLowerCase().includes(gallerySearch.toLowerCase())), [media, gallerySearch]);
  const selectedUrl = galleryTarget === 'category' ? form.iconUrl : bucketForm.iconUrl;

  function handleTitleChange(title: string) { setForm((current) => ({ ...current, title, slug: slugEditedRef.current ? current.slug : slugify(title) })); }
  function handleSlugChange(slug: string) { slugEditedRef.current = true; setForm((current) => ({ ...current, slug })); }
  function startEdit(category: CategoryWithMeta) { slugEditedRef.current = true; setEditingId(category.id); setForm({ title: category.title, slug: category.slug || slugify(category.title), iconUrl: category.iconUrl || '', active: category.active !== false }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function cancelEdit() { slugEditedRef.current = false; setEditingId(null); setForm(EMPTY_FORM); }
  async function handleSave(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!form.title.trim()) return; setIsSaving(true); setToast(''); try { const payload = { title: form.title.trim(), slug: slugify(form.slug || form.title), iconUrl: form.iconUrl.trim(), active: form.active, sortOrder: editingId ? Number(categories.find((item) => item.id === editingId)?.sortOrder ?? categories.length + 1) : categories.length + 1 }; if (editingId) await updateAdminDocument('categories', editingId, payload); else await createAdminDocument('categories', payload); const wasEditing = Boolean(editingId); cancelEdit(); setToast(wasEditing ? 'Category updated.' : 'Category added.'); } catch { setToast('Unable to save category.'); } finally { setIsSaving(false); } }
  async function repairCategorySlugs() { if (!confirm('Repair all category links from their category names? Products will stay unchanged.')) return; setIsSaving(true); try { await Promise.all(categories.map((category) => updateAdminDocument('categories', category.id, { slug: slugify(category.title) }))); setToast('Category links repaired.'); } catch { setToast('Unable to repair category links.'); } finally { setIsSaving(false); } }
  async function remove(category: CategoryWithMeta) { if (!confirm(`Delete ${category.title}?`)) return; await deleteAdminDocument('categories', category.id); setToast('Category deleted.'); }
  async function toggleActive(category: CategoryWithMeta) { await updateAdminDocument('categories', category.id, { active: category.active === false }); }
  async function move(category: CategoryWithMeta, direction: -1 | 1) { const index = categories.findIndex((item) => item.id === category.id); const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= categories.length) return; const other = categories[nextIndex]; await Promise.all([updateAdminDocument('categories', category.id, { sortOrder: nextIndex + 1 }), updateAdminDocument('categories', other.id, { sortOrder: index + 1 })]); }

  function openGallery(target: GalleryTarget) { setGalleryTarget(target); setGallerySearch(''); setShowGallery(true); }
  function chooseGalleryImage(url: string) { if (galleryTarget === 'category') setForm((current) => ({ ...current, iconUrl: url })); else setBucketForm((current) => ({ ...current, iconUrl: url })); setShowGallery(false); }
  function uploadDevice() { fileInputRef.current?.click(); }
  async function uploadFromDevice(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setUploading(true); setToast(''); try { const url = await uploadImageToImgBB(file); await createAdminDocument('media_assets', { name: file.name, url, type: file.type, createdAt: new Date().toISOString(), source: 'admin-device' }); if (galleryTarget === 'category') setForm((current) => ({ ...current, iconUrl: url })); else setBucketForm((current) => ({ ...current, iconUrl: url })); setToast('Image uploaded and selected.'); } catch (error) { setToast(error instanceof Error ? error.message : 'Image upload failed.'); } finally { setUploading(false); } }

  function startBucketEdit(bucket: PriceBucket) { setEditingBucketId(bucket.id); setBucketForm({ ...bucket }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function cancelBucketEdit() { setEditingBucketId(null); setBucketForm({ ...EMPTY_BUCKET, id: '' }); }
  function changeBucket(updater: (current: PriceBucket) => PriceBucket) { setBucketForm(updater); }
  async function saveBucket(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!bucketForm.title.trim() || Number(bucketForm.amount) < 0) { setToast('Enter a bucket name and valid maximum price.'); return; } setIsSaving(true); setToast(''); try { const next = [...buckets]; const payload: PriceBucket = { ...bucketForm, id: editingBucketId || `bucket-${Date.now()}`, title: bucketForm.title.trim(), amount: Number(bucketForm.amount), sortOrder: editingBucketId ? Number(bucketForm.sortOrder) : next.length + 1 }; const index = editingBucketId ? next.findIndex((item) => item.id === editingBucketId) : -1; if (index >= 0) next[index] = payload; else next.push(payload); const normalized = normalizePriceBuckets(next); await setAdminDocument('settings', 'main', { priceBuckets: normalized }); const wasEditing = Boolean(editingBucketId); setBuckets(normalized); cancelBucketEdit(); setToast(wasEditing ? 'Price bucket updated.' : 'Price bucket created.'); } catch { setToast('Unable to save price bucket.'); } finally { setIsSaving(false); } }
  async function removeBucket(bucket: PriceBucket) { if (!confirm(`Delete price bucket “${bucket.title}”? Products assigned to it will no longer appear in this bucket.`)) return; const normalized = buckets.filter((item) => item.id !== bucket.id).map((item, i) => ({ ...item, sortOrder: i + 1 })); await setAdminDocument('settings', 'main', { priceBuckets: normalized }); setBuckets(normalized); setToast('Price bucket deleted.'); }
  async function toggleBucket(bucket: PriceBucket) { const normalized = buckets.map((item) => item.id === bucket.id ? { ...item, active: !item.active } : item); await setAdminDocument('settings', 'main', { priceBuckets: normalized }); setBuckets(normalized); }
  async function moveBucket(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= buckets.length) return; const next = [...buckets]; [next[index], next[target]] = [next[target], next[index]]; const normalized = next.map((item, i) => ({ ...item, sortOrder: i + 1 })); await setAdminDocument('settings', 'main', { priceBuckets: normalized }); setBuckets(normalized); }

  return { tab, setTab, categories, media, form, setForm, editingId, buckets, bucketForm, editingBucketId, isSaving, uploading, toast, showGallery, setShowGallery, gallerySearch, setGallerySearch, galleryTarget, fileInputRef, gallery, selectedUrl, handleTitleChange, handleSlugChange, repairCategorySlugs, startEdit, cancelEdit, handleSave, remove, toggleActive, move, openGallery, chooseGalleryImage, uploadDevice, uploadFromDevice, startBucketEdit, cancelBucketEdit, changeBucket, saveBucket, removeBucket, toggleBucket, moveBucket };
}
