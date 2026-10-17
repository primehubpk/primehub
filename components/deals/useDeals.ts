'use client';
import { useEffect,useMemo,useState } from 'react';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import { loadProductsForNavigation } from '@/lib/productNavigationCache';
import type { WeeklyDeal,Weekday } from '@/lib/types';
import { DAY_ORDER,imageOf } from './DealsTypes';
import { getVerifiedDealProduct } from '@/lib/verifiedDealProduct';
import type { DealProduct,DealProducts,DealStatus } from './DealsTypes';
import { weeklyCartPrice } from '@/lib/weeklyCartPrice';

export default function useDeals(){
  const {settings,loading}=useSettings();
  const addItem=useCartStore(s=>s.addItem);
  const openVariantModal=useCartStore(s=>s.openVariantModal);
  const today=(()=>{const v=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Karachi',weekday:'long'}).format(new Date()).toLowerCase() as Weekday;return DAY_ORDER.includes(v)?v:'monday'})();
  const [products,setProducts]=useState<DealProducts>({});
  const [addingId,setAddingId]=useState<string|null>(null);
  const [actionError,setActionError]=useState('');
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

  const addToCart=async (deal:WeeklyDeal,_status:DealStatus)=>{
    if(!deal.productId||addingId)return;
    setAddingId(deal.id);
    setActionError('');
    try {
      // Deal list receives compact navigation products. Always verify its real
      // variant rows at click-time before deciding whether to add directly.
      const product=await getVerifiedDealProduct(deal.productId);
      const {price,comparison,live}=weeklyCartPrice(deal,product);
      if(price<=0)throw new Error('Deal price is unavailable.');
      const image=imageOf(product as DealProduct,deal);
      const priced={...product,price,originalPrice:comparison,image,imageUrl:image,
        ...(live?{dealDay:deal.day}:{})};
      if(openVariantModal(priced,'cart'))return;
      addItem({id:product.id,productId:product.id,category:String(product.category||''),
        name:String(product.title||product.name||deal.title||`${deal.day} Deal`),price,
        originalPrice:comparison,image:image||undefined,imageUrl:image||undefined,
        ...(live?{dealDay:deal.day}:{})});
    }catch(error){
      setActionError(error instanceof Error?error.message:'Could not verify product options. Try again.');
    }finally{
      setAddingId(null);
    }
  };

  return {settings,loading,today,products,weeklyDeals,addingId,addToCart,actionError};
}
