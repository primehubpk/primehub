import 'server-only';

// Browser-compatible ZIP (STORE) streaming: never holds the entire category archive in RAM.
// Images are already compressed, so deflating them again only wastes CPU.
type ZipEntry = { name: string; bytes: Uint8Array };
const enc = new TextEncoder();
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, i) => {
  let value = i;
  for (let j = 0; j < 8; j++) value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function frame(size: number) {
  const data = new Uint8Array(size);
  return { data, view: new DataView(data.buffer) };
}

export async function* zipStoredEntries(entries: AsyncIterable<ZipEntry>): AsyncGenerator<Uint8Array> {
  const central: Uint8Array[] = [];
  let offset = 0;
  let count = 0;
  for await (const entry of entries) {
    if (count >= 65535) throw new Error('Too many ZIP entries.');
    const name = enc.encode(entry.name.replace(/^\/+/, '').replace(/\.{2,}/g, '_'));
    if (!name.length || name.length > 65535) continue;
    const bytes = entry.bytes;
    if (bytes.length > 0xFFFFFFFF) throw new Error('Image is too large for a ZIP file.');
    const crc = crc32(bytes);
    const local = frame(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true); // UTF-8 entry names.
    local.view.setUint16(8, 0, true); // STORE original JPEG/PNG/WEBP without re-compression.
    local.view.setUint16(12, 0x0021, true); // 1980-01-01
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, bytes.length, true);
    local.view.setUint32(22, bytes.length, true);
    local.view.setUint16(26, name.length, true);

    const index = frame(46 + name.length);
    index.view.setUint32(0, 0x02014b50, true);
    index.view.setUint16(4, 20, true);
    index.view.setUint16(6, 20, true);
    index.view.setUint16(8, 0x0800, true);
    index.view.setUint16(10, 0, true);
    index.view.setUint16(14, 0x0021, true);
    index.view.setUint32(16, crc, true);
    index.view.setUint32(20, bytes.length, true);
    index.view.setUint32(24, bytes.length, true);
    index.view.setUint16(28, name.length, true);
    index.view.setUint32(42, offset, true);
    index.data.set(name, 46);
    central.push(index.data);
    count++;
    offset += local.data.length + name.length + bytes.length;
    yield local.data;
    yield name;
    yield bytes;
  }
  const centralStart = offset;
  for (const part of central) {
    offset += part.length;
    yield part;
  }
  const end = frame(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, count, true);
  end.view.setUint16(10, count, true);
  end.view.setUint32(12, offset - centralStart, true);
  end.view.setUint32(16, centralStart, true);
  yield end.data;
}

export function zipReadableStream(entries: AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
  const iterator = zipStoredEntries(entries);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) { controller.error(error); }
    },
    async cancel() { await iterator.return(undefined); },
  }, { highWaterMark: 1 });
}
