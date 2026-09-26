'use client';

import { useMemo, useState } from 'react';
import CategoryForm from './categories/CategoryForm';
import CategoryGallery from './categories/CategoryGallery';
import CategoryList from './categories/CategoryList';
import BucketForm from './categories/BucketForm';
import BucketList from './categories/BucketList';
import { useCategoriesManager } from './categories/useCategoriesManager';

const LEGACY_CATEGORY_IMAGE_URL = /^https:\/\/i\.ibb\.co\//i;

export default function CategoriesManager() {
  const manager = useCategoriesManager();
  const [migratingImages, setMigratingImages] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState('');
  const legacyCategoryCount = useMemo(
    () => manager.categories.filter((category) => [category.iconUrl, category.imageUrl].some((url) => LEGACY_CATEGORY_IMAGE_URL.test(String(url || '').trim()))).length,
    [manager.categories],
  );

  async function migrateLegacyCategoryImages() {
    if (legacyCategoryCount <= 0 || migratingImages) return;
    if (!confirm(`Move ${legacyCategoryCount} legacy category image${legacyCategoryCount === 1 ? '' : 's'} to Cloudflare R2? Category names, order and product links will stay unchanged.`)) return;

    setMigratingImages(true);
    setMigrationMessage('Moving legacy category images to R2...');
    try {
      let migrated = 0;
      let remaining = legacyCategoryCount;
      for (let batch = 0; batch < 20 && remaining > 0; batch += 1) {
        const response = await fetch('/api/admin/categories/migrate-r2', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) throw new Error(result?.error || 'Category migration failed.');

        const movedThisBatch = Number(result.migrated || 0);
        migrated += movedThisBatch;
        remaining = Math.max(0, Number(result.remaining || 0));
        if (remaining > 0 && movedThisBatch <= 0) {
          const firstFailure = Array.isArray(result.failures) ? result.failures[0]?.error : '';
          throw new Error(firstFailure || `${remaining} category image(s) could not be migrated.`);
        }
        if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      setMigrationMessage(remaining === 0 ? `Moved ${migrated} category image${migrated === 1 ? '' : 's'} to R2.` : `Moved ${migrated}; ${remaining} still need attention.`);
    } catch (error) {
      setMigrationMessage(error instanceof Error ? error.message : 'Category migration failed.');
    } finally {
      setMigratingImages(false);
    }
  }

  return <section className="mx-auto max-w-5xl px-4 py-6">
    <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Store taxonomy</p><h2 className="mt-1 text-2xl font-black">Categories & Price Buckets</h2><p className="mt-1 text-sm text-black/50">Categories, category icons and storefront price buckets are managed here.</p></div>
    <div className="mt-5 flex gap-2 rounded-2xl border border-black/10 bg-white p-2"><button type="button" onClick={() => manager.setTab('categories')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black ${manager.tab === 'categories' ? 'bg-[#14140F] text-white' : 'bg-black/5'}`}>Categories</button><button type="button" onClick={() => manager.setTab('buckets')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black ${manager.tab === 'buckets' ? 'bg-[#14140F] text-white' : 'bg-black/5'}`}>Price Buckets</button></div>
    {manager.tab === 'categories' && <>
      <CategoryForm form={manager.form} editingId={manager.editingId} isSaving={manager.isSaving} uploading={manager.uploading} fileInputRef={manager.fileInputRef} onTitleChange={manager.handleTitleChange} onSlugChange={manager.handleSlugChange} onOpenGallery={() => manager.openGallery('category')} onUploadDevice={manager.uploadDevice} onActiveChange={(active) => manager.setForm((current) => ({ ...current, active }))} onSubmit={manager.handleSave} onCancel={manager.cancelEdit} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={manager.isSaving} onClick={manager.repairCategorySlugs} className="rounded-xl bg-[#E1352B] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Repair all category links</button>
        <button type="button" disabled={migratingImages || legacyCategoryCount === 0} onClick={migrateLegacyCategoryImages} className="rounded-xl bg-[#0F6A5F] px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
          {migratingImages ? 'Moving category images...' : legacyCategoryCount > 0 ? `Move ${legacyCategoryCount} legacy image${legacyCategoryCount === 1 ? '' : 's'} to R2` : 'Category images are on R2'}
        </button>
      </div>
      {migrationMessage && <p className="mt-2 text-xs font-semibold text-[#0F6A5F]">{migrationMessage}</p>}
      <CategoryList categories={manager.categories} onMove={manager.move} onToggleActive={manager.toggleActive} onEdit={manager.startEdit} onRemove={manager.remove} />
    </>}
    {manager.tab === 'buckets' && <>
      <BucketForm bucketForm={manager.bucketForm} editingBucketId={manager.editingBucketId} isSaving={manager.isSaving} uploading={manager.uploading} fileInputRef={manager.fileInputRef} onChange={manager.changeBucket} onOpenGallery={() => manager.openGallery('bucket')} onUploadDevice={manager.uploadDevice} onSubmit={manager.saveBucket} onCancel={manager.cancelBucketEdit} />
      <BucketList buckets={manager.buckets} onMove={manager.moveBucket} onToggle={manager.toggleBucket} onEdit={manager.startBucketEdit} onRemove={manager.removeBucket} />
    </>}
    <input ref={manager.fileInputRef} type="file" accept="image/*" className="hidden" onChange={manager.uploadFromDevice} />
    {manager.toast && <div role="status" className="fixed bottom-5 right-5 z-[60] flex max-w-sm items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-sm font-semibold text-white">{manager.toast}</div>}
    <CategoryGallery showGallery={manager.showGallery} gallerySearch={manager.gallerySearch} galleryTarget={manager.galleryTarget} gallery={manager.gallery} selectedUrl={manager.selectedUrl} uploading={manager.uploading} fileInputRef={manager.fileInputRef} onClose={() => manager.setShowGallery(false)} onSearchChange={manager.setGallerySearch} onChoose={manager.chooseGalleryImage} onUpload={manager.uploadDevice} />
  </section>;
}
