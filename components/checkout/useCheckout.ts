'use client';
import { fetchPublicStorefront } from '@/lib/storefrontClient';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BASE_DELIVERY_CHARGE } from '@/lib/deliveryCharges';
import { auth } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { makeTikTokContent, trackTikTokEvent } from '@/lib/tiktokPixel';
import type { Customer } from './CheckoutTypes';

export const titleOf = (item: any) => item.title || item.name || 'Product';
export const priceOf = (item: any) => Number(item.price || 0);
export const imageOf = (item: any) => item.imageUrl || item.image || item.images?.[0] || '';
function productIdOf(item: any) { return String(item?.productId || String(item?.id || '').split(':')[0] || '').trim(); }
function tikTokContents(rows: any[], fallbackRows: any[] = rows) {
  const categoryById = new Map(fallbackRows.map((item: any) => [productIdOf(item), String(item?.category || '')]));
  return rows
    .map((item: any) => {
      const productId = productIdOf(item);
      if (!productId) return null;
      return makeTikTokContent({
        id: productId,
        name: titleOf(item),
        category: item?.category || categoryById.get(productId),
        price: priceOf(item),
        quantity: Number(item?.quantity || item?.qty || 1),
      });
    })
    .filter(Boolean);
}
async function authHeader(): Promise<Record<string, string>> { const user = auth.currentUser; if (!user) return {}; try { return { Authorization: `Bearer ${await user.getIdToken()}` }; } catch { return {}; } }
export async function getAuthoritativeQuote(items: any[], selfCollect = false) {
  const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ mode: 'quote', items, selfCollect }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to verify current prices.');
  return data;
}
function cleanWhatsAppNumber(value: any) { return String(value || '').replace(/[^0-9]/g, ''); }
function variantText(variant: any) { const color = String(variant?.color ?? '').trim(), size = String(variant?.size ?? '').trim(); if (!color && !size) return 'Variant: Standard'; return `Variant: ${[color && `Color: ${color}`, size && `Size: ${size}`].filter(Boolean).join(', ')}`; }
async function getAdminWhatsAppNumber() { try { const response = await fetchPublicStorefront('settings'); if (!response.ok) throw new Error(`settings read ${response.status}`); const payload = await response.json(); for (const data of [payload?.documents?.main || {}, payload?.documents?.contact || {}]) { const number = data.adminWhatsappNumber ?? data.whatsappNumber ?? data.whatsapp ?? data.whatsappPhone ?? data.phone ?? data.contact?.adminWhatsappNumber ?? data.contact?.whatsappNumber ?? data.contact?.whatsapp ?? data.contact?.phone; const cleaned = cleanWhatsAppNumber(number); if (cleaned) return cleaned; } } catch (error) { console.warn('[whatsapp-checkout] Storefront settings lookup failed', error); } throw new Error('Admin WhatsApp number is not configured.'); }

const REVIEW_ORDER_KEY = 'primehub_review_orders_v1';
const ORDER_PROGRESS_KEY = 'primehub_reseller_order_progress_v1';
const GUEST_ID_KEY = 'primehub_reseller_guest_id_v1';
function guestId() { try { let id = window.localStorage.getItem(GUEST_ID_KEY) || ''; if (!id) { id = `g_${crypto.randomUUID().replace(/-/g, '')}`; window.localStorage.setItem(GUEST_ID_KEY, id); } return id; } catch { return ''; } }
function rememberReviewOrder(orderId: string, productIds: string[]) { try { const raw = window.localStorage.getItem(REVIEW_ORDER_KEY); const existing = raw ? JSON.parse(raw) : []; const entries = Array.isArray(existing) ? existing : []; const next = [{ orderId, productIds: [...new Set(productIds.filter(Boolean))] }, ...entries.filter((entry: any) => entry?.orderId !== orderId)].slice(0, 20); window.localStorage.setItem(REVIEW_ORDER_KEY, JSON.stringify(next)); } catch {} }
function rememberOrderProgress(orderId: string, wholesaleItems = 0) { try { const raw = window.localStorage.getItem(ORDER_PROGRESS_KEY); const existing = raw ? JSON.parse(raw) : []; const entries = Array.isArray(existing) ? existing : []; const next = [{ orderId, createdAt: new Date().toISOString(), wholesale: Number(wholesaleItems || 0) > 0 }, ...entries.filter((entry: any) => entry?.orderId !== orderId)].slice(0, 100); window.localStorage.setItem(ORDER_PROGRESS_KEY, JSON.stringify(next)); window.dispatchEvent(new Event('primehub:reseller-progress')); } catch {} }

export function useCheckout() {
  const items = useCartStore((state: any) => state.items || state.cart || []), clearCart = useCartStore((state: any) => state.clearCart);
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', email: '', address: '', city: '', notes: '' });
  const [placing, setPlacing] = useState(false), [orderId, setOrderId] = useState(''), [error, setError] = useState('');
  const [reviewProductIds, setReviewProductIds] = useState<string[]>([]);
  const [deliveryCharge, setDeliveryCharge] = useState(BASE_DELIVERY_CHARGE);
  const [rewardLabel, setRewardLabel] = useState('');
  const [selfCollect, setSelfCollect] = useState(false);
  const [wholesaleItems, setWholesaleItems] = useState(0);
  const [tierDiscount, setTierDiscount] = useState(0), [tierDiscountPercent, setTierDiscountPercent] = useState(0), [resellerTier, setResellerTier] = useState('');
  const checkoutTracked = useRef(false);
  const totalItems = useMemo(() => items.reduce((sum: number, item: any) => sum + Number(item.quantity || item.qty || 1), 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum: number, item: any) => sum + priceOf(item) * Number(item.quantity || item.qty || 1), 0), [items]);
  const discountedSubtotal = Math.max(0, subtotal - tierDiscount);
  const total = discountedSubtotal + deliveryCharge;
  useEffect(() => {
    if (checkoutTracked.current || !items.length || subtotal <= 0) return;
    const contents = tikTokContents(items);
    if (!contents.length) return;
    trackTikTokEvent('InitiateCheckout', {
      contents: contents as any,
      value: subtotal,
      currency: 'PKR',
    });
    checkoutTracked.current = true;
  }, [items, subtotal]);
  useEffect(() => {
    if (!items.length) { setDeliveryCharge(BASE_DELIVERY_CHARGE); setWholesaleItems(0); setRewardLabel(''); return; }
    let cancelled = false;
    getAuthoritativeQuote(items, selfCollect).then(quote => { if (!cancelled) { setDeliveryCharge(Number(quote.deliveryCharge ?? BASE_DELIVERY_CHARGE)); setWholesaleItems(Number(quote.wholesaleItems || 0)); setTierDiscount(Number(quote.tierDiscount || 0)); setTierDiscountPercent(Number(quote.tierDiscountPercent || 0)); setResellerTier(String(quote.resellerTier || '')); setRewardLabel(String(quote.rewardLabel || '')); } }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [items, selfCollect]);
  const update = (key: keyof Customer, value: string) => setCustomer(previous => ({ ...previous, [key]: value }));
  const placeOrder = async (event: FormEvent) => { event.preventDefault(); setError(''); if (!items.length) return setError('Your cart is empty. Please add a product first.'); if (!customer.name.trim() || !customer.phone.trim() || (!selfCollect && (!customer.address.trim() || !customer.city.trim()))) return setError(selfCollect ? 'Please fill your name and phone.' : 'Please fill your name, phone, address and city.'); setPlacing(true); try { const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ customer, items, selfCollect, guestId: guestId() }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Order save nahi ho saka.'); const productIds = Array.isArray(data.items) ? data.items.map((item: any) => String(item.productId || item.id || '')).filter(Boolean) : items.map((item: any) => String(item.productId || item.id || '')).filter(Boolean); const completedItems = Array.isArray(data.items) && data.items.length ? data.items : items; const completedContents = tikTokContents(completedItems, items); if (completedContents.length) { trackTikTokEvent('PlaceAnOrder', { contents: completedContents as any, value: Number(data.total ?? total), currency: 'PKR' }); } setReviewProductIds(productIds); rememberReviewOrder(data.orderId, productIds); rememberOrderProgress(data.orderId, Number(data.wholesaleItems || wholesaleItems || 0)); setOrderId(data.orderId); clearCart(); } catch (caught) { console.error(caught); setError(caught instanceof Error ? caught.message : 'Order save nahi ho saka. Please try again.'); } finally { setPlacing(false); } };
  const whatsappOrder = async () => { if (!items.length) return; setError(''); try { const [quote, adminNumber] = await Promise.all([getAuthoritativeQuote(items, selfCollect), getAdminWhatsAppNumber()]); const user = auth.currentUser; let resellerCode = '', requestId = ''; if (user) { const token = await user.getIdToken(); const track = await fetch('/api/reseller/whatsapp-order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ customer, items: quote.items, subtotal: quote.subtotal, deliveryCharge: quote.deliveryCharge, total: quote.total, selfCollect }) }); const trackData = await track.json(); if (track.ok) { resellerCode = String(trackData.resellerCode || ''); requestId = String(trackData.requestId || ''); } else if (track.status !== 401) throw new Error(trackData.error || 'Unable to create WhatsApp reseller request.'); }
    const lines = quote.items.map((validated: any, index: number) => [`${index + 1}. ${validated.title} x ${validated.quantity}`, `- ${variantText(validated.variant)}`, `- Price: Rs. ${Number(validated.price).toLocaleString()}`, `- Image: ${validated.image || 'N/A'}`].join('\n'));
    const tracking = resellerCode ? ['', '*RESELLER ORDER*', `Reseller Code: ${resellerCode}`, `Request ID: ${requestId}`] : [];
    const wholesaleLine = Number(quote.wholesaleItems || 0) ? `Wholesale item surcharge (${quote.wholesaleItems} × Rs. 30): Rs. ${Number(quote.wholesaleSurcharge || 0).toLocaleString()}` : '';
    const rewardLine = quote.rewardLabel ? `*${quote.rewardLabel}*` : '';
    const text = ['*Order from PrimeHub*', '', ...lines, '', '*Customer Details:*', `Name: ${customer.name || '-'}`, `Phone: ${customer.phone || '-'}`, `Address: ${customer.address || '-'}`, `City: ${customer.city || '-'}`, '', `Subtotal: Rs. ${Number(quote.subtotal).toLocaleString()}`, rewardLine, `Base delivery: Rs. ${Number(quote.baseDelivery || 350).toLocaleString()}`, wholesaleLine, `*Grand Total: Rs. ${Number(quote.total).toLocaleString()}*`, ...tracking].filter(Boolean).join('\n');
    window.open(`https://wa.me/${adminNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  } catch (caught) { console.error(caught); setError(caught instanceof Error ? caught.message : 'Unable to prepare WhatsApp order.'); } };
  return { items, customer, placing, orderId, reviewProductIds, error, totalItems, subtotal: discountedSubtotal, rawSubtotal: subtotal, tierDiscount, tierDiscountPercent, resellerTier, rewardLabel, deliveryCharge, wholesaleItems, total, selfCollect, setSelfCollect, update, placeOrder, whatsappOrder };
}
