'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Send, ShoppingCart, X } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';

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
  products?: ProductCard[];
  needYou?: boolean;
  whatsapp?: string | null;
  link?: { href: string; label: string } | null;
};

const SESSION_KEY = 'primehub-salaar-session-v1';
const MESSAGE_KEY = 'primehub-salaar-messages-v1';
const SHOWN_KEY = 'primehub-salaar-shown-v1';

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

export default function SalaarNative() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [shownProductIds, setShownProductIds] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
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
    setMessages(localMessages);
    setShownProductIds(shown);
    setReady(true);

    // If local history is empty, recover the saved Firestore thread when available.
    if (!localMessages.length) {
      fetch(`/api/salaar/chat?sessionId=${encodeURIComponent(id)}`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (!Array.isArray(data?.messages) || !data.messages.length) return;
          const recovered: UiMessage[] = data.messages.map((item: any, index: number) => ({
            id: `${id}-${index}`,
            role: item?.role === 'customer' ? 'customer' : 'salaar',
            text: String(item?.text || ''),
          })).filter((item: UiMessage) => item.text);
          setMessages(recovered);
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(MESSAGE_KEY, JSON.stringify(messages.slice(-60)));
  }, [messages, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(SHOWN_KEY, JSON.stringify(shownProductIds.slice(-100)));
  }, [shownProductIds, ready]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
    return () => window.clearTimeout(timer);
  }, [messages, sending, open]);

  const welcome = useMemo<UiMessage>(() => ({
    id: 'welcome',
    role: 'salaar',
    text: 'Assalam o Alaikum ji 👋 Main Salaar hoon. Product, order, Prime Skill ya Reseller Club — bata dein kya help chahiye?',
  }), []);

  async function sendMessage(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const text = (preset ?? input).trim();
    if (!text || sending || !sessionId) return;
    setInput('');
    setSending(true);
    const customer: UiMessage = { id: randomId(), role: 'customer', text };
    setMessages((current) => [...current, customer]);

    try {
      const response = await fetch('/api/salaar/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text, shownProductIds }),
        cache: 'no-store',
      });
      const data = await response.json();
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
    } catch {
      setMessages((current) => [...current, {
        id: randomId(),
        role: 'salaar',
        text: 'Ji, connection issue aa gaya. WhatsApp 03238878009 par message kar dein.',
        needYou: true,
        whatsapp: 'https://wa.me/923238878009',
      }]);
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
          <header className="flex items-center justify-between bg-[#14140f] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-lg font-black text-white">S</div>
              <div>
                <div className="text-sm font-black tracking-tight">Salaar · PrimeHubMall</div>
                <div className="text-[11px] text-emerald-300">Customer help · online</div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/10" aria-label="Close Salaar chat">
              <X size={18} />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f7f6f1] px-3 py-4">
            {renderedMessages.map((message) => (
              <div key={message.id} className={message.role === 'customer' ? 'ml-auto max-w-[84%]' : 'mr-auto max-w-[94%]'}>
                <div className={message.role === 'customer'
                  ? 'rounded-2xl rounded-br-md bg-[#0d7468] px-3 py-2 text-sm leading-5 text-white'
                  : 'rounded-2xl rounded-bl-md border border-black/5 bg-white px-3 py-2 text-sm leading-5 text-[#171712] shadow-sm'}>
                  {message.text}
                </div>

                {message.products?.length ? (
                  <div className="mt-2 space-y-2">
                    {message.products.map((product) => (
                      <div key={product.id} className="flex gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
                        {product.image ? <img src={product.image} alt={product.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-black/5 text-xs">Product</div>}
                        <div className="min-w-0 flex-1">
                          <Link href={product.href} className="line-clamp-2 text-xs font-bold leading-4 text-black">{product.name}</Link>
                          <div className="mt-1 text-sm font-black text-[#d9342b]">Rs. {product.price.toLocaleString()}</div>
                          <button type="button" onClick={() => addProduct(product)} className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#14140f] px-3 py-1.5 text-[11px] font-bold text-white">
                            <ShoppingCart size={13} /> Add to cart
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {message.link ? (
                  <Link href={message.link.href} className="mt-2 inline-flex rounded-full border border-[#0d7468]/30 bg-white px-3 py-1.5 text-xs font-bold text-[#0d7468]">
                    {message.link.label}
                  </Link>
                ) : null}

                {message.whatsapp ? (
                  <a href={message.whatsapp} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">
                    WhatsApp 03238878009
                  </a>
                ) : null}
              </div>
            ))}
            {sending ? <div className="mr-auto rounded-2xl rounded-bl-md bg-white px-3 py-2 text-xs text-black/60 shadow-sm">Salaar dekh raha hai…</div> : null}
          </div>

          <div className="border-t border-black/10 bg-white px-3 py-3">
            {messages.length === 0 ? (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1 text-[11px]">
                <button onClick={() => void sendMessage(undefined, 'Bangles dikhao')} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 font-semibold">Bangles dikhao</button>
                <button onClick={() => void sendMessage(undefined, 'Prime Skill kya hai?')} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 font-semibold">Prime Skill?</button>
                <button onClick={() => void sendMessage(undefined, 'Reseller Club kya hai?')} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 font-semibold">Reseller Club?</button>
              </div>
            ) : null}
            <form onSubmit={(event) => void sendMessage(event)} className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={1}
                maxLength={600}
                placeholder="Salaar se poochain…"
                className="max-h-24 min-h-11 flex-1 resize-none rounded-2xl border border-black/10 bg-[#fafaf7] px-3 py-3 text-sm outline-none focus:border-[#0d7468]"
              />
              <button type="submit" disabled={!input.trim() || sending} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0d7468] text-white disabled:opacity-40" aria-label="Send message">
                <Send size={18} />
              </button>
            </form>
          </div>
        </section>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full border border-black/10 bg-[#14140f] px-3 py-2.5 text-white shadow-xl" aria-label="Open Salaar help">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 font-black">S</span>
          <span className="pr-1 text-sm font-black">Need help?</span>
          <MessageCircle size={17} />
        </button>
      )}
    </div>
  );
}
