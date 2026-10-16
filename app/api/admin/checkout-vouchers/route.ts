import { NextResponse } from 'next/server';
import { authorizedWalletAdmin } from '@/lib/walletAdminSession';
import { cleanVoucher, listCheckoutVouchers, saveCheckoutVouchers } from '@/lib/checkoutVouchersServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function admin(request: Request) {
  return authorizedWalletAdmin(request);
}

export async function GET(request: Request) {
  if (!admin(request)) return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  try { return NextResponse.json({ vouchers: await listCheckoutVouchers() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Voucher settings are temporarily unavailable.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!admin(request)) return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  try {
    const body = await request.json();
    if (!Array.isArray(body.vouchers) || body.vouchers.length > 100) {
      return NextResponse.json({ error: 'Invalid voucher list.' }, { status: 400 });
    }
    const clean = body.vouchers.map(cleanVoucher);
    if (clean.some((v: unknown) => v === null)) {
      return NextResponse.json({ error: 'Voucher codes must be 4-24 characters, amounts Rs 1-100000, and a wallet choice must be set.' }, { status: 400 });
    }
    await saveCheckoutVouchers(clean);
    return NextResponse.json({ success: true, vouchers: clean });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Voucher save failed.' }, { status: 503 });
  }
}
