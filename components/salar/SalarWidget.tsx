'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export default function SalarWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, sending]);

  if (pathname?.startsWith('/admin')) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending) return;

    const history = messages.slice(-8);
    setText('');
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setSending(true);

    try {
      const response = await fetch('/api/salar/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ message, history }),
      });
      const result = await response.json().catch(() => null);
      const reply = response.ok && result?.success
        ? String(result.reply || '').trim()
        : String(result?.error || 'Salar could not respond right now. Please try again.');
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'Salar could not respond right now. Please try again.' }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-[88px] right-3 z-50 sm:bottom-6 sm:right-5">
      {open ? (
        <div className="mb-3 flex h-[min(520px,72vh)] w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-[26px] border border-black/10 bg-[#FFFDF8] shadow-2xl">
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
                Assalam-o-Alaikum! Main Salar hoon. PrimeHubMall ke products, deals ya shopping ke bare mein pooch sakte hain.
              </div>
            ) : null}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[86%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${message.role === 'user' ? 'bg-[#0F6A5F] text-white' : 'bg-white text-[#14140F] shadow-sm'}`}>
                  {message.content}
                </div>
              </div>
            ))}
            {sending ? <div className="inline-flex rounded-2xl bg-white px-3.5 py-2.5 text-[10px] font-bold text-black/40 shadow-sm">Salar is typing…</div> : null}
            <div ref={endRef}/>
          </div>

          <form onSubmit={submit} className="border-t border-black/8 bg-white p-3">
            <div className="flex items-end gap-2 rounded-2xl bg-[#F4F4F1] p-2">
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
              <button type="submit" disabled={sending || !text.trim()} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E1352B] text-white disabled:opacity-40"><Send size={16}/></button>
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
