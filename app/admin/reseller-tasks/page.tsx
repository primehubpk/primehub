'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, ImagePlus, Plus, Save, Trash2, Upload } from 'lucide-react';
import RewardsManager from '@/components/admin/RewardsManagerCatalogBridge';
import { setAdminDocument, uploadImageToImgBB } from '@/components/admin/shared';
import { db } from '@/lib/firebase';
import { DEFAULT_RESELLER_TIERS, type ResellerTier } from '@/lib/resellerTypes';
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS, type MonthlyChallengeSettings, type ResellerTask } from '@/lib/resellerTasks';

const settingsRef = doc(db, 'settings', 'main');
const voucherFields = [
  ['cash-500', 'Rs. 500 Cash'], ['challenge-cash', 'Monthly Cash'], ['challenge-gift', 'PrimeHub Gift Box'],
  ['bridal-gift', 'Bridal Gift'], ['wholesale-off', 'Wholesale Discount'], ['free-delivery', 'Free Delivery'],
  ['jazzcash-300', 'JazzCash Rs. 300'], ['easypaisa-300', 'EasyPaisa Rs. 300'], ['kids-gift', 'Kids Gift Box'], ['elite-cash', 'Elite Cash'],
] as const;

type AdminView = 'tasks' | 'rewards';

function newTask(): ResellerTask {
  return { id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: 'New reseller task', description: 'Add a short instruction for the customer.', icon: '✓', url: '', shareText: '', reward: 50, active: true, verification: 'manual' };
}

export default function ResellerTasksAdminPage() {
  const [view, setView] = useState<AdminView>('tasks');
  const [tasks, setTasks] = useState<ResellerTask[]>(DEFAULT_RESELLER_TASKS);
  const [challenge, setChallenge] = useState<MonthlyChallengeSettings>(DEFAULT_MONTHLY_CHALLENGE);
  const [voucherImages, setVoucherImages] = useState<Record<string, string>>({});
  const [tiers, setTiers] = useState<ResellerTier[]>(DEFAULT_RESELLER_TIERS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingVoucher, setUploadingVoucher] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => onSnapshot(settingsRef, snapshot => {
    const data: any = snapshot.data() || {};
    if (Array.isArray(data.resellerTasks)) setTasks(data.resellerTasks.map((task: ResellerTask) => ({ ...DEFAULT_RESELLER_TASKS.find(item => item.id === task.id), ...task })));
    if (data.resellerMonthlyChallenge) setChallenge({ ...DEFAULT_MONTHLY_CHALLENGE, ...data.resellerMonthlyChallenge });
    setVoucherImages(data.resellerVoucherImages || {});
    if (Array.isArray(data.resellerTiers) && data.resellerTiers.length) setTiers(data.resellerTiers);
  }), []);

  function updateTask(id: string, patch: Partial<ResellerTask>) { setTasks(current => current.map(task => task.id === id ? { ...task, ...patch } : task)); }
  function removeTask(id: string) { if (window.confirm('Delete this reseller task?')) setTasks(current => current.filter(task => task.id !== id)); }

  async function save() {
    setSaving(true); setSaved(false); setMessage('');
    try {
      await setAdminDocument('settings', 'main', { resellerTasks: tasks, resellerMonthlyChallenge: challenge, resellerVoucherImages: voucherImages, resellerTiers: tiers, updatedAt: new Date().toISOString() });
      setSaved(true); setMessage('Reseller settings saved successfully. Home and Reseller Club will read the same settings.');
      window.setTimeout(() => setSaved(false), 1800);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save reseller settings.'); }
    finally { setSaving(false); }
  }

  async function uploadVoucher(id: string, file?: File) {
    if (!file) return;
    setUploadingVoucher(id); setMessage('Uploading voucher image...');
    try { const url = await uploadImageToImgBB(file); setVoucherImages(current => ({ ...current, [id]: url })); setMessage('Voucher image ready. Tap Save Changes to publish it.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Voucher upload failed.'); }
    finally { setUploadingVoucher(''); }
  }

  if (view === 'rewards') return <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]"><section className="sticky top-0 z-20 border-b border-black/8 bg-white/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><button type="button" onClick={() => setView('tasks')} className="inline-flex items-center gap-2 rounded-full bg-[#F4F4F1] px-3 py-2 text-[10px] font-black"><ArrowLeft size={13}/> Tasks & Club</button><Link href="/admin/resellers" className="rounded-full bg-[#14140F] px-3 py-2 text-[10px] font-black text-white">Reseller Management</Link></div></section><RewardsManager /></main>;

  return <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
    <section className="sticky top-0 z-20 border-b border-black/8 bg-white/95 px-4 py-3 backdrop-blur"><div className="mx-auto max-w-6xl"><div className="flex items-center justify-between gap-3"><Link href="/admin" className="inline-flex items-center gap-2 rounded-full bg-[#F4F4F1] px-3 py-2 text-[10px] font-black"><ArrowLeft size={13}/> Admin</Link><button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#14140F] px-4 py-2.5 text-[10px] font-black text-white disabled:opacity-50"><Save size={13}/>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}</button></div><div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-[#F4F4F1] p-1.5"><button type="button" onClick={() => setView('tasks')} className="rounded-xl bg-white px-3 py-2.5 text-[10px] font-black shadow-sm">Tasks & Club</button><button type="button" onClick={() => setView('rewards')} className="rounded-xl px-3 py-2.5 text-[10px] font-black text-black/55">Wheel & Rewards</button></div></div></section>

    <section className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-[26px] bg-[#14140F] p-5 text-white"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#FFCF68]">Reseller Club Control</p><h1 className="mt-1 text-2xl font-black">Tasks, tiers & vouchers</h1><p className="mt-2 text-xs leading-5 text-white/55">One mobile-friendly place for reseller settings. Spin Wheel and loyalty rewards are under “Wheel & Rewards”.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/admin/resellers" className="rounded-full bg-white/10 px-3 py-2 text-[9px] font-black">Open member management</Link><button type="button" onClick={() => setView('rewards')} className="rounded-full bg-[#E1352B] px-3 py-2 text-[9px] font-black">Open Wheel & Rewards</button></div></div>
      {message ? <div className="mt-3 rounded-2xl bg-[#E8F5F2] p-3 text-[10px] font-bold text-[#0F6A5F]">{message}</div> : null}

      <section className="mt-4 rounded-[24px] bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-widest text-[#E1352B]">Tasks</p><h2 className="mt-1 text-lg font-black">Reseller tasks</h2><p className="mt-1 text-[11px] leading-5 text-black/45">Add, edit, switch off or delete tasks. Guests can start tasks; reward claiming stays behind login.</p></div><button type="button" onClick={() => setTasks(current => [...current, newTask()])} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#14140F] px-3 py-2.5 text-[9px] font-black text-white"><Plus size={13}/> Add</button></div><div className="mt-4 space-y-2">{tasks.map((task, index) => <details key={task.id} className="group rounded-2xl border border-black/6 bg-[#F7F7F3] p-3" open={index === 0}><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black">{task.icon || '✓'} {task.title}</p><p className="mt-0.5 text-[9px] text-black/40">{task.reward} reward · {task.active ? 'ON' : 'OFF'}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-black ${task.active ? 'bg-[#DDF5F0] text-[#0F806E]' : 'bg-black/5 text-black/40'}`}>{task.active ? 'ON' : 'OFF'}</span></summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Task title"><input value={task.title} onChange={e => updateTask(task.id, { title: e.target.value })} className="admin-input"/></Field><Field label="Icon / emoji"><input value={task.icon || ''} onChange={e => updateTask(task.id, { icon: e.target.value })} className="admin-input"/></Field><Field label="Description" wide><textarea rows={3} value={task.description} onChange={e => updateTask(task.id, { description: e.target.value })} className="admin-input resize-none"/></Field><Field label={task.id === 'refer-reseller' ? 'Destination link (optional)' : 'Task link'}><input value={task.url || ''} onChange={e => updateTask(task.id, { url: e.target.value })} placeholder="https://..." className="admin-input"/>{task.id === 'refer-reseller' ? <small className="mt-1 block text-[9px] leading-4 text-black/40">Leave empty for automatic referral link.</small> : null}</Field><Field label="Reward points / cash"><input type="number" min="0" value={task.reward} onChange={e => updateTask(task.id, { reward: Math.max(0, Number(e.target.value) || 0) })} className="admin-input"/></Field><Field label="Share message" wide><textarea rows={2} value={task.shareText || ''} onChange={e => updateTask(task.id, { shareText: e.target.value })} placeholder="Message customer will share..." className="admin-input resize-none"/></Field><Field label="Verification"><select value={task.verification} onChange={e => updateTask(task.id, { verification: e.target.value as ResellerTask['verification'] })} className="admin-input"><option value="manual">Manual / proof</option><option value="link">Link/open</option></select></Field><div className="flex items-end gap-2"><button type="button" onClick={() => updateTask(task.id, { active: !task.active })} className={`flex-1 rounded-xl py-3 text-[9px] font-black ${task.active ? 'bg-[#DDF5F0] text-[#0F806E]' : 'bg-black/5 text-black/45'}`}>{task.active ? 'Task ON' : 'Task OFF'}</button><button type="button" onClick={() => removeTask(task.id)} className="rounded-xl bg-red-50 p-3 text-red-700" aria-label="Delete task"><Trash2 size={14}/></button></div></div></details>)}</div></section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="rounded-[24px] bg-white p-4 shadow-sm sm:p-5"><p className="text-[9px] font-black uppercase tracking-widest text-[#0F806E]">Monthly Challenge</p><h2 className="mt-1 text-lg font-black">Order reward</h2><div className="mt-4 space-y-3"><Field label="Target orders"><input type="number" min="1" value={challenge.targetOrders} onChange={e => setChallenge(value => ({ ...value, targetOrders: Math.max(1, Number(e.target.value) || 1) }))} className="admin-input"/></Field><Field label="Gift title"><input value={challenge.giftTitle} onChange={e => setChallenge(value => ({ ...value, giftTitle: e.target.value }))} className="admin-input"/></Field><Field label="Cash option (Rs.)"><input type="number" min="0" value={challenge.cashReward} onChange={e => setChallenge(value => ({ ...value, cashReward: Math.max(0, Number(e.target.value) || 0) }))} className="admin-input"/></Field><button type="button" onClick={() => setChallenge(value => ({ ...value, active: !value.active }))} className={`w-full rounded-xl py-3 text-[10px] font-black ${challenge.active ? 'bg-[#DDF5F0] text-[#0F806E]' : 'bg-black/5 text-black/45'}`}>Challenge {challenge.active ? 'ON' : 'OFF'}</button></div></section><section className="rounded-[24px] bg-white p-4 shadow-sm sm:p-5"><p className="text-[9px] font-black uppercase tracking-widest text-[#B4871D]">Levels</p><h2 className="mt-1 text-lg font-black">Tier discounts</h2><div className="mt-4 space-y-2">{tiers.map((tier, index) => <details key={tier.id} className="rounded-2xl bg-[#F7F7F3] p-3"><summary className="cursor-pointer text-xs font-black">Tier {index + 1} · {tier.name} · {tier.discountPercent || 0}%</summary><div className="mt-3 grid grid-cols-2 gap-2"><Field label="Name"><input value={tier.name} onChange={e => setTiers(list => list.map(x => x.id === tier.id ? { ...x, name: e.target.value } : x))} className="admin-input"/></Field><Field label="Min orders"><input type="number" min="0" value={tier.minMonthlyOrders} onChange={e => setTiers(list => list.map(x => x.id === tier.id ? { ...x, minMonthlyOrders: Math.max(0, Number(e.target.value) || 0) } : x))} className="admin-input"/></Field><Field label="Discount %"><input type="number" min="0" max="100" value={tier.discountPercent || 0} onChange={e => setTiers(list => list.map(x => x.id === tier.id ? { ...x, discountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } : x))} className="admin-input"/></Field><Field label="Benefits" wide><textarea rows={3} value={(tier.benefits || []).join('\n')} onChange={e => setTiers(list => list.map(x => x.id === tier.id ? { ...x, benefits: e.target.value.split('\n').map(v => v.trim()).filter(Boolean) } : x))} className="admin-input resize-none"/></Field></div></details>)}</div></section></div>

      <section className="mt-4 rounded-[24px] bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start gap-3"><ImagePlus size={18} className="mt-0.5 text-[#7B4B94]"/><div><p className="text-[9px] font-black uppercase tracking-widest text-[#7B4B94]">Voucher Artwork</p><h2 className="mt-1 text-lg font-black">Voucher images</h2><p className="mt-1 text-[11px] leading-5 text-black/45">Choose directly from the phone/gallery. URL is still available as an optional fallback.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{voucherFields.map(([id, label]) => <div key={id} className="rounded-2xl bg-[#F7F7F3] p-3"><p className="text-[9px] font-black uppercase text-black/45">{label}</p>{voucherImages[id] ? <img src={voucherImages[id]} alt={label} className="mt-2 aspect-[16/9] w-full rounded-xl object-cover"/> : <div className="mt-2 flex aspect-[16/9] items-center justify-center rounded-xl bg-white text-black/20"><ImagePlus size={24}/></div>}<div className="mt-2 flex gap-2"><label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#14140F] px-3 py-2.5 text-[9px] font-black text-white"><Upload size={12}/>{uploadingVoucher === id ? 'Uploading…' : 'Choose image'}<input type="file" accept="image/*" className="hidden" disabled={uploadingVoucher === id} onChange={e => void uploadVoucher(id, e.target.files?.[0])}/></label>{voucherImages[id] ? <button type="button" onClick={() => setVoucherImages(current => ({ ...current, [id]: '' }))} className="rounded-xl bg-red-50 px-3 text-red-700"><Trash2 size={13}/></button> : null}</div><input value={voucherImages[id] || ''} onChange={e => setVoucherImages(current => ({ ...current, [id]: e.target.value }))} placeholder="Or paste image URL" className="admin-input mt-2 text-[10px]"/></div>)}</div></section>

      <button onClick={() => void save()} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E1352B] px-4 py-4 text-xs font-black text-white disabled:opacity-50"><Save size={15}/>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save All Reseller Settings'}</button>
    </section>
    <style jsx global>{`.admin-input{margin-top:.3rem;width:100%;border-radius:.75rem;background:#fff;padding:.75rem .8rem;font-size:.75rem;font-weight:600;outline:none;border:1px solid rgba(20,20,15,.06)}.admin-input:focus{border-color:rgba(225,53,43,.35)}`}</style>
  </main>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`block text-[8px] font-black uppercase tracking-wide text-black/40 ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}</label>; }
