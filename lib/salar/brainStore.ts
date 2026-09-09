import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const SALAR_BRAIN_SEED = `You are Salar, a professionally trained salesman and host of PrimeHub Mall. You are responsible for helping every visitor with the website: shopping, collections, products, Reseller Club, Prime Skill, delivery, payment, and placing orders. Speak with pyaar, adab, and ehtram.

Voice: When a shopping need is clear, greet Assalamualaikum, I am Salar from PrimeHub Mall. Match Roman Urdu / Urdu / English. Short, warm. One question at a time when collecting details. Never invent stock, price, discount, delivery charges, or payment account numbers.

Website duty: Use tools for catalogue and knowledge. If tools return nothing, give phone 03238878009. Do not guess.

Sales method: (1) Understand need e.g. bangles. (2) List ALL collection names for that need (Glass, Metal, Deal Box, etc.). Ask which to show. (3) Show that collection’s products with photos. (4) If they mention a picture, answer from that product’s real size/material/price. (5) When ready: Rs 300 advance; we prepare complete order and share a video; remaining payment AFTER video. (6) Then name, city, contact, complete address; delivery charges from website. (7) Show summary and Place Order (WhatsApp). System also saves the order on the website if they do not tap.

Blocked users: show they are blocked; unblock request primehubpk1@gmail.com.

Tools: one Worker — catalogue, knowledge, vision, order. Never recite products from generic model memory.

New rules (admin appends below):`;

function serial(value: any): any {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') { try { return value.toDate().toISOString(); } catch { return null; } }
  return value;
}

export async function ensureBrainSeed() {
  const db = getAdminDb();
  const ref = db.collection('salar_brain_files').doc('brain-01');
  const snap = await ref.get();
  if (!snap.exists) {
    const now = new Date().toISOString();
    await ref.set({ id: 'brain-01', filename: 'brain-01.md', title: 'Professional Salesman Training', body: SALAR_BRAIN_SEED, updated_at: now, updated_by: 'primehubpk1@gmail.com', created_at: now });
  }
}

export async function listBrainFiles() {
  await ensureBrainSeed();
  const snap = await getAdminDb().collection('salar_brain_files').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), updated_at: serial(doc.data().updated_at) })).sort((a:any,b:any)=>String(a.filename).localeCompare(String(b.filename)));
}

export async function buildSalarBrainPrompt(maxChars = 100000) {
  const files: any[] = await listBrainFiles();
  const brain01 = files.find((file:any) => String(file.filename) === 'brain-01.md') || files[0];
  const selected: any[] = brain01 ? [brain01] : [];
  let used = brain01 ? String(brain01.body || '').length : 0;
  const newest = files.filter((file:any) => file !== brain01).sort((a:any,b:any) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  for (const file of newest) {
    const body = String(file.body || '');
    if (used + body.length > maxChars) continue;
    selected.push(file); used += body.length;
  }
  return selected.sort((a:any,b:any)=>String(a.filename).localeCompare(String(b.filename))).map((file:any)=>`# ${String(file.filename)}\n${String(file.body || '')}`).join('\n\n');
}

export async function createBrainFile() {
  await ensureBrainSeed();
  const files = await listBrainFiles();
  const nums = files.map((f:any)=>Number(String(f.filename||'').match(/brain-(\d+)\.md/)?.[1]||0));
  const next = Math.max(1, ...nums) + 1;
  const suffix = String(next).padStart(2,'0');
  const id = `brain-${suffix}`;
  const now = new Date().toISOString();
  const row = { id, filename: `${id}.md`, title: `Brain ${suffix}`, body: '', updated_at: now, updated_by: 'primehubpk1@gmail.com', created_at: now };
  await getAdminDb().collection('salar_brain_files').doc(id).set(row);
  return row;
}

export async function saveBrainFile(id: string, input: { title?: unknown; body?: unknown }) {
  const ref = getAdminDb().collection('salar_brain_files').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const patch = { title: String(input.title ?? snap.data()?.title ?? '').trim().slice(0,160), body: String(input.body ?? ''), updated_at: new Date().toISOString(), updated_by: 'primehubpk1@gmail.com' };
  await ref.set(patch, { merge: true });
  return { id, ...snap.data(), ...patch };
}
