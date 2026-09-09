'use client';

/**
 * Repo inspection: homepage = app/page.tsx -> components/HomePageClient.tsx;
 * admin auth = existing app/api/admin/login + app/api/admin/session using HttpOnly primehub_admin_auth cookie;
 * customer auth = Firebase Auth client + /api/auth/bridge bearer verification; admin layout = app/admin/[section]/page.tsx + AdminHeader;
 * DB = Firebase Admin/Firestore (existing repo also has Supabase migration/mirror paths); env = server process.env; assets = /public.
 */

import { FormEvent, useEffect, useState } from 'react';
import { Maximize2, Menu, Minimize2, Send, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import SalarChats from '@/components/admin/SalarChats';
import './SalarWidget.css';

type ChatMessage = { id: string; role: 'user'|'assistant'|'system'; text: string; created_at?: string };

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
  const [error, setError] = useState('');

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

  async function submit(event: FormEvent) {
    event.preventDefault(); const value = input.trim(); if (!value || busy || blocked) return;
    setBusy(true); setError('');
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
      const response = await fetch('/api/salar/messages', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers, body: JSON.stringify({ text: value }) });
      const data = await response.json().catch(() => null);
      if (response.status === 403 && data?.error === 'blocked') { setBlocked(true); setInput(''); return; }
      if (response.status === 429) throw new Error('Too many messages. Please try again in a minute.');
      if (!response.ok) throw new Error(data?.error || 'Unable to send message.');
      setMessages((current) => [...current, ...(Array.isArray(data?.messages) ? data.messages : [])]); setInput('');
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : 'Unable to send message.'); }
    finally { setBusy(false); }
  }

  if (!visible) return null;

  return <div className="salar-root" aria-live="polite">{open ? <section className={`salar-panel ${maximized ? 'salar-panel-max' : ''}`} aria-label="Salar help chat"><header className="salar-header"><div className="salar-identity"><div className="salar-avatar" aria-hidden="true">{!imageFailed ? <img src="/salar-placeholder.svg" alt="" onError={() => setImageFailed(true)} /> : <span>S</span>}</div><div><strong>Salar</strong><small>{blocked ? 'Blocked' : 'Need help?'}</small></div></div><div className="salar-actions">{adminLoggedIn ? <button type="button" onClick={() => setAdminDrawer((value) => !value)} aria-label="All Salar chats"><Menu size={16}/></button> : null}<button type="button" onClick={() => setOpen(false)} aria-label="Minimize Salar"><Minimize2 size={16}/></button><button type="button" onClick={() => setMaximized((value) => !value)} aria-label={maximized ? 'Restore Salar' : 'Maximize Salar'}><Maximize2 size={16}/></button><button type="button" onClick={() => { setOpen(false); setMaximized(false); setAdminDrawer(false); }} aria-label="Close Salar"><X size={17}/></button></div></header>{adminDrawer && adminLoggedIn ? <div className="salar-admin-drawer"><SalarChats compact /></div> : <><div className="salar-body"><div className="salar-messages">{!messages.length && !busy ? <div className="salar-bubble">Assalamualaikum, I am Salar from PrimeHub Mall. Need help?</div> : null}{messages.map((message) => <div key={message.id} className={`salar-bubble ${message.role === 'user' ? 'salar-bubble-mine' : ''}`}>{message.text}</div>)}{busy && !messages.length ? <div className="salar-bubble">Loading chat…</div> : null}</div>{blocked ? <div className="salar-blocked"><strong>Blocked</strong><span>Unblock ki request: primehubpk1@gmail.com</span></div> : null}<label className="salar-select-label" htmlFor="salar-area">Quick area</label><select id="salar-area" className="salar-select" defaultValue="" disabled><option value="">Coming in next phases</option><option>Images</option><option>Reseller Club</option><option>Prime Skill</option><option>Shopping</option></select>{error ? <p className="salar-error">{error}</p> : null}</div>{!blocked ? <form className="salar-composer" onSubmit={submit}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type a message…" aria-label="Message Salar" disabled={busy}/><button type="submit" aria-label="Send message" disabled={busy || !input.trim()}><Send size={17}/></button></form> : null}</>}</section> : null}<button type="button" className="salar-launcher" onClick={() => void openChat()} aria-label="Open Salar help"><span className="salar-launcher-avatar" aria-hidden="true">{!imageFailed ? <img src="/salar-placeholder.svg" alt="" onError={() => setImageFailed(true)} /> : <span>S</span>}</span><span><strong>Salar</strong><small>Need help?</small></span></button></div>;
}
