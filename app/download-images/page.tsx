'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Download, Images, Loader2, Search, ShieldCheck, X } from 'lucide-react';
import { auth } from '@/lib/firebase';

type Category = { id: string; title: string; slug: string; count: number; cover: string };
type Photo = { id: string; productId: string; title: string; url: string; filename: string };
type Listing = { categories: Category[]; images: Photo[]; total: number; nextOffset: number | null };
const RESELLER_LOGIN_URL = '/reseller/join?redirect=%2Fdownload-images';

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 12_000);
}

export default function DownloadImagesPage() {
  const router = useRouter();
  const [uid, setUid] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [photoSearch, setPhotoSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [downloadProgress, setDownloadProgress] = useState({ processed: 0, started: 0, failed: 0, total: 0 });
  const [downloadStage, setDownloadStage] = useState<'idle' | 'listing' | 'saving'>('idle');
  const [downloadComplete, setDownloadComplete] = useState(false);
  const requestCounter = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const directCdnCors = useRef<boolean | null>(null);

  useEffect(() => onAuthStateChanged(auth, user => {
    if (!user) {
      router.replace(RESELLER_LOGIN_URL);
      return;
    }
    setUid(user.uid);
  }), [router]);

  const apiGet = useCallback(async (slug = '', offset = 0, signal?: AbortSignal): Promise<Listing> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Please sign in with your existing reseller account.');
    const query = new URLSearchParams();
    if (slug) query.set('category', slug);
    query.set('offset', String(offset));
    const response = await fetch(`/api/reseller/image-gallery?${query.toString()}`, {
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      cache: 'no-store',
      signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Could not load the image collection.');
    return data as Listing;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    void apiGet('', 0, controller.signal).then(data => {
      setCategories(data.categories || []);
      setSelected(current => current || data.categories?.[0]?.slug || '');
    }).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Catalogue is unavailable.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [uid, apiGet]);

  useEffect(() => {
    if (!selected || !uid) return;
    const controller = new AbortController();
    const order = ++requestCounter.current;
    setPhotos([]); setNextOffset(null); setTotal(0); setPhotoSearch('');
    setLoadingImages(true); setError(''); setDownloadError('');
    void apiGet(selected, 0, controller.signal).then(data => {
      if (order !== requestCounter.current) return;
      setPhotos(data.images || []); setNextOffset(data.nextOffset); setTotal(data.total);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not open category.');
    }).finally(() => { if (order === requestCounter.current) setLoadingImages(false); });
    return () => controller.abort();
  }, [selected, uid, apiGet]);

  async function loadMore() {
    if (loadingImages || nextOffset === null) return;
    const currentSlug = selected, currentRequest = requestCounter.current;
    setLoadingImages(true);
    try {
      const data = await apiGet(currentSlug, nextOffset);
      if (currentSlug !== selected || currentRequest !== requestCounter.current) return;
      setPhotos(previous => [...previous, ...data.images]); setNextOffset(data.nextOffset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'More images could not load.'); }
    finally { setLoadingImages(false); }
  }

  async function downloadFile(body: Record<string, unknown>, filename: string, controller: AbortController, photo?: Photo) {
    const user = auth.currentUser;
    if (!user) throw new Error('Please sign in again.');

    // Images are already public on Cloudflare R2 / ImgBB; try a browser CORS
    // download once. If supported, subsequent photos bypass Vercel origin egress.
    // If the CDN does not allow CORS, use the protected same-origin image proxy.
    if (photo?.url && directCdnCors.current !== false) {
      try {
        const uri = new URL(photo.url);
        if (uri.protocol !== 'https:' || uri.port ||
          !['images.primehubmall.com', 'i.ibb.co'].includes(uri.hostname)) {
          throw new Error('Unsupported photo CDN');
        }
        const direct = await fetch(uri.toString(), { signal: controller.signal, mode: 'cors', redirect: 'error' });
        const contentType = direct.headers.get('content-type') || '';
        const contentLength = Number(direct.headers.get('content-length') || 0);
        if (!direct.ok || !contentType.startsWith('image/') || contentLength > 9 * 1024 * 1024) {
          throw new Error('CDN image cannot be downloaded directly');
        }
        const blob = await direct.blob();
        if (blob.size === 0 || blob.size > 9 * 1024 * 1024) throw new Error('Image exceeds download size limit');
        directCdnCors.current = true;
        saveFile(blob, filename);
        return;
      } catch (error) {
        if (controller.signal.aborted) throw error;
        // First-party CORS is optional; fallback is always secured by Firebase Auth.
        directCdnCors.current = false;
      }
    }

    const response = await fetch('/api/reseller/image-download', {
      method: 'POST', signal: controller.signal, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || 'Download failed. Please try again.');
    }
    const blob = await response.blob();
    if (!blob.size || blob.size > 9 * 1024 * 1024) throw new Error('Image could not be safely downloaded.');
    saveFile(blob, filename);
  }

  async function saveOne(photo: Photo) {
    if (downloading || abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setDownloading(photo.id); setDownloadError('');
    try { await downloadFile({ mode: 'image', category: selected, imageId: photo.id }, photo.filename, controller, photo); }
    catch (err) { setDownloadError(err instanceof Error ? err.message : 'Image download failed.'); }
    finally { setDownloading(''); abortRef.current = null; }
  }

  // Downloads separate original image files: no archive or extraction.
  // Chrome may require a one-time automatic-multiple-download permission.
  async function downloadAll(categorySlug = selected) {
    const category = categories.find(item => item.slug === categorySlug);
    if (!category || downloading || abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const slug = category.slug;
    setDownloading('all'); setDownloadStage('listing'); setDownloadComplete(false);
    setDownloadProgress({ processed: 0, started: 0, failed: 0, total: category.count });
    setDownloadError('');
    let processed = 0, started = 0, failed = 0;
    try {
      // Fetch the complete manifest, including the gallery pages not yet displayed.
      const allPhotos: Photo[] = [];
      let offset = 0, total = category.count;
      while (!controller.signal.aborted) {
        const listing = await apiGet(slug, offset, controller.signal);
        const batch = Array.isArray(listing.images) ? listing.images : [];
        allPhotos.push(...batch);
        total = listing.total;
        if (listing.nextOffset === null) break;
        if (!batch.length || listing.nextOffset <= offset) throw new Error('Category photo list is incomplete. Please retry.');
        offset = listing.nextOffset;
      }
      if (controller.signal.aborted) return;
      if (total !== allPhotos.length) throw new Error('Category photo list changed during download. Please retry to get every image.');
      setDownloadProgress({ processed, started, failed, total });
      setDownloadStage('saving');
      for (const photo of allPhotos) {
        if (controller.signal.aborted) break;
        try {
          await downloadFile({ mode: 'image', category: slug, imageId: photo.id }, photo.filename, controller, photo);
          // Chrome may block file saving despite a successful synthetic click.
          // This counts files offered to Chrome, not confirmed disk writes.
          started++;
        } catch (err) {
          if (controller.signal.aborted) break;
          failed++;
          console.warn('Original product image could not be requested:', photo.id, err);
        }
        processed++;
        setDownloadProgress({ processed, started, failed, total });
      }
      if (!controller.signal.aborted) {
        setDownloadComplete(true);
        if (failed > 0) setDownloadError(`${failed} images could not be fetched. Please retry the missing images later and check Chrome Downloads.`);
      }
    } catch (err) {
      if (!controller.signal.aborted) setDownloadError(err instanceof Error ? err.message : 'Category download failed. Please try again.');
    } finally {
      setDownloading(''); setDownloadStage('idle'); abortRef.current = null;
    }
  }

  const current = categories.find(item => item.slug === selected);
  const matchingCategories = categories.filter(category => category.title.toLowerCase().includes(search.trim().toLowerCase()));
  const visiblePhotos = photoSearch.trim() ? photos.filter(photo => photo.title.toLowerCase().includes(photoSearch.trim().toLowerCase())) : photos;

  return <main className="min-h-screen bg-[#F6F6F2] pb-32 text-[#14140F]">
    <div className="bg-[#141A16] px-4 pb-8 pt-5 text-white">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-2 text-[11px] font-bold text-white/80"><ArrowLeft size={14}/> PrimeHubMall</Link>
        <div className="mt-6 flex items-center gap-3">
          <div className="rounded-2xl bg-[#FFCF68] p-3 text-[#151915]"><Download size={27}/></div>
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#FFCF68]">PrimeHub Reseller Club</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Download Product Images</h1></div>
        </div>
        <p className="mt-3 max-w-2xl text-xs leading-6 text-white/65">Browse real PrimeHubMall categories, save individual photos, or download a whole category as separate original photos on your phone. No second login or new account is needed.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[10px] font-bold"><ShieldCheck size={13}/> Secure reseller access</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[10px] font-bold"><Images size={13}/> Original product photos</span>
        </div>
      </div>
    </div>
    <div className="mx-auto max-w-6xl px-3 pt-5 sm:px-6">
      {loading && <div role="status" className="flex items-center gap-3 rounded-2xl bg-white p-5 text-sm text-black/60"><Loader2 className="animate-spin" size={18}/> Opening secure image catalogue…</div>}
      {error && <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}<Link href={RESELLER_LOGIN_URL} className="ml-2 font-black underline">Reseller sign in</Link></div>}
      {!loading && categories.length > 0 && <>
        <div className="rounded-[24px] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-[#0F6A5F]">Choose Collection</p><h2 className="mt-1 text-xl font-black">Tap category to download all</h2></div><span className="rounded-full bg-[#F1F5F2] px-3 py-2 text-xs font-bold text-[#0F6A5F]">{categories.length} categories</span></div>
          <label className="mt-4 flex items-center gap-2 rounded-2xl border border-black/10 bg-[#F8F8F5] px-4 py-3"><Search size={17} className="text-black/45"/><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search category" className="w-full bg-transparent text-sm outline-none"/></label>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {matchingCategories.map(category => <button key={category.slug} type="button" onClick={() => { if (downloading) return; setSelected(category.slug); void downloadAll(category.slug); }} aria-pressed={selected === category.slug} className={`overflow-hidden rounded-2xl border p-1.5 text-left transition ${selected === category.slug ? 'border-[#0F6A5F] bg-[#E7F6F1] ring-2 ring-[#0F6A5F]/20' : 'border-black/10 bg-white'}`}>
              <div className="relative aspect-square overflow-hidden rounded-xl bg-[#F4F4F1]"><img src={category.cover} loading="lazy" alt="" className="h-full w-full object-cover"/></div>
              <p className="mt-2 min-h-[28px] line-clamp-2 text-[10px] font-black leading-3.5">{category.title}</p><p className="mb-1 mt-1 text-[9px] font-semibold text-[#0F6A5F]">{category.count} photos</p>
            </button>)}
          </div>
          {!matchingCategories.length && <p className="mt-4 text-xs text-black/50">No category matches your search.</p>}
        </div>

        {current && <section className="mt-5 rounded-[26px] bg-white p-3 shadow-sm sm:p-5" aria-label={current.title + ' downloadable images'}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-4">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-[#0F6A5F]">Selected Collection</p><h2 className="mt-1 text-xl font-black">{current.title}</h2>
              <p className="mt-1 text-xs text-black/45">{current.count} original photos · no ZIP</p></div>
            <button type="button" disabled={Boolean(downloading)} onClick={() => void downloadAll(selected)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#0F6A5F] px-4 py-3 text-xs font-black text-white disabled:opacity-60">
              {downloading === 'all' ? <Loader2 size={17} className="animate-spin"/> : <Download size={17}/>}
              {downloading === 'all' ? (downloadStage === 'listing' ? 'Checking photos…' : `Saving ${downloadProgress.processed}/${downloadProgress.total}…`) : 'Download All Images'}
            </button>
          </div>
          <div className="mt-4 rounded-2xl bg-[#F6F6F2] p-3 text-[11px] leading-5 text-black/60">
            <b className="text-[#0F6A5F]">Tap a category to download all its photos.</b> Tap any category once to start saving its photos automatically. Chrome puts the original JPG/PNG/WebP photos in Downloads. The first time Chrome may ask <b>Allow multiple downloads?</b> — choose <b>Allow</b>. Websites cannot override this Chrome security permission.
          </div>
          {downloadError && <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{downloadError}</div>}
          {downloading && <div role="status" className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#E7F6F1] p-3 text-[10px] font-bold text-[#0F6A5F]"><span>{downloading === 'all' ? (downloadStage === 'listing' ? 'Finding every photo…' : `Sent ${downloadProgress.started}/${downloadProgress.total} images to Chrome · ${downloadProgress.failed} failed. Keep this tab open.`) : 'Saving photo…'}</span><button type="button" onClick={() => abortRef.current?.abort()} className="inline-flex items-center gap-1 text-red-700"><X size={14}/> Cancel</button></div>}
          {downloadComplete && !downloading && <p role="status" className="mt-3 flex items-start gap-1.5 rounded-xl bg-[#E7F6F1] p-3 text-[11px] font-bold text-[#0F6A5F]"><CheckCircle2 size={15} className="shrink-0"/> Sent ${downloadProgress.started} separate image download requests to Chrome. ${downloadProgress.failed ? `${downloadProgress.failed} photos were unavailable.` : ''} Check Chrome Downloads to confirm the photos actually saved; Chrome may block some until multiple downloads are allowed.</p>}
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2.5"><Search size={16} className="text-black/40"/><input type="search" value={photoSearch} onChange={event => setPhotoSearch(event.target.value)} className="w-full bg-transparent text-xs outline-none" placeholder="Find a product in loaded images"/></label>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {visiblePhotos.map(photo => <article key={photo.id} className="overflow-hidden rounded-2xl border border-black/10 bg-[#FAFAF8]">
              <div className="aspect-square overflow-hidden bg-white"><img src={photo.url} alt={photo.title} loading="lazy" decoding="async" className="h-full w-full object-contain"/></div>
              <div className="p-2.5"><p className="min-h-[30px] line-clamp-2 text-[10px] font-bold leading-4">{photo.title}</p>
                <button type="button" disabled={Boolean(downloading)} onClick={() => void saveOne(photo)} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#0F6A5F]/15 bg-[#E7F6F1] px-2 text-[10px] font-black text-[#0F6A5F] disabled:opacity-60">
                  {downloading === photo.id ? <Loader2 size={13} className="animate-spin"/> : <Download size={13}/>} Save Image
                </button>
              </div>
            </article>)}
          </div>
          {loadingImages && <p role="status" className="mt-5 flex items-center justify-center gap-2 text-xs text-black/45"><Loader2 size={15} className="animate-spin"/> Loading photos…</p>}
          {nextOffset !== null && <div className="mt-5 flex flex-col items-center gap-2">
            <button type="button" disabled={loadingImages} onClick={() => void loadMore()} className="rounded-xl bg-[#14140F] px-6 py-3 text-xs font-bold text-white disabled:opacity-50">Load more images ({photos.length}/{total})</button>
            <span className="text-[10px] text-black/40">Download All saves every photo separately, even those not yet displayed.</span>
          </div>}
          {!loadingImages && total === 0 && <p className="py-6 text-center text-xs text-black/50">No downloadable images in this collection yet.</p>}
        </section>}
      </>}
      {!loading && !categories.length && !error && <div className="rounded-2xl bg-white p-5 text-sm text-black/45">No active product image collections are available.</div>}
    </div>
  </main>;
}
