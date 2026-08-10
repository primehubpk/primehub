'use client';

// ==================== SUPPLIER REQUEST MODERATION ====================
import { useEffect, useState } from 'react';
import { onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Check, Loader2, X } from 'lucide-react';
import { adminCollection, createAdminDocument, updateAdminDocument, VendorRequest } from './shared';

export default function VendorRequests() {
  const [requests, setRequests] = useState<VendorRequest[]>([]);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => onSnapshot(adminCollection('vendor_submissions'), (snap) => setRequests(snap.docs.map((item) => ({ id: item.id, ...item.data() } as VendorRequest)))), []);

  // ==================== APPROVAL / REJECTION ACTIONS ====================
  async function moderate(request: VendorRequest, status: 'approved' | 'rejected') {
    setBusyId(request.id); setNotice('');
    try {
      if (status === 'approved') {
        const submittedStock = Number(request.stock || request.quantity || 0);
        await createAdminDocument('products', { title: request.productTitle || 'Supplier Product', price: Number(request.wholesalePrice || 0), originalPrice: Number(request.wholesalePrice || 0), category: request.category || 'Supplier Deals', description: request.description || '', imageUrl: request.photos?.[0] || '', images: request.photos || [], stock: submittedStock > 0 ? submittedStock : 50, isFlashSale: false, isWeekendSpecial: false, createdAt: serverTimestamp() });
      }
      await updateAdminDocument('vendor_submissions', request.id, { status, moderatedAt: serverTimestamp() });
      setNotice(status === 'approved' ? 'Product approved and published.' : 'Supplier request rejected.');
    } catch { setNotice('Action failed. Please try again.'); }
    finally { setBusyId(''); }
  }

  return <section className="mx-auto max-w-5xl px-4 py-6"><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Supplier moderation</p><h2 className="mt-1 text-2xl font-black">Vendor Requests</h2>{notice && <p className="mt-4 rounded-xl bg-[#0F6A5F] p-3 text-xs font-black text-white">{notice}</p>}<div className="mt-5 space-y-3">{requests.map((request) => <article key={request.id} className="rounded-3xl bg-white p-4 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-black">{request.productTitle || 'Untitled product'}</h3><p className="mt-1 text-xs text-black/50">{request.supplierName} · {request.businessName} · {request.whatsappNumber} · {request.city}</p><p className="mt-2 text-xs font-black">Wholesale Rs. {Number(request.wholesalePrice || 0).toLocaleString()} · Stock {Number(request.stock || request.quantity || 50) || 50}</p></div><span className="text-xs font-black">{request.status || 'pending'}</span></div>{request.photos?.length ? <div className="mt-3 flex gap-2 overflow-x-auto">{request.photos.map((photo) => <img key={photo} src={photo} alt="Supplier product" className="h-20 w-20 rounded-xl object-cover" />)}</div> : null}{request.status === 'pending' && <div className="mt-4 flex gap-2"><button disabled={busyId === request.id} onClick={() => moderate(request, 'approved')} className="flex items-center gap-1 rounded-xl bg-[#0F6A5F] px-3 py-2 text-xs font-black text-white"><Check size={14}/>{busyId === request.id ? <Loader2 size={14} className="animate-spin"/> : 'Approve & Publish'}</button><button disabled={busyId === request.id} onClick={() => moderate(request, 'rejected')} className="flex items-center gap-1 rounded-xl bg-[#E1352B] px-3 py-2 text-xs font-black text-white"><X size={14}/>Reject</button></div>}</article>)}{requests.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-xs text-black/45">No supplier requests yet.</p>}</div></section>;
}
