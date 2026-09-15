'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Check, Forward, ImagePlus, Maximize2, Menu, Minus, Minimize2, Plus, Send, ShoppingCart, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
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

type OrderItem = ProductCard & { quantity: number };
type OrderCustomer = { name: string; phone: string; email: string; city: string; address: string };
type OrderQuote = {
  items?: Array<{ productId: string; title: string; price: number; quantity: number; image?: string }>;
  subtotal?: number;
  rawSubtotal?: number;
  deliveryCharge?: number;
  total?: number;
  totalItems?: number;
  tierDiscount?: number;
  rewardLabel?: string;
};

const STORAGE_KEY = 'primehub-salar-chat-v5';
const LEGACY_STORAGE_KEYS = ['primehub-salar-chat-v4', 'primehub-salar-chat-v3'];
const CHAT_ID_KEY = 'primehub-salar-chat-id-v1';
const MAX_SAVED_MESSAGES = 100;
const MAX_SAVED_PRODUCTS_PER_MESSAGE = 600;

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
  } catch {}
  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function historyContent(message: ChatMessage) {
  const actorPrefix = message.actor === 'admin' ? '[PrimeHub Admin message] ' : '';
  const reference = message.mention
    ? `\n[Customer referenced exact product: ${message.mention.title}; product id: ${message.mention.id}]`
    : '';
  const products = message.role === 'user' && message.products?.length
    ? `\n[Customer selected products: ${message.products.map((product) => `${product.title} (${product.id})`).join(' | ')}]`
    : '';
  return `${actorPrefix}${message.content || ''}${reference}${products}`.trim();
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
      products: Array.isArray(item.products) ? item.products.slice(0, MAX_SAVED_PRODUCTS_PER_MESSAGE) : [],
      categories: Array.isArray(item.categories) ? item.categories.slice(0, 30) : [],
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

function groupedImageProducts(products: ProductCard[]) {
  const groups = new Map<string, ProductCard[]>();
  for (const product of products) {
    const label = String(product.category || '').trim() || 'More designs';
    const current = groups.get(label) || [];
    current.push(product);
    groups.set(label, current);
  }
  return [...groups.entries()];
}

function orderIntent(value: string) {
  return /(order|final|confirm|book|place|mangwa|mangwana|mangva|mangwana|order kr|order kar|final kr|final kar|پکا|آرڈر)/i.test(value);
}

function cleanPhone(value: string) {
  return value.replace(/[^0-9+]/g, '').slice(0, 20);
}

function detailsFromMessage(message: string) {
  const lines = message.split(/\n|,/).map((line) => line.trim()).filter(Boolean);
  const out: Partial<OrderCustomer> = {};
  for (const line of lines) {
    const name = line.match(/^(?:name|naam)\s*[:\-]?\s*(.+)$/i);
    const phone = line.match(/^(?:phone|contact|number|mobile|whatsapp)\s*[:\-]?\s*(.+)$/i);
    const city = line.match(/^(?:city|shehar)\s*[:\-]?\s*(.+)$/i);
    const address = line.match(/^(?:address|pata|full address)\s*[:\-]?\s*(.+)$/i);
    if (name) out.name = name[1].trim().slice(0, 120);
    if (phone) out.phone = cleanPhone(phone[1]);
    if (city) out.city = city[1].trim().slice(0, 120);
    if (address) out.address = address[1].trim().slice(0, 500);
  }
  if (!out.phone) {
    const phone = message.match(/(?:\+?92|0)?3\d{9}/);
    if (phone) out.phone = cleanPhone(phone[0]);
  }
  return out;
}

function customerComplete(customer: OrderCustomer) {
  return Boolean(customer.name.trim() && customer.phone.trim() && customer.city.trim() && customer.address.trim());
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  } catch {
    return {};
  }
}

function cleanWhatsAppNumber(value: unknown) {
  return String(value || '').replace(/[^0-9]/g, '');
}

async function adminWhatsAppNumber() {
  for (const reference of [doc(db, 'settings', 'main'), doc(db, 'settings', 'contact')]) {
    try {
      const snapshot = await getDoc(reference);
      if (!snapshot.exists()) continue;
      const data: any = snapshot.data() || {};
      const value = data.adminWhatsappNumber ?? data.whatsappNumber ?? data.whatsapp ?? data.phone
        ?? data.contact?.adminWhatsappNumber ?? data.contact?.whatsappNumber ?? data.contact?.whatsapp ?? data.contact?.phone;
      const number = cleanWhatsAppNumber(value);
      if (number) return number;
    } catch {}
  }
  return '';
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
  const [selectedProducts, setSelectedProducts] = useState<ProductCard[]>([]);
  const [lastSharedProducts, setLastSharedProducts] = useState<ProductCard[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [salarPaused, setSalarPaused] = useState(false);
  const [iconUrl, setIconUrl] = useState('');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderCustomer, setOrderCustomer] = useState<OrderCustomer>({ name: '', phone: '', email: '', city: '', address: '' });
  const [orderQuote, setOrderQuote] = useState<OrderQuote | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderId, setOrderId] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (user) => {
      const name = String(user?.displayName || '').trim().slice(0, 120);
      const email = String(user?.email || '').trim().slice(0, 240);
      setCustomerId(String(user?.uid || '').trim().slice(0, 200));
      setCustomerName(name);
      setCustomerEmail(email);
      setOrderCustomer((current) => ({ ...current, name: current.name || name, email: current.email || email }));
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

      let raw = window.localStorage.getItem(STORAGE_KEY) || '';
      if (!raw) {
        for (const key of LEGACY_STORAGE_KEYS) {
          raw = window.localStorage.getItem(key) || '';
          if (raw) break;
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw) as any;
        setMessages(savedMessages(parsed.messages));
        if (parsed.context && typeof parsed.context === 'object') setContext(parsed.context as ChatContext);
        if (Array.isArray(parsed.lastSharedProducts)) setLastSharedProducts(parsed.lastSharedProducts.slice(0, 30));
        if (Array.isArray(parsed.orderItems)) setOrderItems(parsed.orderItems.slice(0, 30));
        if (parsed.orderCustomer && typeof parsed.orderCustomer === 'object') setOrderCustomer((current) => ({ ...current, ...parsed.orderCustomer }));
        if (parsed.orderQuote && typeof parsed.orderQuote === 'object') setOrderQuote(parsed.orderQuote as OrderQuote);
        if (typeof parsed.orderId === 'string') setOrderId(parsed.orderId.slice(0, 200));
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        messages: persistable,
        context,
        lastSharedProducts,
        orderItems,
        orderCustomer,
        orderQuote,
        orderId,
      }));
    } catch {}
  }, [messages, context, hydrated, lastSharedProducts, orderItems, orderCustomer, orderQuote, orderId]);

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
    } catch {}
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
    const frame = window.requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: sending ? 'smooth' : 'auto', block: 'end' }));
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, open, sending, adminDrawerOpen]);

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
    if (!file.type.startsWith('image/')) return setAttachmentError('Sirf image attach karein.');
    if (file.size > 3 * 1024 * 1024) return setAttachmentError('Image 3 MB ya us se choti honi chahiye.');
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  }

  function toggleProduct(product: ProductCard) {
    setSelectedProducts((current) => {
      if (current.some((item) => item.id === product.id)) return current.filter((item) => item.id !== product.id);
      return [...current, product].slice(0, 30);
    });
  }

  function selected(id: string) {
    return selectedProducts.some((product) => product.id === id);
  }

  async function quoteOrder(items: OrderItem[]) {
    if (!items.length) return;
    setOrderLoading(true);
    setOrderError('');
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ mode: 'quote', items: items.map((item) => ({ productId: item.id, quantity: item.quantity })) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Bill verify nahi ho saka.');
      setOrderQuote(data as OrderQuote);
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'Bill verify nahi ho saka.');
    } finally {
      setOrderLoading(false);
    }
  }

  async function startOrderDraft(products: ProductCard[]) {
    const unique = [...new Map(products.map((product) => [product.id, product])).values()].slice(0, 30);
    if (!unique.length) return;
    const items = unique.map((product) => ({ ...product, quantity: 1 }));
    setOrderItems(items);
    setOrderId('');
    setOrderQuote(null);
    setOrderError('');
    await quoteOrder(items);
  }

  function changeQuantity(id: string, delta: number) {
    const next = orderItems.map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.min(50, item.quantity + delta)) } : item);
    setOrderItems(next);
    void quoteOrder(next);
  }

  async function whatsappOrder(orderNumber = orderId, quote = orderQuote) {
    if (!orderNumber) return;
    const number = await adminWhatsAppNumber();
    if (!number) return setOrderError('WhatsApp number website settings mein nahi mila.');
    const lines = (quote?.items || orderItems).map((item: any, index: number) => `${index + 1}. ${item.title || item.name || 'Product'} x ${item.quantity || 1}`);
    const message = [
      '*PrimeHub Salar Order*',
      `Order ID: ${orderNumber}`,
      '',
      ...lines,
      '',
      `Name: ${orderCustomer.name}`,
      `Phone: ${orderCustomer.phone}`,
      `City: ${orderCustomer.city}`,
      `Address: ${orderCustomer.address}`,
      quote?.total != null ? `Total: Rs. ${Number(quote.total).toLocaleString('en-PK')}` : '',
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  async function placeChatOrder(openWhatsAppAfter = false, itemsOverride?: OrderItem[], customerOverride?: OrderCustomer) {
    const items = itemsOverride || orderItems;
    const customer = customerOverride || orderCustomer;
    if (!items.length) return setOrderError('Order mein product select karein.');
    if (!customerComplete(customer)) return setOrderError('Name, contact, city aur complete address fill karein.');
    if (orderLoading || orderId) return;

    setOrderLoading(true);
    setOrderError('');
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          customer: { ...customer, notes: 'Order prepared through Salar chat. Advance requested: Rs. 500; remaining payment after ready-order video confirmation.' },
          items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Order place nahi ho saka.');
      setOrderId(String(data.orderId || ''));
      setOrderQuote(data as OrderQuote);
      setMessages((current) => [...current, {
        role: 'assistant',
        actor: 'salar',
        content: `Order website par place ho gaya hai. Order ID: ${String(data.orderId || '')}`,
        createdAt: new Date().toISOString(),
      }]);
      if (openWhatsAppAfter) await whatsappOrder(String(data.orderId || ''), data as OrderQuote);
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'Order place nahi ho saka.');
    } finally {
      setOrderLoading(false);
    }
  }

  async function sendMessage(rawMessage: string, attachedImage: File | null = null, preview = '', referencesOverride?: ProductCard[]) {
    const message = rawMessage.trim();
    const references = referencesOverride === undefined ? selectedProducts : referencesOverride;
    if ((!message && !attachedImage && !references.length) || sending || !chatId) return;

    const parsedDetails = detailsFromMessage(message);
    const mergedCustomer = { ...orderCustomer, ...parsedDetails };
    if (Object.keys(parsedDetails).length) setOrderCustomer(mergedCustomer);

    const history = messages.slice(-10).map((item) => ({ role: item.role, content: historyContent(item) })).filter((item) => item.content);
    const userContent = message || (references.length ? `${references.length} selected products` : '📷 Product photo');
    const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setMessages((current) => [...current, {
      id: optimisticId,
      role: 'user',
      actor: 'customer',
      content: userContent,
      imagePreview: preview || undefined,
      products: references.length ? references : undefined,
      createdAt: new Date().toISOString(),
    }]);
    if (referencesOverride === undefined) setSelectedProducts([]);
    if (references.length) setLastSharedProducts(references);
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
        if (references.length) form.append('references', JSON.stringify(references));
        form.append('image', attachedImage, attachedImage.name || 'customer-photo.jpg');
        response = await fetch('/api/salar/chat', { method: 'POST', cache: 'no-store', body: form });
      } else {
        response = await fetch('/api/salar/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ chatId, message, history, context, customerId, customerName, customerEmail, references }),
        });
      }

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Salar could not respond right now. Please try again.');

      setSalarPaused(result.salarPaused === true);
      if (result.chat && Array.isArray(result.chat.messages)) {
        setMessages(savedMessages(result.chat.messages));
        if (result.chat.context && typeof result.chat.context === 'object') setContext(result.chat.context as ChatContext);
      } else if (result?.context && typeof result.context === 'object') {
        setContext(result.context as ChatContext);
      }

      const candidatesForOrder = references.length ? references : lastSharedProducts;
      let currentOrderItems = orderItems;
      if (orderIntent(message) && !currentOrderItems.length && candidatesForOrder.length) {
        currentOrderItems = candidatesForOrder.map((product) => ({ ...product, quantity: 1 }));
        setOrderItems(currentOrderItems);
        void quoteOrder(currentOrderItems);
      }
      if (orderIntent(message) && currentOrderItems.length && customerComplete(mergedCustomer) && !orderId) {
        void placeChatOrder(false, currentOrderItems, mergedCustomer);
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
    if ((!message && !file && !selectedProducts.length) || sending) return;
    setText('');
    clearImage();
    await sendMessage(message, file, preview);
  }

  async function sendSelectedProducts() {
    if (!selectedProducts.length || sending) return;
    const message = text.trim() || `Ye ${selectedProducts.length} products dekhein.`;
    setText('');
    await sendMessage(message, null, '', selectedProducts);
    setSelectedProducts([]);
  }

  async function makeSelectedOrder() {
    if (!selectedProducts.length || sending) return;
    const products = [...selectedProducts];
    await startOrderDraft(products);
    setText('');
    await sendMessage('Ye selected products mera order draft bana dein.', null, '', products);
    setSelectedProducts([]);
  }

  function SalarIcon({ size = 19 }: { size?: number }) {
    return iconUrl ? <img src={iconUrl} alt="Salar" className="h-full w-full object-cover"/> : <Bot size={size}/>;
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
              {adminAuthenticated ? <button type="button" onClick={() => setAdminDrawerOpen(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10" aria-label="Open customer chats"><Menu size={18}/></button> : null}
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
            {messages.length === 0 ? <div className="rounded-2xl bg-white p-4 text-xs leading-5 text-black/55 shadow-sm">Assalam-o-Alaikum! Main Salar hoon. Aap product, deal, offer ya PrimeHubMall ke bare mein pooch sakte hain — product ki photo bhi share kar sakte hain.</div> : null}

            {messages.map((message, index) => {
              const imageOnlyProducts = message.displayMode === 'product_images' ? (message.products || []).filter((product) => product.imageUrl) : [];
              const imageGroups = groupedImageProducts(imageOnlyProducts);
              const displayImage = messageImage(message);
              const showBubble = Boolean(message.content || displayImage || message.mention);
              const adminMessage = message.actor === 'admin';
              return (
                <div key={message.id || `${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={message.role === 'user' ? 'max-w-[88%]' : 'max-w-[96%]'}>
                    {showBubble ? (
                      <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${message.role === 'user' ? 'bg-[#0F6A5F] text-white' : adminMessage ? 'bg-[#FFF1D6] text-[#14140F] shadow-sm' : 'bg-white text-[#14140F] shadow-sm'}`}>
                        {adminMessage ? <p className="mb-1 text-[8px] font-black uppercase tracking-wide text-[#9A6500]">PrimeHub Admin</p> : null}
                        {message.mention ? <div className={`mb-2 flex items-center gap-2 rounded-xl p-2 ${message.role === 'user' ? 'bg-white/12' : 'bg-[#F4F4F1]'}`}>{message.mention.imageUrl ? <img src={message.mention.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover"/> : null}<div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-wide opacity-60">Mentioned product</p><p className="line-clamp-2 text-[10px] font-bold leading-4">{message.mention.title}</p></div></div> : null}
                        {displayImage ? <img src={displayImage} alt="Customer attachment" className="mb-2 max-h-48 w-full rounded-xl object-cover"/> : null}
                        {message.content}
                      </div>
                    ) : null}

                    {message.role === 'user' && message.products?.length ? (
                      <div className={`${showBubble ? 'mt-2' : ''} ml-auto grid max-w-[260px] grid-cols-3 gap-1.5`}>
                        {message.products.filter((product) => product.imageUrl).slice(0, 9).map((product) => <img key={product.id} src={product.imageUrl} alt={product.title} className="aspect-square w-full rounded-xl object-cover"/>)}
                      </div>
                    ) : null}

                    {message.role === 'assistant' && message.categories?.length ? (
                      <div className={`${showBubble ? 'mt-2' : ''} grid grid-cols-2 gap-2`}>
                        {message.categories.map((category) => <button key={category.id || category.title} type="button" disabled={sending || salarPaused} onClick={() => void sendMessage(category.title)} className="flex min-h-[58px] items-center gap-2 rounded-2xl border border-black/8 bg-white p-2 text-left shadow-sm transition active:scale-[0.98] disabled:opacity-50">{category.imageUrl ? <img src={category.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover"/> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F1] text-[9px] font-black">CAT</span>}<span className="line-clamp-2 text-[10px] font-black leading-4 text-[#14140F]">{category.title}</span></button>)}
                      </div>
                    ) : null}

                    {message.role === 'assistant' && imageOnlyProducts.length ? (
                      <div className={`${showBubble ? 'mt-2' : ''} space-y-3`}>
                        {imageGroups.map(([groupName, groupProducts]) => (
                          <div key={groupName}>
                            {imageGroups.length > 1 ? <p className="mb-1.5 text-[9px] font-black uppercase tracking-wide text-black/50">{groupName}</p> : null}
                            <div className="grid grid-cols-5 gap-1.5">
                              {groupProducts.map((product) => (
                                <button key={product.id} type="button" onClick={() => toggleProduct(product)} className={`relative block aspect-square overflow-hidden rounded-xl border bg-[#F4F4F1] shadow-sm ${selected(product.id) ? 'border-[#0F6A5F] ring-2 ring-[#0F6A5F]/30' : 'border-black/8'}`} aria-label={`Select ${product.title}`}>
                                  <img src={product.imageUrl} alt={product.title || 'Product'} className="h-full w-full object-cover"/>
                                  {selected(product.id) ? <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0F6A5F] text-white"><Check size={11}/></span> : null}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {message.role === 'assistant' && message.displayMode !== 'product_images' && message.products?.length ? (
                      <div className={`${showBubble ? 'mt-2' : ''} flex gap-2 overflow-x-auto pb-1`}>
                        {message.products.map((product) => (
                          <div key={product.id} className={`w-[142px] shrink-0 overflow-hidden rounded-2xl border bg-white shadow-sm ${selected(product.id) ? 'border-[#0F6A5F] ring-2 ring-[#0F6A5F]/20' : 'border-black/8'}`}>
                            <button type="button" onClick={() => toggleProduct(product)} className="relative block aspect-square w-full bg-[#F4F4F1]" aria-label={`Select ${product.title}`}>
                              {product.imageUrl ? <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-[9px] font-black text-black/30">PrimeHubMall</div>}
                              {selected(product.id) ? <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#0F6A5F] text-white"><Check size={14}/></span> : null}
                            </button>
                            <div className="p-2.5"><a href={product.path || `/product/${encodeURIComponent(product.id)}`} className="line-clamp-2 text-[10px] font-black leading-4 text-[#14140F]">{product.title}</a>{product.price != null ? <p className="mt-1 text-[10px] font-black text-[#E1352B]">{money(product.price)}</p> : null}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {orderItems.length ? (
              <div className="rounded-2xl border border-[#0F6A5F]/20 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><ShoppingCart size={16} className="text-[#0F6A5F]"/><div><p className="text-[10px] font-black">Order draft</p><p className="text-[8px] text-black/40">Advance Rs. 500 · balance after ready-order video</p></div></div><button type="button" onClick={() => { setOrderItems([]); setOrderQuote(null); setOrderId(''); setOrderError(''); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F4F4F1]"><X size={13}/></button></div>
                <div className="mt-2 space-y-2">{orderItems.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl bg-[#F6F6F2] p-2">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover"/> : null}<p className="min-w-0 flex-1 line-clamp-2 text-[9px] font-bold">{item.title}</p><div className="flex items-center gap-1"><button type="button" onClick={() => changeQuantity(item.id, -1)} className="flex h-6 w-6 items-center justify-center rounded-full bg-white"><Minus size={11}/></button><span className="w-5 text-center text-[9px] font-black">{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} className="flex h-6 w-6 items-center justify-center rounded-full bg-white"><Plus size={11}/></button></div></div>)}</div>
                {orderQuote ? <div className="mt-2 rounded-xl bg-[#FFF7E7] p-2.5 text-[9px]"><div className="flex justify-between"><span>Subtotal</span><b>{money(orderQuote.subtotal ?? orderQuote.rawSubtotal)}</b></div><div className="mt-1 flex justify-between"><span>Delivery</span><b>{money(orderQuote.deliveryCharge)}</b></div><div className="mt-1 flex justify-between text-[10px]"><span className="font-black">Total</span><b className="text-[#E1352B]">{money(orderQuote.total)}</b></div></div> : null}
                {!orderId ? <div className="mt-3 grid grid-cols-2 gap-2"><input value={orderCustomer.name} onChange={(event) => setOrderCustomer((current) => ({ ...current, name: event.target.value }))} placeholder="Name" className="rounded-xl bg-[#F4F4F1] px-3 py-2 text-[9px] outline-none"/><input value={orderCustomer.phone} onChange={(event) => setOrderCustomer((current) => ({ ...current, phone: event.target.value }))} placeholder="Contact" className="rounded-xl bg-[#F4F4F1] px-3 py-2 text-[9px] outline-none"/><input value={orderCustomer.city} onChange={(event) => setOrderCustomer((current) => ({ ...current, city: event.target.value }))} placeholder="City" className="rounded-xl bg-[#F4F4F1] px-3 py-2 text-[9px] outline-none"/><input value={orderCustomer.address} onChange={(event) => setOrderCustomer((current) => ({ ...current, address: event.target.value }))} placeholder="Complete address" className="rounded-xl bg-[#F4F4F1] px-3 py-2 text-[9px] outline-none"/></div> : null}
                {orderError ? <p className="mt-2 text-[8px] font-bold text-[#E1352B]">{orderError}</p> : null}
                {orderId ? <div className="mt-3 rounded-xl bg-[#EAF7F4] p-3 text-[9px] font-bold text-[#0F6A5F]">Order placed ✓<br/>ID: {orderId}<button type="button" onClick={() => void whatsappOrder()} className="mt-2 block rounded-full bg-[#0F6A5F] px-3 py-2 text-[8px] font-black text-white">Send to WhatsApp</button></div> : <button type="button" disabled={orderLoading || !customerComplete(orderCustomer)} onClick={() => void placeChatOrder(true)} className="mt-3 w-full rounded-full bg-[#14140F] px-4 py-3 text-[9px] font-black text-white disabled:opacity-40">{orderLoading ? 'Placing order…' : 'Place Order + WhatsApp'}</button>}
              </div>
            ) : null}

            {sending ? <div className="inline-flex rounded-2xl bg-white px-3.5 py-2.5 text-[10px] font-bold text-black/40 shadow-sm">Salar is typing…</div> : null}
            <div ref={endRef}/>
          </div>

          <form onSubmit={submit} className="shrink-0 border-t border-black/8 bg-white p-3">
            {selectedProducts.length ? (
              <div className="mb-2 rounded-xl bg-[#FFF1D6] p-2">
                <div className="flex items-center gap-2"><div className="flex -space-x-2">{selectedProducts.slice(0, 5).map((product) => product.imageUrl ? <img key={product.id} src={product.imageUrl} alt="" className="h-9 w-9 rounded-lg border-2 border-[#FFF1D6] object-cover"/> : null)}</div><p className="min-w-0 flex-1 text-[9px] font-black">{selectedProducts.length} selected</p><button type="button" onClick={() => setSelectedProducts([])} className="flex h-7 w-7 items-center justify-center rounded-full bg-white"><X size={13}/></button></div>
                <div className="mt-2 flex gap-2"><button type="button" disabled={sending} onClick={() => void sendSelectedProducts()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#0F6A5F] px-3 py-2 text-[8px] font-black text-white"><Forward size={12}/>Send selected</button><button type="button" disabled={sending} onClick={() => void makeSelectedOrder()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#14140F] px-3 py-2 text-[8px] font-black text-white"><ShoppingCart size={12}/>Make order</button></div>
              </div>
            ) : null}
            {imagePreview ? <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#F4F4F1] p-2"><img src={imagePreview} alt="Attachment preview" className="h-12 w-12 rounded-lg object-cover"/><span className="min-w-0 flex-1 truncate text-[9px] font-bold text-black/50">{imageFile?.name || 'Product photo'}</span><button type="button" onClick={clearImage} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black/55"><X size={14}/></button></div> : null}
            {attachmentError ? <p className="mb-2 px-1 text-[9px] font-bold text-[#E1352B]">{attachmentError}</p> : null}
            <div className="flex items-end gap-2 rounded-2xl bg-[#F4F4F1] p-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => chooseImage(event.target.files?.[0])}/>
              <button type="button" disabled={sending} onClick={() => fileRef.current?.click()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0F6A5F] shadow-sm disabled:opacity-40"><ImagePlus size={17}/></button>
              <textarea ref={composerRef} value={text} onChange={(event) => setText(event.target.value.slice(0, 4000))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder={salarPaused ? 'PrimeHub Admin ko message karein…' : 'Salar se poochain…'} className="max-h-24 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-xs outline-none"/>
              <button type="submit" disabled={sending || (!text.trim() && !imageFile && !selectedProducts.length)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E1352B] text-white disabled:opacity-40"><Send size={16}/></button>
            </div>
          </form>

          <SalarAdminDrawer open={adminDrawerOpen} onClose={() => setAdminDrawerOpen(false)}/>
        </div>
      ) : null}

      {!open ? <div className="flex flex-col items-end gap-1.5"><span className="mr-3 rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-[#14140F] shadow-md">Need help?</span><button type="button" onClick={() => setOpen(true)} className="ml-auto flex h-14 items-center gap-2 rounded-full bg-[#14140F] px-4 text-white shadow-xl"><span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#FFB020] text-[#14140F]"><SalarIcon size={19}/></span><span className="pr-1 text-xs font-black">Salar</span></button></div> : null}
    </div>
  );
}
