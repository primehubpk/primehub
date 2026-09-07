'use client';

const MAX_EDGE = 1280;
const WEBP_QUALITY = 0.72;

function webpName(name: string) {
  const stem = (name || 'salaar-image').replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'salaar-image';
  return `${stem}.webp`;
}

async function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
}

export async function compressSalaarImageBeforeUpload(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await canvasBlob(canvas);
    if (!blob?.size) return file;
    if (blob.size >= file.size && file.type === 'image/webp') return file;
    return new File([blob], webpName(file.name), { type: 'image/webp', lastModified: Date.now() });
  } catch {
    // Server-side Sharp compression remains the final safety net for unsupported browsers/formats.
    return file;
  }
}
