'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { ImagePlus, Star, Upload } from 'lucide-react';
import { db } from '@/lib/firebase';

type Review = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  imageUrl?: string;
  photos?: string[];
  verified?: boolean;
  createdAt?: any;
};

const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload?key=f38fa84b03c7eaaeda2a4d3a164b116f';

function formatReviewDate(value: any) {
  try {
    const date = value?.toDate ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export default function ReviewsSection({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'reviews'), where('productId', '==', productId)),
      (snap) => setReviews(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Review))),
      () => setReviews([])
    );
    return unsubscribe;
  }, [productId]);

  useEffect(() => {
    const productGrid = document.querySelector('main > .mx-auto.max-w-6xl > .grid');
    if (!productGrid?.parentElement) return;
    const node = document.createElement('div');
    node.className = 'product-reviews-slot';
    productGrid.parentElement.insertBefore(node, productGrid.nextSibling);
    setMountNode(node);
    return () => node.remove();
  }, []);

  const average = useMemo(
    () => reviews.length ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length : 0,
    [reviews]
  );

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError('');
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Please choose an image smaller than 8MB.');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await fetch(IMGBB_UPLOAD_URL, { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.url) throw new Error('Upload failed');
      setImageUrl(result.data.url);
    } catch {
      setUploadError('Photo upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !comment.trim() || submitting || uploading) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        productId,
        name: name.trim(),
        rating,
        comment: comment.trim(),
        imageUrl: imageUrl || null,
        photos: imageUrl ? [imageUrl] : [],
        verified: false,
        createdAt: serverTimestamp(),
      });
      setName('');
      setComment('');
      setRating(5);
      setImageUrl('');
      setUploadError('');
    } finally {
      setSubmitting(false);
    }
  }

  if (!mountNode) return null;

  return createPortal(
    <section className="mx-auto mt-8 max-w-5xl rounded-[28px] border border-black/7 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Customer Feedback</p>
          <h2 className="mt-1 text-xl font-black">Customer Reviews</h2>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-[#F4F4F1] px-3 py-2">
          <b className="text-2xl">{average.toFixed(1)}</b>
          <span className="flex text-[#FFB020]">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={15} fill={i < Math.round(average) ? 'currentColor' : 'none'} />)}</span>
          <span className="text-[10px] font-bold text-black/40">{reviews.length} reviews</span>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-2.5">
        <h3 className="text-sm font-black">Share your experience</h3>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-xl bg-[#F4F4F1] p-3 text-sm outline-none focus:ring-2 focus:ring-black/10" />
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="rounded-xl bg-[#F4F4F1] p-3 text-sm outline-none">{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}</select>
        <textarea required value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write your review" rows={4} className="rounded-xl bg-[#F4F4F1] p-3 text-sm outline-none focus:ring-2 focus:ring-black/10" />

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-black/15 bg-[#FCFCFA] p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F1]"><ImagePlus size={18} /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-black">Add product photo</span><span className="block text-[9px] font-bold text-black/40">JPG, PNG or other image • max 8MB</span></span>
          <input type="file" accept="image/*" onChange={upload} className="sr-only" />
          <span className="flex items-center gap-1 rounded-lg bg-[#14140F] px-3 py-2 text-[9px] font-black text-white">{uploading ? 'Uploading…' : <><Upload size={12} /> Choose</>}</span>
        </label>
        {uploadError && <p className="text-[10px] font-bold text-[#E1352B]">{uploadError}</p>}
        {imageUrl && <div className="flex items-center gap-3 rounded-xl bg-[#F4F4F1] p-2"><img src={imageUrl} alt="Review upload preview" className="h-14 w-14 rounded-lg object-cover" /><span className="text-[9px] font-bold text-[#0F6A5F]">Photo ready to attach to your review.</span></div>}

        <button type="submit" disabled={submitting || uploading} className="rounded-xl bg-[#14140F] py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit review'}</button>
      </form>

      <div className="mt-7 border-t border-black/8 pt-6">
        <div className="space-y-3">
          {reviews.length === 0 && <p className="rounded-2xl bg-[#F4F4F1] p-4 text-xs font-bold text-black/45">No reviews yet. Be the first customer to share your experience.</p>}
          {reviews.map((review) => {
            const photo = review.imageUrl || review.photos?.[0] || '';
            return (
              <article key={review.id} className="rounded-2xl bg-[#F4F4F1] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <b className="text-sm">{review.name}</b>
                    <p className="mt-0.5 text-[9px] font-bold text-black/35">{formatReviewDate(review.createdAt)}</p>
                  </div>
                  {review.verified && <span className="text-[9px] font-black text-[#0F6A5F]">VERIFIED PURCHASE</span>}
                </div>
                <div className="mt-2 flex text-[#FFB020]">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} fill={i < Number(review.rating || 0) ? 'currentColor' : 'none'} />)}</div>
                <p className="mt-2 text-xs leading-5 text-black/60">{review.comment}</p>
                {photo && <a href={photo} target="_blank" rel="noreferrer" className="mt-3 inline-block overflow-hidden rounded-xl border border-black/8 bg-white" aria-label="Open customer product photo"><img src={photo} alt="Customer product review" className="h-24 w-24 object-cover transition hover:scale-105" /></a>}
              </article>
            );
          })}
        </div>
      </div>
    </section>,
    mountNode
  );
}
