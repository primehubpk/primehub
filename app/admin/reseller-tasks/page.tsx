'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_RESELLER_TIERS, type ResellerTier } from '@/lib/resellerTypes';
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS, DEFAULT_RESELLER_WHEEL, type MonthlyChallengeSettings, type ResellerTask, type ResellerWheelSettings } from '@/lib/resellerTasks';

const settingsRef = doc(db, 'settings', 'main');
const voucherFields = [
  ['cash-500', 'Rs. 500 Cash'], ['challenge-cash', 'Monthly Cash'], ['challenge-gift', 'PrimeHub Gift Box'],
  ['bridal-gift', 'Bridal Gift'], ['wholesale-off', 'Wholesale Discount'], ['free-delivery', 'Free Delivery'],
  ['jazzcash-300', 'JazzCash Rs. 300'], ['easypaisa-300', 'EasyPaisa Rs. 300'], ['kids-gift', 'Kids Gift Box'], ['elite-cash', 'Elite Cash'],
] as const;

export default function ResellerTasksAdminPage() {
  const [tasks, setTasks] = useState<ResellerTask[]>(DEFAULT_RESELLER_TASKS);
  const [challenge, setChallenge] = useState<MonthlyChallengeSettings>(DEFAULT_MONTHLY_CHALLENGE);
  const [wheel, setWheel] = useState<ResellerWheelSettings>(DEFAULT_RESELLER_WHEEL);
  const [voucherImages, setVoucherImages] = useState<Record<string, string>>({});
  const [tiers, setTiers] = useState<ResellerTier[]>(DEFAULT_RESELLER_TIERS);
  const [saving, setSaving] = useState(false), [saved, setSaved] = useState(false);

  useEffect(() => onSnapshot(settingsRef, snapshot => {
    const data: any = snapshot.data() || {};
    if (Array.isArray(data.resellerTasks)) setTasks(data.resellerTasks);
    if (data.resellerMonthlyChallenge) setChallenge({ ...DEFAULT_MONTHLY_CHALLENGE, ...data.resellerMonthlyChallenge });
    if (data.resellerWheel) setWheel({ ...DEFAULT_RESELLER_WHEEL, ...data.resellerWheel });
    setVoucherImages(data.resellerVoucherImages || {});
    if (Array.isArray(data.resellerTiers) && data.resellerTiers.length === 4) setTiers(data.resellerTiers);
  }), []);

  async function save() {
    setSaving(true); setSaved(false);
    await setDoc(settingsRef, { resellerTasks: tasks, resellerMonthlyChallenge: challenge, resellerWheel: wheel, resellerVoucherImages: voucherImages, resellerTiers: tiers }, { merge: true });
    setSaving(false); setSaved(true); window.setTimeout(() => setSaved(false), 1800);
  }
  function updateTask(id: string, patch: Partial<ResellerTask>) { setTasks(current => current.map(task => task.id === id ? { ...task, ...patch } : task)); }

  return <section className="mx-auto max-w-6xl px-4 py-5">
    <div className="mb-5 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#0F806E]">Admin Control</p><h2 className="text-2xl font-black">Reseller Tasks & Challenge</h2><p className="mt-1 text-xs text-black/45">Manage tasks, voucher images, points and availability.</p></div><button onClick={save} disabled={saving} className="rounded-2xl bg-[#14140F] px-4 py-3 text-[10px] font-black text-white disabled:opacity-50">{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}</button></div>
    <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <div className="space-y-3"><div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-[9px] font-black uppercase tracking-widest text-[#B4871D]">Reseller Levels</p><h3 className="mt-1 text-lg font-black">Tier discounts</h3><p className="mt-1 text-xs text-black/45">Set each level name, required monthly orders and customer discount.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{tiers.map((tier,index)=><div key={tier.id} className="rounded-2xl bg-[#F4F4F1] p-3"><p className="text-[9px] font-black uppercase text-black/35">Tier {index+1}</p><input value={tier.name} onChange={e=>setTiers(list=>list.map(x=>x.id===tier.id?{...x,name:e.target.value}:x))} className="mt-2 w-full rounded-xl bg-white px-3 py-2 text-xs font-bold"/><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[8px] font-black text-black/40">MIN ORDERS<input type="number" min="0" value={tier.minMonthlyOrders} onChange={e=>setTiers(list=>list.map(x=>x.id===tier.id?{...x,minMonthlyOrders:Math.max(0,Number(e.target.value)||0)}:x))} className="mt-1 w-full rounded-xl bg-white px-2 py-2 text-xs"/></label><label className="text-[8px] font-black text-black/40">DISCOUNT %<input type="number" min="0" max="100" value={tier.discountPercent||0} onChange={e=>setTiers(list=>list.map(x=>x.id===tier.id?{...x,discountPercent:Math.min(100,Math.max(0,Number(e.target.value)||0))}:x))} className="mt-1 w-full rounded-xl bg-white px-2 py-2 text-xs"/></label></div><label className="mt-2 block text-[8px] font-black text-black/40">BENEFITS (one per line)<textarea value={(tier.benefits||[]).join('\n')} onChange={e=>setTiers(list=>list.map(x=>x.id===tier.id?{...x,benefits:e.target.value.split('\n').map(v=>v.trim()).filter(Boolean)}:x))} rows={3} className="mt-1 w-full resize-none rounded-xl bg-white px-2 py-2 text-xs font-medium normal-case"/></label></div>)}</div></div>
        {tasks.map(task => <div key={task.id} className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{task.title}</h3><p className="mt-1 text-xs text-black/45">{task.description}</p></div><button onClick={() => updateTask(task.id, { active: !task.active })} className={`rounded-full px-3 py-1.5 text-[9px] font-black ${task.active ? 'bg-[#DDF5F0] text-[#0F806E]' : 'bg-black/5 text-black/40'}`}>{task.active ? 'ON' : 'OFF'}</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><label className="text-[9px] font-black uppercase text-black/40">Task Link<input value={task.url || ''} onChange={event => updateTask(task.id, { url: event.target.value })} placeholder="https://..." className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-2.5 text-xs font-medium outline-none" /></label><label className="text-[9px] font-black uppercase text-black/40">{task.id === 'weekly-orders' || task.id === 'monthly-orders' ? 'Cash Reward (Rs.)' : 'Reward Points'}<input type="number" min="0" value={task.reward} onChange={event => updateTask(task.id, { reward: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-2.5 text-xs font-medium outline-none" /></label></div></div>)}
      </div>
      <div className="space-y-4">
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-[9px] font-black uppercase tracking-widest text-[#0F806E]">Monthly Challenge</p><h3 className="mt-1 text-lg font-black">10 Order Reward</h3><div className="mt-4 space-y-3"><label className="block text-[9px] font-black uppercase text-black/40">Target Orders<input type="number" min="1" value={challenge.targetOrders} onChange={event => setChallenge(value => ({ ...value, targetOrders: Math.max(1, Number(event.target.value) || 1) }))} className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm outline-none" /></label><label className="block text-[9px] font-black uppercase text-black/40">Gift Title<input value={challenge.giftTitle} onChange={event => setChallenge(value => ({ ...value, giftTitle: event.target.value }))} className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm outline-none" /></label><label className="block text-[9px] font-black uppercase text-black/40">Cash Option (Rs.)<input type="number" min="0" value={challenge.cashReward} onChange={event => setChallenge(value => ({ ...value, cashReward: Math.max(0, Number(event.target.value) || 0) }))} className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm outline-none" /></label><button onClick={() => setChallenge(value => ({ ...value, active: !value.active }))} className={`w-full rounded-xl py-3 text-[10px] font-black ${challenge.active ? 'bg-[#DDF5F0] text-[#0F806E]' : 'bg-black/5 text-black/45'}`}>Challenge {challenge.active ? 'ON' : 'OFF'}</button></div></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-[9px] font-black uppercase tracking-widest text-[#E85D04]">Spin Wheel</p><h3 className="mt-1 text-lg font-black">Custom Prize Slot</h3><div className="mt-4 space-y-3"><label className="block text-[9px] font-black uppercase text-black/40">Prize Title<input value={wheel.customPrizeTitle} onChange={event => setWheel(value => ({ ...value, customPrizeTitle: event.target.value }))} className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm outline-none" /></label><label className="block text-[9px] font-black uppercase text-black/40">Image URL<input value={wheel.customPrizeImage} onChange={event => setWheel(value => ({ ...value, customPrizeImage: event.target.value }))} placeholder="https://.../gift.jpg" className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm outline-none" /></label><label className="block text-[9px] font-black uppercase text-black/40">Prize Value / Points<input type="number" min="0" value={wheel.customPrizeValue} onChange={event => setWheel(value => ({ ...value, customPrizeValue: Math.max(0, Number(event.target.value) || 0) }))} className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm outline-none" /></label><button onClick={() => setWheel(value => ({ ...value, active: !value.active }))} className={`w-full rounded-xl py-3 text-[10px] font-black ${wheel.active ? 'bg-[#DDF5F0] text-[#0F806E]' : 'bg-black/5 text-black/45'}`}>Wheel {wheel.active ? 'ON' : 'OFF'}</button></div></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-[9px] font-black uppercase tracking-widest text-[#7B4B94]">Voucher Artwork</p><h3 className="mt-1 text-lg font-black">Premium voucher images</h3><p className="mt-1 text-xs text-black/45">Empty fields use the built-in premium artwork. Paste an image URL to replace any voucher image.</p><div className="mt-4 space-y-3">{voucherFields.map(([id, label]) => <label key={id} className="block text-[9px] font-black uppercase text-black/40">{label}<input value={voucherImages[id] || ''} onChange={event => setVoucherImages(current => ({ ...current, [id]: event.target.value }))} placeholder="https://.../voucher.jpg" className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-3 text-xs font-medium normal-case outline-none" /></label>)}</div></div>
      </div>
    </div>
  </section>;
}

