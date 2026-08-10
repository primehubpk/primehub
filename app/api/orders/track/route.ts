import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// ==================== FORCE DYNAMIC ROUTE FOR BUILD ====================
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone') || searchParams.get('q') || '';

    if (!phone) {
      return NextResponse.json({ orders: [] }, { status: 200 });
    }

    const q = query(
      collection(db, 'orders'),
      where('customer.phone', '==', phone.trim())
    );

    const snap = await getDocs(q);
    const orders = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    console.error('Error tracking order:', error);
    return NextResponse.json({ orders: [], error: 'Failed to track order' }, { status: 500 });
  }
}
