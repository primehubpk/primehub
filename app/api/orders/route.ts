import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { pakistanDay } from '@/lib/notifications/dailyPush';
import { calculateDeliveryCharge } from '@/lib/deliveryCharges';
import { getDualProduct, getDualStorefrontSettings } from '@/lib/dualReadServer';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { isSupabaseWriteConfigured, mapOrderToSupabase, mirrorSupabaseUpsert, recordMirrorFailure, supabasePrimaryUpsert } from '@/lib/dualWriteServer';
import { isWholesaleProduct } from '@/lib/wholesale';
import { createShoppingWalletOrder, shoppingWalletBalance } from '@/lib/resellerShoppingCheckout';
import { cashBackForTier, orderEligibleSubtotal } from '@/lib/orderBenefits';
import { listCheckoutVouchers, resolveCheckoutVoucher } from '@/lib/checkoutVouchersServer';
import { referralCode, resolveMemberReferralCode } from '@/lib/primeFamilyReferralsServer';
import { bigDealConfiguredSlotCount, bigDealRotationIndex } from '@/lib/bigDealRotation';

export const runtime = 'nodejs';
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
type Weekday = (typeof WEEKDAYS)[number];
type IncomingItem = { id?: string | number; productId?: string; name?: string; title?: string; price?: number; originalPrice?: number; image?: string; imageUrl?: string; qty?: number; quantity?: number; dealDay?: Weekday; variant?: { color?: string; size?: string }; markedImages?: Array<{ originalUrl?: string; markedUrl?: string }> };
type Customer = { name: string; phone: string; email?: string; address: string; city: string; notes?: string };
type SalarOrderContext = { chatId: string; customerImageUrls: string[]; markedImageUrl?: string };
type RewardWallet = { freeDeliveryCredits?: number; history?: any[]; [key: string]: any };

function safeHttpsUrl(value: unknown) { try { const url = new URL(String(value || '').trim()); return url.protocol === 'https:' ? url.toString().slice(0, 1600) : ''; } catch { return ''; } }
function cleanSalarOrderContext(value: unknown): SalarOrderContext | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (source.source !== 'salar') return null;
  const chatId = String(source.chatId || '').trim();
  if (!/^[A-Za-z0-9_-]{12,80}$/.test(chatId)) return null;
  const customerImageUrls = Array.isArray(source.customerImageUrls)
    ? [...new Set(source.customerImageUrls.map(safeHttpsUrl).filter(Boolean))].slice(0, 12)
    : [];
  const markedImageUrl = safeHttpsUrl(source.markedImageUrl);
  return { chatId, customerImageUrls, ...(markedImageUrl ? { markedImageUrl } : {}) };
}

function pakistanWeekday(): Weekday { const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase(); return (WEEKDAYS.includes(day as Weekday) ? day : 'sunday') as Weekday; }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function cleanGuestId(value: unknown) { const id = String(value || '').trim(); return /^g_[a-zA-Z0-9]{12,80}$/.test(id) ? id : ''; }
function trustedMarkedImages(input: IncomingItem, productId: string) {
  if (!Array.isArray(input.markedImages)) return [];
  const photos: Array<{ originalUrl: string; markedUrl: string }> = [];
  const unique = new Set<string>();
  for (const row of input.markedImages.slice(0, 12)) {
    const markedUrl = String(row?.markedUrl || '').trim();
    const originalUrl = String(row?.originalUrl || '').trim();
    try {
      const marked = new URL(markedUrl), original = new URL(originalUrl);
      const prefix = `/products/customer-marks/${productId}/`;
      if (marked.protocol !== 'https:' || marked.hostname !== 'images.primehubmall.com' ||
          marked.username || marked.password || marked.port || marked.search || marked.hash ||
          !marked.pathname.startsWith(prefix) ||
          !/^[0-9a-f-]{36}\.webp$/.test(marked.pathname.slice(prefix.length)) ||
          original.protocol !== 'https:' ||
          !['images.primehubmall.com', 'i.ibb.co'].includes(original.hostname) ||
          unique.has(markedUrl)) continue;
      photos.push({ originalUrl, markedUrl });
      unique.add(markedUrl);
    } catch {}
  }
  return photos;
}
function variantValue(row: any, key: 'color' | 'size') { const direct = row?.[key] ?? row?.[`variant${key[0].toUpperCase()}${key.slice(1)}`]; if (typeof direct === 'string' || typeof direct === 'number') return String(direct).trim().toLowerCase(); if (row?.options && typeof row.options === 'object') { const value = row.options[key]; if (typeof value === 'string' || typeof value === 'number') return String(value).trim().toLowerCase(); } return ''; }
function findVariant(product: any, item: IncomingItem) { const rows = [...(Array.isArray(product.variantMatrix) ? product.variantMatrix : []), ...(Array.isArray(product.variants) ? product.variants : [])]; if (!rows.length) return null; const variant = item.variant || {}; const wantedColor = variant.color ? String(variant.color).trim().toLowerCase() : ''; const wantedSize = variant.size ? String(variant.size).trim().toLowerCase() : ''; return rows.find((row: any) => (!wantedColor || variantValue(row, 'color') === wantedColor) && (!wantedSize || variantValue(row, 'size') === wantedSize)) || rows[0]; }

async function buildAuthoritativeItems(items: IncomingItem[]) {
  const currentDay = pakistanWeekday();
  const uniqueIds = [...new Set(items.map(item => String(item.productId || item.id || '')).filter(Boolean))];
  if (!uniqueIds.length) throw new Error('Cart does not contain valid product IDs.');

  const [settingsResult, productResults] = await Promise.all([
    getDualStorefrontSettings({ cache: 'no-store', timeoutMs: 5000 }),
    Promise.all(uniqueIds.map(id => getDualProduct(id, { cache: 'no-store', timeoutMs: 5000 }))),
  ]);
  const settings = settingsResult.documents.main || {};
  const weeklyDeals = Array.isArray(settings.weeklyDeals) ? settings.weeklyDeals : [];
  const liveDeal = weeklyDeals.find((deal: any) => deal?.day === currentDay && deal?.active !== false && typeof deal?.productId === 'string' && numberValue(deal?.dealPrice) > 0);
  // Live Big Deal is now administered under main.bigDeal. dailyDeal is a
  // legacy alias used by older homepage code, not the canonical source.
  // Price and discount eligibility MUST use the same dedicated rotation.
  const big = settings.bigDeal && typeof settings.bigDeal === 'object'
    ? settings.bigDeal : settings.dailyDeal;
  const now = Date.now();
  const bigStarts = big?.startAt ? new Date(big.startAt).getTime() : 0;
  const bigEnds = big?.endAt ? new Date(big.endAt).getTime() : 0;
  const bigActive = big?.active === true &&
    (!bigStarts || Number.isNaN(bigStarts) || now >= bigStarts) &&
    (!bigEnds || Number.isNaN(bigEnds) || now < bigEnds);
  const bigSlot = bigActive ? bigDealRotationIndex(big.rotationStartedAt, new Date(now), bigDealConfiguredSlotCount(big)) : -1;
  const bigProductId = bigActive ? String(big.productIds?.[bigSlot] || big.productId || '') : '';
  const bigPrice = bigActive ? numberValue(big.dealPrices?.[bigSlot] ?? big.dealPrice ?? 0) : 0;
  const products = new Map(productResults.filter(result => result.product).map(result => [String(result.product!.id), result.product]));

  const pricedItems = items.map(item => {
    const productId = String(item.productId || item.id || '');
    const product: any = products.get(productId);
    if (!product) throw new Error(`Product ${productId} is no longer available.`);
    const variant: any = findVariant(product, item);
    const rawStock = variant?.stock ?? product.stock ?? product.quantity;
    const stockProvided = rawStock !== undefined && rawStock !== null && rawStock !== '';
    if (stockProvided && numberValue(rawStock) <= 0) throw new Error(`${product.title || product.name || 'This product'} is currently unavailable.`);
    const regularPrice = numberValue(product.price);
    const liveDealPrice = liveDeal?.productId === productId ? numberValue(liveDeal.dealPrice) : 0;
    const isLiveDealItem = liveDealPrice > 0 && liveDeal?.productId === productId;
    const isBigDealItem = bigProductId === productId && bigPrice > 0;
    // Exclude active labelled deals even when product.price is already reduced.
    // Do not charge above the published base price on a scheduled offer.
    const price = isLiveDealItem ? Math.min(liveDealPrice, regularPrice) :
      isBigDealItem ? Math.min(bigPrice, regularPrice) :
      (variant && numberValue(variant.price) > 0 ? numberValue(variant.price) : regularPrice);
    if (price <= 0) throw new Error('Product price is not available.');
    const quantity = Math.max(1, Math.min(50, Math.floor(numberValue(item.quantity ?? item.qty ?? 1))));
    const markedImages = trustedMarkedImages(item, productId);
    return { productId, title: String(product.title || product.name || item.title || item.name || 'Product'), price, originalPrice: numberValue(product.originalPrice) > regularPrice ? numberValue(product.originalPrice) : regularPrice, quantity, image: String(markedImages[0]?.markedUrl || variant?.imageUrl || product.imageUrl || product.image || item.imageUrl || item.image || ''), ...(markedImages.length ? { markedImages } : {}), variant: item.variant || null, weeklyDealDay: isLiveDealItem ? currentDay : null,
      rewardExcluded: isLiveDealItem || isBigDealItem,
      dealCategory: isLiveDealItem ? 'weekly' : isBigDealItem ? 'big' : '',
      isWholesale: isWholesaleProduct(product), category: product.category || '', categoryId: product.categoryId || '' };
  });
  return { items: pricedItems, settings };
}

async function decodedUser(request: Request) { const header = request.headers.get('authorization') || ''; if (!header.startsWith('Bearer ')) return null; try { return await getAdminAuth().verifyIdToken(header.slice(7)); } catch { return null; } }
function sbCfg() { return { url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''), key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '') }; }

async function readSupabaseResellerProfile(uid: string) {
  const { url, key } = sbCfg();
  if (!url || !key) throw new Error('Supabase reseller read is not configured.');
  const response = await fetch(`${url}/rest/v1/reseller_profiles?user_id=eq.${encodeURIComponent(uid)}&select=user_id,status,tier_id,monthly_orders,payload&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Supabase reseller read failed ${response.status}`);
  const rows = await response.json() as any[];
  const row = rows?.[0];
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    ...payload,
    status: payload.status ?? row.status,
    tierId: payload.tierId ?? row.tier_id,
    monthlyOrders: payload.monthlyOrders ?? row.monthly_orders,
  };
}

async function optionalReseller(request: Request, settings: Record<string, any>) {
  const decoded = await decodedUser(request); if (!decoded) return null;
  let data: any = null;
  let shouldTryFirebase = true;
  if (isSupabaseWriteConfigured()) {
    try {
      data = await readSupabaseResellerProfile(decoded.uid);
      shouldTryFirebase = false;
    } catch (error) {
      console.warn('Supabase reseller read failed; Firebase emergency fallback allowed.', error instanceof Error ? error.message : 'unknown');
    }
  }
  if (shouldTryFirebase) {
    try {
      const profile = await getAdminDb().collection('reseller_profiles').doc(decoded.uid).get();
      data = profile.exists ? profile.data() || {} : null;
    } catch (error) {
      console.warn('Firebase reseller fallback failed.', error instanceof Error ? error.message : 'unknown');
      data = null;
    }
  }
  if (!data || data.status !== 'active') return null;

  const configured = Array.isArray(settings.resellerTiers) ? settings.resellerTiers : [];
  if (configured.length !== 4) throw new Error('Cashback tier settings are temporarily unavailable; please retry checkout.');
  const tiers = configured;
  const monthlyOrders = Math.max(0, Number(data.monthlyOrders || 0));
  const tier = [...tiers].sort((a:any,b:any)=>Number(b.minMonthlyOrders)-Number(a.minMonthlyOrders)).find((item:any)=>monthlyOrders>=Number(item.minMonthlyOrders)) || tiers[0];
  return { userId: decoded.uid, tierId: String(tier.id || 'starter'), tierName: String(tier.name || 'Starter'), discountPercent: Math.min(100, Math.max(0, Number(tier.discountPercent || 0))) };
}

async function readRewardWallet(uid: string): Promise<RewardWallet> {
  if (isSupabaseWriteConfigured()) {
    try { const { url, key } = sbCfg(); const r = await fetch(`${url}/rest/v1/user_rewards?id=eq.${encodeURIComponent(uid)}&select=payload&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }); if (r.ok) { const rows = await r.json(); return rows?.[0]?.payload || {}; } } catch {}
  }
  try { const snap = await getAdminDb().collection('user_rewards').doc(uid).get(); return snap.data() || {}; } catch { return {}; }
}

async function writeRewardWallet(uid: string, wallet: RewardWallet) {
  if (isSupabaseWriteConfigured()) {
    const { url, key } = sbCfg();
    const r = await fetch(`${url}/rest/v1/user_rewards?on_conflict=id`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: uid, user_id: uid, payload: wallet, authoritative_source: 'supabase', mirror_status: 'synced', mirror_error: null, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) throw new Error('Unable to consume Free Delivery reward.');
    try { await getAdminDb().collection('user_rewards').doc(uid).set({ ...wallet, updatedAt: new Date() }, { merge: true }); } catch (error) { console.warn('Reward Firebase mirror skipped after Supabase success.', error instanceof Error ? error.message : 'unknown'); }
    return;
  }
  await getAdminDb().collection('user_rewards').doc(uid).set({ ...wallet, updatedAt: new Date() }, { merge: true });
}

function publicOrderError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to place order.';
  if (/RESOURCE_EXHAUSTED|quota exceeded|firestore|supabase .*failed|JWT|credentials are not configured/i.test(message)) {
    return 'Order service is temporarily busy. Please try again.';
  }
  return message;
}

export async function POST(request: Request) {
  try {
    const body = await request.json(); const rawItems = Array.isArray(body?.items) ? body.items as IncomingItem[] : []; const quoteOnly = body?.mode === 'quote'; const selfCollect = body?.selfCollect === true; const useShoppingCredit = body?.useShoppingCredit === true;
    if (!rawItems.length || rawItems.length > 50) return NextResponse.json({ error: 'Your cart is empty or contains too many items.' }, { status: 400 });
    const { items, settings } = await buildAuthoritativeItems(rawItems);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const rawSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const [reseller, user] = await Promise.all([optionalReseller(request, settings), decodedUser(request)]);
    const eligibleSubtotal = orderEligibleSubtotal(items, settings);
    const submittedVoucher = String(body?.voucherCode || '').trim();
    // Friend codes are assigned by the server, not editable Admin coupon rows.
    // They benefit the OTHER member whose code was used, not the buyer.
    if (referralCode(submittedVoucher) && !reseller?.userId) {
      throw new Error('Sign in to your active Prime Family account to use a friend code.');
    }
    const voucher = submittedVoucher
      ? (referralCode(submittedVoucher)
          ? await resolveMemberReferralCode(submittedVoucher, user?.uid || '', eligibleSubtotal)
          : resolveCheckoutVoucher(await listCheckoutVouchers(), submittedVoucher, eligibleSubtotal))
      : null;
    if (voucher?.kind === 'cash' || voucher?.kind === 'cashback') {
      if (!user || !reseller?.userId) {
        throw new Error('Sign in to your active Prime Family account to use cashback vouchers.');
      }
      const claimId = createHash('sha256').update(user.uid + ':' + voucher.code).digest('hex');
      const prior = await getAdminDb().collection('reseller_voucher_claims').doc(claimId).get();
      if (prior.exists) throw new Error('This cash voucher was already used by your account.');
    }
    const voucherDiscount = voucher?.kind === 'discount' ? voucher.amount : 0;
    const exclusiveVoucherReward = voucher?.kind === 'cash' || voucher?.kind === 'cashback';
    const voucherCashAmount = exclusiveVoucherReward ? voucher.amount : 0;
    const voucherCashbackPercent = voucher?.kind === 'cashback' ? Number(voucher.percent || 0) : 0;
    const referralPercent = voucher?.kind === 'referral' ? Number(voucher.percent || 0) : 0;
    const referralCashEstimate = voucher?.kind === 'referral' ? Number(voucher.referrerEarns || 0) : 0;
    const eligibleAfterVoucher = Math.max(0, eligibleSubtotal - voucherDiscount);
    // Discount at checkout has been replaced by CASHBACK only after Admin delivery.
    const tierDiscountPercent = 0, tierDiscount = 0;
    // Share only public Admin tier labels / thresholds with the cart UI.
    // Neither tier selection nor credit amount is ever trusted from the browser.
    const cashbackTiers = Array.isArray(settings.resellerTiers) && settings.resellerTiers.length === 4
      ? settings.resellerTiers.map((tier: any) => ({
          id: String(tier.id || ''),
          name: String(tier.name || '').slice(0, 30),
          minMonthlyOrders: Math.max(0, Number(tier.minMonthlyOrders || 0)),
          cashbackPercent: Math.min(100, Math.max(0, Number(tier.discountPercent || 0))),
        })).sort((a: any, b: any) => a.minMonthlyOrders - b.minMonthlyOrders)
      : [];
    // Any verified voucher replaces the tier benefit: either immediate
    // checkout discount OR one post-delivery cash reward, never both.
    const tierCashbackPercent = reseller?.discountPercent || 0;
    const cashbackPercent = voucher ? 0 : tierCashbackPercent;
    const cashbackEstimate = cashbackPercent > 0 ? cashBackForTier(eligibleAfterVoucher, cashbackPercent) : 0;
    const subtotal = Math.max(0, rawSubtotal - voucherDiscount);
    const calculatedDelivery = selfCollect ? { baseDelivery: 0, wholesaleItems: 0, wholesaleSurcharge: 0, deliveryCharge: 0 } : calculateDeliveryCharge(items);
    // Free delivery at five items (or self-collect) must not consume a Spin
    // reward credit unnecessarily. The server decides from verified quantities.
    const rewardWallet = user && calculatedDelivery.deliveryCharge > 0 && body?.mode !== 'whatsapp_intent'
      ? await readRewardWallet(user.uid) : {};
    const freeDeliveryReward = !selfCollect && calculatedDelivery.deliveryCharge > 0 && Number(rewardWallet.freeDeliveryCredits || 0) > 0;
    const delivery = freeDeliveryReward ? { ...calculatedDelivery, deliveryCharge: 0 } : calculatedDelivery;
    const total = subtotal + delivery.deliveryCharge;
    // A regular cart quote/order must NEVER read Firebase wallet collections.
    // For an elected wallet quote only, show a fresh estimate. For placement the
    // Firestore order+debit transaction obtains the authoritative balance once.
    if (useShoppingCredit && !user) throw new Error('Sign in to your reseller account to use shopping credit.');
    const walletShoppingBalance = (quoteOnly && useShoppingCredit && user)
      ? await shoppingWalletBalance(user.uid) : 0;
    const walletShoppingApplied = quoteOnly && useShoppingCredit ? Math.min(walletShoppingBalance, eligibleAfterVoucher) : 0;
    const amountDue = total - walletShoppingApplied;
    const quote = { items, rawSubtotal, tierDiscount, tierDiscountPercent, resellerTier: reseller?.tierName || '',
      eligibleSubtotal, eligibleAfterVoucher, voucherCode: voucher?.code || '', voucherId: voucher?.id || '',
      voucherKind: voucher?.kind || '', voucherDiscount, voucherCashAmount, voucherCashbackPercent,
      referralPercent, referralCashEstimate,
      voucherRewardMode: voucher ? 'exclusive_v1' : '',
      tierCashbackPercent, cashbackPercent, cashbackEstimate, cashbackPolicy: 'delivered_only_v1',
      ...(quoteOnly ? { cashbackMemberActive: Boolean(reseller?.userId), cashbackTiers } : {}),
      subtotal, totalItems, ...delivery, total, selfCollect, fulfillment: selfCollect ? 'self_collect' : 'delivery',
      freeDeliveryReward, rewardLabel: freeDeliveryReward ? 'Spin & Win Reward — Free Delivery' : '',
      walletShoppingBalance, walletShoppingApplied, amountDue };
    if (quoteOnly) return NextResponse.json(quote);

    // A WhatsApp handoff is NOT a placed order. Record complete, server-verified
    // customer/items/prices in a separate review queue before opening WhatsApp.
    // Only the admin can promote it to a real order after checking the message.
    if (body?.mode === 'whatsapp_intent') {
      const customer = body?.customer as Customer | undefined;
      if (!customer?.name?.trim() || !customer?.phone?.trim()) {
        return NextResponse.json({ error: 'Customer name and phone are required for WhatsApp.' }, { status: 400 });
      }
      const proposedId = String(body?.orderRequestId || '');
      const intentId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(proposedId) ? proposedId : crypto.randomUUID();
      const ref = getAdminDb().collection('whatsapp_order_intents').doc(intentId);
      const row = {
        id: intentId, source: 'whatsapp', whatsappState: 'awaiting_message',
        status: 'awaiting_confirmation', isRealOrder: false,
        customer: {
          name: customer.name.trim().slice(0, 120),
          phone: customer.phone.trim().slice(0, 40),
          email: String(customer.email || '').trim().slice(0, 140),
          city: String(customer.city || '').trim().slice(0, 120),
          address: selfCollect ? 'PrimeHub Shop Pickup' : String(customer.address || '').trim().slice(0, 500),
          notes: String(customer.notes || '').trim().slice(0, 1000),
        },
        ...quote, walletShoppingBalance: 0, walletShoppingApplied: 0, amountDue: total,
        ...(reseller?.userId ? { resellerUserId: reseller.userId } : {}),
        guestId: cleanGuestId(body?.guestId), createdAt: new Date().toISOString(),
      };
      try {
        await ref.create(row);
      } catch (error) {
        const existing = await ref.get();
        const previous = existing.data();
        if (!existing.exists || previous?.customer?.phone !== row.customer.phone ||
            previous?.status !== 'awaiting_confirmation' ||
            Number(previous.total) !== total ||
            JSON.stringify(previous.items || []) !== JSON.stringify(quote.items)) throw error;
      }
      return NextResponse.json({ ...quote, requestId: intentId, whatsappState: 'awaiting_message',
        notice: 'WhatsApp order request saved for admin review, not confirmed until the customer sends the message.' });
    }

    const customer = body?.customer as Customer | undefined;
    if (!customer?.name?.trim() || !customer?.phone?.trim() || (!selfCollect && (!customer?.address?.trim() || !customer?.city?.trim()))) return NextResponse.json({ error: selfCollect ? 'Name and phone are required.' : 'Name, phone, address and city are required.' }, { status: 400 });

    const resellerUserId = reseller?.userId || '';
    const resellerGuestId = cleanGuestId(body?.guestId);
    const shouldUseWallet = useShoppingCredit && eligibleAfterVoucher > 0 && total > 0;
    const orderId = shouldUseWallet ? String(body?.orderRequestId || '') : crypto.randomUUID();
    const salar = cleanSalarOrderContext(body?.orderContext);
    const orderData: any = { customer: { name: customer.name.trim(), phone: customer.phone.trim(), email: String(customer.email || '').trim(), address: selfCollect ? 'PrimeHub Shop Pickup' : customer.address.trim(), city: selfCollect ? 'Lahore' : customer.city.trim(), notes: String(customer.notes || '').trim() }, ...quote, ...(voucher?.kind === 'referral' ? { referralOwnerUid: voucher.ownerUid } : {}), idempotencyKey: `${salar ? 'salar' : 'website'}-order:${orderId}`, currency: 'PKR', status: 'pending', source: salar ? 'salar' : 'website', ...(salar ? { salar } : {}), createdAt: new Date() };
    if (resellerUserId) orderData.resellerUserId = resellerUserId;
    if (resellerGuestId) orderData.resellerGuestId = resellerGuestId;

    if (shouldUseWallet && user) {
      // Atomic source of truth: order + eligible-only debit + append-only spend are one Firestore commit.
      const saved = await createShoppingWalletOrder(user.uid, orderId, { ...orderData, resellerUserId: user.uid });
      if (isSupabaseWriteConfigured()) {
        const row = { ...mapOrderToSupabase(orderId, saved.order), authoritative_source: 'firebase', mirror_status: 'synced', mirror_error: null };
        try {
          await supabasePrimaryUpsert({ table: 'orders', row });
        } catch (syncError) {
          // Do not reject a successfully paid Firebase order: the user must never pay twice.
          console.error('Shopping wallet order Supabase mirror unavailable:', syncError);
          try { await recordMirrorFailure('orders', orderId, 'upsert', row); } catch (queueError) { console.error('Shopping wallet order retry queue unavailable:', queueError); }
        }
      }
      if (user && freeDeliveryReward && saved.created) {
        try {
          const current = await readRewardWallet(user.uid);
          const credits = Math.max(0, Number(current.freeDeliveryCredits || 0));
          if (credits > 0) {
            const history = [...(Array.isArray(current.history) ? current.history : []), { id: `free-delivery:${orderId}`, action: 'use', name: 'Spin & Win Reward — Free Delivery', type: 'free-delivery', status: 'used', orderId, createdAt: new Date().toISOString() }].slice(-100);
            await writeRewardWallet(user.uid, { ...current, freeDeliveryCredits: credits - 1, history });
          }
        } catch (rewardError) { console.error('Free delivery reward on wallet order needs reconciliation:', rewardError); }
      }
      // Keep normal purchase-reminder suppression for customers paying with shopping credit.
      if (saved.created) {
        try {
          await getAdminDb().collection('push_user_purchases').doc(user.uid + '_' + pakistanDay(new Date()))
            .set({ purchasedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 90 * 86_400_000) }, { merge: true });
        } catch { console.warn('[push] wallet purchase suppression marker unavailable'); }
      }
      return NextResponse.json({ orderId, ...saved.order, walletShoppingApplied: saved.amount, amountDue: saved.amountDue, resellerLinked: true, guestTracked: Boolean(resellerGuestId) });
    }

    const supabaseRow = mapOrderToSupabase(orderId, orderData);
    if (isSupabaseWriteConfigured()) {
      const primaryRow = { ...supabaseRow, authoritative_source: 'supabase', mirror_status: 'synced', mirror_error: null, firebase_mirrored_at: null };
      await supabasePrimaryUpsert({ table: 'orders', row: primaryRow });
      try {
        await getAdminDb().collection('orders').doc(orderId).set(orderData);
      } catch (error) {
        console.warn('Order Firebase mirror skipped after Supabase primary success.', error instanceof Error ? error.message : 'unknown');
        try {
          await recordMirrorFailure('orders', orderId, 'upsert', orderData, 'firebase');
        } catch (outboxError) {
          console.error('Order Firebase mirror retry could not be queued.', outboxError instanceof Error ? outboxError.message : 'unknown');
        }
      }
    } else {
      await getAdminDb().collection('orders').doc(orderId).set(orderData);
      const mirror = await mirrorSupabaseUpsert({ table: 'orders', row: supabaseRow });
      if (mirror.attempted && !mirror.ok) {
        console.error('Order Supabase mirror failed:', mirror.error);
        await recordMirrorFailure('orders', orderId, 'upsert', supabaseRow);
      }
    }

    if (user && freeDeliveryReward) {
      const current = await readRewardWallet(user.uid); const credits = Math.max(0, Number(current.freeDeliveryCredits || 0));
      if (credits > 0) { const history = [...(Array.isArray(current.history) ? current.history : []), { id: `free-delivery:${orderId}`, action: 'use', name: 'Spin & Win Reward — Free Delivery', type: 'free-delivery', status: 'used', orderId, createdAt: new Date().toISOString() }].slice(-100); await writeRewardWallet(user.uid, { ...current, freeDeliveryCredits: credits - 1, history }); }
    }

    // A successful signed-in order suppresses the same-day browse reminder on all linked installs.
    // Best effort only: a notification ledger failure must never fail checkout.
    if (user?.uid) {
      try {
        await getAdminDb().collection('push_user_purchases').doc(user.uid + '_' + pakistanDay(new Date()))
          .set({ purchasedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 90 * 86_400_000) }, { merge: true });
      } catch (error) { console.warn('[push] purchase suppression marker unavailable'); }
    }
    return NextResponse.json({ orderId, ...quote, resellerLinked: Boolean(resellerUserId), guestTracked: Boolean(resellerGuestId) });
  } catch (error) {
    console.error('Secure order creation failed:', error);
    return NextResponse.json({ error: publicOrderError(error) }, { status: 400 });
  }
}
