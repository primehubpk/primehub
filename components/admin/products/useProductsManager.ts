'use client';

import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import {
  adminCollection,
  createAdminDocument,
  deleteAdminDocument,
  getAdminDocument,
  setAdminDocument,
  updateAdminDocument,
  uploadImageToImgBB,
} from '../shared';
import type { DailyDeal, PriceBucket, WeeklyDeal } from '@/lib/types';
import {
  DAYS,
  EMPTY_FORM,
  makeId,
  slugify,
  type CategoryOption,
  type ColorItem,
  type DealChoice,
  type MediaAsset,
  type Product,
  type ProductFormState,
  type VariantRow,
} from './ProductTypes';

function compressImage(file: File): Promise<File> {
  return Promise.resolve(file);
}

export function useProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [priceBuckets, setPriceBuckets] = useState<PriceBucket[]>([]);
  const [weeklyDeals, setWeeklyDeals] = useState<WeeklyDeal[]>([]);
  const [bigDeal, setBigDeal] = useState<DailyDeal | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [deal, setDeal] = useState<DealChoice>({ day: '', dealPrice: '' });
  const [bucketIds, setBucketIds] = useState<string[]>([]);
  const [colors, setColors] = useState<ColorItem[]>([]);
  const [colorDraft, setColorDraft] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [customSize, setCustomSize] = useState('');
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [uploadingColor, setUploadingColor] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => onSnapshot(
    adminCollection('products'),
    snapshot => setProducts(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Product)),
    error => setMessage(`Products could not load: ${error.message}`),
  ), []);

  useEffect(() => onSnapshot(
    adminCollection('categories'),
    snapshot => setCategories(
      snapshot.docs
        .map(item => ({ id: item.id, ...item.data() }) as CategoryOption)
        .filter(item => item.active !== false)
        .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999)),
    ),
    error => setMessage(`Categories could not load: ${error.message}`),
  ), []);

  useEffect(() => onSnapshot(
    adminCollection('media_assets'),
    snapshot => setMedia(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as MediaAsset)),
    () => undefined,
  ), []);

  useEffect(() => {
    getAdminDocument('settings', 'main')
      .then(snapshot => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as {
          priceBuckets?: PriceBucket[];
          weeklyDeals?: WeeklyDeal[];
          dailyDeal?: DailyDeal;
        };
        setPriceBuckets(Array.isArray(data.priceBuckets) ? data.priceBuckets.filter(bucket => bucket.active !== false) : []);
        setWeeklyDeals(Array.isArray(data.weeklyDeals) ? data.weeklyDeals : []);
        setBigDeal(data.dailyDeal || null);
      })
      .catch(error => setMessage(`Store settings could not load: ${error.message}`));
  }, []);

  const shown = useMemo(
    () => products.filter(product => product.title.toLowerCase().includes(query.toLowerCase()) || String(product.category || '').toLowerCase().includes(query.toLowerCase())),
    [products, query],
  );

  const gallery = useMemo(
    () => media.filter(asset => `${asset.name || ''} ${asset.url}`.toLowerCase().includes(gallerySearch.toLowerCase())),
    [media, gallerySearch],
  );

  useEffect(() => {
    setVariantRows(current => {
      const existing = new Map(current.map(row => [`${row.color}::${row.size}`, row]));
      const next: VariantRow[] = [];
      colors.filter(color => color.name.trim()).forEach(color => sizes.forEach(size => {
        const key = `${color.name.trim()}::${size}`;
        const old = existing.get(key);
        next.push({
          id: old?.id || makeId(),
          color: color.name.trim(),
          size,
          stock: old?.stock ?? (form.stock || '10'),
          imageUrl: color.imageUrl || form.images[0] || '',
        });
      }));
      return next;
    });
  }, [colors, sizes, form.stock, form.images]);

  function change(key: keyof ProductFormState, value: string | boolean | string[]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function toggleSize(size: string) {
    setSizes(current => current.includes(size) ? current.filter(item => item !== size) : [...current, size]);
  }

  function addCustomSize() {
    const value = customSize.trim();
    if (!value || sizes.includes(value)) return;
    setSizes(current => [...current, value]);
    setCustomSize('');
  }

  function addColor() {
    const name = colorDraft.trim();
    if (!name || colors.some(color => color.name.toLowerCase() === name.toLowerCase())) return;
    setColors(current => [...current, { id: makeId(), name, imageUrl: form.images[0] || '' }]);
    setColorDraft('');
  }

  function removeColor(id: string) {
    setColors(current => current.filter(color => color.id !== id));
  }

  function setColorImage(id: string, imageUrl: string) {
    setColors(current => current.map(color => color.id === id ? { ...color, imageUrl } : color));
  }

  function removeVariantRow(id: string) {
    setVariantRows(current => current.filter(row => row.id !== id));
  }

  function updateVariantStock(id: string, stock: string) {
    setVariantRows(current => current.map(row => row.id === id ? { ...row, stock } : row));
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    const remaining = Math.max(0, 6 - form.images.length);
    if (!files.length || !remaining) {
      event.target.value = '';
      return;
    }
    const selected = files.slice(0, remaining);
    setBusy(true);
    setMessage('');
    try {
      for (let index = 0; index < selected.length; index += 1) {
        setUploadingSlot(form.images.length + index);
        const file = await compressImage(selected[index]);
        const url = await uploadImageToImgBB(file);
        setForm(current => current.images.length >= 6 ? current : { ...current, images: [...current.images, url] });
        try {
          await createAdminDocument('media_assets', {
            name: selected[index].name,
            url,
            type: file.type,
            size: file.size,
            createdAt: new Date().toISOString(),
          });
        } catch {
          // Media library is auxiliary; the product image remains uploaded.
        }
      }
      setMessage(`${selected.length} image${selected.length > 1 ? 's' : ''} uploaded successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setBusy(false);
      setUploadingSlot(null);
      event.target.value = '';
    }
  }

  async function uploadColorPhoto(id: string, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingColor(id);
    try {
      const compressed = await compressImage(file);
      const url = await uploadImageToImgBB(compressed);
      setColorImage(id, url);
      setMessage('Color image uploaded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Color image upload failed.');
    } finally {
      setUploadingColor(null);
      event.target.value = '';
    }
  }

  function setMainImage(index: number) {
    if (index <= 0) return;
    setForm(current => {
      const images = [...current.images];
      const [main] = images.splice(index, 1);
      return { ...current, images: [main, ...images] };
    });
  }

  function removeImage(index: number) {
    setForm(current => ({ ...current, images: current.images.filter((_, i) => i !== index) }));
  }

  function reset() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDeal({ day: '', dealPrice: '' });
    setBucketIds([]);
    setColors([]);
    setColorDraft('');
    setSizes([]);
    setCustomSize('');
    setVariantRows([]);
    setMessage('');
  }

  function startEdit(product: Product) {
    const rawColors = Array.isArray((product as any).variantColors) ? (product as any).variantColors : [];
    const rawOptions = Array.isArray((product as any).variantOptions) ? (product as any).variantOptions : [];
    const colorOption = rawOptions.find((item: any) => item.id === 'color');
    const sizeOption = rawOptions.find((item: any) => item.id === 'size');
    const colorMap = (product as any).colorImages && typeof (product as any).colorImages === 'object' ? (product as any).colorImages : {};
    const firstImg = typeof product.images?.[0] === 'string'
      ? product.images[0]
      : (product.images?.[0] as any)?.url || (typeof product.imageUrl === 'string' ? product.imageUrl : '');
    const loadedColors: ColorItem[] = rawColors.length
      ? rawColors.map((item: any) => ({ id: makeId(), name: String(item.name || item), imageUrl: String(item.imageUrl || colorMap[item.name] || '') }))
      : (colorOption?.values || []).map((name: string) => ({ id: makeId(), name, imageUrl: String(colorMap[name] || firstImg || '') }));
    const original = Number((product as any).originalPrice ?? product.price ?? 0);
    const current = Number(product.price ?? 0);
    const existingDeal = weeklyDeals.find(item => item.productId === product.id);
    const isBig = bigDeal?.productId === product.id;
    const normalizedImages: string[] = (
      Array.isArray(product.images) && product.images.length > 0
        ? product.images.map((img: any) => typeof img === 'string' ? img : (img?.url || '')).filter(Boolean)
        : [typeof product.imageUrl === 'string' ? product.imageUrl : ''].filter(Boolean)
    ).slice(0, 6);

    setEditing(product);
    setForm({
      ...EMPTY_FORM,
      title: product.title,
      originalPrice: String(original || ''),
      discountPrice: current && current !== original ? String(current) : '',
      description: String(product.description || ''),
      category: String(product.category || ''),
      stock: String(product.stock ?? 0),
      videoUrl: String((product as any).videoUrl || ''),
      images: normalizedImages,
      featured: Boolean((product as any).featured),
      published: (product as any).published !== false,
    });
    setColors(loadedColors);
    setSizes((sizeOption?.values || []).map((value: string) => String(value)));
    setVariantRows(Array.isArray((product as any).variantMatrix)
      ? (product as any).variantMatrix.map((row: any) => ({
        id: row.id || makeId(),
        color: row.color || String(row.label || '').split(' / ')[0] || '',
        size: row.size || String(row.label || '').split(' / ')[1] || '',
        stock: String(row.stock ?? product.stock ?? 10),
        imageUrl: row.imageUrl || colorMap[row.color] || firstImg || '',
      }))
      : []);
    setDeal({
      day: isBig ? 'big' : (existingDeal?.day || ''),
      dealPrice: isBig ? String(bigDeal?.dealPrice || '') : String(existingDeal?.dealPrice || ''),
    });
    setBucketIds(Array.isArray((product as any).priceBucketIds) ? (product as any).priceBucketIds : []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function syncWeeklyDeal(productId: string) {
    const snapshot = await getAdminDocument('settings', 'main');
    const data = snapshot.exists() ? snapshot.data() as { weeklyDeals?: WeeklyDeal[]; dailyDeal?: DailyDeal } : {};
    let nextDeals = Array.isArray(data.weeklyDeals) ? data.weeklyDeals.filter(item => item.productId !== productId) : [];
    let nextBigDeal = data.dailyDeal || null;
    if (deal.day === 'big') {
      const dealPrice = Number(deal.dealPrice);
      const originalPrice = Number(form.originalPrice);
      if (!dealPrice || dealPrice >= originalPrice) throw new Error('Big Deal price must be lower than the original price.');
      nextDeals = nextDeals.filter(item => item.productId !== productId);
      nextBigDeal = {
        ...(nextBigDeal || {}),
        productId,
        imageUrl: form.images[0] || '',
        title: form.title.trim(),
        originalPrice,
        dealPrice,
        startAt: nextBigDeal?.startAt || '',
        endAt: nextBigDeal?.endAt || '',
        buttonText: 'Shop Big Deal',
        buttonLink: nextBigDeal?.buttonLink || '/deals/big',
        active: true,
      } as DailyDeal;
    } else if (deal.day) {
      const dealPrice = Number(deal.dealPrice);
      const originalPrice = Number(form.originalPrice);
      if (!dealPrice || dealPrice >= originalPrice) throw new Error('Deal price must be lower than the original price.');
      nextDeals = nextDeals.filter(item => item.day !== deal.day);
      nextDeals.push({
        id: `weekly-${deal.day}`,
        day: deal.day,
        label: 'One Day Deal',
        productId,
        imageUrl: form.images[0] || '',
        title: form.title.trim(),
        originalPrice,
        dealPrice,
        startAt: '',
        endAt: '',
        buttonText: 'Shop Deal',
        buttonLink: `/product/${productId}`,
        active: true,
      });
      if (nextBigDeal?.productId === productId) nextBigDeal = { ...nextBigDeal, productId: '', imageUrl: '', title: '', originalPrice: 0, dealPrice: 0, active: false };
    } else if (nextBigDeal?.productId === productId) {
      nextBigDeal = { ...nextBigDeal, productId: '', imageUrl: '', title: '', originalPrice: 0, dealPrice: 0, active: false };
    }
    await setAdminDocument('settings', 'main', { weeklyDeals: nextDeals, dailyDeal: nextBigDeal });
    setWeeklyDeals(nextDeals);
    setBigDeal(nextBigDeal);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.originalPrice || !form.category) {
      setMessage('Product name, original price and category are required.');
      return;
    }
    if (deal.day && (!deal.dealPrice || Number(deal.dealPrice) >= Number(form.originalPrice))) {
      setMessage('Deal price must be lower than the original price.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const originalPrice = Number(form.originalPrice);
      const salePrice = form.discountPrice ? Number(form.discountPrice) : originalPrice;
      if (salePrice > originalPrice) throw new Error('Discount price cannot be higher than original price.');
      const cleanColors = colors.map(color => ({ name: color.name.trim(), imageUrl: color.imageUrl || form.images[0] || '' })).filter(color => color.name);
      const cleanSizes = [...new Set(sizes.map(size => size.trim()).filter(Boolean))];
      const variantOptions = [{ id: 'color', name: 'Color', values: cleanColors.map(color => color.name) }, { id: 'size', name: 'Size', values: cleanSizes }];
      const colorImages = Object.fromEntries(cleanColors.map(color => [color.name, color.imageUrl]));
      const variantMatrix = variantRows.map(row => ({ id: row.id, label: `${row.color} / ${row.size}`, color: row.color, size: row.size, stock: Math.max(0, Number(row.stock || 0)), imageUrl: row.imageUrl || colorImages[row.color] || form.images[0] || '', sku: '', price: String(salePrice), salePrice: '', active: true }));
      const payload = { title: form.title.trim(), slug: slugify(form.title), price: salePrice, originalPrice, description: form.description, category: form.category, stock: Math.max(0, Number(form.stock || 0)), videoUrl: form.videoUrl.trim(), imageUrl: form.images[0] || '', images: form.images.slice(0, 6), colorImages, variantColors: cleanColors, variantOptions, variantMatrix, featured: form.featured, published: form.published, priceBucketIds: bucketIds, updatedAt: new Date().toISOString() };
      let productId = editing?.id || '';
      if (editing) await updateAdminDocument('products', editing.id, payload);
      else productId = (await createAdminDocument('products', { ...payload, isFlashSale: false, isWeekendSpecial: false, createdAt: new Date().toISOString() })).id;
      await syncWeeklyDeal(productId);
      setMessage(editing ? 'Product updated successfully.' : 'Product added successfully.');
      reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save product.');
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct(product: Product) {
    if (confirm(`Delete ${product.title}?`)) await deleteAdminDocument('products', product.id);
  }

  const bucketLabel = (id: string) => priceBuckets.find(bucket => bucket.id === id)?.title || id;
  const selectedDealLabel = deal.day === 'big' ? 'Big Deal' : deal.day ? DAYS.find(item => item.key === deal.day)?.label : 'No deal — regular product';

  return {
    products,
    categories,
    media,
    priceBuckets,
    weeklyDeals,
    bigDeal,
    form,
    deal,
    bucketIds,
    colors,
    colorDraft,
    sizes,
    customSize,
    variantRows,
    query,
    editing,
    busy,
    uploadingSlot,
    uploadingColor,
    showGallery,
    gallerySearch,
    message,
    shown,
    gallery,
    bucketLabel,
    selectedDealLabel,
    change,
    setQuery,
    setColorDraft,
    setCustomSize,
    setGallerySearch,
    setShowGallery,
    setDeal,
    setBucketIds,
    toggleSize,
    addCustomSize,
    addColor,
    removeColor,
    setColorImage,
    removeVariantRow,
    updateVariantStock,
    upload,
    uploadColorPhoto,
    setMainImage,
    removeImage,
    reset,
    startEdit,
    save,
    removeProduct,
    setMessage,
  };
}
