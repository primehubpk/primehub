import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { getVariantRows, useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import { WEEKDAY_LABELS, WEEKDAY_ORDER, countdownParts, dealTiming } from '@/lib/weeklyDealUtils';
import type { ProductVariantSelection, WeeklyDeal } from '@/lib/types';
import { rememberProduct } from '@/components/RecentlyViewed';
import { dealDiscount, imagesOf, originalPriceOf, regularPriceOf, titleOf, type Product, type ProductDetailModel, money } from './ProductDetailTypes';

function dealIsActive(deal: any, now: number): boolean {
  if (!deal || deal.active === false) return false;
  const start = deal.startAt ? new Date(deal.startAt).getTime() : 0;
  const end = deal.endAt ? new Date(deal.endAt).getTime() : 0;
  return (!start || Number.isNaN(start) || now >= start) && (!end || Number.isNaN(end) || now < end);
}

export function useProductDetail(): ProductDetailModel {
 const params=useParams<{id:string}>(),router=useRouter(),id=String(params?.id||''),{settings}=useSettings(),addItem=useCartStore(s=>s.addItem);
 const [product,setProduct]=useState<Product|null>(null),[weeklyProducts,setWeeklyProducts]=useState<Record<string,Product>>({}),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[activeImage,setActiveImage]=useState(0),[quantity,setQuantity]=useState(1),[wished,setWished]=useState(false),[videoOpen,setVideoOpen]=useState(false),[added,setAdded]=useState(false),[nowTick,setNowTick]=useState<number|null>(null),[variantModalOpen,setVariantModalOpen]=useState(false),[variantMode,setVariantMode]=useState<'cart'|'buy'>('cart'),[variantSelection,setVariantSelection]=useState<ProductVariantSelection|undefined>();
 useEffect(()=>{setNowTick(Date.now());const timer=window.setInterval(()=>setNowTick(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
 useEffect(()=>{let cancelled=false;async function load(){if(!id)return;setLoading(true);try{const [productSnap,productsSnap]=await Promise.all([getDoc(doc(db,'products',id)),getDocs(collection(db,'products'))]);if(cancelled)return;if(!productSnap.exists()){setProduct(null);setFailed(true);}else{const nextProduct={id:productSnap.id,...productSnap.data()} as Product;setProduct(nextProduct);rememberProduct(productSnap.id);}const nextProducts:Record<string,Product>={};productsSnap.forEach(item=>{nextProducts[item.id]={id:item.id,...item.data()} as Product;});setWeeklyProducts(nextProducts);}catch{if(!cancelled)setFailed(true);}finally{if(!cancelled)setLoading(false);}}load();return()=>{cancelled=true;};},[id]);
 const images=useMemo(()=>product?imagesOf(product):[],[product]);
 const regularPrice=product?regularPriceOf(product):0,productOriginal=product?originalPriceOf(product):0,stock=Number(product?.stock??product?.quantity??product?.inventory??10),rating=Number(product?.rating||0),reviews=Number(product?.reviews||0);
 const variantRows=useMemo(()=>product?getVariantRows(product):[],[product]);
 const weeklyDeals=useMemo(()=>((settings.weeklyDeals||[]) as WeeklyDeal[]).filter(deal=>deal.active!==false&&deal.productId&&Number(deal.dealPrice)>0).sort((a,b)=>WEEKDAY_ORDER.indexOf(a.day)-WEEKDAY_ORDER.indexOf(b.day)),[settings.weeklyDeals]);
 const currentDeal=useMemo(()=>weeklyDeals.find(deal=>deal.productId===id),[weeklyDeals,id]),timing=currentDeal&&nowTick!==null?dealTiming(currentDeal.day,new Date(nowTick)):null,liveDeal=Boolean(currentDeal&&timing?.isLive),dealPrice=currentDeal?Number(currentDeal.dealPrice||0):0,normalForDeal=currentDeal?Number(weeklyProducts[id]?.price||currentDeal.originalPrice||regularPrice):productOriginal,savingsAmount=currentDeal&&dealPrice>0&&normalForDeal>dealPrice?normalForDeal-dealPrice:0,savingsPercent=dealDiscount(dealPrice,normalForDeal),countdown=timing&&nowTick!==null?countdownParts(timing.unlockAt.getTime()-nowTick):null;
 const activeAdminDeal=useMemo(()=>{if(!product)return null;const candidates=[(settings as any).bigDeal,(settings as any).dailyDeal].filter(Boolean);const now=nowTick??Date.now();return candidates.find((deal:any)=>(deal.productId===product.id||deal.id===product.id)&&dealIsActive(deal,now)&&Number(deal.dealPrice||deal.price)>0)||null;},[product,settings,nowTick]);
 const activeDealPrice=activeAdminDeal?Number(activeAdminDeal.dealPrice||activeAdminDeal.price||0):null;
 const activeDealNormalPrice=activeAdminDeal?Number(activeAdminDeal.normalPrice||activeAdminDeal.originalPrice||regularPrice):0;
 const effectiveCurrentPrice=activeDealPrice&&activeDealPrice>0?activeDealPrice:(liveDeal&&dealPrice>0?dealPrice:regularPrice);
 const effectiveNormalPrice=activeAdminDeal?activeDealNormalPrice:(liveDeal&&normalForDeal>effectiveCurrentPrice?normalForDeal:productOriginal||regularPrice);
 const effectiveSavings=effectiveNormalPrice>effectiveCurrentPrice?effectiveNormalPrice-effectiveCurrentPrice:0;
 const effectiveSavingsPercent=dealDiscount(effectiveCurrentPrice,effectiveNormalPrice);
 const effectiveLiveDeal=Boolean(activeAdminDeal||liveDeal);
 const effectiveDealPrice=activeDealPrice&&activeDealPrice>0?activeDealPrice:dealPrice;
 const countdown=timing&&nowTick!==null?countdownParts(timing.unlockAt.getTime()-nowTick):null,currentPrice=effectiveCurrentPrice,whatsappNumber=String(settings.whatsappNumber||'').replace(/\D/g,''),maxQuantity=stock>0?stock:undefined,stockProgress=Math.max(0,Math.min(100,(stock/Math.max(stock,50))*100)),bannerCountdown=countdown?(liveDeal?`${countdown.hours.toString().padStart(2,'0')}:${countdown.minutes.toString().padStart(2,'0')}:${countdown.seconds.toString().padStart(2,'0')}`:`${countdown.days}d ${countdown.hours.toString().padStart(2,'0')}:${countdown.minutes.toString().padStart(2,'0')}:${countdown.seconds.toString().padStart(2,'0')}`):'—';
 const hasVariants=variantRows.length>0;
 const addResolved=(selection:ProductVariantSelection|undefined,qty:number)=>{if(!product||currentPrice<=0||stock===0)return;const row=selection&&variantRows.length?variantRows.find(r=>(!selection.color||r.color===selection.color)&&(!selection.size||r.size===selection.size)):undefined;const selectedStock=row?Number(row.stock??0):stock;if(selectedStock<=0)return;const price=activeDealPrice&&activeDealPrice>0?activeDealPrice:(liveDeal?currentPrice:Number(row?.price??currentPrice)||currentPrice);const image=String(row?.imageUrl||images[0]||product.imageUrl||product.image||'');const cartItem={id:selection&&Object.values(selection).some(Boolean)?`${product.id}:${Object.entries(selection).filter(([,v])=>v).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}-${v}`).join('|')}`:product.id,productId:product.id,name:titleOf(product),price,originalPrice:effectiveNormalPrice||productOriginal||price,image,imageUrl:image,dealDay:liveDeal&&currentDeal?currentDeal.day:undefined,variant:selection};for(let i=0;i<Math.min(qty,selectedStock);i++)addItem(cartItem);setAdded(true);window.setTimeout(()=>setAdded(false),1200);};
 const addProduct=()=>{if(hasVariants){setVariantMode('cart');setVariantModalOpen(true);return;}addResolved(undefined,quantity);};
 const orderNow=()=>{if(hasVariants){setVariantMode('buy');setVariantModalOpen(true);return;}if(!product||currentPrice<=0||stock===0)return;addResolved(undefined,quantity);router.push('/checkout');};
 const openVariantSelector=(mode:'cart'|'buy')=>{if(!hasVariants){if(mode==='buy')orderNow();else addProduct();return;}setVariantMode(mode);setVariantModalOpen(true);};
 const closeVariantSelector=()=>setVariantModalOpen(false);
 const confirmVariant=(selection:ProductVariantSelection,qty:number)=>{setVariantSelection(selection);setVariantModalOpen(false);addResolved(selection,qty);if(variantMode==='buy')router.push('/checkout');};
 const buyWhatsApp=()=>{if(!product||currentPrice<=0||stock===0)return;const variantText=variantSelection&&Object.values(variantSelection).some(Boolean)?`Variant: ${Object.entries(variantSelection).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(' / ')}`:'';const text=['🛍️ PrimeHub Deals — Product Order','',`Product: ${titleOf(product)}`,variantText,`Quantity: ${quantity}`,`Price: ${money(currentPrice)}`,`Total: ${money(currentPrice*quantity)}`,activeAdminDeal?'Big Deal — LIVE':currentDeal?`Weekly Deal: ${WEEKDAY_LABELS[currentDeal.day]}${liveDeal?' — LIVE':' — locked'}`:'',`Product ID: ${product.id}`,'','I want to order this product.'].filter(Boolean).join('\n');const target=whatsappNumber?`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`:`https://wa.me/?text=${encodeURIComponent(text)}`;window.open(target,'_blank','noopener,noreferrer');};
 return {product,weeklyProducts,loading,failed,activeImage,quantity,wished,videoOpen,added,nowTick,images,regularPrice,productOriginal,stock,rating,reviews,weeklyDeals,currentDeal,timing,liveDeal:effectiveLiveDeal,dealPrice:effectiveDealPrice,normalForDeal:effectiveNormalPrice,savingsAmount:effectiveSavings,savingsPercent:effectiveSavingsPercent,countdown,currentPrice,whatsappNumber,maxQuantity,stockProgress,bannerCountdown,variantRows,variantModalOpen,variantMode,variantSelection,setActiveImage,setQuantity,setWished,setVideoOpen,addProduct,orderNow,buyWhatsApp,openVariantSelector,closeVariantSelector,confirmVariant};
}
