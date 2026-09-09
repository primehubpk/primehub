'use client';

import { useEffect, useState } from 'react';
import { Ban, Loader2, RefreshCw, Trash2, Unlock } from 'lucide-react';

type Conversation = { id: string; visitor_label?: string; blocked?: boolean; last_message_preview?: string; last_message_at?: string; updated_at?: string; customer_uid?: string | null };
type Message = { id: string; role: 'user'|'assistant'|'system'; text: string; created_at?: string };
type Props = { compact?: boolean };

export default function SalarChats({ compact = false }: Props) {
  const [rows, setRows] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function loadRows() {
    const response = await fetch('/api/admin/salar/conversations', { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Unable to load chats.');
    setRows(Array.isArray(data?.conversations) ? data.conversations : []);
  }

  async function openChat(row: Conversation) {
    setSelected(row); setMessages([]); setStatus('');
    const response = await fetch(`/api/admin/salar/conversations/${encodeURIComponent(row.id)}`, { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok) { setStatus(data?.error || 'Unable to load chat.'); return; }
    setSelected(data.conversation); setMessages(Array.isArray(data.messages) ? data.messages : []);
  }

  useEffect(() => { loadRows().catch((error) => setStatus(error instanceof Error ? error.message : 'Unable to load chats.')); }, []);

  async function mutate(action: 'block'|'unblock'|'delete') {
    if (!selected || busy) return;
    const question = action === 'delete' ? 'Delete this Salar conversation and all messages?' : action === 'block' ? 'Block this visitor from sending Salar messages?' : 'Unblock this visitor?';
    if (!window.confirm(question)) return;
    setBusy(true); setStatus('');
    try {
      const response = await fetch(`/api/admin/salar/conversations/${encodeURIComponent(selected.id)}${action === 'delete' ? '' : `/${action}`}`, { method: action === 'delete' ? 'DELETE' : 'POST', credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `Unable to ${action} chat.`);
      if (action === 'delete') { setSelected(null); setMessages([]); }
      else setSelected((current) => current ? { ...current, blocked: action === 'block' } : current);
      await loadRows();
    } catch (error) { setStatus(error instanceof Error ? error.message : `Unable to ${action} chat.`); }
    finally { setBusy(false); }
  }

  return <section className={compact ? '' : 'mt-6'}>
    <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-lg font-black">Chats</h3><p className="text-xs text-black/45">All persisted Salar conversations. Newest activity first.</p></div><button type="button" onClick={() => void loadRows()} className="rounded-full bg-black/5 p-2" aria-label="Refresh chats"><RefreshCw size={15}/></button></div>
    <div className="grid min-h-[360px] gap-3 md:grid-cols-[280px_1fr]">
      <div className="max-h-[560px] overflow-y-auto rounded-2xl border border-black/8 bg-[#F8F7F3] p-2">
        {rows.length ? rows.map((row) => <button key={row.id} type="button" onClick={() => void openChat(row)} className={`mb-2 w-full rounded-xl p-3 text-left ${selected?.id === row.id ? 'bg-[#14140F] text-white' : 'bg-white'}`}><div className="flex items-center gap-2"><strong className="truncate text-xs">{row.visitor_label || 'Guest'}</strong>{row.blocked ? <span className="rounded-full bg-[#E1352B]/15 px-2 py-0.5 text-[8px] font-black text-[#E1352B]">Blocked</span> : null}</div><p className="mt-1 truncate text-[10px] opacity-60">{row.last_message_preview || 'No messages yet'}</p><p className="mt-1 text-[8px] opacity-40">{row.last_message_at || row.updated_at || ''}</p></button>) : <p className="p-4 text-xs text-black/40">No Salar chats yet.</p>}
      </div>
      <div className="rounded-2xl border border-black/8 bg-white p-4">
        {selected ? <><div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/8 pb-3"><div><strong className="text-sm">{selected.visitor_label || 'Guest'}</strong><p className="text-[9px] text-black/40">{selected.blocked ? 'Blocked' : 'Active'}{selected.customer_uid ? ' · customer account linked' : ''}</p></div><div className="flex gap-2">{selected.blocked ? <button disabled={busy} onClick={() => void mutate('unblock')} className="flex items-center gap-1 rounded-full bg-black/5 px-3 py-2 text-[9px] font-black"><Unlock size={12}/>Unblock</button> : <button disabled={busy} onClick={() => void mutate('block')} className="flex items-center gap-1 rounded-full bg-[#E1352B]/10 px-3 py-2 text-[9px] font-black text-[#E1352B]"><Ban size={12}/>Block</button>}<button disabled={busy} onClick={() => void mutate('delete')} className="flex items-center gap-1 rounded-full bg-black/5 px-3 py-2 text-[9px] font-black"><Trash2 size={12}/>Delete</button></div></div><div className="max-h-[430px] space-y-2 overflow-y-auto py-4">{messages.map((message) => <div key={message.id} className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-5 ${message.role === 'user' ? 'ml-auto bg-[#14140F] text-white' : 'bg-[#F4F4F1] text-black'}`}><p className="text-[8px] font-black uppercase opacity-50">{message.role}</p>{message.text}</div>)}{!messages.length ? <p className="text-xs text-black/40">No messages in this thread.</p> : null}</div></> : <div className="flex h-full min-h-[260px] items-center justify-center text-xs text-black/35">Select a chat to open its transcript.</div>}
        {busy ? <p className="flex items-center gap-2 text-xs"><Loader2 size={13} className="animate-spin"/>Working…</p> : null}{status ? <p className="mt-3 rounded-xl bg-[#F4F4F1] p-3 text-xs font-semibold">{status}</p> : null}
      </div>
    </div>
  </section>;
}
