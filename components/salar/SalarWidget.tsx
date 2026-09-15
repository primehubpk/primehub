'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Bot, ImagePlus, Maximize2, Menu, Minimize2, Send, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import SalarAdminDrawer from '@/components/salar/SalarAdminDrawer';

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
  id?: string;
  role: 'user' | 'assistant';
  actor?: 'customer' | 'salar' | 'admin';
  content: string;
  createdAt?: string;
  imagePreview?: string;
  imageUrl?: string;
  products?: ProductCard[];
  categories?: CategoryCard[];
  displayMode?: DisplayMode;
  mention?: ProductMention;
};

const STORAGE_KEY = 'primehub-salar-chat-v4';
const LEGACY_STORAGE_KEY = 'primehub-salar-chat-v3';
const CHAT_ID_KEY = 'primehub-salar-chat-id-v1';
const MAX_SAVED_MESSAGES = 100;

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `Rs. ${amount.toLocaleString('en-PK')}` : '';
}

function safeDisplayMode(value: unknown): DisplayMode {
  return value === 'products' || value === 'categories' || value === 'product_images' ? value : 'none';
}

function createChatId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // Fall through to a random browser id.
  }
  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function historyContent(message: ChatMessage) {
  const actorPrefix = message.actor === 'admin' ? '[PrimeHub Admin message] ' : '';
  const reference = message.mention
    ? `\n[Customer referenced exact product: ${message.mention.title}; product id: ${message.mention.id}]`
    : '';
  return `${actorPrefix}${message.content || ''}${reference}`.trim();
}

function savedMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: any) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-MAX_SAVED_MESSAGES)
    .map((item: any) => ({
      id: item.id ? String(item.id).slice(0, 120) : undefined,
      role: item.role,
      actor: item.actor === 'admin' ? 'admin' : item.actor === 'customer' || item.role === 'user' ? 'customer' : 'salar',
      content: String(item.content || '').slice(0, 6000),
      createdAt: item.createdAt ? String(item.createdAt).slice(0, 80) : undefined,
      imageUrl: item.imageUrl ? String(item.imageUrl).slice(0, 1600) : undefined,
      products: Array.isArray(item.products) ? item.products.slice(0, 12) : [],
      categories: Array.isArray(item.categories) ? item.categories.slice(0, 12) : [],
      displayMode: safeDisplayMode(item.displayMode),
      mention: item.mention && typeof item.mention === 'object'
        ? {
            id: String(item.mention.id || '').slice(0, 200),
            title: String(item.mention.title || '').slice(0, 300),
            imageUrl: item.mention.imageUrl ? String(item.mention.imageUrl).slice(0, 1600) : undefined,
          }
        : undefined,
    }))
    .filter((item) => item.content || item.imageUrl || item.products?.length || item.categories?.length || item.mention) as ChatMessage[];
}

function messageImage(message: ChatMessage) {
  return message.imagePreview || message.imageUrl || '';
}

export default function SalarWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [context, setContext] = useState<ChatContext>({ shownProductIds: [] });
  const [chatId, setChatId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [selectedMention, setSelectedMention] = useState<ProductMention | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [salarPaused, setSalarPaused] = useState(false);
  const [iconUrl, setIconUrl] = useState('');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (user) => {
      setCustomerId(String(user?.uid || '').trim().slice(0, 200));
      setCustomerName(String(user?.displayName || '').trim().slice(0, 120));
      setCustomerEmail(String(user?.email || '').trim().slice(0, 240));
    });
    return stop;
  }, []);

  useEffect(() => {
    try {
      let storedChatId = window.localStorage.getItem(CHAT_ID_KEY) || '';
      if (!/^[A-Za-z0-9_-]{12,80}$/.test(storedChatId)) {
        storedChatId = createChatId();
        window.localStorage.setItem(CHAT_ID_KEY, storedChatId);
      }
      setChatId(storedChatId);

      const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
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
      setChatId(createChatId());
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void fetch('/api/admin/session', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => response.json())
      .then((result) => setAdminAuthenticated(result?.authenticated === true))
      .catch(() => setAdminAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const persistable = messages.slice(-MAX_SAVED_MESSAGES).map(({ imagePreview: _preview, ...message }) => message);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: persistable, context }));
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }, [messages, context, hydrated]);

  const syncChat = useCallback(async () => {
    if (!chatId) return;
    try {
      const response = await fetch(`/api/salar/chat?chatId=${encodeURIComponent(chatId)}`, { cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) return;
      setIconUrl(String(result.settings?.iconUrl || ''));
      if (result.chat && Array.isArray(result.chat.messages)) {
        setMessages(savedMessages(result.chat.messages));
        if (result.chat.context && typeof result.chat.context === 'object') setContext(result.chat.context as ChatContext);
        setSalarPaused(result.chat.salarPaused === true);
      }
    } catch {
      // Local chat remains usable if live sync is temporarily unavailable.
    }
  }, [chatId]);

  useEffect(() => {
    if (!hydrated || !chatId) return;
    void syncChat();
    const interval = window.setInterval(() => void syncChat(), open ? 4000 : 15000);
    return () => window.clearInterval(interval);
  }, [hydrated, chatId, open, syncChat]);

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
    if (!open || adminDrawerOpen) return;
    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: sending ? 'smooth' : 'auto', block: 'end' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, open, sending, expanded, adminDrawerOpen]);

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
    if ((!message && !attachedImage && !mention) || sending || !chatId) return;

    const history = messages
      .slice(-10)
      .map((item) => ({ role: item.role, content: historyContent(item) }))
      .filter((item) => item.content);
    const userContent = message || (mention ? 'Is product ke bare mein batain.' : '📷 Product photo');
    const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setMessages((current) => [...current, {
      id: optimisticId,
      role: 'user',
      actor: 'customer',
      content: userContent,
      imagePreview: preview || undefined,
      mention: mention || undefined,
      createdAt: new Date().toISOString(),
    }]);
    if (mentionOverride === undefined) setSelectedMention(null);
    setSending(true);

    try {
      let response: Response;
      if (attachedImage) {
        const form = new FormData();
        form.append('chatId', chatId);
        form.append('message', message);
        form.append('history', JSON.stringify(history));
        form.append('context', JSON.stringify(context));
        form.append('customerId', customerId);
        form.append('customerName', customerName);
        form.append('customerEmail', customerEmail);
        if (mention) form.append('mention', JSON.stringify(mention));
        form.append('image', attachedImage, attachedImage.name || 'customer-photo.jpg');
        response = await fetch('/api/salar/chat', { method: 'POST', cache: 'no-store', body: form });
      } else {
        response = await fetch('/api/salar/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            chatId,
            message,
            history,
            context,
            customerId,
            customerName,
            customerEmail,
            mention,
          }),
        });
      }

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Salar could not respond right now. Please try again.');

      setSalarPaused(result.salarPaused === true);
      if (result.chat && Array.isArray(result.chat.messages)) {
        setMessages(savedMessages(result.chat.messages));
        if (result.chat.context && typeof result.chat.context === 'object') setContext(result.chat.context as ChatContext);
      } else {
        if (result?.context && typeof result.context === 'object') setContext(result.context as ChatContext);
        const reply = String(result.reply || '').trim();
        if (reply || Array.isArray(result?.products) || Array.isArray(result?.categories)) {
          setMessages((current) => [...current, {
            role: 'assistant',
            actor: 'salar',
            content: reply,
            products: Array.isArray(result?.products) ? result.products : [],
            categories: Array.isArray(result?.categories) ? result.categories : [],
            displayMode: safeDisplayMode(result?.displayMode),
          }]);
        }
      }
    } catch (error) {
      const reply = error instanceof Error ? error.message : 'Salar could not respond right now. Please try again.';
      setMessages((current) => [...current, { role: 'assistant', actor: 'salar', content: reply, displayMode: 'none' }]);
    } finally {
      setSending(false);
      void syncChat();
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

  function SalarIcon({ size = 19 }: { size?: number }) {
    return iconUrl
      ? <img src={iconUrl} alt="Salar" className="h-full w-full object-cover"/>
      : <Bot size={size}/>;
  }

  const chatShellClass = expanded
    ? 'relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#FFFDF8] shadow-2xl'
    : 'relative flex h-[min(620px,calc(100dvh-120px))] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-[26px] border border-black/10 bg-[#FFFDF8] shadow-2xl';

  return (
    <div className={expanded && open ? 'fixed inset-0 z-[80]' : 'fixed bottom-[88px] right-3 z-50 sm:bottom-6 sm:right-5'}>
      {open ? (
        <div className={chatShellClass}>
          <div className="flex shrink-0 items-center justify-between bg-[#14140F] px-3 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2">
              {adminAuthenticated ? (
                <button type="button" onClick={() => setAdminDrawerOpen(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10" aria-label="Open customer chats"><Menu size={18}/></button>
              ) : null}
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFB020] text-[#14140F]"><SalarIcon size={19}/></span>
              <div className="min-w-0"><p className="truncate text-sm font-black">Salar</p><p className="truncate text-[9px] font-bold text-white/55">PrimeHubMall AI Salesman</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? 'Make chat smaller' : 'Open full chat'} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition active:scale-95">{expanded ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}</button>
              <button type="button" onClick={() => { setOpen(false); setExpanded(false); setAdminDrawerOpen(false); }} aria-label="Close Salar" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition active:scale-95"><X size={17}/></button>
            </div>
          </div>

          {salarPaused ? <div className="shrink-0 border-b border-[#E9C677] bg-[#FFF1D6] px-3 py-2 text-[9px] font-bold text-[#7A5100]">PrimeHub Admin is handling this chat. Salar will wait until the admin continues it.</div> : null}

          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3.5 pb-6 touch-pan-y">
            {messages.length === 0 ? (
              <div className="rounded-2xl bg-white p-4 text-xs leading-5 text-black/55 shadow-sm">Assalam-o-Alaikum! Main Salar hoon. Aap product, deal, offer ya PrimeHubMall ke bare mein pooch sakte hain — product ki photo bhi share kar sakte hain.</div>
            ) : null}

            {messages.map((message, index) => {
              const imageOnlyProducts = message.displayMode === 'product_images' ? (message.products || []).filter((product) => product.imageUrl) : [];
              const displayImage = messageImage(message);
              const showBubble = Boolean(message.content || displayImage || message.mention);
              const adminMessage = message.actor === 'admin';
              return (
                <div key={message.id || `${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={message.role === 'user' ? 'max-w-[86%]' : 'max-w-[94%]'}>
                    {showBubble ? (
                      <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${message.role === 'user' ? 'bg-[#0F6A5F] text-white' : adminMessage ? 'bg-[#FFF1D6] text-[#14140F] shadow-sm' : 'bg-white text-[#14140F] shadow-sm'}`}>
                        {adminMessage ? <p className="mb-1 text-[8px] font-black uppercase tracking-wide text-[#9A6500]">PrimeHub Admin</p> : null}
                        {message.mention ? (
                          <div className={`mb-2 flex items-center gap-2 rounded-xl p-2 ${message.role === 'user' ? 'bg-white/12' : 'bg-[#F4F4F1]'}`}>
                            {message.mention.imageUrl ? <img src={message.mention.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover"/> : null}
                            <div className="min-w-0"><p className={`text-[8px] font-black uppercase tracking-wide ${message.role === 'user' ? 'text-white/65' : 'text-black/35'}`}>Mentioned product</p><p className="line-clamp-2 text-[10px] font-bold leading-4">{message.mention.title}</p></div>
                          </div>
                        ) : null}
                        {displayImage ? <img src={displayImage} alt="Customer attachment" className="mb-2 max-h-48 w-full rounded-xl object-cover"/> : null}
                        {message.content}
                      </div>
                    ) : null}

                    {message.role === 'assistant' && message.categories?.length ? (
                      <div className={`${showBubble ? 'mt-2' : ''} grid grid-cols-2 gap-2`}>
                        {message.categories.map((category) => (
                          <button key={category.id || category.title} type="button" disabled={sending || salarPaused} onClick={() => void sendMessage(category.title)} className="flex min-h-[58px] items-center gap-2 rounded-2xl border border-black/8 bg-white p-2 text-left shadow-sm transition active:scale-[0.98] disabled:opacity-50">
                            {category.imageUrl ? <img src={category.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover"/> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F1] text-[9px] font-black">CAT</span>}
                            <span className="line-clamp-2 text-[10px] font-black leading-4 text-[#14140F]">{category.title}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {message.role === 'assistant' && imageOnlyProducts.length ? (
                      <div className={`${showBubble ? 'mt-2' : ''} grid grid-cols-2 gap-2`}>
                        {imageOnlyProducts.map((product) => (
                          <button key={product.id} type="button" onClick={() => mentionProduct(product)} className="block aspect-square overflow-hidden rounded-2xl border border-black/8 bg-[#F4F4F1] shadow-sm" aria-label={`Mention ${product.title}`}><img src={product.imageUrl} alt={product.title || 'Product'} className="h-full w-full object-cover"/></button>
                        ))}
                      </div>
                    ) : null}

                    {message.role === 'assistant' && message.displayMode !== 'product_images' && message.products?.length ? (
                      <div className={`${showBubble ? 'mt-2' : ''} flex gap-2 overflow-x-auto pb-1`}>
                        {message.products.map((product) => (
                          <div key={product.id} className="w-[142px] shrink-0 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm">
                            <button type="button" onClick={() => mentionProduct(product)} className="block aspect-square w-full bg-[#F4F4F1]" aria-label={`Mention ${product.title}`}>
                              {product.imageUrl ? <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-[9px] font-black text-black/30">PrimeHubMall</div>}
                            </button>
                            <div className="p-2.5">
                              <a href={product.path || `/product/${encodeURIComponent(product.id)}`} className="line-clamp-2 text-[10px] font-black leading-4 text-[#14140F]">{product.title}</a>
                              {product.price != null ? <p className="mt-1 text-[10px] font-black text-[#E1352B]">{money(product.price)}</p> : null}
                              {product.stock != null ? <p className="mt-0.5 text-[8px] font-bold text-black/40">{Number(product.stock) > 0 ? `${product.stock} in stock` : 'Out of stock'}</p> : null}
                              <button type="button" onClick={() => mentionProduct(product)} className="mt-2 rounded-full bg-[#F4F4F1] px-2.5 py-1.5 text-[8px] font-black text-[#0F6A5F]">Ask about this</button>
                            </div>
                          </div>
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

          <form onSubmit={submit} className="shrink-0 border-t border-black/8 bg-white p-3">
            {selectedMention ? (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#FFF1D6] p-2">
                {selectedMention.imageUrl ? <img src={selectedMention.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover"/> : null}
                <div className="min-w-0 flex-1"><p className="text-[8px] font-black uppercase tracking-wide text-black/35">Asking about</p><p className="line-clamp-2 text-[9px] font-bold">{selectedMention.title}</p></div>
                <button type="button" onClick={() => setSelectedMention(null)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white" aria-label="Remove product mention"><X size={13}/></button>
              </div>
            ) : null}
            {imagePreview ? (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#F4F4F1] p-2"><img src={imagePreview} alt="Attachment preview" className="h-12 w-12 rounded-lg object-cover"/><span className="min-w-0 flex-1 truncate text-[9px] font-bold text-black/50">{imageFile?.name || 'Product photo'}</span><button type="button" onClick={clearImage} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black/55" aria-label="Remove image"><X size={14}/></button></div>
            ) : null}
            {attachmentError ? <p className="mb-2 px-1 text-[9px] font-bold text-[#E1352B]">{attachmentError}</p> : null}
            <div className="flex items-end gap-2 rounded-2xl bg-[#F4F4F1] p-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => chooseImage(event.target.files?.[0])}/>
              <button type="button" disabled={sending} onClick={() => fileRef.current?.click()} aria-label="Attach product image" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0F6A5F] shadow-sm disabled:opacity-40"><ImagePlus size={17}/></button>
              <textarea ref={composerRef} value={text} onChange={(event) => setText(event.target.value.slice(0, 4000))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder={salarPaused ? 'PrimeHub Admin ko message karein…' : 'Salar se poochain…'} className="max-h-24 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-xs outline-none"/>
              <button type="submit" disabled={sending || (!text.trim() && !imageFile && !selectedMention)} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E1352B] text-white disabled:opacity-40"><Send size={16}/></button>
            </div>
          </form>

          <SalarAdminDrawer open={adminDrawerOpen} onClose={() => setAdminDrawerOpen(false)}/>
        </div>
      ) : null}

      {!open ? (
        <div className="flex flex-col items-end gap-1.5">
          <span className="mr-3 rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-[#14140F] shadow-md">Need help?</span>
          <button type="button" onClick={() => setOpen(true)} className="ml-auto flex h-14 items-center gap-2 rounded-full bg-[#14140F] px-4 text-white shadow-xl" aria-label="Open Salar AI salesman">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#FFB020] text-[#14140F]"><SalarIcon size={19}/></span>
            <span className="pr-1 text-xs font-black">Salar</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
