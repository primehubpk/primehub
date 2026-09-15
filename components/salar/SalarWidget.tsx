'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, ImagePlus, Maximize2, MessageCircle, Minimize2, Send, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type ProductCard = {
  id: string;
  title: string;
  path: string;
  imageUrl?: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
  category?: string;
};

type CategoryCard = {
  id: string;
  title: string;
  slug?: string;
  imageUrl?: string;
};

type DisplayMode = 'none' | 'products' | 'categories' | 'product_images';

type ProductMention = {
  id: string;
  title: string;
  imageUrl?: string;
};

type ChatContext = {
  lastProductQuery?: string;
  shownProductIds?: string[];
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
  products?: ProductCard[];
  categories?: CategoryCard[];
  displayMode?: DisplayMode;
  mention?: ProductMention;
};

const STORAGE_KEY = 'primehub-salar-chat-v3';
const MAX_SAVED_MESSAGES = 80;

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `Rs. ${amount.toLocaleString('en-PK')}` : '';
}

function safeDisplayMode(value: unknown): DisplayMode {
  return value === 'products' || value === 'categories' || value === 'product_images' ? value : 'none';
}

function historyContent(message: ChatMessage) {
  const reference = message.mention
    ? `\n[Customer referenced exact product: ${message.mention.title}; product id: ${message.mention.id}]`
    : '';
  return `${message.content || ''}${reference}`.trim();
}

function savedMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: any) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-MAX_SAVED_MESSAGES)
    .map((item: any) => ({
      role: item.role,
      content: String(item.content || '').slice(0, 6000),
      products: Array.isArray(item.products) ? item.products.slice(0, 12) : [],
      categories: Array.isArray(item.categories) ? item.categories.slice(0, 12) : [],
      displayMode: safeDisplayMode(item.displayMode),
      mention: item.mention && typeof item.mention === 'object'
        ? {
            id: String(item.mention.id || '').slice(0, 200),
            title: String(item.mention.title || '').slice(0, 300),
            imageUrl: item.mention.imageUrl ? String(item.mention.imageUrl).slice(0, 1400) : undefined,
          }
        : undefined,
    }))
    .filter((item) => item.content || item.products?.length || item.categories?.length || item.mention);
}

export default function SalarWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [context, setContext] = useState<ChatContext>({ shownProductIds: [] });
  const [customerName, setCustomerName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [selectedMention, setSelectedMention] = useState<ProductMention | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (user) => {
      setCustomerName(String(user?.displayName || '').trim().slice(0, 80));
    });
    return stop;
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { messages?: unknown; context?: unknown };
        setMessages(savedMessages(parsed.messages));
        if (parsed.context && typeof parsed.context === 'object') {
          const savedContext = parsed.context as ChatContext;
          setContext({
            lastProductQuery: typeof savedContext.lastProductQuery === 'string' ? savedContext.lastProductQuery.slice(0, 500) : undefined,
            shownProductIds: Array.isArray(savedContext.shownProductIds)
              ? savedContext.shownProductIds.map((id) => String(id).slice(0, 200)).slice(-80)
              : [],
          });
        }
      }
    } catch {
      // A broken local cache should never stop Salar from opening.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const persistable = messages.slice(-MAX_SAVED_MESSAGES).map(({ imagePreview: _imagePreview, ...message }) => message);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: persistable, context }));
    } catch {
      // Storage can be unavailable in private browsing; chat should still work for this page session.
    }
  }, [messages, context, hydrated]);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const html = document.documentElement;
    const bodyOverflow = body.style.overflow;
    const bodyOverscroll = body.style.overscrollBehavior;
    const htmlOverscroll = html.style.overscrollBehavior;
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    html.style.overscrollBehavior = 'none';
    return () => {
      body.style.overflow = bodyOverflow;
      body.style.overscrollBehavior = bodyOverscroll;
      html.style.overscrollBehavior = htmlOverscroll;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: sending ? 'smooth' : 'auto', block: 'end' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, open, sending, expanded]);

  if (pathname?.startsWith('/admin')) return null;

  function clearImage() {
    setImageFile(null);
    setImagePreview('');
    setAttachmentError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function chooseImage(file: File | undefined) {
    setAttachmentError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAttachmentError('Sirf image attach karein.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setAttachmentError('Image 3 MB ya us se choti honi chahiye.');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  }

  function mentionProduct(product: ProductCard) {
    setSelectedMention({ id: product.id, title: product.title, imageUrl: product.imageUrl });
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }

  async function sendMessage(
    rawMessage: string,
    attachedImage: File | null = null,
    preview = '',
    mentionOverride?: ProductMention | null,
  ) {
    const message = rawMessage.trim();
    const mention = mentionOverride === undefined ? selectedMention : mentionOverride;
    if ((!message && !attachedImage && !mention) || sending) return;

    const history = messages
      .slice(-10)
      .map((item) => ({ role: item.role, content: historyContent(item) }))
      .filter((item) => item.content);
    const userContent = message || (mention ? 'Is product ke bare mein batain.' : '📷 Product photo');
    const requestMessage = mention
      ? `${message || 'Is product ke bare mein details batain.'}\n\n[Customer is referring to this exact product from the chat: ${mention.title}; product id: ${mention.id}]`
      : message;

    setMessages((current) => [...current, {
      role: 'user',
      content: userContent,
      imagePreview: preview || undefined,
      mention: mention || undefined,
    }]);
    if (mentionOverride === undefined) setSelectedMention(null);
    setSending(true);

    try {
      let response: Response;
      if (attachedImage) {
        const form = new FormData();
        form.append('message', requestMessage);
        form.append('history', JSON.stringify(history));
        form.append('context', JSON.stringify(context));
        form.append('customerName', customerName);
        form.append('image', attachedImage, attachedImage.name || 'customer-photo.jpg');
        response = await fetch('/api/salar/chat', {
          method: 'POST',
          cache: 'no-store',
          body: form,
        });
      } else {
        response = await fetch('/api/salar/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ message: requestMessage, history, context, customerName }),
        });
      }

      const result = await response.json().catch(() => null);
      const reply = response.ok && result?.success
        ? String(result.reply || '').trim()
        : String(result?.error || 'Salar could not respond right now. Please try again.');

      if (response.ok && result?.success && result?.context && typeof result.context === 'object') {
        setContext(result.context as ChatContext);
      }
      setMessages((current) => [...current, {
        role: 'assistant',
        content: reply,
        products: Array.isArray(result?.products) ? result.products : [],
        categories: Array.isArray(result?.categories) ? result.categories : [],
        displayMode: safeDisplayMode(result?.displayMode),
      }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'Salar could not respond right now. Please try again.', displayMode: 'none' }]);
    } finally {
      setSending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    const file = imageFile;
    const preview = imagePreview;
    if ((!message && !file && !selectedMention) || sending) return;
    setText('');
    clearImage();
    await sendMessage(message, file, preview);
  }

  const chatShellClass = expanded
    ? 'fixed inset-0 z-[80] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#FFFDF8] shadow-2xl'
    : 'flex h-[min(620px,calc(100dvh-120px))] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-[26px] border border-black/10 bg-[#FFFDF8] shadow-2xl';

  return (
    <div className={expanded && open ? 'fixed inset-0 z-[80]' : 'fixed bottom-[88px] right-3 z-50 sm:bottom-6 sm:right-5'}>
      {open ? (
        <div className={chatShellClass}>
          <div className="flex shrink-0 items-center justify-between bg-[#14140F] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFB020] text-[#14140F]"><Bot size={19}/></span>
              <div><p className="text-sm font-black">Salar</p><p className="text-[9px] font-bold text-white/55">PrimeHubMall AI Salesman</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-label={expanded ? 'Make chat smaller' : 'Open full chat'}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition active:scale-95"
              >
                {expanded ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setExpanded(false); }}
                aria-label="Close Salar"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition active:scale-95"
              >
                <X size={17}/>
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3.5 pb-6 touch-pan-y">
            {messages.length === 0 ? (
              <div className="rounded-2xl bg-white p-4 text-xs leading-5 text-black/55 shadow-sm">
                Assalam-o-Alaikum! Main Salar hoon. Aap product, deal, offer ya PrimeHubMall ke bare mein pooch sakte hain — product ki photo bhi share kar sakte hain.
              </div>
            ) : null}

            {messages.map((message, index) => {
              const imageOnlyProducts = message.displayMode === 'product_images'
                ? (message.products || []).filter((product) => product.imageUrl)
                : [];
              const showBubble = Boolean(message.content || message.imagePreview || message.mention);

              return (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={message.role === 'user' ? 'max-w-[86%]' : 'max-w-[94%]'}>
                    {showBubble ? (
                      <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${message.role === 'user' ? 'bg-[#0F6A5F] text-white' : 'bg-white text-[#14140F] shadow-sm'}`}>
                        {message.mention ? (
                          <div className={`mb-2 flex items-center gap-2 rounded-xl p-2 ${message.role === 'user' ? 'bg-white/12' : 'bg-[#F4F4F1]'}`}>
                            {message.mention.imageUrl ? <img src={message.mention.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover"/> : null}
                            <div className="min-w-0">
                              <p className={`text-[8px] font-black uppercase tracking-wide ${message.role === 'user' ? 'text-white/65' : 'text-black/35'}`}>Mentioned product</p>
                              <p className="line-clamp-2 text-[10px] font-bold leading-4">{message.mention.title}</p>
                            </div>
                          </div>
                        ) : null}
                        {message.imagePreview ? <img src={message.imagePreview} alt="Customer attachment" className="mb-2 max-h-40 w-full rounded-xl object-cover"/> : null}
                        {message.content}
                      </div>
                    ) : null}

                    {message.role === 'assistant' && message.categories?.length ? (
                      <div className={`${showBubble ? 'mt-2' : ''} grid grid-cols-2 gap-2`}>
                        {message.categories.map((category) => (
                          <button
                            key={category.id || category.title}
                            type="button"
                            disabled={sending}
                            onClick={() => void sendMessage(category.title, null, '', null)}
                            className="flex min-h-[58px] items-center gap-2 rounded-2xl border border-black/8 bg-white p-2 text-left shadow-sm transition active:scale-[0.98] disabled:opacity-50"
                          >
                            {category.imageUrl ? <img src={category.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover"/> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F1] text-[9px] font-black">CAT</span>}
                            <span className="line-clamp-2 text-[10px] font-black leading-4 text-[#14140F]">{category.title}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {message.role === 'assistant' && imageOnlyProducts.length ? (
                      <div className={`${showBubble ? 'mt-2' : ''} grid grid-cols-2 gap-2`}>
                        {imageOnlyProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => mentionProduct(product)}
                            aria-label={`Mention ${product.title}`}
                            className="group relative block aspect-square overflow-hidden rounded-2xl border border-black/8 bg-[#F4F4F1] text-left shadow-sm transition active:scale-[0.98]"
                          >
                            <img src={product.imageUrl} alt={product.title || 'Product'} className="h-full w-full object-cover"/>
                            <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white shadow-lg">
                              <MessageCircle size={15}/>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {message.role === 'assistant' && message.displayMode !== 'product_images' && message.products?.length ? (
                      <div className={`${showBubble ? 'mt-2' : ''} flex gap-2 overflow-x-auto overscroll-contain pb-1`}>
                        {message.products.map((product) => (
                          <a
                            key={product.id}
                            href={product.path || `/product/${encodeURIComponent(product.id)}`}
                            className="w-[142px] shrink-0 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm"
                          >
                            <div className="aspect-square bg-[#F4F4F1]">
                              {product.imageUrl ? <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-[9px] font-black text-black/30">PrimeHubMall</div>}
                            </div>
                            <div className="p-2.5">
                              <p className="line-clamp-2 text-[10px] font-black leading-4 text-[#14140F]">{product.title}</p>
                              {product.price != null ? <p className="mt-1 text-[10px] font-black text-[#E1352B]">{money(product.price)}</p> : null}
                              {product.stock != null ? <p className="mt-0.5 text-[8px] font-bold text-black/40">{Number(product.stock) > 0 ? `${product.stock} in stock` : 'Out of stock'}</p> : null}
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {sending ? <div className="inline-flex rounded-2xl bg-white px-3.5 py-2.5 text-[10px] font-bold text-black/40 shadow-sm">Salar is typing…</div> : null}
            <div ref={endRef}/>
          </div>

          <form onSubmit={submit} className="shrink-0 border-t border-black/8 bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            {selectedMention ? (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#0F6A5F]/15 bg-[#F1F8F6] p-2">
                {selectedMention.imageUrl ? <img src={selectedMention.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover"/> : null}
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-black uppercase tracking-wide text-[#0F6A5F]/65">Ask about this product</p>
                  <p className="line-clamp-2 text-[10px] font-black leading-4 text-[#14140F]">{selectedMention.title}</p>
                </div>
                <button type="button" onClick={() => setSelectedMention(null)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black/50 shadow-sm" aria-label="Remove product mention"><X size={13}/></button>
              </div>
            ) : null}
            {imagePreview ? (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#F4F4F1] p-2">
                <img src={imagePreview} alt="Attachment preview" className="h-12 w-12 rounded-lg object-cover"/>
                <span className="min-w-0 flex-1 truncate text-[9px] font-bold text-black/50">{imageFile?.name || 'Product photo'}</span>
                <button type="button" onClick={clearImage} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black/55" aria-label="Remove image"><X size={14}/></button>
              </div>
            ) : null}
            {attachmentError ? <p className="mb-2 px-1 text-[9px] font-bold text-[#E1352B]">{attachmentError}</p> : null}
            <div className="flex items-end gap-2 rounded-2xl bg-[#F4F4F1] p-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => chooseImage(event.target.files?.[0])}
              />
              <button type="button" disabled={sending} onClick={() => fileRef.current?.click()} aria-label="Attach product image" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0F6A5F] shadow-sm disabled:opacity-40"><ImagePlus size={17}/></button>
              <textarea
                ref={composerRef}
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, 4000))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                placeholder={selectedMention ? 'Is product ke bare mein poochain…' : 'Salar se poochain…'}
                className="max-h-24 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-xs outline-none"
              />
              <button type="submit" disabled={sending || (!text.trim() && !imageFile && !selectedMention)} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E1352B] text-white disabled:opacity-40"><Send size={16}/></button>
            </div>
          </form>
        </div>
      ) : null}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="ml-auto flex h-14 items-center gap-2 rounded-full bg-[#14140F] px-4 text-white shadow-xl" aria-label="Open Salar AI salesman">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFB020] text-[#14140F]"><Bot size={19}/></span>
          <span className="pr-1 text-xs font-black">Salar</span>
        </button>
      ) : null}
    </div>
  );
}
