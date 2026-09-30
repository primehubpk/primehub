import 'server-only';

const MAX_BYTES = 3_500_000;

export function isUploadedPostingVideo(url: URL) {
  return url.protocol === 'https:' && url.hostname === 'images.primehubmall.com' && !url.port && !url.username && !url.password && /^\/tiktok-sandbox\/[\w-]+\.mp4$/.test(url.pathname);
}

export async function readUploadedPostingVideo(url: URL): Promise<Uint8Array> {
  if (!isUploadedPostingVideo(url)) throw new Error('Choose a video uploaded through this posting form.');
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.body) throw new Error('The uploaded video could not be read.');
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Video exceeds the 3.5 MB upload limit.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Video exceeds the 3.5 MB upload limit.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = Buffer.concat(chunks);
  if (bytes.length < 1024 || bytes.subarray(4, 8).toString('ascii') !== 'ftyp') throw new Error('The uploaded file is not a valid MP4.');
  return new Uint8Array(bytes);
}

export async function transferPostingVideo(uploadUrl: string, bytes: Uint8Array) {
  const target = new URL(uploadUrl);
  if (target.protocol !== 'https:' || !target.hostname.endsWith('.tiktokapis.com') || target.port || target.username || target.password) throw new Error('TikTok returned an invalid upload destination.');
  const response = await fetch(target, {
    method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: {
      'Content-Type': 'video/mp4', 'Content-Length': String(bytes.byteLength),
      'Content-Range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
    }, body: bytes,
  });
  if (response.status !== 201) throw new Error(`TikTok file transfer failed (${response.status}).`);
}
