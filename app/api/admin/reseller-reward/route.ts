import { NextResponse } from 'next/server';
import { authorizedWalletAdmin } from '@/lib/walletAdminSession';

export const runtime = 'nodejs';

/** Manual "Confirm + Reward" is intentionally retired.
 * The only automatic payout path is Admin Orders -> Delivered, where a
 * transactional order ledger prevents duplicate cashback and voucher credits.
 */
export async function POST(request: Request) {
  if (!authorizedWalletAdmin(request)) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  }
  return NextResponse.json({
    error: 'Manual rewards are disabled. Mark the verified order Delivered in Admin Orders to issue cashback once.',
  }, { status: 409 });
}
