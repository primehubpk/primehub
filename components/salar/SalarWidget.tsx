'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Maximize2, Menu, Minimize2, Send, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import SalarChats from '@/components/admin/SalarChats';
import './SalarWidget.css';

type ProductAttachment = { id: string; name: string; price: number; image_url?: string | null; url?: string; size?: string | null; material?: string | null };
type ImageAttachment = { url: string };
type LinkAttachment = { title: string; url: string };
type OrderSummary = {
  complete: boolean; orderId: string; whatsappUrl?: string; items: Array<{ title?: string; quantity?: number; price?: number; lineTotal?: number }>;
  subtotal: number; advance: number; remaining: number; delivery: number; total: number; name: string; city: string; phone: string; address: string; paymentNote: string;
};
type ChatMessage = { id: string; role: 'user'|'assistant'|'system'; type?: string; text: string; attachments?: { products?: ProductAttachment[]; images?: ImageAttachment[]; links?: LinkAttachment[]; order_summary?: OrderSummary } | any[]; created_at?: string };

function objectAttachments(message: ChatMessage): any { return message.attachments && !Array.isArray(message.attachments) ? message.attachments : {}; }
function productsOf(message: ChatMessage): ProductAttachment[] { const value = objectAttachments(message); return Array.isArray(value.products) ? value.products : []; }
function imagesOf(message: ChatMessage): ImageAttachment[] { const value = objectAttachments(message); return Array.isArray(value.images) ? value.images : []; }
function linksOf(message: ChatMessage): LinkAttachment[] { const value = objectAttachments(message); return Array.isArray(value.links) ? value.links : []; }
function orderSummaryOf(message: ChatMessage): OrderSummary | null { const value = objectAttachments(message).order_summary; return value && typeof value === 'object' ? value : null; }

export default function SalarWidget() {
  const [visible, setVisible] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [adminDrawer, setAdminDrawer] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [orderBusy, setOrderBusy] = useState('');
  const [fallbackWhatsApp, setFallbackWhatsApp] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function authHeaders(): Promise<Record<string,string>> {
    try { const token = await auth.currentUser?.getIdToken(); return token ? { Authorization: `Bearer ${token}` } : {}; } catch { return {}; }
  }

  async function ensureSessionAndLoad() {
    setBusy(true); setError('');
    try {
      const headers = await authHeaders();
      const sessionResponse = await fetch('/api/salar/session', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers });
      if (!sessionResponse.ok) throw new Error('Unable to start Salar chat.');
      const response = await fetch('/api/salar/messages', { credentials: 'same-origin', cache: 'no-store', headers });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Unable to load Salar chat.');
      setMessages(Array.isArray(data?.messages) ? data.messages : []); setBlocked(data?.blocked === true);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load Salar chat.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/salar/visibility', { credentials: 'same-origin', cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((data) => { if (!cancelled) { setVisible(data?.visible === true); setAdminLoggedIn(data?.adminLoggedIn === true); } }).catch(() => { if (!cancelled) setVisible(false); });
    return () => { cancelled = true; };
  }, []);

  async function openChat() { setOpen(true); setAdminDrawer(false); await ensureSessionAndLoad(); }

  async function sendPayload(payload: Record<string, unknown>) {
    if (busy || blocked) return;
    setBusy(true); setError('');
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
      const response = await fetch('/api/salar/messages', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (response.status === 403 && data?.error === 'blocked') { setBlocked(true); setInput(''); return; }
      if (response.status === 429) throw new Error('Too many messages. Please try again in a minute.');
      if (!response.ok) throw new Error(data?.error || 'Unable to send message.');
      setMessages((current) => [...current, ...(Array.isArray(data?.messages) ? data.messages : [])]); setInput('');
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : 'Unable to send message.'); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); const value = input.trim(); if (!value || busy || blocked) return; await sendPayload({ text: value });
  }

  async function handleImage(file: File | undefined) {
    if (!file || busy || blocked) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { setError('Only JPEG, PNG, or WebP images are allowed.'); return; }
    if (file.size > 4 * 1024 * 1024) { setError('Image must be 4MB or smaller.'); return; }
    setBusy(true); setError('');
    try {
      const form = new FormData(); form.append('image', file);
      const upload = await fetch('/api/salar/upload', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: await authHeaders(), body: form });
      const uploaded = await upload.json().catch(() => null);
      if (upload.status === 403 && uploaded?.error === 'blocked') { setBlocked(true); return; }
      if (!upload.ok || !uploaded?.url) throw new Error(uploaded?.error || 'Unable to upload image.');
      const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
      const response = await fetch('/api/salar/messages', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers, body: JSON.stringify({ text: input.trim() || 'Is image ke bare mein batayein.', imageUrl: uploaded.url }) });
      const data = await response.json().catch(() => null);
      if (response.status === 403 && data?.error === 'blocked') { setBlocked(true); return; }
      if (!response.ok) throw new Error(data?.error || 'Unable to send image.');
      setMessages((current) => [...current, ...(Array.isArray(data?.messages) ? data.messages : [])]); setInput('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to upload image.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function quickArea(value: string) {
    if (!value || busy || blocked) return;
    if (value === 'images') { fileRef.current?.click(); return; }
    const topics: Record<string, string> = { reseller: 'reseller_club', skill: 'prime_skill', shopping: 'shopping' };
    const labels: Record<string, string> = { reseller: 'Reseller Club', skill: 'Prime Skill', shopping: 'Shopping' };
    if (topics[value]) await sendPayload({ text: labels[value], topic: topics[value] });
  }

  async function placeOrder(summary: OrderSummary) {
    if (!summary.complete || orderBusy || blocked) return;
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    setOrderBusy(summary.orderId); setError('');
    try {
      const response = await fetch('/api/salar/order', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: '{}' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.orderId) throw new Error(data?.error || 'Unable to confirm website order.');
      const whatsappUrl = String(data.whatsappUrl || summary.whatsappUrl || '');
      if (whatsappUrl) {
        setFallbackWhatsApp((current) => ({ ...current, [summary.orderId]: whatsappUrl }));
        if (popup) popup.location.href = whatsappUrl; else window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      } else {
        popup?.close();
        setError('Order website par save hai, lekin WhatsApp number configured nahi mila.');
      }
    } catch (caught) {
      popup?.close(); setError(caught instanceof Error ? caught.message : 'Unable to confirm website order.');
    } finally { setOrderBusy(''); }
  }

  if (!visible) return null;

  return <div className="salar-root" aria-live="polite">
    {open ? <section className={`salar-panel ${maximized ? 'salar-panel-max' : ''}`} aria-label="Salar help chat">
      <header className="salar-header"><div className="salar-identity"><div className="salar-avatar" aria-hidden="true">{!imageFailed ? <img src="/salar-placeholder.svg" alt="" onError={() => setImageFailed(true)} /> : <span>S</span>}</div><div><strong>Salar</strong><small>{blocked ? 'Blocked' : 'Need help?'}</small></div></div><div className="salar-actions">{adminLoggedIn ? <button type="button" onClick={() => setAdminDrawer((value) => !value)} aria-label="All Salar chats"><Menu size={16}/></button> : null}<button type="button" onClick={() => setOpen(false)} aria-label="Minimize Salar"><Minimize2 size={16}/></button><button type="button" onClick={() => setMaximized((value) => !value)} aria-label={maximized ? 'Restore Salar' : 'Maximize Salar'}><Maximize2 size={16}/></button><button type="button" onClick={() => { setOpen(false); setMaximized(false); setAdminDrawer(false); }} aria-label="Close Salar"><X size={17}/></button></div></header>
      {adminDrawer && adminLoggedIn ? <div className="salar-admin-drawer"><SalarChats compact /></div> : <>
        <div className="salar-body"><div className="salar-messages">{!messages.length && !busy ? <div className="salar-bubble">Assalamualaikum, I am Salar from PrimeHub Mall. Need help?</div> : null}
          {messages.map((message) => { const products = productsOf(message); const images = imagesOf(message); const links = linksOf(message); const summary = orderSummaryOf(message); return <div key={message.id} className={`salar-message-wrap ${message.role === 'user' ? 'salar-message-mine' : ''}`}>
            <div className={`salar-bubble ${message.role === 'user' ? 'salar-bubble-mine' : ''}`}>{message.text}</div>
            {images.length ? <div className="salar-upload-images">{images.map((image, index) => <a key={`${image.url}-${index}`} className="salar-upload-thumb" href={image.url} target="_blank" rel="noopener noreferrer"><img src={image.url} alt="Uploaded to Salar" loading="lazy" /></a>)}</div> : null}
            {products.length ? <div className="salar-products">{products.map((product) => { const card = <><div className="salar-product-image">{product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <span>No photo</span>}</div><div className="salar-product-copy"><strong>{product.name}</strong><span>Rs {Number(product.price || 0).toLocaleString()}</span>{product.size ? <small>Size: {product.size}</small> : null}{product.material ? <small>{product.material}</small> : null}</div></>; return product.url ? <a key={product.id} className="salar-product-card" href={product.url} target="_blank" rel="noopener noreferrer">{card}</a> : <div key={product.id} className="salar-product-card">{card}</div>; })}</div> : null}
            {links.length ? <div className="salar-links">{links.map((link, index) => <a key={`${link.url}-${index}`} className="salar-link" href={link.url} target="_blank" rel="noopener noreferrer">Open {link.title || 'PrimeHub page'}</a>)}</div> : null}
            {summary ? <div className="salar-order-summary"><strong>PrimeHub Order Summary</strong><div className="salar-order-items">{summary.items.map((item, index) => <span key={`${item.title}-${index}`}>{item.title} × {item.quantity || 1} <b>Rs {Number(item.lineTotal ?? item.price ?? 0).toLocaleString()}</b></span>)}</div><div className="salar-order-row"><span>Subtotal</span><b>Rs {Number(summary.subtotal).toLocaleString()}</b></div><div className="salar-order-row"><span>Delivery</span><b>Rs {Number(summary.delivery).toLocaleString()}</b></div><div className="salar-order-row"><span>Total</span><b>Rs {Number(summary.total).toLocaleString()}</b></div><div className="salar-order-row"><span>Advance</span><b>Rs {Number(summary.advance).toLocaleString()}</b></div><div className="salar-order-row"><span>Remaining after video</span><b>Rs {Number(summary.remaining).toLocaleString()}</b></div><div className="salar-order-customer"><span>{summary.name}</span><span>{summary.city} · {summary.phone}</span><span>{summary.address}</span><small>{summary.paymentNote}</small></div>{summary.complete ? <button type="button" className="salar-place-order" disabled={orderBusy === summary.orderId} onClick={() => void placeOrder(summary)}>{orderBusy === summary.orderId ? 'Saving…' : 'Place Order'}</button> : null}{(fallbackWhatsApp[summary.orderId] || summary.whatsappUrl) ? <a className="salar-whatsapp-fallback" href={fallbackWhatsApp[summary.orderId] || summary.whatsappUrl} target="_blank" rel="noopener noreferrer">Open WhatsApp</a> : null}</div> : null}
          </div>; })}
          {busy ? <div className="salar-bubble">Salar soch raha hai…</div> : null}
        </div>
        {blocked ? <div className="salar-blocked"><strong>Blocked</strong><span>Unblock ki request: primehubpk1@gmail.com</span></div> : null}
        <label className="salar-select-label" htmlFor="salar-area">Quick area</label>
        <select id="salar-area" className="salar-select" defaultValue="" disabled={busy || blocked} onChange={(event) => { const value = event.target.value; event.target.value = ''; void quickArea(value); }}><option value="">Choose…</option><option value="images">Images</option><option value="reseller">Reseller Club</option><option value="skill">Prime Skill</option><option value="shopping">Shopping</option></select>
        <input ref={fileRef} className="salar-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleImage(event.target.files?.[0])} />
        {error ? <p className="salar-error">{error}</p> : null}</div>
        {!blocked ? <form className="salar-composer" onSubmit={submit}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type a message…" aria-label="Message Salar" disabled={busy}/><button type="submit" aria-label="Send message" disabled={busy || !input.trim()}><Send size={17}/></button></form> : null}
      </>}
    </section> : null}
    <button type="button" className="salar-launcher" onClick={() => void openChat()} aria-label="Open Salar help"><span className="salar-launcher-avatar" aria-hidden="true">{!imageFailed ? <img src="/salar-placeholder.svg" alt="" onError={() => setImageFailed(true)} /> : <span>S</span>}</span><span><strong>Salar</strong><small>Need help?</small></span></button>
  </div>;
}
