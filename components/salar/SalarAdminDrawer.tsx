'use client';

import SalarProviderSelector from '@/components/salar/SalarProviderSelector';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Ban, Bot, PauseCircle, PlayCircle, RefreshCw, Send, Trash2, Unlock, X } from 'lucide-react';

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
  blocked?: boolean;
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

type ChatAction = 'pause' | 'resume' | 'reply' | 'delete' | 'block' | 'unblock';

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState('');
  const listPending = useRef(false);
  const detailPending = useRef(new Set<string>());

  const loadList = useCallback(async (quiet = false) => {
    if (listPending.current) return;
    listPending.current = true;
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
      listPending.current = false;
      if (!quiet) setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (chatId: string, quiet = false) => {
    if (!chatId || detailPending.current.has(chatId)) return;
    detailPending.current.add(chatId);
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
      detailPending.current.delete(chatId);
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadList();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadList(true);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [open, loadList]);

  useEffect(() => {
    if (!open || !selectedId) return;
    void loadDetail(selectedId);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadDetail(selectedId, true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [open, selectedId, loadDetail]);

  const visibleChats = useMemo(() => chats.filter((chat) => {
    if (filter === 'active') return chat.active;
    if (filter === 'inactive') return !chat.active;
    return true;
  }), [chats, filter]);

  const visibleChatIds = useMemo(() => visibleChats.map((chat) => chat.id), [visibleChats]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected = visibleChatIds.length > 0 && visibleChatIds.every((id) => selectedSet.has(id));

  function beginSelectAll() {
    setSelectionMode(true);
    setSelectedIds(visibleChatIds);
  }

  function toggleSelected(chatId: string) {
    setSelectionMode(true);
    setSelectedIds((current) => current.includes(chatId)
      ? current.filter((id) => id !== chatId)
      : [...current, chatId]);
  }

  function selectAllVisible() {
    setSelectedIds(visibleChatIds);
  }

  function cancelSelection() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  async function deleteSelectedChats() {
    const ids = selectedIds.filter((id) => chats.some((chat) => chat.id === id));
    if (!ids.length || bulkDeleting) return;
    if (!window.confirm(`Delete ${ids.length} selected chat${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;

    setBulkDeleting(true);
    setError('');
    try {
      const response = await fetch('/api/admin/salar/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ action: 'bulk-delete', chatIds: ids }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Selected chats could not be deleted.');

      const deletedIds = new Set(Array.isArray(result.deletedIds) ? result.deletedIds : ids);
      setChats((current) => current.filter((chat) => !deletedIds.has(chat.id)));
      if (selectedId && deletedIds.has(selectedId)) {
        setSelectedId('');
        setDetail(null);
      }
      cancelSelection();
      await loadList(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Selected chats could not be deleted.');
    } finally {
      setBulkDeleting(false);
    }
  }

  async function action(actionName: ChatAction, message = '', pauseSalar = false, targetChatId = selectedId) {
    if (!targetChatId || acting) return;
    setActing(true);
    setError('');
    try {
      const response = await fetch('/api/admin/salar/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ action: actionName, chatId: targetChatId, message, pauseSalar }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Action failed.');
      if (actionName === 'delete') {
        if (selectedId === targetChatId) {
          setSelectedId('');
          setDetail(null);
        }
        setChats((current) => current.filter((chat) => chat.id !== targetChatId));
      } else if (selectedId === targetChatId && result.chat) {
        setDetail(result.chat as ChatDetail);
      }
      if (actionName === 'reply') setReply('');
      await loadList(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.');
    } finally {
      setActing(false);
    }
  }

  async function confirmDelete(chat: ChatSummary) {
    const label = chat.customerName || chat.customerEmail || 'this customer chat';
    if (!window.confirm(`Delete ${label}? This chat will be removed from the admin chat list.`)) return;
    await action('delete', '', false, chat.id);
  }

  async function confirmBlock(chat: ChatSummary) {
    const label = chat.customerName || chat.customerEmail || 'this customer';
    if (chat.blocked) {
      if (!window.confirm(`Unblock ${label}? Salar will be available to this customer again.`)) return;
      await action('unblock', '', false, chat.id);
      return;
    }
    if (!window.confirm(`Block ${label}? Salar chat access will be stopped for this guest/session or logged-in account.`)) return;
    await action('block', '', false, chat.id);
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
          <div className="shrink-0 border-b border-black/8 bg-white">
            <div className="flex items-center gap-2 px-3 py-2.5">
              {(['active', 'inactive', 'all'] as const).map((value) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-[9px] font-black capitalize ${filter === value ? 'bg-[#14140F] text-white' : 'bg-[#F1F1ED] text-black/55'}`}>{value}</button>
              ))}
              <button type="button" onClick={() => void loadList()} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F1ED] text-black/55" aria-label="Refresh chats"><RefreshCw size={14}/></button>
            </div>
            {!selectionMode ? (
              <div className="flex items-center justify-between border-t border-black/6 px-3 py-2">
                <p className="text-[8px] font-bold text-black/35">{visibleChats.length} chats shown</p>
                <button type="button" disabled={!visibleChats.length} onClick={beginSelectAll} className="rounded-full bg-[#F1F1ED] px-3 py-2 text-[8px] font-black text-black/65 disabled:opacity-40">
                  Select all
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 border-t border-black/6 px-3 py-2">
                <span className="mr-auto text-[8px] font-black text-black/55">{selectedIds.length} selected</span>
                {!allVisibleSelected ? (
                  <button type="button" onClick={selectAllVisible} className="rounded-full bg-[#F1F1ED] px-3 py-2 text-[8px] font-black text-black/65">Select all</button>
                ) : null}
                <button type="button" onClick={cancelSelection} className="rounded-full bg-[#F1F1ED] px-3 py-2 text-[8px] font-black text-black/65">Cancel</button>
                <button type="button" disabled={!selectedIds.length || bulkDeleting} onClick={() => void deleteSelectedChats()} className="inline-flex items-center gap-1 rounded-full bg-[#C62E25] px-3 py-2 text-[8px] font-black text-white disabled:opacity-40">
                  <Trash2 size={11}/>{bulkDeleting ? 'Deleting…' : 'Delete selected'}
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain p-3">
            <details className="mb-3 rounded-2xl bg-white p-3"><summary className="cursor-pointer text-xs font-bold">AI provider / model</summary><SalarProviderSelector/></details>
            {loading ? <div className="rounded-2xl bg-white p-4 text-xs font-bold text-black/40">Loading chats…</div> : null}
            {!loading && visibleChats.length === 0 ? <div className="rounded-2xl bg-white p-4 text-xs text-black/45">No {filter === 'all' ? '' : filter} chats yet.</div> : null}
            <div className="space-y-2">
              {visibleChats.map((chat) => (
                <div key={chat.id} className={`flex items-stretch gap-2 rounded-2xl border bg-white p-2 shadow-sm ${selectionMode && selectedSet.has(chat.id) ? 'border-[#0F6A5F]/35 ring-1 ring-[#0F6A5F]/15' : 'border-black/7'}`}>
                  {selectionMode ? (
                    <label className="flex shrink-0 items-center pl-1" aria-label={`Select ${chat.customerName || 'customer chat'}`}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(chat.id)}
                        onChange={() => toggleSelected(chat.id)}
                        className="h-4 w-4 accent-[#0F6A5F]"
                      />
                    </label>
                  ) : null}
                  <button type="button" onClick={() => setSelectedId(chat.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left">
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
                  {!selectionMode ? (
                    <div className="flex shrink-0 flex-col justify-center gap-1.5">
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => void confirmBlock(chat)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40 ${chat.blocked ? 'bg-[#DDF5F0] text-[#0F6A5F]' : 'bg-[#FFF1D6] text-[#9A6200]'}`}
                        aria-label={`${chat.blocked ? 'Unblock' : 'Block'} ${chat.customerName || 'customer'}`}
                        title={chat.blocked ? 'Unblock customer' : 'Block customer'}
                      >
                        {chat.blocked ? <Unlock size={13}/> : <Ban size={13}/>}
                      </button>
                      <button type="button" disabled={acting} onClick={() => void confirmDelete(chat)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFE8E5] text-[#C62E25] disabled:opacity-40" aria-label={`Delete ${chat.customerName || 'chat'}`} title="Delete chat"><Trash2 size={13}/></button>
                    </div>
                  ) : null}
                </div>
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
                onClick={() => void action(detail?.blocked ? 'unblock' : detail?.salarPaused ? 'resume' : 'pause')}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[8px] font-black text-white disabled:opacity-40 ${detail?.blocked || detail?.salarPaused ? 'bg-[#0F6A5F]' : 'bg-[#E1352B]'}`}
              >
                {detail?.blocked ? <Unlock size={13}/> : detail?.salarPaused ? <PlayCircle size={13}/> : <PauseCircle size={13}/>}
                {detail?.blocked ? 'Unblock' : detail?.salarPaused ? 'Continue Salar' : 'Stop Salar'}
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
            {detail?.blocked ? <p className="mb-2 rounded-xl bg-[#FFE8E5] px-3 py-2 text-[8px] font-bold text-[#A32720]">This customer is blocked. Tap Unblock above to restore Salar access.</p> : detail?.salarPaused ? <p className="mb-2 rounded-xl bg-[#FFF1D6] px-3 py-2 text-[8px] font-bold text-[#8A5A00]">Salar is stopped only for this customer chat. Other customers continue normally.</p> : null}
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
