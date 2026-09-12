import type { ReactNode } from 'react';

function InstantDashboardShell() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 min-h-screen bg-[#111]">
      <div className="mx-auto min-h-screen max-w-[1180px] overflow-hidden bg-[#F6F1E8] lg:my-6 lg:min-h-[calc(100vh-3rem)] lg:rounded-[32px]">
        <header className="bg-[linear-gradient(165deg,#16332E_0%,#0C1C19_70%)] px-4 pb-[22px] pt-3 text-white sm:px-6 lg:px-8 lg:pb-7 lg:pt-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-white/80">← Reseller Club</span>
            <div className="flex gap-2">
              <span className="h-9 w-9 rounded-full bg-white/10" />
              <span className="h-9 w-9 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1.3fr_.7fr]">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.07] p-3">
              <span className="h-12 w-12 shrink-0 rounded-full bg-[#FFCF68]" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-[#FFCF68]">Profile</p>
                <p className="mt-1 h-4 w-36 rounded-full bg-white/20" />
                <p className="mt-2 h-2.5 w-24 rounded-full bg-white/10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[.07] p-3">
                <p className="text-[8px] font-extrabold uppercase tracking-wider text-white/45">Cash Wallet</p>
                <p className="mt-2 h-4 w-16 rounded-full bg-white/20" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[.07] p-3">
                <p className="text-[8px] font-extrabold uppercase tracking-wider text-white/45">Points Wallet</p>
                <p className="mt-2 h-4 w-12 rounded-full bg-white/20" />
              </div>
            </div>
          </div>
        </header>

        <nav className="flex gap-1.5 overflow-hidden border-b border-black/5 bg-[#F6F1E8] px-4 py-3 sm:px-6 lg:justify-center lg:px-8">
          {['home', 'rewards', 'tiers', 'tasks', 'vouchers', 'wallet', 'gifts'].map((item, index) => (
            <span key={item} className={`shrink-0 rounded-full px-2.5 py-2 text-[10px] font-bold capitalize shadow-sm ${index === 0 ? 'bg-[#14140F] text-white' : 'bg-white text-[#6B6A62]'}`}>
              {item}
            </span>
          ))}
        </nav>

        <section className="space-y-4 px-4 pb-28 pt-3.5 sm:px-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0 lg:px-8">
          <section className="rounded-[18px] bg-[#FFFDF8] p-4 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">Weekly streak</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-[#14140F]">7-Day Check-in</h2>
              <span className="h-7 w-12 rounded-full bg-[#FFF3E0]" />
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }, (_, index) => <span key={index} className="h-12 rounded-xl bg-[#F1ECE3]" />)}
            </div>
            <span className="mt-4 block h-11 w-full rounded-xl bg-[#14140F]" />
          </section>

          <section className="rounded-[28px] border border-black/[.06] bg-[#FFFDF8] p-4 shadow-[0_16px_40px_rgba(20,20,15,.08)]">
            <p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-[#B4871D]">Prime Loyalty Program</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#14140F]">Your reseller tiers</h2>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {Array.from({ length: 4 }, (_, index) => <span key={index} className="h-28 rounded-[20px] border border-black/[.07] bg-[#F8F1E6]" />)}
            </div>
          </section>

          <section className="rounded-[18px] bg-[#FFFDF8] p-3.5 shadow-[0_8px_24px_rgba(20,20,15,.05)] lg:col-span-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">Tasks</p>
            <h2 className="mt-1 text-lg font-extrabold text-[#14140F]">Earn points & cash</h2>
            <div className="mt-3 space-y-2">
              <span className="block h-14 rounded-2xl bg-[#F6F1E8]" />
              <span className="block h-14 rounded-2xl bg-[#F6F1E8]" />
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}

export default function ResellerDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="reseller-dashboard-stage relative min-h-screen">
      <style>{`
        .reseller-dashboard-stage > main.flex.min-h-screen {
          background: transparent !important;
          color: transparent !important;
          position: relative;
          z-index: 10;
        }
      `}</style>
      <InstantDashboardShell />
      {children}
    </div>
  );
}
