'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, Maximize2, Menu, Minimize2, Minus, Reply, Send, X } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import { compressSalaarImageBeforeUpload } from '@/lib/salaarClientImage';
import SalaarAdminInbox from '@/components/salaar/SalaarAdminInbox';

type ProductCard = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  href: string;
  dealLive?: boolean;
  dealLabel?: string;
  hasVariants?: boolean;
  variantColors?: unknown;
  variantSizes?: unknown;
  colors?: unknown;
  sizes?: unknown;
  variants?: unknown;
  variantMatrix?: unknown;
  colorImages?: unknown;
};

type UiMessage = {
  id: string;
  role: 'customer' | 'salaar';
  text: string;
  imageUrls?: string[];
  products?: ProductCard[];
  referencedProduct?: ProductCard | null;
  needYou?: boolean;
  whatsapp?: string | null;
  link?: { href: string; label: string } | null;
};

type PendingImage = { file: File; previewUrl: string };
type ClientSalesMemory = Record<string, unknown>;
type LightboxState = { url: string; label: string } | null;

const SESSION_KEY = 'primehub-salaar-session-v1';
const MESSAGE_KEY = 'primehub-salaar-messages-v1';
const SHOWN_KEY = 'primehub-salaar-shown-v1';
const MEMORY_KEY = 'primehub-salaar-sales-memory-v1';
const HUMAN_REPLY_POLL_MS = 8000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `salaar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function safeMessageImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => /^https:\/\/(?:images\.primehubmall\.com|pub-[a-z0-9]+\.r2\.dev)\//i.test(item))
    .slice(0, 2);
}

function safeProduct(value: unknown): ProductCard | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const id = String(source.id || '').trim();
  const name = String(source.name || source.title || '').trim().slice(0, 120);
  if (!id || !name) return null;
  const price = Number(source.price || 0);
  const originalPrice = Number(source.originalPrice || price || 0);
  const image = typeof source.image === 'string' ? source.image : '';
  const href = typeof source.href === 'string' && source.href ? source.href : `/product/${encodeURIComponent(id)}`;
  return {
    id,
    name,
    price: Number.isFinite(price) ? price : 0,
    originalPrice: Number.isFinite(originalPrice) ? originalPrice : 0,
    image,
    href,
    dealLive: source.dealLive === true,
    dealLabel: typeof source.dealLabel === 'string' ? source.dealLabel.slice(0, 100) : undefined,
  };
}

function mergeServerMessages(current: UiMessage[], incoming: UiMessage[]): UiMessage[] {
  const next = [...current];
  for (const item of incoming) {
    const imageKey = item.imageUrls?.[0] || '';
    const alreadyThere = next.some((existing) => existing.role === item.role && existing.text === item.text && (existing.imageUrls?.[0] || '') === imageKey);
    if (!alreadyThere) next.push(item);
  }
  return next.slice(-60);
}

function isReadyIntent(message: string) {
  const value = message.trim().toLowerCase();
  return /^(ready|ready kar|ready karo|order ready|order confirm|confirm order|order lock|lock order|cart ready)/i.test(value)
    || /(order|cart).*(ready|confirm|lock)/i.test(value);
}

function SalaarAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`${compact ? 'h-10 w-10 text-[23px]' : 'h-14 w-14 text-[31px]'} relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-black/10 bg-gradient-to-b from-[#f7dfc9] to-[#d7a576] shadow-sm`}
    >
      <span className="translate-y-[1px]">👨🏻‍💼</span>
      <span className="absolute bottom-[2px] right-[2px] h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
    </span>
  );
}

export default function SalaarNative() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [shownProductIds, setShownProductIds] = useState<string[]>([]);
  const [salesMemory, setSalesMemory] = useState<ClientSalesMemory | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [imageError, setImageError] = useState('');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminInboxOpen, setAdminInboxOpen] = useState(false);
  const [referencedProduct, setReferencedProduct] = useState<ProductCard | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cartItems = useCartStore((state) => state.items);

  useEffect(() => {
    let id = localStorage.getItem(SESSION_KEY) || '';
    if (!id) {
      id = randomId();
      localStorage.setItem(SESSION_KEY, id);
    }
    setSessionId(id);
    const localMessages = loadJson<UiMessage[]>(MESSAGE_KEY, []);
    setMessages(localMessages);
    setShownProductIds(loadJson<string[]>(SHOWN_KEY, []));
    setSalesMemory(loadJson<ClientSalesMemory | null>(MEMORY_KEY, null));
    setReady(true);

    if (!localMessages.length) {
      fetch(`/api/salaar/dual-live?sessionId=${encodeURIComponent(id)}`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (data?.salesMemory && typeof data.salesMemory === 'object') setSalesMemory(data.salesMemory);
          if (!Array.isArray(data?.messages) || !data.messages.length) return;
          const recovered: UiMessage[] = data.messages.map((item: any, index: number) => ({
            id: `${id}-${index}`,
            role: item?.role === 'customer' ? 'customer' : 'salaar',
            text: String(item?.text || ''),
            imageUrls: safeMessageImages(item?.imageUrls),
            referencedProduct: safeProduct(item?.referencedProduct),
          })).filter((item: UiMessage) => item.text);
          setMessages(recovered);
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch('/api/admin/session', { cache: 'no-store' })
      .then((response) => response.json().catch(() => null))
      .then((data) => {
        if (!active) return;
        const isAdmin = data?.authenticated === true;
        setAdminAuthenticated(isAdmin);
        if (!isAdmin) setAdminInboxOpen(false);
      })
      .catch(() => {
        if (!active) return;
        setAdminAuthenticated(false);
        setAdminInboxOpen(false);
      });
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open || !sessionId || adminInboxOpen) return;
    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch(`/api/salaar/dual-live?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (data?.salesMemory && typeof data.salesMemory === 'object') setSalesMemory(data.salesMemory);
        if (!Array.isArray(data?.messages)) return;
        const recovered: UiMessage[] = data.messages.map((item: any, index: number) => ({
          id: `server-${sessionId}-${index}-${String(item?.createdAt || '')}`,
          role: item?.role === 'customer' ? 'customer' : 'salaar',
          text: String(item?.text || ''),
          imageUrls: safeMessageImages(item?.imageUrls),
          referencedProduct: safeProduct(item?.referencedProduct),
        })).filter((item: UiMessage) => item.text);
        setMessages((current) => mergeServerMessages(current, recovered));
      } catch {
        // Local chat stays usable during a short polling failure.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), HUMAN_REPLY_POLL_MS);
    const onVisibility = () => { if (document.visibilityState === 'visible') void poll(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [open, sessionId, adminInboxOpen]);

  useEffect(() => {
    if (ready) localStorage.setItem(MESSAGE_KEY, JSON.stringify(messages.slice(-60)));
  }, [messages, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem(SHOWN_KEY, JSON.stringify(shownProductIds.slice(-400)));
  }, [shownProductIds, ready]);

  useEffect(() => {
    if (!ready) return;
    if (salesMemory) localStorage.setItem(MEMORY_KEY, JSON.stringify(salesMemory));
    else localStorage.removeItem(MEMORY_KEY);
  }, [salesMemory, ready]);

  useEffect(() => {
    if (!open || adminInboxOpen) return;
    const timer = window.setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
    return () => window.clearTimeout(timer);
  }, [messages, sending, open, adminInboxOpen, expanded]);

  useEffect(() => () => {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl);
  }, [pendingImage]);

  useEffect(() => {
    if (!lightbox) return;
    const currentState = typeof history.state === 'object' && history.state ? history.state : {};
    history.pushState({ ...currentState, salaarImageViewer: true }, '');
    const onPopState = () => setLightbox(null);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [lightbox?.url]);

  const welcome = useMemo<UiMessage>(() => ({
    id: 'welcome',
    role: 'salaar',
    text: 'Assalam o Alaikum ji 👋 Main Salaar hoon. Product, order, Prime Skill ya Reseller Club — bata dein kya help chahiye?',
  }), []);

  function openImage(url: string, label: string) {
    if (url) setLightbox({ url, label });
  }

  function closeImage() {
    if (typeof history !== 'undefined' && history.state?.salaarImageViewer) history.back();
    else setLightbox(null);
  }

  function clearPendingImage() {
    setPendingImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function chooseImage(file?: File | null) {
    setImageError('');
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setImageError('JPG, PNG, WEBP ya AVIF image bhejein.');
      return;
    }
    if (!file.size || file.size > MAX_IMAGE_BYTES) {
      setImageError('Image 8MB ya is se chhoti honi chahiye.');
      return;
    }
    clearPendingImage();
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
  }

  async function uploadSelectedImage(): Promise<string | null> {
    if (!pendingImage) return null;
    const compactFile = await compressSalaarImageBeforeUpload(pendingImage.file);
    const form = new FormData();
    form.set('sessionId', sessionId);
    form.set('image', compactFile);
    const response = await fetch('/api/salaar/upload-image', { method: 'POST', body: form, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success || typeof data?.url !== 'string') {
      throw new Error(String(data?.error || 'Image upload failed.'));
    }
    return data.url;
  }

  async function sendMessage(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const text = (preset ?? input).trim();
    if ((!text && !pendingImage) || sending || !sessionId) return;
    const quoted = referencedProduct;
    setSending(true);
    setImageError('');

    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadSelectedImage();
      const customerText = text || (imageUrl ? 'Image bheji hai — isko dekh kar guide karein.' : '');
      setInput('');
      setReferencedProduct(null);
      setMessages((current) => [...current, {
        id: randomId(),
        role: 'customer',
        text: customerText,
        imageUrls: imageUrl ? [imageUrl] : [],
        referencedProduct: quoted,
      }]);
      if (imageUrl) clearPendingImage();

      const readyFlow = !imageUrl && isReadyIntent(text);
      const endpoint = readyFlow ? '/api/salaar/dual-ready' : '/api/salaar/dual-live';
      const cartContext = cartItems.slice(0, 20).map((item: any) => ({
        productId: String(item?.productId || item?.id || ''),
        name: String(item?.name || item?.title || '').slice(0, 100),
        quantity: Number(item?.quantity || item?.qty || 1) || 1,
      })).filter((item) => item.productId);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text,
          shownProductIds,
          salesMemory,
          cartContext,
          ...(quoted ? { referencedProductId: quoted.id } : {}),
          ...(imageUrl ? { imageUrls: [imageUrl] } : {}),
          ...(readyFlow ? { cartItems } : {}),
        }),
        cache: 'no-store',
      });
      const data = await response.json();
      if (data?.salesMemory && typeof data.salesMemory === 'object') setSalesMemory(data.salesMemory);
      if (data?.silent) return;
      const products: ProductCard[] = Array.isArray(data?.products) ? data.products : [];
      if (products.length) {
        setShownProductIds((current) => Array.from(new Set([...current, ...products.map((product) => product.id)])));
      }
      setMessages((current) => [...current, {
        id: randomId(),
        role: 'salaar',
        text: String(data?.reply || 'Ji, main yahan hoon. Dobara short mein bata dein.'),
        products,
        needYou: Boolean(data?.needYou),
        whatsapp: typeof data?.whatsapp === 'string' ? data.whatsapp : null,
        link: data?.link?.href && data?.link?.label ? { href: String(data.link.href), label: String(data.link.label) } : null,
      }]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      if (!imageUrl && pendingImage) {
        setImageError(detail || 'Image upload nahi ho saki. Dobara try karein.');
        if (quoted) setReferencedProduct(quoted);
      } else {
        setMessages((current) => [...current, {
          id: randomId(),
          role: 'salaar',
          text: 'Ji, connection issue aa gaya. WhatsApp 03238878009 par message kar dein.',
          needYou: true,
          whatsapp: 'https://wa.me/923238878009',
        }]);
      }
    } finally {
      setSending(false);
    }
  }

  const renderedMessages = messages.length ? messages : [welcome];
  if (!ready) return null;

  return (
    <>
      <div className="fixed bottom-24 right-3 z-[95] md:bottom-5 md:right-5">
        {open ? (
          <section className={`flex flex-col overflow-hidden border border-black/10 bg-white shadow-2xl transition-[width,height] duration-200 ${expanded ? 'h-[min(90vh,820px)] w-[min(96vw,760px)] rounded-[26px]' : 'h-[min(72vh,620px)] w-[min(94vw,390px)] rounded-[24px]'}`}>
            <header className="flex items-center justify-between border-b border-black/5 bg-white px-3 py-3 text-[#171712] sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <SalaarAvatar compact />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black tracking-tight">Salaar · PrimeHubMall</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {adminInboxOpen ? 'Admin inbox · secure session' : 'Professional sales help · online'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {adminAuthenticated ? <button type="button" onClick={() => setAdminInboxOpen((value) => !value)} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${adminInboxOpen ? 'bg-[#14140F] text-white' : 'bg-black/5 text-black/70 hover:bg-black/10'}`} aria-label={adminInboxOpen ? 'Back to Salaar chat' : 'Open all Salaar chats'}><Menu size={16} /></button> : null}
                <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/5 text-black/65 hover:bg-black/10" aria-label="Minimize Salaar chat"><Minus size={16} /></button>
                <button type="button" onClick={() => setExpanded((value) => !value)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/5 text-black/65 hover:bg-black/10" aria-label={expanded ? 'Return Salaar chat to normal size' : 'Expand Salaar chat'}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
                <button type="button" onClick={() => { setAdminInboxOpen(false); setExpanded(false); setOpen(false); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/5 text-black/65 hover:bg-black/10" aria-label="Close Salaar chat"><X size={16} /></button>
              </div>
            </header>

            {adminInboxOpen && adminAuthenticated ? (
              <SalaarAdminInbox onBackToCustomerChat={() => setAdminInboxOpen(false)} />
            ) : (
              <>
                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f7f6f1] px-3 py-4">
                  {renderedMessages.map((message) => (
                    <div key={message.id} className={message.role === 'customer' ? 'ml-auto max-w-[86%]' : 'mr-auto max-w-[96%]'}>
                      {message.referencedProduct ? (
                        <div className={`mb-1.5 flex items-center gap-2 rounded-xl border px-2 py-1.5 text-xs ${message.role === 'customer' ? 'border-white/30 bg-[#0a6158] text-white' : 'border-black/10 bg-white text-black'}`}>
                          {message.referencedProduct.image ? <button type="button" onClick={() => openImage(message.referencedProduct!.image, message.referencedProduct!.name)}><img src={message.referencedProduct.image} alt="Referenced product" className="h-10 w-10 rounded-lg object-cover" /></button> : null}
                          <div className="min-w-0"><div className="truncate font-bold">{message.referencedProduct.name}</div><div className="opacity-75">Rs. {message.referencedProduct.price.toLocaleString()}</div></div>
                        </div>
                      ) : null}
                      {message.imageUrls?.length ? (
                        <div className={`mb-1.5 grid gap-1 overflow-hidden rounded-2xl ${message.imageUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {message.imageUrls.map((url) => <button type="button" key={url} onClick={() => openImage(url, 'Shared image')} className="block overflow-hidden"><img src={url} alt="Customer shared" className="max-h-52 w-full bg-white object-cover transition hover:scale-[1.01]" loading="lazy" /></button>)}
                        </div>
                      ) : null}
                      <div className={message.role === 'customer' ? 'rounded-2xl rounded-br-md bg-[#0d7468] px-3 py-2 text-sm leading-5 text-white' : 'rounded-2xl rounded-bl-md border border-black/5 bg-white px-3 py-2 text-sm leading-5 text-[#171712] shadow-sm'}>{message.text}</div>
                      {message.products?.length ? (
                        <div className={`mt-2 grid gap-2 ${expanded ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
                          {message.products.map((product) => (
                            <article key={product.id} className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                              <div className="relative aspect-square bg-[#f1f0eb]">
                                {product.image ? <button type="button" onClick={() => openImage(product.image, product.name)} className="h-full w-full"><img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" /></button> : <div className="grid h-full w-full place-items-center text-xs text-black/40">Product</div>}
                                <button type="button" onClick={() => setReferencedProduct(product)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[#0d7468] shadow ring-1 ring-black/10" aria-label={`Ask Salaar about ${product.name}`}><Reply size={14} /></button>
                                {product.dealLive ? <span className="absolute bottom-2 left-2 rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">LIVE DEAL</span> : null}
                              </div>
                              <div className="p-2.5">
                                <Link href={product.href} className="line-clamp-2 text-[11px] font-bold leading-4 text-black">{product.name}</Link>
                                <div className="mt-1 flex flex-wrap items-baseline gap-1.5"><span className="text-sm font-black text-[#d9342b]">Rs. {product.price.toLocaleString()}</span>{product.originalPrice > product.price ? <span className="text-[9px] text-black/35 line-through">Rs. {product.originalPrice.toLocaleString()}</span> : null}</div>
                                <button type="button" onClick={() => setReferencedProduct(product)} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#0d7468]"><Reply size={12} /> Ask about this</button>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : null}
                      {message.link ? <Link href={message.link.href} className="mt-2 inline-flex rounded-full border border-[#0d7468]/30 bg-white px-3 py-1.5 text-xs font-bold text-[#0d7468]">{message.link.label}</Link> : null}
                      {message.whatsapp ? <a href={message.whatsapp} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">WhatsApp 03238878009</a> : null}
                    </div>
                  ))}
                  {sending ? <div className="mr-auto rounded-2xl rounded-bl-md bg-white px-3 py-2 text-xs text-black/60 shadow-sm">{pendingImage ? 'Image compress/upload ho rahi hai…' : 'Salaar dekh raha hai…'}</div> : null}
                </div>

                <div className="border-t border-black/10 bg-white px-3 py-3">
                  {messages.length === 0 ? <div className="mb-2 flex gap-2 overflow-x-auto pb-1 text-[11px]"><button onClick={() => void sendMessage(undefined, 'Bangles dikhao')} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 font-semibold">Bangles dikhao</button><button onClick={() => void sendMessage(undefined, 'Prime Skill kya hai?')} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 font-semibold">Prime Skill?</button><button onClick={() => void sendMessage(undefined, 'Reseller Club kya hai?')} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 font-semibold">Reseller Club?</button></div> : null}
                  {referencedProduct ? <div className="mb-2 flex items-center gap-2 rounded-2xl border-l-4 border-[#0d7468] bg-[#f6f7f3] p-2"><button type="button" onClick={() => referencedProduct.image && openImage(referencedProduct.image, referencedProduct.name)}>{referencedProduct.image ? <img src={referencedProduct.image} alt="Referenced product" className="h-12 w-12 rounded-lg object-cover" /> : null}</button><div className="min-w-0 flex-1"><div className="text-[10px] font-bold text-[#0d7468]">Replying to product</div><div className="truncate text-xs font-bold text-black">{referencedProduct.name}</div><div className="text-[11px] text-black/55">Rs. {referencedProduct.price.toLocaleString()}</div></div><button type="button" onClick={() => setReferencedProduct(null)} className="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-black/60" aria-label="Cancel product reply"><X size={14} /></button></div> : null}
                  {pendingImage ? <div className="mb-2 flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fafaf7] p-2"><button type="button" onClick={() => openImage(pendingImage.previewUrl, 'Selected image')}><img src={pendingImage.previewUrl} alt="Selected for Salaar" className="h-16 w-16 rounded-xl object-cover" /></button><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-black">Image ready</div><div className="mt-0.5 text-[11px] text-black/55">Auto-compress ho kar Salaar vision ko jayegi.</div></div><button type="button" onClick={clearPendingImage} disabled={sending} className="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-black/60" aria-label="Remove selected image"><X size={15} /></button></div> : null}
                  {imageError ? <div className="mb-2 text-xs font-semibold text-red-600">{imageError}</div> : null}
                  <form onSubmit={(event) => void sendMessage(event)} className="flex items-end gap-2">
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(event) => chooseImage(event.target.files?.[0])} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/10 bg-[#fafaf7] text-[#0d7468] disabled:opacity-40" aria-label="Send image to Salaar"><ImagePlus size={19} /></button>
                    <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} maxLength={600} placeholder={referencedProduct ? 'Is product ke bare mein poochain…' : pendingImage ? 'Image ke bare mein poochain…' : 'Salaar se poochain…'} className="max-h-24 min-h-11 flex-1 resize-none rounded-2xl border border-black/10 bg-[#fafaf7] px-3 py-3 text-sm outline-none focus:border-[#0d7468]" />
                    <button type="submit" disabled={(!input.trim() && !pendingImage) || sending} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0d7468] text-white disabled:opacity-40" aria-label="Send message"><Send size={18} /></button>
                  </form>
                </div>
              </>
            )}
          </section>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="group relative grid h-14 w-14 place-items-center rounded-full bg-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.26)]" aria-label="Open Salaar help">
            <span className="absolute -top-8 right-0 whitespace-nowrap rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-bold text-[#171712] shadow-sm">Need help?</span>
            <SalaarAvatar />
          </button>
        )}
      </div>

      {lightbox ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/95 p-3" role="dialog" aria-modal="true" aria-label="Image viewer">
          <button type="button" onClick={closeImage} className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur" aria-label="Close image viewer"><X size={24} /></button>
          <img src={lightbox.url} alt={lightbox.label} className="max-h-[92vh] max-w-[96vw] object-contain" />
        </div>
      ) : null}
    </>
  );
}
