'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Clock3, MessageCircle, PauseCircle, PlayCircle, Send, ShoppingBag, UserRound } from 'lucide-react';

type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  qty: number;
  variant?: { color?: string; size?: string } | null;
};

type CartSummary = { items: CartItem[]; itemCount: number; subtotal: number } | null;

type Conversation = {
  sessionId: string;
  lastMessage: string;
  lastRole: string;
  status: 'AUTO' | 'WAIT';
  holdType: 'SOFT' | 'HARD' | null;
  softHoldUntil: string | null;
  needYou: boolean;
  updatedAt: string | null;
  hasPending: boolean;
  orderStage?: string | null;
  advanceRequired?: number;
  cartSummary?: CartSummary;
  readyAt?: string | null;
  orderCompletedAt?: string | null;
};

type ThreadMessage = {
  id: string;
  role: 'customer' | 'admin' | 'salaar';
  text: string;
  createdAt: string | null;
  provider?: string | null;
  needYou?: boolean;
  pending?: boolean;
  phase?: string | null;
};

type Thread = {
  conversation: Conversation;
  messages: ThreadMessage[];
};

function shortGuest(sessionId: string) {
  return `Guest · ${sessionId.slice(-4).toUpperCase()}`;
}

function timeLabel(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function money(value: number) {
  return Math.max(0, Number(value || 0)).toLocaleString('en-PK');
}

export default function SalaarInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState('');
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function loadList() {
    try {
      const response = await fetch('/api/admin/salaar', { cache: 'no-store' });
      if (!response.ok) throw new Error('Inbox load failed');
      const data = await response.json();
      const items: Conversation[] = Array.isArray(data?.conversations) ? data.conversations : [];
      setConversations(items);
      if (!selected && items[0]?.sessionId) setSelected(items[0].sessionId);
    } catch {
      setError('Salaar inbox load nahi ho raha. Admin login dobara check karein.');
    }
  }

  async function loadThread(sessionId: string) {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/admin/salaar?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Thread load failed');
      setThread(await response.json());
      setError('');
    } catch {
      setError('Selected Salaar chat load nahi ho rahi.');
    }
  }

  useEffect(() => {
    void loadList();
    const timer = window.setInterval(() => void loadList(), 2500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected) return;
    void loadThread(selected);
    const timer = window.setInterval(() => void loadThread(selected), 2000);
    return () => window.clearInterval(timer);
  }, [selected]);

  async function act(action: 'message' | 'wait' | 'continue' | 'complete', message?: string) {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/salaar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selected, action, text: message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Action failed');
      setText('');
      await Promise.all([loadThread(selected), loadList()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salaar action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    await act('message', clean);
  }

  const active = useMemo(() => conversations.find((item) => item.sessionId === selected) || null, [conversations, selected]);
  const order = thread?.conversation;

  return (
    <section className="mx-auto max-w-6xl p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#14140F] px-4 py-3 text-white">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Admin — Salaar inbox</p>
          <h2 className="mt-1 text-lg font-black">Website customer chats</h2>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-black">
          <span className="rounded-full bg-white/10 px-3 py-1.5">{conversations.length} chats</span>
          <span className="rounded-full bg-red-500/20 px-3 py-1.5 text-red-200">{conversations.filter((item) => item.needYou).length} NEED YOU</span>
          <span className="rounded-full bg-amber-500/20 px-3 py-1.5 text-amber-100">{conversations.filter((item) => item.orderStage === 'READY').length} READY</span>
        </div>
      </div>

      {error ? <div className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div> : null}

      <div className="grid min-h-[66vh] overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-sm md:grid-cols-[300px_1fr]">
        <aside className="max-h-[66vh] overflow-y-auto border-b border-black/8 bg-[#F8F7F3] md:border-b-0 md:border-r">
          {conversations.length ? conversations.map((item) => (
            <button key={item.sessionId} type="button" onClick={() => setSelected(item.sessionId)} className={`w-full border-b border-black/6 px-3 py-3 text-left transition ${selected === item.sessionId ? 'bg-white' : 'hover:bg-white/70'}`}>
              <div className="flex items-start gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#14140F] text-white"><UserRound size={15} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="truncate text-[11px]">{shortGuest(item.sessionId)}</b>
                    <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-black ${item.status === 'WAIT' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{item.status}</span>
                    {item.needYou ? <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[7px] font-black text-red-700">NEED YOU</span> : null}
                    {item.orderStage ? <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-black ${item.orderStage === 'COMPLETE' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>{item.orderStage}</span> : null}
                  </div>
                  <p className="mt-1 truncate text-[9px] text-black/45">{item.lastMessage || 'New conversation'}</p>
                  <div className="mt-1 flex items-center gap-1 text-[8px] text-black/35"><Clock3 size={9} />{timeLabel(item.updatedAt)}{item.holdType ? ` · ${item.holdType}` : ''}{item.hasPending ? ' · pending' : ''}</div>
                </div>
              </div>
            </button>
          )) : <div className="p-5 text-center text-xs font-bold text-black/35">Abhi koi Salaar chat nahi.</div>}
        </aside>

        <div className="flex min-h-[52vh] flex-col">
          {selected && thread ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-black/8 px-3 py-3 sm:px-4">
                <div className="mr-auto min-w-0"><p className="truncate text-sm font-black">{shortGuest(selected)}</p><p className="text-[9px] text-black/40">{thread.conversation.status}{thread.conversation.holdType ? ` · ${thread.conversation.holdType}` : ''}</p></div>
                <button type="button" disabled={busy} onClick={() => void act('wait')} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-2 text-[9px] font-black text-amber-900 disabled:opacity-50"><PauseCircle size={13} /> Salaar wait</button>
                <button type="button" disabled={busy} onClick={() => void act('continue')} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-2 text-[9px] font-black text-white disabled:opacity-50"><PlayCircle size={13} /> Continue Salaar</button>
              </div>

              {order?.orderStage && order.cartSummary ? (
                <div className="border-b border-black/8 bg-[#FFF8E8] p-3 sm:p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-[#14140F] text-white"><ShoppingBag size={17} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><b className="text-xs">Ready order handoff</b><span className={`rounded-full px-2 py-1 text-[8px] font-black ${order.orderStage === 'COMPLETE' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>{order.orderStage}</span></div>
                      <p className="mt-1 text-[10px] text-black/55">{order.cartSummary.itemCount} item(s) · Rs {money(order.cartSummary.subtotal)} · Advance Rs {money(order.advanceRequired || 300)}</p>
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                        {order.cartSummary.items.map((item) => <div key={`${item.id}-${item.productId}`} className="flex min-w-[190px] gap-2 rounded-xl bg-white p-2 shadow-sm">{item.image ? <img src={item.image} alt={item.name} className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-black/5" />}<div className="min-w-0"><p className="line-clamp-2 text-[9px] font-black">{item.name}</p><p className="mt-1 text-[9px] text-black/50">Qty {item.qty} · Rs {money(item.price)}</p>{item.variant?.color || item.variant?.size ? <p className="text-[8px] text-black/35">{[item.variant?.color, item.variant?.size].filter(Boolean).join(' · ')}</p> : null}</div></div>)}
                      </div>
                    </div>
                    {order.orderStage === 'READY' ? <button type="button" disabled={busy} onClick={() => void act('complete')} className="inline-flex items-center gap-1 rounded-full bg-[#14140F] px-3 py-2 text-[9px] font-black text-white disabled:opacity-50"><CheckCircle2 size={13} /> Complete</button> : null}
                  </div>
                </div>
              ) : null}

              <div className="flex-1 space-y-2 overflow-y-auto bg-[#F4F4F1] p-3 sm:p-4">
                {thread.messages.map((message) => (
                  <div key={message.id} className={message.role === 'customer' ? 'mr-auto max-w-[86%]' : 'ml-auto max-w-[86%]'}>
                    <div className={`rounded-2xl px-3 py-2 text-xs leading-5 shadow-sm ${message.role === 'customer' ? 'rounded-bl-md bg-white text-black' : message.role === 'admin' ? 'rounded-br-md bg-[#14140F] text-white' : 'rounded-br-md bg-emerald-700 text-white'}`}>
                      <div className="mb-1 flex items-center gap-1 text-[8px] font-black uppercase opacity-60">{message.role === 'customer' ? <UserRound size={9} /> : message.role === 'admin' ? <MessageCircle size={9} /> : <Bot size={9} />}{message.role}{message.provider ? ` · ${message.provider}` : ''}{message.phase ? ` · ${message.phase}` : ''}{message.pending ? ' · pending' : ''}</div>
                      {message.text}
                    </div>
                    <div className={`mt-1 text-[8px] text-black/30 ${message.role === 'customer' ? 'text-left' : 'text-right'}`}>{timeLabel(message.createdAt)}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={(event) => void send(event)} className="flex items-end gap-2 border-t border-black/8 bg-white p-3">
                <textarea value={text} onChange={(event) => setText(event.target.value)} rows={1} maxLength={1200} placeholder="Human reply likhain…" className="min-h-11 flex-1 resize-none rounded-2xl bg-[#F4F4F1] px-3 py-3 text-xs outline-none" />
                <button type="submit" disabled={busy || !text.trim()} className="grid h-11 w-11 place-items-center rounded-full bg-[#14140F] text-white disabled:opacity-40" aria-label="Send human reply"><Send size={16} /></button>
              </form>
            </>
          ) : <div className="grid flex-1 place-items-center p-6 text-center text-black/35"><div><Bot className="mx-auto" /><p className="mt-2 text-xs font-bold">Sidebar se customer chat open karein.</p></div></div>}
        </div>
      </div>

      {active?.status === 'WAIT' && active.holdType === 'SOFT' ? <p className="mt-2 text-[9px] font-bold text-black/45">Human reply ke baad Salaar 1 hour SOFT HOLD par hai. Timer ke baad pending customer message auto-answer ho jayega.</p> : null}
      {active?.orderStage === 'READY' ? <p className="mt-2 text-[9px] font-bold text-blue-700">READY ka matlab order intent/admin handoff hai — actual order/lock team confirmation ke baghair final nahi samjha jata.</p> : null}
    </section>
  );
}
