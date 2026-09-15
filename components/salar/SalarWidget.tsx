'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, ImagePlus, Send, X } from 'lucide-react';
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
};

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `Rs. ${amount.toLocaleString('en-PK')}` : '';
}

function safeDisplayMode(value: unknown): DisplayMode {
  return value === 'products' || value === 'categories' || value === 'product_images' ? value : 'none';
}

export default function SalarWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [context, setContext] = useState<ChatContext>({ shownProductIds: [] });
  const [customerName, setCustomerName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (user) => {
      setCustomerName(String(user?.displayName || '').trim().slice(0, 80));
    });
    return stop;
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, sending]);

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

  async function sendMessage(rawMessage: string, attachedImage: File | null = null, preview = '') {
    const message = rawMessage.trim();
    if ((!message && !attachedImage) || sending) return;

    const history = messages.slice(-10).map(({ role, content }) => ({ role, content })).filter((item) => item.content);
    const userContent = message || '📷 Product photo';
    setMessages((current) => [...current, { role: 'user', content: userContent, imagePreview: preview || undefined }]);
    setSending(true);

    try {
      let response: Response;
      if (attachedImage) {
        const form = new FormData();
        form.append('message', message);
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
          body: JSON.stringify({ message, history, context, customerName }),
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
    if ((!message && !file) || sending) return;
    setText('');
    clearImage();
    await sendMessage(message, file, preview);
  }

  return (
    <div className="fixed bottom-[88px] right-3 z-50 sm:bottom-6 sm:right-5">
      {open ? (
        <div className="mb-3 flex h-[min(600px,78vh)] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-[26px] border border-black/10 bg-[#FFFDF8] shadow-2xl">
          <div className="flex items-center justify-between bg-[#14140F] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFB020] text-[#14140F]"><Bot size={19}/></span>
              <div><p className="text-sm font-black">Salar</p><p className="text-[9px] font-bold text-white/55">PrimeHubMall AI Salesman</p></div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Salar" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"><X size={17}/></button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
            {messages.length === 0 ? (
              <div className="rounded-2xl bg-white p-4 text-xs leading-5 text-black/55 shadow-sm">
                Assalam-o-Alaikum! Main Salar hoon. Aap product, deal, offer ya PrimeHubMall ke bare mein pooch sakte hain — product ki photo bhi share kar sakte hain.
              </div>
            ) : null}

            {messages.map((message, index) => {
              const imageOnlyProducts = message.displayMode === 'product_images'
                ? (message.products || []).filter((product) => product.imageUrl)
                : [];
              const showBubble = Boolean(message.content || message.imagePreview);

              return (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={message.role === 'user' ? 'max-w-[86%]' : 'max-w-[94%]'}>
                    {showBubble ? (
                      <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${message.role === 'user' ? 'bg-[#0F6A5F] text-white' : 'bg-white text-[#14140F] shadow-sm'}`}>
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
                            onClick={() => void sendMessage(category.title)}
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
                          <a
                            key={product.id}
                            href={product.path || `/product/${encodeURIComponent(product.id)}`}
                            aria-label={product.title || 'Open product'}
                            className="block aspect-square overflow-hidden rounded-2xl border border-black/8 bg-[#F4F4F1] shadow-sm"
                          >
                            <img src={product.imageUrl} alt={product.title || 'Product'} className="h-full w-full object-cover"/>
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {message.role === 'assistant' && message.displayMode !== 'product_images' && message.products?.length ? (
                      <div className={`${showBubble ? 'mt-2' : ''} flex gap-2 overflow-x-auto pb-1`}>
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

          <form onSubmit={submit} className="border-t border-black/8 bg-white p-3">
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
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, 4000))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                placeholder="Salar se poochain…"
                className="max-h-24 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-xs outline-none"
              />
              <button type="submit" disabled={sending || (!text.trim() && !imageFile)} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E1352B] text-white disabled:opacity-40"><Send size={16}/></button>
            </div>
          </form>
        </div>
      ) : null}

      <button type="button" onClick={() => setOpen((value) => !value)} className="ml-auto flex h-14 items-center gap-2 rounded-full bg-[#14140F] px-4 text-white shadow-xl" aria-label="Open Salar AI salesman">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFB020] text-[#14140F]"><Bot size={19}/></span>
        <span className="pr-1 text-xs font-black">Salar</span>
      </button>
    </div>
  );
}
