'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

function ResellerDashboardRouteShell() {
  return (
    <main className="min-h-screen bg-[#111] text-[#14140F]" aria-label="Opening Reseller Club">
      <div className="relative mx-auto min-h-screen max-w-[1180px] overflow-hidden bg-[#F6F1E8] shadow-2xl lg:my-6 lg:min-h-[calc(100vh-3rem)] lg:rounded-[32px]">
        <header className="bg-[linear-gradient(165deg,#16332E_0%,#0C1C19_70%)] px-4 pb-[22px] pt-3 text-white sm:px-6 lg:px-8 lg:pb-7 lg:pt-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-white/80">← Reseller Club</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[.14em] text-[#FFCF68]">
              Opening…
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1.3fr_.7fr]">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.07] p-3">
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-[#FFCF68]/75" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-2.5 w-16 animate-pulse rounded-full bg-[#FFCF68]/45" />
                <div className="h-4 w-36 max-w-full animate-pulse rounded-full bg-white/75" />
                <div className="h-2.5 w-44 max-w-full animate-pulse rounded-full bg-white/25" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['Cash Wallet', 'Points Wallet'].map((label) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[.07] p-3">
                  <p className="text-[8px] font-extrabold uppercase tracking-wider text-white/45">{label}</p>
                  <div className="mt-2 h-4 w-16 animate-pulse rounded-full bg-white/55" />
                </div>
              ))}
            </div>
          </div>
        </header>

        <nav className="flex gap-1.5 overflow-hidden border-b border-black/5 bg-[#F6F1E8] px-4 py-3 sm:px-6 lg:justify-center lg:px-8" aria-hidden="true">
          {['Home', 'Rewards', 'Tiers', 'Tasks', 'Vouchers'].map((item, index) => (
            <span key={item} className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-bold ${index === 0 ? 'bg-[#14140F] text-white' : 'bg-white text-black/35'}`}>
              {item}
            </span>
          ))}
        </nav>

        <section className="grid gap-4 px-4 pb-28 pt-3.5 sm:px-6 lg:grid-cols-2 lg:px-8" aria-live="polite">
          {Array.from({ length: 6 }, (_, index) => (
            <article key={index} className="rounded-[18px] bg-[#FFFDF8] p-4 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
              <div className="h-2.5 w-20 animate-pulse rounded-full bg-[#E85D04]/20" />
              <div className="mt-2 h-5 w-40 max-w-[70%] animate-pulse rounded-full bg-black/10" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="h-16 animate-pulse rounded-2xl bg-[#F1ECE3]" />
                <div className="h-16 animate-pulse rounded-2xl bg-[#E7F6F3]" />
              </div>
              <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-black/[.06]" />
              <div className="mt-2 h-3 w-3/4 animate-pulse rounded-full bg-black/[.05]" />
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function dashboardContentIsReady(host: HTMLDivElement | null) {
  const main = host?.querySelector(':scope > main');
  if (!main) return false;
  const waitingForProfile = main.classList.contains('items-center') && main.classList.contains('justify-center');
  return !waitingForProfile;
}

function hideDuplicateRewardWallet(host: HTMLDivElement | null) {
  if (!host) return;
  const sections = Array.from(host.querySelectorAll('main section')) as HTMLElement[];
  sections.forEach(section => {
    const directLabel = Array.from(section.children).find(child => child.tagName === 'SPAN');
    const label = directLabel?.textContent?.trim().toLowerCase();
    if (label === 'reward wallet') section.style.display = 'none';
    else if (label === 'wallet') section.style.display = '';
  });
}

export default function ResellerDashboardLayout({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    const host = contentRef.current;
    if (!host) return;

    const check = () => {
      frameRef.current = null;
      const ready = dashboardContentIsReady(host);
      if (ready && !readyRef.current) {
        readyRef.current = true;
        setContentReady(true);
      }
      if (ready) hideDuplicateRewardWallet(host);
    };

    const scheduleCheck = () => {
      if (frameRef.current != null) return;
      frameRef.current = window.requestAnimationFrame(check);
    };

    check();
    const observer = new MutationObserver(scheduleCheck);
    observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen">
      {!contentReady ? <ResellerDashboardRouteShell /> : null}
      <div ref={contentRef} className={contentReady ? 'block' : 'hidden'}>
        {children}
      </div>
    </div>
  );
}
