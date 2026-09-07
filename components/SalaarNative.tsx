'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, Send, ShoppingCart, X } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import { compressSalaarImageBeforeUpload } from '@/lib/salaarClientImage';

type ProductCard = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  href: string;
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
  needYou?: boolean;
  whatsapp?: string | null;
  link?: { href: string; label: string } | null;
};

type PendingImage = { file: File; previewUrl: string };

type ClientSalesMemory = Record<string, unknown>;

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
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [shownProductIds, setShownProductIds] = useState<string[]>([]);
  const [salesMemory, setSalesMemory] = useState<ClientSalesMemory | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [imageError, setImageError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const openVariantModal = useCartStore((state) => state.openVariantModal);

  useEffect(() => {
    let id = localStorage.getItem(SESSION_KEY) || '';
    if (!id) {
      id = randomId();
      localStorage.setItem(SESSION_KEY, id);
    }
    setSessionId(id);
    const localMessages = loadJson<UiMessage[]>(MESSAGE_KEY, []);
    const shown = loadJson<string[]>(SHOWN_KEY, []);
    const memory = loadJson<ClientSalesMemory | null>(MEMORY_KEY, null);
    setMessages(localMessages);
    setShownProductIds(shown);
    setSalesMemory(memory);
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
          })).filter((item: UiMessage) => item.text);
          setMessages(recovered);
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!open || !sessionId) return;
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
  }, [open, sessionId]);

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
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
    return () => window.clearTimeout(timer);
  }, [messages, sending, open]);

  useEffect(() => () => {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl);
  }, [pendingImage]);

  const welcome = useMemo<UiMessage>(() => ({
    id: 'welcome',
    role: 'salaar',
    text: 'Assalam o Alaikum ji 👋 Main Salaar hoon. Product, order, Prime Skill ya Reseller Club — bata dein kya help chahiye?',
  }), []);

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
    setSending(true);
    setImageError('');

    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadSelectedImage();
      const customerText = text || (imageUrl ? 'Image bheji hai — isko dekh kar guide karein.' : '');
      setInput('');
      setMessages((current) => [...current, {
        id: randomId(),
        role: 'customer',
        text: customerText,
        imageUrls: imageUrl ? [imageUrl] : [],
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
      if (!imageUrl && pendingImage) setImageError(detail || 'Image upload nahi ho saki. Dobara try karein.');
      else {
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

  function addProduct(product: ProductCard) {
    if (product.hasVariants) {
      const opened = openVariantModal({
        id: product.id,
        name: product.name,
        title: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        imageUrl: product.image,
        hasVariants: true,
        variantColors: product.variantColors as any,
        variantSizes: product.variantSizes as any,
        colors: product.colors as any,
        sizes: product.sizes as any,
        variants: product.variants as any,
        variantMatrix: product.variantMatrix as any,
        colorImages: product.colorImages as any,
      }, 'cart');
      if (opened) return;
    }
    addItem({
      id: `salaar:${product.id}`,
      productId: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice || product.price,
      image: product.image,
      imageUrl: product.image,
    });
  }

  const renderedMessages = messages.length ? messages : [welcome];
  if (!ready) return null;

  return (
    <div className="fixed bottom-24 right-3 z-[95] md:bottom-5 md:right-5">
      {open ? (
        <section className="flex h-[min(72vh,620px)] w-[min(94vw,390px)] flex-col overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-black/5 bg-white px-4 py-3 text-[#171712]">
            <div className="flex min-w-0 items-center gap-3">
              <SalaarAvatar compact />
              <div className="min-w-0">
                <div className="truncate text-sm font-black tracking-tight">Salaar · PrimeHubMall</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Professional sales help · online
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/5 text-black/70 transition hover:bg-black/10" aria-label="Close Salaar chat"><X size={18} /></button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f7f6f1] px-3 py-4">
            {renderedMessages.map((message) => (
              <div key={message.id} className={message.role === 'customer' ? 'ml-auto max-w-[84%]' : 'mr-auto max-w-[94%]'}>
                {message.imageUrls?.length ? <div className={`mb-1.5 grid gap-1 overflow-hidden rounded-2xl ${message.imageUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>{message.imageUrls.map((url) => <img key={url} src={url} alt="Customer shared" className="max-h-52 w-full bg-white object-cover" loading="lazy" />)}</div> : null}
                <div className={message.role === 'customer' ? 'rounded-2xl rounded-br-md bg-[#0d7468] px-3 py-2 text-sm leading-5 text-white' : 'rounded-2xl rounded-bl-md border border-black/5 bg-white px-3 py-2 text-sm leading-5 text-[#171712] shadow-sm'}>{message.text}</div>
                {message.products?.length ? <div className="mt-2 space-y-2">{message.products.map((product) => (
                  <div key={product.id} className="flex gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
                    {product.image ? <img src={product.image} alt={product.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-black/5 text-xs">Product</div>}
                    <div className="min-w-0 flex-1"><Link href={product.href} className="line-clamp-2 text-xs font-bold leading-4 text-black">{product.name}</Link><div className="mt-1 text-sm font-black text-[#d9342b]">Rs. {product.price.toLocaleString()}</div><button type="button" onClick={() => addProduct(product)} className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#14140f] px-3 py-1.5 text-[11px] font-bold text-white"><ShoppingCart size={13} /> Add to cart</button></div>
                  </div>
                ))}</div> : null}
                {message.link ? <Link href={message.link.href} className="mt-2 inline-flex rounded-full border border-[#0d7468]/30 bg-white px-3 py-1.5 text-xs font-bold text-[#0d7468]">{message.link.label}</Link> : null}
                {message.whatsapp ? <a href={message.whatsapp} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">WhatsApp 03238878009</a> : null}
              </div>
            ))}
            {sending ? <div className="mr-auto rounded-2xl rounded-bl-md bg-white px-3 py-2 text-xs text-black/60 shadow-sm">{pendingImage ? 'Image compress/upload ho rahi hai…' : 'Salaar dekh raha hai…'}</div> : null}
          </div>

          <div className="border-t border-black/10 bg-white px-3 py-3">
            {messages.length === 0 ? <div className="mb-2 flex gap-2 overflow-x-auto pb-1 text-[11px]"><button onClick={() => void sendMessage(undefined, 'Bangles dikhao')} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 font-semibold">Bangles dikhao</button><button onClick={() => void sendMessage(undefined, 'Prime Skill kya hai?')} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 font-semibold">Prime Skill?</button><button onClick={() => void sendMessage(undefined, 'Reseller Club kya hai?')} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 font-semibold">Reseller Club?</button></div> : null}
            {pendingImage ? <div className="mb-2 flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fafaf7] p-2"><img src={pendingImage.previewUrl} alt="Selected for Salaar" className="h-16 w-16 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-black">Image ready</div><div className="mt-0.5 text-[11px] text-black/55">Auto-compress ho kar Salaar vision ko jayegi.</div></div><button type="button" onClick={clearPendingImage} disabled={sending} className="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-black/60" aria-label="Remove selected image"><X size={15} /></button></div> : null}
            {imageError ? <div className="mb-2 text-xs font-semibold text-red-600">{imageError}</div> : null}
            <form onSubmit={(event) => void sendMessage(event)} className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(event) => chooseImage(event.target.files?.[0])} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/10 bg-[#fafaf7] text-[#0d7468] disabled:opacity-40" aria-label="Send image to Salaar"><ImagePlus size={19} /></button>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} maxLength={600} placeholder={pendingImage ? 'Image ke bare mein poochain…' : 'Salaar se poochain…'} className="max-h-24 min-h-11 flex-1 resize-none rounded-2xl border border-black/10 bg-[#fafaf7] px-3 py-3 text-sm outline-none focus:border-[#0d7468]" />
              <button type="submit" disabled={(!input.trim() && !pendingImage) || sending} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0d7468] text-white disabled:opacity-40" aria-label="Send message"><Send size={18} /></button>
            </form>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative grid h-14 w-14 place-items-center rounded-full bg-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.26)]"
          aria-label="Open Salaar help"
        >
          <span className="absolute -top-8 right-0 whitespace-nowrap rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-bold text-[#171712] shadow-sm">Need help?</span>
          <SalaarAvatar />
        </button>
      )}
    </div>
  );
}
