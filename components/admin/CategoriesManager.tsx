'use client';

import CategoryForm from './categories/CategoryForm';
import CategoryGallery from './categories/CategoryGallery';
import CategoryList from './categories/CategoryList';
import BucketForm from './categories/BucketForm';
import BucketList from './categories/BucketList';
import { useCategoriesManager } from './categories/useCategoriesManager';

export default function CategoriesManager() {
  const manager = useCategoriesManager();
  return <section className="mx-auto max-w-5xl px-4 py-6">
    <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Store taxonomy</p><h2 className="mt-1 text-2xl font-black">Categories & Price Buckets</h2><p className="mt-1 text-sm text-black/50">Categories, category icons and storefront price buckets are managed here.</p></div>
    <div className="mt-5 flex gap-2 rounded-2xl border border-black/10 bg-white p-2"><button type="button" onClick={() => manager.setTab('categories')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black ${manager.tab === 'categories' ? 'bg-[#14140F] text-white' : 'bg-black/5'}`}>Categories</button><button type="button" onClick={() => manager.setTab('buckets')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black ${manager.tab === 'buckets' ? 'bg-[#14140F] text-white' : 'bg-black/5'}`}>Price Buckets</button></div>
    {manager.tab === 'categories' && <>
      <CategoryForm form={manager.form} editingId={manager.editingId} isSaving={manager.isSaving} uploading={manager.uploading} fileInputRef={manager.fileInputRef} onTitleChange={manager.handleTitleChange} onSlugChange={(slug) => manager.setForm((current) => ({ ...current, slug }))} onOpenGallery={() => manager.openGallery('category')} onUploadDevice={manager.uploadDevice} onActiveChange={(active) => manager.setForm((current) => ({ ...current, active }))} onSubmit={manager.handleSave} onCancel={manager.cancelEdit} />
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
