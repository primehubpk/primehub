import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RewardRules = {
  pointsPerProduct: number;
  redemptionRatio: string;
};

const FALLBACK_REWARD_RULES: RewardRules = {
  pointsPerProduct: 100,
  redemptionRatio: '100 points = Rs. 100',
};

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key.' } },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: Request) {
  const configuredApiKey = process.env.PRIMEHUB_API_KEY;
  const suppliedApiKey = request.headers.get('x-api-key');

  if (!configuredApiKey || !suppliedApiKey || suppliedApiKey !== configuredApiKey) {
    return unauthorized();
  }

  try {
    const db = getAdminDb();
    const [categorySnapshot, settingsSnapshot] = await Promise.all([
      db.collection('categories').get(),
      db.collection('settings').doc('main').get(),
    ]);

    const settings = settingsSnapshot.exists ? settingsSnapshot.data() || {} : {};
    const categories = categorySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as { id: string; title?: string; active?: boolean; sortOrder?: number })
      .filter((category) => category.active !== false && typeof category.title === 'string' && category.title.trim())
      .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || String(a.title).localeCompare(String(b.title)))
      .map((category) => category.title!.trim());

    const configuredBuckets = Array.isArray(settings.priceBuckets) ? settings.priceBuckets : [];
    const priceBuckets = configuredBuckets
      .filter((bucket: any) => bucket?.active !== false)
      .sort((a: any, b: any) => Number(a?.sortOrder ?? 999) - Number(b?.sortOrder ?? 999))
      .map((bucket: any) => ({
        id: String(bucket.id || bucket.title || 'bucket'),
        label: String(bucket.title || bucket.label || ''),
        ...(Number.isFinite(Number(bucket.amount)) ? { maxPrice: Number(bucket.amount) } : {}),
        ...(bucket.type ? { type: String(bucket.type) } : {}),
      }));

    const weeklyDeals = Array.isArray(settings.weeklyDeals) ? settings.weeklyDeals : [];
    const dailyDeals = weeklyDeals
      .filter((deal: any) => deal?.active !== false && typeof deal?.label === 'string' && deal.label.trim())
      .sort((a: any, b: any) => String(a.day || '').localeCompare(String(b.day || '')))
      .map((deal: any) => deal.label.trim());
    if (settings.dailyDeal?.active && typeof settings.dailyDeal.title === 'string' && settings.dailyDeal.title.trim()) {
      dailyDeals.push(settings.dailyDeal.title.trim());
    }

    const configuredRewardRules = settings.rewardRules as Partial<RewardRules> | undefined;
    const rewardRules: RewardRules = {
      pointsPerProduct: Number(configuredRewardRules?.pointsPerProduct ?? FALLBACK_REWARD_RULES.pointsPerProduct),
      redemptionRatio: String(configuredRewardRules?.redemptionRatio ?? FALLBACK_REWARD_RULES.redemptionRatio),
    };

    return NextResponse.json(
      {
        success: true,
        storeName: String(settings.storeName || 'PrimeHub'),
        categories,
        priceBuckets,
        dailyDeals,
        standardBangleSizes: ['2.4', '2.6', '2.8', '2.10', 'Free Size'],
        rewardRules,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
      },
    );
  } catch (error) {
    console.error('store metadata failed', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Store metadata could not be loaded.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
