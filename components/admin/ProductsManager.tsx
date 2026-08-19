'use client';
import ProductForm from './products/ProductForm';
import ProductList from './products/ProductList';
import { useProductsManager } from './products/useProductsManager';
export default function ProductsManager(){
  const manager=useProductsManager();
  return <section className="mx-auto max-w-6xl px-4 py-6">
    <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Catalog control</p><h2 className="mt-1 text-2xl font-black">Products Manager</h2><p className="mt-1 text-sm text-black/50">Complete product setup with a clean bangle color/size workflow.</p></div>
    {manager.message&&<div role="status" className="mt-4 rounded-xl bg-white p-3 text-xs font-bold text-black/65 shadow-sm">{manager.message}</div>}
    <ProductForm form={manager.form} categories={manager.categories} priceBuckets={manager.priceBuckets} deal={manager.deal} bucketIds={manager.bucketIds} colors={manager.colors} colorDraft={manager.colorDraft} sizes={manager.sizes} customSize={manager.customSize} variantRows={manager.variantRows} busy={manager.busy} uploadingSlot={manager.uploadingSlot} uploadingColor={manager.uploadingColor} editing={manager.editing} showGallery={manager.showGallery} gallerySearch={manager.gallerySearch} gallery={manager.gallery} onSubmit={manager.save} onChange={manager.change} onUpload={manager.upload} onSetMainImage={manager.setMainImage} onRemoveImage={manager.removeImage} onColorDraftChange={manager.setColorDraft} onColorKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();manager.addColor()}}} onAddColor={manager.addColor} onRemoveColor={manager.removeColor} onSetColorImage={manager.setColorImage} onUploadColorPhoto={manager.uploadColorPhoto} onToggleSize={manager.toggleSize} onCustomSizeChange={manager.setCustomSize} onCustomSizeKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();manager.addCustomSize()}}} onAddCustomSize={manager.addCustomSize} onRemoveVariantRow={manager.removeVariantRow} onUpdateVariantStock={manager.updateVariantStock} onDealChange={manager.setDeal} onBucketToggle={(id,checked)=>manager.setBucketIds(current=>checked?[...current,id]:current.filter(item=>item!==id))} onGallerySearchChange={manager.setGallerySearch} onToggleGallery={()=>manager.setShowGallery(current=>!current)} onReset={manager.reset}/>
    <ProductList products={manager.shown} query={manager.query} onQueryChange={manager.setQuery} onEdit={manager.startEdit} onDelete={manager.removeProduct}/>
  </section>;
}
