'use client';
import { useEffect,useMemo,useState } from 'react';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import { loadProductsForNavigation } from '@/lib/productNavigationCache';
import type { WeeklyDeal,Weekday } from '@/lib/types';
import { DAY_ORDER,imageOf,regularPriceOf } from './DealsTypes';
import type { DealProduct,DealProducts,DealStatus } from './DealsTypes';

export default function useDeals(){
  const {settings,loading}=useSettings();
  const addItem=useCartStore(s=>s.addItem);
  const today=(()=>{const v=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Karachi',weekday:'long'}).format(new Date()).toLowerCase() as Weekday;return DAY_ORDER.includes(v)?v:'monday'})();
  const [products,setProducts]=useState<DealProducts>({});
  const [addingId,setAddingId]=useState<string|null>(null);
  const weeklyDeals=useMemo(()=> (settings.weeklyDeals||[]).filter(d=>d.productId),[settings.weeklyDeals]);
  const productIdsKey=useMemo(
    ()=>Array.from(new Set(weeklyDeals.map(deal=>String(deal.productId||'').trim()).filter(Boolean))).sort().join('\u0001'),
    [weeklyDeals],
  );

  useEffect(()=>{
    let cancelled=false;
    const ids=productIdsKey?productIdsKey.split('\u0001'):[];
    if(!ids.length){
      setProducts({});
      return()=>{cancelled=true};
    }
    loadProductsForNavigation<DealProduct>(ids)
      .then(next=>{if(!cancelled)setProducts(next as DealProducts)})
      .catch(()=>{if(!cancelled)setProducts({})});
    return()=>{cancelled=true};
  },[productIdsKey]);

  const addToCart=(deal:WeeklyDeal,status:DealStatus)=>{
    const product=products[deal.productId];
    if(!product||Number(product.stock??0)<=0)return;
    const regularPrice=regularPriceOf(product,deal),dealPrice=Number(deal.dealPrice||0),price=status==='live'&&deal.active!==false&&dealPrice>0?dealPrice:regularPrice;
    if(price<=0)return;
    const image=imageOf(product,deal);
    addItem({id:product.id,name:product.title||deal.title||`${deal.day} Deal`,price,originalPrice:regularPrice>price?regularPrice:Number(product.originalPrice||regularPrice),image:image||undefined,imageUrl:image||undefined,...(status==='live'?{dealDay:deal.day}:{})});
    setAddingId(deal.id);
    window.setTimeout(()=>setAddingId(current=>current===deal.id?null:current),1200);
  };

  return {settings,loading,today,products,weeklyDeals,addingId,addToCart};
}
