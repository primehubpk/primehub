import 'server-only';
import { parseKeys } from '@/lib/salar/keyRotator';

type VisionResult = { ok: true; text: string } | { ok: false };

function shouldRotate(status: number, payload: string) {
  return [401, 403, 429].includes(status) || /quota|billing|resource[_\s-]?exhausted|rate[_\s-]?limit|too many requests|api.?key|unauthorized|forbidden|authentication/i.test(payload);
}

async function fetchImageAsBase64(imageUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(imageUrl, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    const mimeType = String(response.headers.get('content-type') || 'image/webp').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp)$/i.test(mimeType)) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) return null;
    return { mimeType, data: buffer.toString('base64') };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function geminiVision(key: string, model: string, prompt: string, mimeType: string, data: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 500 },
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      if (shouldRotate(response.status, text)) return null;
      return null;
    }
    let json: any = null;
    try { json = JSON.parse(text); } catch { return null; }
    const parts = json?.candidates?.[0]?.content?.parts;
    const value = Array.isArray(parts) ? parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim() : '';
    return value || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function groqVisionCapable(model: string) {
  return /vision|llava|scout|maverick|\bvl\b/i.test(model);
}

async function groqVision(key: string, model: string, prompt: string, imageUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 500,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageUrl } }] }],
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      if (shouldRotate(response.status, text)) return null;
      return null;
    }
    let json: any = null;
    try { json = JSON.parse(text); } catch { return null; }
    const value = json?.choices?.[0]?.message?.content;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function visionCompletion({ imageUrl, prompt }: { imageUrl: string; prompt: string }): Promise<VisionResult> {
  const image = await fetchImageAsBase64(imageUrl);
  if (!image) return { ok: false };

  const geminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  for (const key of parseKeys(process.env.GEMINI_API_KEYS)) {
    const text = await geminiVision(key, geminiModel, prompt, image.mimeType, image.data);
    if (text) return { ok: true, text };
  }

  const groqModel = process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';
  if (groqVisionCapable(groqModel)) {
    for (const key of parseKeys(process.env.GROQ_API_KEYS)) {
      const text = await groqVision(key, groqModel, prompt, imageUrl);
      if (text) return { ok: true, text };
    }
  }

  return { ok: false };
}
