'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, PauseCircle, PlayCircle, RefreshCw, Send, X } from 'lucide-react';

type ChatSummary = {
  id: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  salarPaused: boolean;
  lastPreview: string;
  lastActor: 'customer' | 'salar' | 'admin' | null;
  messageCount: number;
  imageUrl?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  actor: 'customer' | 'salar' | 'admin';
  content: string;
  createdAt: string;
  imageUrl?: string;
  mention?: { id: string; title: string; imageUrl?: string };
  products?: Array<{ id: string; title: string; imageUrl?: string; price?: number; stock?: number }>;
  categories?: Array<{ id: string; title: string; imageUrl?: string }>;
};

type ChatDetail = ChatSummary & {
  messages: ChatMessage[];
  context?: Record<string, unknown>;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function timeLabel(value: string) {
  try {
    return new Date(value).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function SalarAdminDrawer({ open, onClose }: Props) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<ChatDetail | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/salar/chats', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Chats could not load.');
      setChats(Array.isArray(result.chats) ? result.chats : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chats could not load.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (chatId: string, quiet = false) => {
    if (!chatId) return;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/salar/chats?chatId=${encodeURIComponent(chatId)}`, { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Chat could not load.');
      setDetail(result.chat as ChatDetail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chat could not load.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadList();
    const timer = window.setInterval(() => {
      void loadList(true);
      if (selectedId) void loadDetail(selectedId, true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [open, selectedId, loadList, loadDetail]);

  useEffect(() => {
    if (!open || !selectedId) return;
    void loadDetail(selectedId);
  }, [open, selectedId, loadDetail]);

  const visibleChats = useMemo(() => chats.filter((chat) => {
    if (filter === 'active') return chat.active;
    if (filter === 'inactive') return !chat.active;
    return true;
  }), [chats, filter]);

  async function action(actionName: 'pause' | 'resume' | 'reply', message = '', pauseSalar = false) {
    if (!selectedId || acting) return;
    setActing(true);
    setError('');
    try {
      const response = await fetch('/api/admin/salar/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ action: actionName, chatId: selectedId, message, pauseSalar }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Action failed.');
      setDetail(result.chat as ChatDetail);
      if (actionName === 'reply') setReply('');
      await loadList(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.');
    } finally {
      setActing(false);
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>, pauseAfter = false) {
    event.preventDefault();
    const message = reply.trim();
    if (!message) return;
    await action('reply', message, pauseAfter);
  }

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[95] flex flex-col overflow-hidden bg-[#F6F6F2] text-[#14140F]">
      <div className="flex shrink-0 items-center justify-between bg-[#14140F] px-3 py-3 text-white">
        <div className="flex items-center gap-2">
          {selectedId ? (
            <button type="button" onClick={() => { setSelectedId(''); setDetail(null); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10" aria-label="Back to chats"><ArrowLeft size={17}/></button>
          ) : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFB020] text-[#14140F]"><Bot size={18}/></span>}
          <div>
            <p className="text-xs font-black">{selectedId ? detail?.customerName || 'Customer chat' : 'Customer Chats'}</p>
            <p className="text-[8px] font-bold text-white/55">PrimeHub Admin · live conversations</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10" aria-label="Close customer chats"><X size={17}/></button>
      </div>

      {!selectedId ? (
        <>
          <div className="flex shrink-0 items-center gap-2 border-b border-black/8 bg-white px-3 py-2.5">
            {(['active', 'inactive', 'all'] as const).map((value) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-[9px] font-black capitalize ${filter === value ? 'bg-[#14140F] text-white' : 'bg-[#F1F1ED] text-black/55'}`}>{value}</button>
            ))}
            <button type="button" onClick={() => void loadList()} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F1ED] text-black/55" aria-label="Refresh chats"><RefreshCw size={14}/></button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain p-3">
            {loading ? <div className="rounded-2xl bg-white p-4 text-xs font-bold text-black/40">Loading chats…</div> : null}
            {!loading && visibleChats.length === 0 ? <div className="rounded-2xl bg-white p-4 text-xs text-black/45">No {filter === 'all' ? '' : filter} chats yet.</div> : null}
            <div className="space-y-2">
              {visibleChats.map((chat) => (
                <button key={chat.id} type="button" onClick={() => setSelectedId(chat.id)} className="flex w-full items-center gap-3 rounded-2xl border border-black/7 bg-white p-3 text-left shadow-sm">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#F1F1ED]">
                    {chat.imageUrl ? <img src={chat.imageUrl} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full w-full items-center justify-center text-sm font-black text-black/25">{(chat.customerName || 'C').slice(0, 1).toUpperCase()}</div>}
                    <span className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-white ${chat.active ? 'bg-emerald-500' : 'bg-black/25'}`}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[11px] font-black">{chat.customerName || 'Guest customer'}</p>
                      {chat.salarPaused ? <span className="rounded-full bg-[#FFE8E5] px-2 py-0.5 text-[7px] font-black text-[#C62E25]">SALAR STOPPED</span> : null}
                    </div>
                    {chat.customerEmail ? <p className="truncate text-[8px] text-black/35">{chat.customerEmail}</p> : null}
                    <p className="mt-1 line-clamp-1 text-[9px] text-black/55">{chat.lastPreview || 'Conversation started'}</p>
                    <p className="mt-1 text-[7px] font-bold text-black/30">{chat.messageCount} msgs · {timeLabel(chat.updatedAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="shrink-0 border-b border-black/8 bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black">{detail?.customerName || 'Guest customer'}</p>
                <p className="truncate text-[8px] text-black/40">{detail?.customerEmail || detail?.customerId || selectedId}</p>
              </div>
              <button
                type="button"
                disabled={acting || !detail}
                onClick={() => void action(detail?.salarPaused ? 'resume' : 'pause')}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[8px] font-black text-white disabled:opacity-40 ${detail?.salarPaused ? 'bg-[#0F6A5F]' : 'bg-[#E1352B]'}`}
              >
                {detail?.salarPaused ? <PlayCircle size={13}/> : <PauseCircle size={13}/>}
                {detail?.salarPaused ? 'Continue Salar' : 'Stop Salar'}
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
            {loading && !detail ? <div className="rounded-2xl bg-white p-4 text-xs font-bold text-black/40">Loading conversation…</div> : null}
            {(detail?.messages || []).map((message) => {
              const customer = message.actor === 'customer';
              const admin = message.actor === 'admin';
              return (
                <div key={message.id} className={`flex ${customer ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-[10px] leading-4 shadow-sm ${customer ? 'bg-[#0F6A5F] text-white' : admin ? 'bg-[#FFF1D6] text-[#14140F]' : 'bg-white text-[#14140F]'}`}>
                    {!customer ? <p className={`mb-1 text-[7px] font-black uppercase tracking-wide ${admin ? 'text-[#A46800]' : 'text-black/35'}`}>{admin ? 'PrimeHub Admin' : 'Salar'}</p> : null}
                    {message.mention ? (
                      <div className={`mb-2 flex items-center gap-2 rounded-xl p-2 ${customer ? 'bg-white/10' : 'bg-black/5'}`}>
                        {message.mention.imageUrl ? <img src={message.mention.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover"/> : null}
                        <span className="line-clamp-2 text-[9px] font-bold">{message.mention.title}</span>
                      </div>
                    ) : null}
                    {message.imageUrl ? <img src={message.imageUrl} alt="Customer upload" className="mb-2 max-h-48 w-full rounded-xl object-cover"/> : null}
                    {message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null}
                    {message.products?.length ? (
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {message.products.filter((product) => product.imageUrl).slice(0, 9).map((product) => <img key={product.id} src={product.imageUrl} alt={product.title} className="aspect-square w-full rounded-lg object-cover"/>)}
                      </div>
                    ) : null}
                    <p className={`mt-1.5 text-[7px] ${customer ? 'text-white/55' : 'text-black/30'}`}>{timeLabel(message.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-black/8 bg-white p-3">
            {detail?.salarPaused ? <p className="mb-2 rounded-xl bg-[#FFF1D6] px-3 py-2 text-[8px] font-bold text-[#8A5A00]">Salar is stopped only for this customer chat. Other customers continue normally.</p> : null}
            <form onSubmit={(event) => void submitReply(event, false)}>
              <textarea value={reply} onChange={(event) => setReply(event.target.value.slice(0, 6000))} rows={2} placeholder="Reply as PrimeHub Admin…" className="w-full resize-none rounded-xl bg-[#F1F1ED] px-3 py-2.5 text-[10px] outline-none"/>
              <div className="mt-2 flex gap-2">
                <button type="submit" disabled={acting || !reply.trim()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#14140F] px-3 py-2.5 text-[9px] font-black text-white disabled:opacity-40"><Send size={13}/>Send reply</button>
                <button type="button" disabled={acting || !reply.trim()} onClick={(event) => void submitReply(event as unknown as FormEvent<HTMLFormElement>, true)} className="flex-1 rounded-full bg-[#E1352B] px-3 py-2.5 text-[9px] font-black text-white disabled:opacity-40">Send + Stop Salar</button>
              </div>
            </form>
          </div>
        </>
      )}

      {error ? <div className="absolute bottom-20 left-3 right-3 rounded-xl bg-[#3A1714] px-3 py-2 text-[9px] font-bold text-white shadow-lg">{error}</div> : null}
    </div>
  );
}
