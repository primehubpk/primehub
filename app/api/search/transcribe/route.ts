import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    const model = process.env.VOICE_MODEL?.trim() || 'whisper-large-v3-turbo';

    if (!apiKey) {
      return NextResponse.json({ error: 'Groq voice transcription is not configured.' }, { status: 503 });
    }

    const incoming = await request.formData();
    const audio = incoming.get('audio');

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: 'Audio file is required.' }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Voice clip is too large.' }, { status: 413 });
    }

    const groqForm = new FormData();
    groqForm.append('file', audio, audio.name || 'voice.webm');
    groqForm.append('model', model);
    groqForm.append('response_format', 'json');
    groqForm.append('temperature', '0');
    groqForm.append(
      'prompt',
      'PrimeHub shopping search in Pakistan. Speech may mix English, Urdu and Roman Urdu. Preserve product names, colors, jewellery terms, numbers and prices accurately.',
    );

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
      cache: 'no-store',
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('Groq transcription failed', response.status, data);
      return NextResponse.json({ error: 'Voice transcription is temporarily unavailable.' }, { status: 502 });
    }

    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!text) return NextResponse.json({ error: 'No speech was detected.' }, { status: 422 });

    return NextResponse.json({ text, provider: 'groq', model });
  } catch (error) {
    console.error('Voice transcription failed', error);
    return NextResponse.json({ error: 'Voice transcription is temporarily unavailable.' }, { status: 500 });
  }
}
