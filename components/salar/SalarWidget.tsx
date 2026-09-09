'use client';

/**
 * Phase 1 repo inspection: homepage = app/page.tsx -> components/HomePageClient.tsx;
 * admin auth = existing app/api/admin/login + app/api/admin/session using HttpOnly primehub_admin_auth cookie;
 * admin layout/navigation = app/admin/[section]/page.tsx + components/admin/AdminHeader.tsx;
 * DB/settings = existing Firebase Admin/Firestore settings/main (with the repo's Supabase migration/mirror layer elsewhere);
 * env access = server-side process.env; public/image assets = /public.
 */

import { FormEvent, useEffect, useState } from 'react';
import { Maximize2, Minimize2, Send, X } from 'lucide-react';
import './SalarWidget.css';

type LocalMessage = { id: number; text: string; mine?: boolean };

export default function SalarWidget() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<LocalMessage[]>([
    { id: 1, text: 'Assalamualaikum, I am Salar from PrimeHub Mall. Need help?' },
  ]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/salar/visibility', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!cancelled) setVisible(data?.visible === true); })
      .catch(() => { if (!cancelled) setVisible(false); });
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    const now = Date.now();
    setMessages((current) => [
      ...current,
      { id: now, text: value, mine: true },
      { id: now + 1, text: 'Phase 1: chat save coming next.' },
    ]);
    setInput('');
  }

  return (
    <div className="salar-root" aria-live="polite">
      {open ? (
        <section className={`salar-panel ${maximized ? 'salar-panel-max' : ''}`} aria-label="Salar help chat">
          <header className="salar-header">
            <div className="salar-identity">
              <div className="salar-avatar" aria-hidden="true">
                {!imageFailed ? <img src="/salar-placeholder.svg" alt="" onError={() => setImageFailed(true)} /> : <span>S</span>}
              </div>
              <div><strong>Salar</strong><small>Need help?</small></div>
            </div>
            <div className="salar-actions">
              <button type="button" onClick={() => setOpen(false)} aria-label="Minimize Salar"><Minimize2 size={16} /></button>
              <button type="button" onClick={() => setMaximized((value) => !value)} aria-label={maximized ? 'Restore Salar' : 'Maximize Salar'}><Maximize2 size={16} /></button>
              <button type="button" onClick={() => { setOpen(false); setMaximized(false); }} aria-label="Close Salar"><X size={17} /></button>
            </div>
          </header>

          <div className="salar-body">
            <div className="salar-messages">
              {messages.map((message) => <div key={message.id} className={`salar-bubble ${message.mine ? 'salar-bubble-mine' : ''}`}>{message.text}</div>)}
            </div>
            <label className="salar-select-label" htmlFor="salar-area">Quick area</label>
            <select id="salar-area" className="salar-select" defaultValue="" disabled>
              <option value="">Coming in next phases</option>
              <option>Images</option>
              <option>Reseller Club</option>
              <option>Prime Skill</option>
              <option>Shopping</option>
            </select>
          </div>

          <form className="salar-composer" onSubmit={submit}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type a test message…" aria-label="Message Salar" />
            <button type="submit" aria-label="Send test message"><Send size={17} /></button>
          </form>
        </section>
      ) : null}

      <button type="button" className="salar-launcher" onClick={() => setOpen(true)} aria-label="Open Salar help">
        <span className="salar-launcher-avatar" aria-hidden="true">
          {!imageFailed ? <img src="/salar-placeholder.svg" alt="" onError={() => setImageFailed(true)} /> : <span>S</span>}
        </span>
        <span><strong>Salar</strong><small>Need help?</small></span>
      </button>
    </div>
  );
}
