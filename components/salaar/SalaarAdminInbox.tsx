'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Send,
  UserRound,
} from 'lucide-react';

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
};

type ThreadMessage = {
  id: string;
  role: 'customer' | 'admin' | 'salaar';
  text: string;
  imageUrls?: string[];
  createdAt: string | null;
  provider?: string | null;
  visionUsed?: boolean;
  needYou?: boolean;
  pending?: boolean;
  phase?: string | null;
};

type Thread = {
  conversation: Conversation & { salesMemory?: Record<string, unknown> | null };
  messages: ThreadMessage[];
};

type Props = {
  onBackToCustomerChat: () => void;
};

function guestLabel(sessionId: string) {
  return `Guest · ${sessionId.slice(-4).toUpperCase()}`;
}

function timeLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function safeImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .filter((item) => /^https:\/\/(?:images\.primehubmall\.com|pub-[a-z0-9]+\.r2\.dev)\//i.test(item))
    .slice(0, 2);
}

export default function SalaarAdminInbox({ onBackToCustomerChat }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState('');
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function loadList() {
    if (document.visibilityState !== 'visible') return;
    try {
      const response = await fetch('/api/admin/salaar-dual', { cache: 'no-store' });
      if (response.status === 401) throw new Error('Admin session expired.');
      if (!response.ok) throw new Error('Inbox load failed.');
      const data = await response.json();
      const items = Array.isArray(data?.conversations) ? data.conversations as Conversation[] : [];
      setConversations(items);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'All chats load nahi ho rahi.');
    }
  }

  async function loadThread(sessionId: string) {
    if (!sessionId || document.visibilityState !== 'visible') return;
    try {
      const response = await fetch(`/api/admin/salaar-dual?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      if (response.status === 401) throw new Error('Admin session expired.');
      if (!response.ok) throw new Error('Chat load failed.');
      const data = await response.json();
      setThread({
        ...data,
        messages: Array.isArray(data?.messages)
          ? data.messages.map((item: ThreadMessage) => ({ ...item, imageUrls: safeImages(item?.imageUrls) }))
          : [],
      });
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Selected chat load nahi ho rahi.');
    }
  }

  useEffect(() => {
    void loadList();
    const timer = window.setInterval(() => void loadList(), 8000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected) {
      setThread(null);
      return;
    }
    void loadThread(selected);
    const timer = window.setInterval(() => void loadThread(selected), 5000);
    return () => window.clearInterval(timer);
  }, [selected]);

  async function act(action: 'message' | 'wait' | 'continue' | 'complete', message?: string) {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/salaar-dual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selected, action, text: message }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.error || 'Admin action failed.'));
      setText('');
      await Promise.all([loadList(), loadThread(selected)]);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Admin action failed.');
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

  const selectedSummary = useMemo(
    () => conversations.find((item) => item.sessionId === selected) || null,
    [conversations, selected],
  );

  if (!selected) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-[#f7f6f1]">
        <div className="flex items-center gap-2 border-b border-black/8 bg-white px-3 py-2.5">
          <button type="button" onClick={onBackToCustomerChat} className="grid h-8 w-8 place-items-center rounded-full bg-black/5" aria-label="Back to Salaar chat"><ArrowLeft size={16} /></button>
          <div className="min-w-0 flex-1"><div className="text-xs font-black">All Salaar Chats</div><div className="text-[9px] text-black/45">Admin only · {conversations.length} conversations</div></div>
          {conversations.some((item) => item.needYou) ? <span className="rounded-full bg-red-100 px-2 py-1 text-[8px] font-black text-red-700">{conversations.filter((item) => item.needYou).length} NEED YOU</span> : null}
        </div>
        {error ? <div className="m-3 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">{error}</div> : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations.length ? conversations.map((item) => (
            <button key={item.sessionId} type="button" onClick={() => setSelected(item.sessionId)} className="flex w-full gap-2 border-b border-black/6 bg-white/70 px-3 py-3 text-left transition hover:bg-white">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#14140F] text-white"><UserRound size={15} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><b className="truncate text-[11px]">{guestLabel(item.sessionId)}</b><span className={`rounded-full px-1.5 py-0.5 text-[7px] font-black ${item.status === 'WAIT' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{item.status}</span>{item.needYou ? <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[7px] font-black text-red-700">NEED YOU</span> : null}</div>
                <p className="mt-1 truncate text-[9px] text-black/50">{item.lastMessage || 'New conversation'}</p>
                <div className="mt-1 flex items-center gap-1 text-[8px] text-black/35"><Clock3 size={9} />{timeLabel(item.updatedAt)}{item.hasPending ? ' · pending' : ''}{item.orderStage ? ` · ${item.orderStage}` : ''}</div>
              </div>
            </button>
          )) : <div className="p-6 text-center text-xs font-bold text-black/35">Abhi koi customer chat nahi.</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f7f6f1]">
      <div className="flex items-center gap-2 border-b border-black/8 bg-white px-3 py-2.5">
        <button type="button" onClick={() => setSelected('')} className="grid h-8 w-8 place-items-center rounded-full bg-black/5" aria-label="Back to all chats"><ArrowLeft size={16} /></button>
        <div className="min-w-0 flex-1"><div className="truncate text-xs font-black">{guestLabel(selected)}</div><div className="text-[9px] text-black/45">{selectedSummary?.status || thread?.conversation?.status || 'AUTO'}{selectedSummary?.holdType ? ` · ${selectedSummary.holdType}` : ''}</div></div>
        <button type="button" disabled={busy} onClick={() => void act('wait')} className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-amber-900 disabled:opacity-40" aria-label="Pause Salaar"><PauseCircle size={15} /></button>
        <button type="button" disabled={busy} onClick={() => void act('continue')} className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-40" aria-label="Continue Salaar"><PlayCircle size={15} /></button>
      </div>
      {error ? <div className="m-3 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">{error}</div> : null}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {thread?.messages?.length ? thread.messages.map((message) => (
          <div key={message.id} className={message.role === 'customer' ? 'mr-auto max-w-[88%]' : 'ml-auto max-w-[88%]'}>
            {message.imageUrls?.length ? <div className={`mb-1 grid gap-1 overflow-hidden rounded-xl ${message.imageUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>{message.imageUrls.map((url) => <img key={url} src={url} alt="Customer shared" loading="lazy" className="max-h-44 w-full object-cover" />)}</div> : null}
            <div className={`rounded-2xl px-3 py-2 text-xs leading-5 shadow-sm ${message.role === 'customer' ? 'rounded-bl-md bg-white text-black' : message.role === 'admin' ? 'rounded-br-md bg-[#14140F] text-white' : 'rounded-br-md bg-emerald-700 text-white'}`}>
              <div className="mb-1 flex flex-wrap items-center gap-1 text-[8px] font-black uppercase opacity-60">{message.role === 'customer' ? <UserRound size={9} /> : message.role === 'admin' ? <MessageCircle size={9} /> : <Bot size={9} />}{message.role}{message.provider ? ` · ${message.provider}` : ''}{message.visionUsed ? ' · vision' : ''}{message.pending ? ' · pending' : ''}</div>
              {message.text}
            </div>
            <div className={`mt-1 text-[8px] text-black/30 ${message.role === 'customer' ? 'text-left' : 'text-right'}`}>{timeLabel(message.createdAt)}</div>
          </div>
        )) : <div className="grid h-full place-items-center p-6 text-center text-xs font-bold text-black/35">Chat loading...</div>}
      </div>
      {thread?.conversation?.orderStage === 'READY' ? <div className="border-t border-black/8 bg-blue-50 px-3 py-2"><button type="button" disabled={busy} onClick={() => void act('complete')} className="inline-flex items-center gap-1 rounded-full bg-[#14140F] px-3 py-2 text-[9px] font-black text-white disabled:opacity-40"><CheckCircle2 size={13} /> Mark order handoff complete</button></div> : null}
      <form onSubmit={(event) => void send(event)} className="flex items-end gap-2 border-t border-black/8 bg-white p-3">
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={1} maxLength={1200} placeholder="Human reply likhain…" className="min-h-10 flex-1 resize-none rounded-2xl bg-[#F4F4F1] px-3 py-2.5 text-xs outline-none" />
        <button type="submit" disabled={busy || !text.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#14140F] text-white disabled:opacity-40" aria-label="Send human reply"><Send size={15} /></button>
      </form>
    </div>
  );
}
