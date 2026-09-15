import { NextResponse } from 'next/server';
import { answerWithModelDrivenSalar, type SalarModelImageInput } from '@/lib/salar/modelDrivenEngine';
import { getSalarState } from '@/lib/salar/server';
import {
  appendSalarMessage,
  bootstrapSalarHistory,
  cleanChatId,
  createEmptySalarChat,
  getSalarChat,
  salarAiHistory,
  saveSalarChat,
  type SalarCustomerChat,
  type SalarStoredMention,
  type SalarStoredProduct,
} from '@/lib/salar/chatStore';
import { getSalarUiSettings } from '@/lib/salar/uiSettings';
import { compressForR2, isR2PublicUrl, r2ObjectKey, uploadWebpToR2 } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function cleanText(value: unknown, max = 2000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function finiteNumber(value: unknown) {
  if (value === '' || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeHttpsUrl(value: unknown) {
  const text = cleanText(value, 1600);
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function safeMention(value: unknown): SalarStoredMention | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const id = cleanText(source.id, 200);
  const title = cleanText(source.title, 300);
  if (!id || !title) return undefined;
  const imageUrl = safeHttpsUrl(source.imageUrl);
  return { id, title, ...(imageUrl ? { imageUrl } : {}) };
}

function safeReferences(value: unknown): SalarStoredProduct[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((item: any) => {
    const id = cleanText(item?.id, 200);
    const title = cleanText(item?.title, 300);
    if (!id || !title) return null;
    const imageUrl = safeHttpsUrl(item?.imageUrl);
    return Object.fromEntries(Object.entries({
      id,
      title,
      path: cleanText(item?.path, 500) || undefined,
      imageUrl: imageUrl || undefined,
      price: finiteNumber(item?.price),
      originalPrice: finiteNumber(item?.originalPrice),
      stock: finiteNumber(item?.stock),
      category: cleanText(item?.category, 220) || undefined,
    }).filter(([, field]) => field !== undefined && field !== '')) as unknown as SalarStoredProduct;
  }).filter(Boolean) as SalarStoredProduct[];
}

function parseJsonField(value: FormDataEntryValue | null, fallback: unknown) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function readRequest(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    const body = await request.json().catch(() => ({}));
    return {
      chatId: body?.chatId,
      message: body?.message,
      history: body?.history,
      context: body?.context,
      customerId: body?.customerId,
      customerName: body?.customerName,
      customerEmail: body?.customerEmail,
      mention: safeMention(body?.mention),
      references: safeReferences(body?.references),
      image: undefined as SalarModelImageInput | undefined,
      imageBuffer: undefined as Buffer | undefined,
      imageName: '',
    };
  }

  const form = await request.formData();
  const imageValue = form.get('image');
  let image: SalarModelImageInput | undefined;
  let imageBuffer: Buffer | undefined;
  let imageName = '';

  if (imageValue instanceof File && imageValue.size > 0) {
    if (!imageValue.type.startsWith('image/')) throw new Error('Only image files are supported.');
    if (imageValue.size > MAX_IMAGE_BYTES) throw new Error('Image is too large.');
    imageBuffer = Buffer.from(await imageValue.arrayBuffer());
    imageName = imageValue.name || 'customer-photo.jpg';
    image = {
      mimeType: imageValue.type || 'image/jpeg',
      base64: imageBuffer.toString('base64'),
    };
  }

  return {
    chatId: form.get('chatId'),
    message: form.get('message'),
    history: parseJsonField(form.get('history'), []),
    context: parseJsonField(form.get('context'), {}),
    customerId: form.get('customerId'),
    customerName: form.get('customerName'),
    customerEmail: form.get('customerEmail'),
    mention: safeMention(parseJsonField(form.get('mention'), null)),
    references: safeReferences(parseJsonField(form.get('references'), [])),
    image,
    imageBuffer,
    imageName,
  };
}

async function persistCustomerImage(buffer: Buffer | undefined, originalName: string) {
  if (!buffer?.length) return '';
  try {
    const compressed = await compressForR2(buffer);
    const url = await uploadWebpToR2(compressed, r2ObjectKey(`salar-customer-${Date.now()}-${originalName || 'image.webp'}`));
    return isR2PublicUrl(url) ? url : '';
  } catch (error) {
    console.warn('Salar customer image persistence failed', error instanceof Error ? error.message : 'unknown');
    return '';
  }
}

function publicChat(chat: SalarCustomerChat | null) {
  if (!chat) return null;
  return {
    id: chat.id,
    updatedAt: chat.updatedAt,
    salarPaused: chat.salarPaused,
    context: chat.context,
    messages: chat.messages,
  };
}

function updateCustomerMeta(chat: SalarCustomerChat, input: {
  customerId?: unknown;
  customerName?: unknown;
  customerEmail?: unknown;
}) {
  return {
    ...chat,
    customerId: cleanText(input.customerId, 200) || chat.customerId,
    customerName: cleanText(input.customerName, 120) || chat.customerName,
    customerEmail: cleanText(input.customerEmail, 240) || chat.customerEmail,
  } satisfies SalarCustomerChat;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const chatId = cleanChatId(url.searchParams.get('chatId'));
    const [state, ui, chat] = await Promise.all([
      getSalarState(),
      getSalarUiSettings(),
      chatId ? getSalarChat(chatId) : Promise.resolve(null),
    ]);
    return NextResponse.json({
      success: true,
      settings: { enabled: state.enabled, iconUrl: ui.iconUrl },
      chat: publicChat(chat),
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Salar public chat sync failed', error);
    return NextResponse.json({ success: false, error: 'Salar chat could not sync.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let chat: SalarCustomerChat | null = null;
  try {
    const input = await readRequest(request);
    const chatId = cleanChatId(input.chatId);
    if (!chatId) {
      return NextResponse.json({ success: false, error: 'Salar chat session is invalid.' }, { status: 400 });
    }

    const message = cleanText(input.message, 4000);
    if (!message && !input.image && !input.mention && !input.references.length) {
      return NextResponse.json({ success: false, error: 'Please enter a message or attach an image.' }, { status: 400 });
    }

    chat = await getSalarChat(chatId) || createEmptySalarChat(chatId, {
      customerId: input.customerId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      context: input.context,
    });
    chat = updateCustomerMeta(chat, input);
    chat = bootstrapSalarHistory(chat, input.history);

    const aiHistory = salarAiHistory(chat, 10);
    const imageUrl = await persistCustomerImage(input.imageBuffer, input.imageName);
    const referenceSummary = input.references.length
      ? input.references.map((product, index) => `${index + 1}. ${product.title} [product id: ${product.id}]`).join('\n')
      : '';
    const userContent = message || (input.references.length ? `${input.references.length} selected products` : input.mention ? 'Is product ke bare mein batain.' : '📷 Product photo');
    const aiMessage = input.references.length
      ? `${message || 'In selected products ke bare mein help karein.'}\n\n[Customer selected these exact products from the chat:\n${referenceSummary}\n]`
      : input.mention
        ? `${message || 'Is product ke bare mein details batain.'}\n\n[Customer is referring to this exact product from the chat: ${input.mention.title}; product id: ${input.mention.id}]`
        : message;

    chat = appendSalarMessage(chat, {
      role: 'user',
      actor: 'customer',
      content: userContent,
      ...(imageUrl ? { imageUrl } : {}),
      ...(input.mention ? { mention: input.mention } : {}),
      ...(input.references.length ? { products: input.references } : {}),
    });
    chat = await saveSalarChat(chat);

    if (chat.salarPaused) {
      return NextResponse.json({
        success: true,
        reply: '',
        displayMode: 'none',
        products: [],
        categories: [],
        context: chat.context,
        salarPaused: true,
        chat: publicChat(chat),
      }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }

    const exactProductIds = [input.mention?.id, ...input.references.map((product) => product.id)].filter(Boolean) as string[];
    const result = await answerWithModelDrivenSalar({
      message: aiMessage,
      history: aiHistory,
      context: chat.context,
      customerName: chat.customerName,
      exactProductIds,
      image: input.image,
    });

    chat = appendSalarMessage({ ...chat, context: result.context || chat.context }, {
      role: 'assistant',
      actor: 'salar',
      content: String(result.reply || ''),
      products: Array.isArray(result.products) ? result.products : [],
      categories: Array.isArray(result.categories) ? result.categories : [],
      displayMode: result.displayMode || 'none',
    });
    chat = await saveSalarChat(chat);

    return NextResponse.json({
      success: true,
      ...result,
      salarPaused: false,
      chat: publicChat(chat),
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Salar chat failed', error);
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Please enter a message or attach an image')) {
      return NextResponse.json({ success: false, error: 'Please enter a message or attach an image.' }, { status: 400 });
    }
    if (message.includes('Only image files')) {
      return NextResponse.json({ success: false, error: 'Please attach an image file.' }, { status: 400 });
    }
    if (message.includes('Image is too large')) {
      return NextResponse.json({ success: false, error: 'Image must be 3 MB or smaller.' }, { status: 413 });
    }
    if (message.includes('catalogue is not ready')) {
      return NextResponse.json({ success: false, error: 'Salar is getting ready. Please try again after the catalogue is updated.' }, { status: 503 });
    }
    if (message.includes('No Salar AI provider is configured')) {
      return NextResponse.json({ success: false, error: 'Salar AI providers are not configured in the existing environment.' }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: 'Salar could not respond right now. Please try again.' }, { status: 503 });
  }
}
