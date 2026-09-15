import { NextResponse } from 'next/server';
import { answerWithSalar } from '@/lib/salar/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await answerWithSalar({ message: body?.message, history: body?.history });
    return NextResponse.json({ success: true, ...result }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Salar chat failed', error);
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Please enter a message')) {
      return NextResponse.json({ success: false, error: 'Please enter a message.' }, { status: 400 });
    }
    if (message.includes('API key is not configured')) {
      return NextResponse.json({ success: false, error: 'Salar is not configured yet.' }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: 'Salar could not respond right now. Please try again.' }, { status: 503 });
  }
}
