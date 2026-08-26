'use client';

import Link from 'next/link';
import { ArrowLeft, Banknote, Gift, Settings2, ShieldCheck, Trophy, Users, WalletCards } from 'lucide-react';

const cards = [
  { title: 'Resellers', value: '128', icon: Users, text: 'View members, tiers and status' },
  { title: 'Pending Withdrawals', value: '7', icon: Banknote, text: 'Review payout requests' },
  { title: 'Wallet Liability', value: 'Rs. 84,500', icon: WalletCards, text: 'Available reseller rewards' },
  { title: 'Monthly Challenges', value: '1 Active', icon: Trophy, text: 'Configure monthly reward' },
];

export default function AdminResellersPage() {
  return <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]"><section className="bg-[#14140F] px-4 py-7 text-white sm:px-6"><div className="mx-auto max-w-5xl"><Link href="/admin" className="inline-flex items-center gap-2 text-[10px] font-bold text-white/60"><ArrowLeft size={13}/> Admin</Link><div className="mt-5 flex items-center justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FFCF68]">PrimeHub Control</p><h1 className="mt-1 text-2xl font-black">Reseller Management</h1><p className="mt-1 text-[10px] text-white/45">Configure the Reseller Club without changing customer shopping.</p></div><Settings2 className="text-[#FFCF68]" size={25}/></div></div></section>
  <section className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(({ title, value, icon: Icon, text }) => <div key={title} className="rounded-[24px] bg-white p-4 shadow-[0_10px_28px_rgba(20,20,15,0.05)]"><Icon size={18} className="text-[#0F6A5F]"/><p className="mt-3 text-[9px] font-black uppercase tracking-wider text-black/35">{title}</p><p className="mt-1 text-xl font-black">{value}</p><p className="mt-1 text-[10px] text-black/40">{text}</p></div>)}</div>
  <div className="grid gap-4 lg:grid-cols-2"><Panel title="Tier Rules" icon={<Trophy size={16}/>} rows={['Starter · 5 orders · 5%', 'Prime · 10 orders · 10%', 'Pro · 20 orders · 15%', 'Elite · 30 orders · 20%']} /><Panel title="Reward & Withdrawal" icon={<WalletCards size={16}/>} rows={['Minimum withdrawal · Rs. 500', 'Eligible status · Delivered', 'Reward · Pending → Available', 'Payout · Admin approval']} /><Panel title="Monthly Challenge" icon={<Gift size={16}/>} rows={['Target · 10 eligible orders', 'Reward · Rs. 1,000 or Gift', 'Calendar month · Admin controlled', 'Completion · server verified']} /><Panel title="Social Tasks" icon={<Users size={16}/>} rows={['YouTube · +50 pts', 'Instagram · +50 pts', 'TikTok · +50 pts', 'Share · +100 pts']} /></div>
  <div className="rounded-[24px] border border-[#0F6A5F]/10 bg-[#0F6A5F]/5 p-4 text-[10px] leading-5 text-black/50"><div className="flex items-center gap-2 font-black text-[#14140F]"><ShieldCheck size={15} className="text-[#0F6A5F]"/> Security boundary</div><p className="mt-1">This phase is an Admin UI/configuration preview. Real reseller settings, wallet balances and payout actions will only be enabled after secure Firestore rules and trusted admin authorization are implemented.</p></div></section></main>;
}

function Panel({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: string[] }) { return <div className="rounded-[26px] bg-white p-5 shadow-[0_10px_28px_rgba(20,20,15,0.05)]"><div className="flex items-center gap-2 text-sm font-black text-[#0F6A5F]">{icon}<span className="text-[#14140F]">{title}</span></div><div className="mt-3 space-y-2">{rows.map((row) => <div key={row} className="rounded-xl bg-[#F4F4F1] px-3 py-2.5 text-[10px] font-semibold">{row}</div>)}</div><button disabled className="mt-3 w-full rounded-xl bg-[#14140F] py-2.5 text-[10px] font-black text-white opacity-45">Secure editor in integration phase</button></div>; }
