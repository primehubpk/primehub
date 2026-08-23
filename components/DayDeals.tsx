'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';

type ImageValue=string|{url?:string};
type WeekendProduct={id:string;title?:string;name?:string;price?:number;originalPrice?:number;imageUrl?:string;image?:string;images?:ImageValue[];variantMatrix?:any[];variants?:any[];variantColors?:any;variantOptions?:any};
function isWeekend(){const day=new Date().getDay();return day===0||day===6;}
function titleOf(product:WeekendProduct){return product.title||product.name||'Weekend Deal';}
function getDealImageUrl(deal:WeekendProduct){const first=deal.images?.[0];return(typeof first==='string'?first:first?.url)||deal.imageUrl||deal.image||'/placeholder.png';}
function isImgBB(src:string){try{const url=new URL(src);return url.protocol==='https:'&&(url.hostname==='i.ibb.co'||url.hostname==='ibb.co');}catch{return false;}}

export default function DayDeals(){
 const [deals,setDeals]=useState<WeekendProduct[]>([]);const addItem=useCartStore(s=>s.addItem);const openVariantModal=useCartStore(s=>s.openVariantModal);const weekendActive=isWeekend();
 useEffect(()=>{const weekendDealsQuery=query(collection(db,'products'),where('isWeekendSpecial','==',true));return onSnapshot(weekendDealsQuery,s=>setDeals(s.docs.map(item=>({id:item.id,...item.data()}) as WeekendProduct)),()=>setDeals([]));},[]);
 function addDeal(product:WeekendProduct){
  if(openVariantModal(product,'cart'))return;
  const image=getDealImageUrl(product);const price=Number(product.price||0);
  addItem({id:product.id,productId:product.id,name:titleOf(product),price,originalPrice:Number(product.originalPrice||price),image,imageUrl:image});
 }
 if(!deals.length)return null;
 return(
  <section className="mx-auto mt-6 max-w-6xl px-4">
   <div className="mb-3 flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-[#FFB020]" aria-hidden="true"/><h2 className="font-[family-name:var(--font-display)] text-base font-bold">{weekendActive?'Weekend Glow Deals — Live Now':'Weekend Glow Deals'}</h2></div>
   <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overflow-y-visible touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing overscroll-x-contain scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {deals.slice(0,3).map(deal=>{const original=Number((deal as WeekendProduct & {normalPrice?:number;dealPrice?:number}).normalPrice||deal.originalPrice||0);const current=Number((deal as WeekendProduct & {dealPrice?:number}).dealPrice||deal.price||0);const savings=Math.round(original-current);const image=getDealImageUrl(deal);return <article key={deal.id} className="relative w-[180px] shrink-0 snap-start overflow-hidden rounded-xl border border-black/10 bg-white p-2 text-center sm:w-[210px]"><Link href={`/product/${deal.id}`} className="block"><div className="relative mb-2 aspect-square overflow-hidden rounded-lg bg-[#F4F4F1]"><Image src={image} alt={titleOf(deal)} width={300} height={300} unoptimized={isImgBB(image)} className="h-full w-full object-cover" onError={event=>{event.currentTarget.src='/placeholder.png';}}/>{savings>0&&<span className="absolute right-1.5 top-1.5 z-10 inline-flex items-center rounded-full bg-[#0F6A5F] px-2 py-1 text-[8px] font-black text-white shadow-[0_6px_16px_rgba(15,106,95,0.45)]">Save Rs. {savings.toLocaleString()}</span>}</div><p className="truncate text-[9px] font-bold">{titleOf(deal)}</p></Link><button type="button" onClick={()=>addDeal(deal)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#14140F] py-2.5 text-[9px] font-black text-white"><ShoppingCart size={12}/> Add to Cart</button></article>;})}
   </div>
  </section>
 );
}
