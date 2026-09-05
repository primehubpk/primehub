'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { BASE_DELIVERY_CHARGE } from '@/lib/deliveryCharges';
import { db, auth } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import type { Customer } from './CheckoutTypes';

export const titleOf = (item: any) => item.title || item.name || 'Product';
export const priceOf = (item: any) => Number(item.price || 0);
export const imageOf = (item: any) => item.imageUrl || item.image || item.images?.[0] || '';
export async function getAuthoritativeQuote(items: any[], selfCollect = false) {
  const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ mode: 'quote', items, selfCollect }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to verify current prices.');
  return data;
}
function cleanWhatsAppNumber(value: any) { return String(value || '').replace(/[^0-9]/g, ''); }
function variantText(variant: any) { const color = String(variant?.color ?? '').trim(), size = String(variant?.size ?? '').trim(); if (!color && !size) return 'Variant: Standard'; return `Variant: ${[color && `Color: ${color}`, size && `Size: ${size}`].filter(Boolean).join(', ')}`; }
async function getAdminWhatsAppNumber() { for (const reference of [doc(db, 'settings', 'main'), doc(db, 'settings', 'contact')]) { try { const snapshot = await getDoc(reference); if (!snapshot.exists()) continue; const data: any = snapshot.data() || {}; const number = data.adminWhatsappNumber ?? data.whatsappNumber ?? data.whatsapp ?? data.whatsappPhone ?? data.phone ?? data.contact?.adminWhatsappNumber ?? data.contact?.whatsappNumber ?? data.contact?.whatsapp ?? data.contact?.phone; const cleaned = cleanWhatsAppNumber(number); if (cleaned) return cleaned; } catch (error) { console.warn('[whatsapp-checkout] Failed to read settings document', reference.id, error); } } throw new Error('Admin WhatsApp number is not configured.'); }
async function authHeader(): Promise<Record<string, string>> { const user = auth.currentUser; if (!user) return {}; try { return { Authorization: `Bearer ${await user.getIdToken()}` }; } catch { return {}; } }

const REVIEW_ORDER_KEY = 'primehub_review_orders_v1';
function rememberReviewOrder(orderId: string, productIds: string[]) {
  try {
    const raw = window.localStorage.getItem(REVIEW_ORDER_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const entries = Array.isArray(existing) ? existing : [];
    const next = [{ orderId, productIds: [...new Set(productIds.filter(Boolean))] }, ...entries.filter((entry: any) => entry?.orderId !== orderId)].slice(0, 20);
    window.localStorage.setItem(REVIEW_ORDER_KEY, JSON.stringify(next));
  } catch {}
}

export function useCheckout() {
  const items = useCartStore((state: any) => state.items || state.cart || []), clearCart = useCartStore((state: any) => state.clearCart);
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', email: '', address: '', city: '', notes: '' });
  const [placing, setPlacing] = useState(false), [orderId, setOrderId] = useState(''), [error, setError] = useState('');
  const [reviewProductIds, setReviewProductIds] = useState<string[]>([]);
  const [deliveryCharge, setDeliveryCharge] = useState(BASE_DELIVERY_CHARGE);
  const [selfCollect, setSelfCollect] = useState(false);
  const [wholesaleItems, setWholesaleItems] = useState(0);
  const [tierDiscount, setTierDiscount] = useState(0), [tierDiscountPercent, setTierDiscountPercent] = useState(0), [resellerTier, setResellerTier] = useState('');
  const totalItems = useMemo(() => items.reduce((sum: number, item: any) => sum + Number(item.quantity || item.qty || 1), 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum: number, item: any) => sum + priceOf(item) * Number(item.quantity || item.qty || 1), 0), [items]);
  const discountedSubtotal = Math.max(0, subtotal - tierDiscount);
  const total = discountedSubtotal + deliveryCharge;
  useEffect(() => {
    if (!items.length) { setDeliveryCharge(BASE_DELIVERY_CHARGE); setWholesaleItems(0); return; }
    let cancelled = false;
    getAuthoritativeQuote(items, selfCollect).then(quote => { if (!cancelled) { setDeliveryCharge(Number(quote.deliveryCharge ?? BASE_DELIVERY_CHARGE)); setWholesaleItems(Number(quote.wholesaleItems || 0)); setTierDiscount(Number(quote.tierDiscount||0)); setTierDiscountPercent(Number(quote.tierDiscountPercent||0)); setResellerTier(String(quote.resellerTier||'')); } }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [items, selfCollect]);
  const update = (key: keyof Customer, value: string) => setCustomer(previous => ({ ...previous, [key]: value }));
  const placeOrder = async (event: FormEvent) => { event.preventDefault(); setError(''); if (!items.length) return setError('Your cart is empty. Please add a product first.'); if (!customer.name.trim() || !customer.phone.trim() || (!selfCollect && (!customer.address.trim() || !customer.city.trim()))) return setError(selfCollect ? 'Please fill your name and phone.' : 'Please fill your name, phone, address and city.'); setPlacing(true); try { const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ customer, items, selfCollect }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Order save nahi ho saka.'); const productIds = Array.isArray(data.items) ? data.items.map((item: any) => String(item.productId || item.id || '')).filter(Boolean) : items.map((item: any) => String(item.productId || item.id || '')).filter(Boolean); setReviewProductIds(productIds); rememberReviewOrder(data.orderId, productIds); setOrderId(data.orderId); clearCart(); } catch (caught) { console.error(caught); setError(caught instanceof Error ? caught.message : 'Order save nahi ho saka. Please try again.'); } finally { setPlacing(false); } };
  const whatsappOrder = async () => { if (!items.length) return; setError(''); try { const [quote, adminNumber] = await Promise.all([getAuthoritativeQuote(items, selfCollect), getAdminWhatsAppNumber()]); const user = auth.currentUser; let resellerCode = '', requestId = ''; if (user) { const token = await user.getIdToken(); const track = await fetch('/api/reseller/whatsapp-order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ customer, items: quote.items, subtotal: quote.subtotal, deliveryCharge: quote.deliveryCharge, total: quote.total, selfCollect }) }); const trackData = await track.json(); if (track.ok) { resellerCode = String(trackData.resellerCode || ''); requestId = String(trackData.requestId || ''); } else if (track.status !== 401) throw new Error(trackData.error || 'Unable to create WhatsApp reseller request.'); }
    const lines = quote.items.map((validated: any, index: number) => [`${index + 1}. ${validated.title} x ${validated.quantity}`, `- ${variantText(validated.variant)}`, `- Price: Rs. ${Number(validated.price).toLocaleString()}`, `- Image: ${validated.image || 'N/A'}`].join('\n'));
    const tracking = resellerCode ? ['', '*RESELLER ORDER*', `Reseller Code: ${resellerCode}`, `Request ID: ${requestId}`] : [];
    const wholesaleLine = Number(quote.wholesaleItems || 0) ? `Wholesale item surcharge (${quote.wholesaleItems} × Rs. 30): Rs. ${Number(quote.wholesaleSurcharge || 0).toLocaleString()}` : '';
    const text = ['*Order from PrimeHub*', '', ...lines, '', '*Customer Details:*', `Name: ${customer.name || '-'}`, `Phone: ${customer.phone || '-'}`, `Address: ${customer.address || '-'}`, `City: ${customer.city || '-'}`, '', `Subtotal: Rs. ${Number(quote.subtotal).toLocaleString()}`, `Base delivery: Rs. ${Number(quote.baseDelivery || 350).toLocaleString()}`, wholesaleLine, `*Grand Total: Rs. ${Number(quote.total).toLocaleString()}*`, ...tracking].filter(Boolean).join('\n');
    window.open(`https://wa.me/${adminNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  } catch (caught) { console.error(caught); setError(caught instanceof Error ? caught.message : 'Unable to prepare WhatsApp order.'); } };
  return { items, customer, placing, orderId, reviewProductIds, error, totalItems, subtotal: discountedSubtotal, rawSubtotal: subtotal, tierDiscount, tierDiscountPercent, resellerTier, deliveryCharge, wholesaleItems, total, selfCollect, setSelfCollect, update, placeOrder, whatsappOrder };
}
