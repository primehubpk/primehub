'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { WalletCards } from 'lucide-react';

type Member = { id?: string; userId?: string; displayName?: string; email?: string; status?: string; walletShopping?: number; walletAvailable?: number };
type Credit = { id: string; userId: string; amount: number; purpose: string; reason: string; createdAt?: string | null };
const money = (n: number | undefined) => `Rs. ${Number(n || 0).toLocaleString()}`;

export default function AdminResellerCreditsPanel({ members, onCredited }: { members: Member[]; onCredited: () => Promise<void> }) {
  const [userId, setUserId] = useState('');
  const [purpose, setPurpose] = useState<'shopping' | 'withdrawable'>('shopping');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<Credit[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const operationId = useRef('');
  const member = members.find(row => (row.userId || row.id) === userId);
  const refreshHistory = useCallback(async () => {
    const response = await fetch('/api/admin/reseller-wallet-credit', { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Unable to read wallet credit history.');
    setHistory(Array.isArray(data?.credits) ? data.credits : []);
  }, []);
  useEffect(() => { void refreshHistory().catch(e => setError(String(e?.message || e))); }, [refreshHistory]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!member || member.status !== 'active') return setError('Select an active reseller account.');
    const rupees = Number(amount);
    if (!Number.isSafeInteger(rupees) || rupees <= 0 || !reason.trim()) return setError('Enter positive whole rupees and an audit reason.');
    const confirmed = window.confirm(`CREDIT CONFIRMATION\n\nAccount: ${member.email || member.userId}\nUID: ${userId}\nAmount: ${money(rupees)}\nPurpose: ${purpose === 'shopping' ? 'SHOPPING ONLY (cannot withdraw)' : 'WITHDRAWABLE cash wallet'}\n\nThis changes the real wallet balance. Continue?`);
    if (!confirmed) return;
    setBusy(true); setError(''); setMessage('');
    if (!operationId.current) operationId.current = crypto.randomUUID();
    try {
      const response = await fetch('/api/admin/reseller-wallet-credit', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, purpose, amount: rupees, reason: reason.trim(), operationId: operationId.current }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Credit failed.');
      operationId.current = '';
      setMessage(data.credited ? `Credited ${money(rupees)} to the ${purpose} wallet.` : 'Credit was already recorded; no duplicate charge.');
      setAmount(''); setReason('');
      try {
        await Promise.all([onCredited(), refreshHistory()]);
      } catch {
        // Money was already credited. A read/refresh outage must not present it as a failed credit.
        setError('Credit was saved successfully, but the member list/history could not refresh. Press Refresh; do not credit the same amount again.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Credit failed; retry to check the same transaction.'); }
    finally { setBusy(false); }
  }

  return <section id="credit-wallet" className="mt-4 rounded-[26px] border border-[#0F6A5F]/15 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-[#DDF5F0] p-2.5 text-[#0F6A5F]"><WalletCards size={20}/></span><div>
      <p className="text-[9px] font-black uppercase tracking-widest text-[#0F6A5F]">Reseller Club · Admin Wallet</p>
      <h2 className="mt-1 text-xl font-black">Add wallet credit</h2>
      <p className="mt-1 text-[10px] leading-5 text-black/50">Shopping credit pays only for website orders. Withdrawable credit joins the reward cash wallet (minimum withdrawal Rs. 500). Every adjustment is atomic and logged against the member UID.</p>
    </div></div>
    <form onSubmit={submit} className="mt-4 grid gap-3">
      <label className="text-[10px] font-bold">Reseller account (verify email and UID)
        <select required value={userId} onChange={e => { setUserId(e.target.value); operationId.current = ''; }} className="mt-1 w-full rounded-xl border border-black/10 bg-[#F8F8F5] p-3 text-xs">
          <option value="">Select reseller</option>
          {members.filter(row => row.status === 'active').map(row => <option key={row.id || row.userId} value={row.userId || row.id}>{row.email || row.displayName || 'Reseller'} — {(row.userId || row.id || '').slice(-8)}</option>)}
        </select>
      </label>
      {member ? <div className="rounded-xl bg-[#F4F4F1] p-3 text-[10px] leading-5"><p className="break-all font-black">{member.email}</p><p className="break-all text-black/40">Account UID: {userId}</p><p className="text-black/60">Shopping: {money(member.walletShopping)} · Withdrawable: {money(member.walletAvailable)}</p></div> : null}
      <fieldset className="grid grid-cols-2 gap-2"><legend className="mb-2 text-[10px] font-bold">Credit type</legend>
        <label className={`rounded-xl border p-3 text-[10px] font-bold ${purpose === 'shopping' ? 'border-[#0F6A5F] bg-[#DDF5F0]' : 'border-black/10'}`}><input type="radio" name="purpose" checked={purpose === 'shopping'} onChange={() => { setPurpose('shopping'); operationId.current = ''; }}/> Shopping only</label>
        <label className={`rounded-xl border p-3 text-[10px] font-bold ${purpose === 'withdrawable' ? 'border-[#0F6A5F] bg-[#DDF5F0]' : 'border-black/10'}`}><input type="radio" name="purpose" checked={purpose === 'withdrawable'} onChange={() => { setPurpose('withdrawable'); operationId.current = ''; }}/> Withdrawable</label>
      </fieldset>
      <label className="text-[10px] font-bold">Amount (Rs.)<input required type="number" min="1" step="1" value={amount} onChange={e => { setAmount(e.target.value); operationId.current = ''; }} className="mt-1 w-full rounded-xl border border-black/10 bg-[#F8F8F5] p-3 text-sm" placeholder="e.g. 1500"/></label>
      <label className="text-[10px] font-bold">Reason / reference (required for audit)<input required maxLength={240} value={reason} onChange={e => { setReason(e.target.value); operationId.current = ''; }} className="mt-1 w-full rounded-xl border border-black/10 bg-[#F8F8F5] p-3 text-sm" placeholder="Why is this money being credited?"/></label>
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
      {message ? <p role="status" className="rounded-xl bg-[#DDF5F0] p-3 text-xs font-bold text-[#0F6A5F]">{message}</p> : null}
      <button disabled={busy || !member} className="rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white disabled:opacity-45">{busy ? 'Saving securely…' : 'Review and add real credit'}</button>
    </form>
    <div className="mt-6 border-t border-black/10 pt-4"><h3 className="text-sm font-black">Last 100 admin credits</h3><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
      {history.length === 0 ? <p className="text-xs text-black/40">No credits recorded yet.</p> : history.map(entry => <div key={entry.id} className="rounded-xl bg-[#F8F8F5] p-3 text-[10px]">
        <div className="flex justify-between gap-2"><b>{money(entry.amount)} · {entry.purpose}</b><span className="text-black/40">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</span></div>
        <p className="mt-1 break-all text-black/50">{members.find(m => (m.userId || m.id) === entry.userId)?.email || entry.userId}</p><p className="mt-1">{entry.reason}</p>
      </div>)}
    </div></div>
  </section>;
}
