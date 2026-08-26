'use client';
import { FormEvent, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import type { Customer } from './CheckoutTypes';

export const titleOf=(i:any)=>i.title||i.name||'Product';
export const priceOf=(i:any)=>Number(i.price||0);
export const imageOf=(i:any)=>i.imageUrl||i.image||i.images?.[0]||'';

export async function getAuthoritativeQuote(items:any[]){const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'quote',items})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to verify current prices.');return d;}
function cleanWhatsAppNumber(value:any){return String(value||'').replace(/[^0-9]/g,'');}
function variantText(variant:any){const color=String(variant?.color??'').trim(),size=String(variant?.size??'').trim();if(!color&&!size)return 'Variant: Standard';const parts=[];if(color)parts.push(`Color: ${color}`);if(size)parts.push(`Size: ${size}`);return `Variant: ${parts.join(', ')}`;}
async function getAdminWhatsAppNumber(){for(const ref of [doc(db,'settings','main'),doc(db,'settings','contact')]){try{const snap=await getDoc(ref);if(!snap.exists())continue;const data:any=snap.data()||{};const number=data.adminWhatsappNumber??data.whatsappNumber??data.whatsapp??data.whatsappPhone??data.phone??data.contact?.adminWhatsappNumber??data.contact?.whatsappNumber??data.contact?.whatsapp??data.contact?.phone;const cleaned=cleanWhatsAppNumber(number);if(cleaned)return cleaned;}catch(error){console.warn('[whatsapp-checkout] Failed to read settings document',ref.id,error);}}throw new Error('Admin WhatsApp number is not configured.');}
async function authHeader():Promise<Record<string,string>>{const user=auth.currentUser;if(!user)return {};try{return{Authorization:`Bearer ${await user.getIdToken()}`};}catch{return{};}}

export function useCheckout(){
  const items=useCartStore((s:any)=>s.items||s.cart||[]),clearCart=useCartStore((s:any)=>s.clearCart);
  const [customer,setCustomer]=useState<Customer>({name:'',phone:'',email:'',address:'',city:'',notes:''});
  const [placing,setPlacing]=useState(false),[orderId,setOrderId]=useState(''),[error,setError]=useState('');
  const totalItems=useMemo(()=>items.reduce((s:number,i:any)=>s+Number(i.quantity||i.qty||1),0),[items]);
  const subtotal=useMemo(()=>items.reduce((s:number,i:any)=>s+priceOf(i)*Number(i.quantity||i.qty||1),0),[items]);
  const update=(key:keyof Customer,value:string)=>setCustomer(p=>({...p,[key]:value));
  const placeOrder=async(e:FormEvent)=>{e.preventDefault();setError('');if(!items.length)return setError('Your cart is empty. Please add a product first.');if(!customer.name.trim()||!customer.phone.trim()||!customer.address.trim()||!customer.city.trim())return setError('Please fill your name, phone, address and city.');setPlacing(true);try{const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json',...(await authHeader())},body:JSON.stringify({customer,items})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Order save nahi ho saka.');setOrderId(d.orderId);clearCart();}catch(err){console.error(err);setError(err instanceof Error?err.message:'Order save nahi ho saka. Please try again.');}finally{setPlacing(false);}};
  const whatsappOrder=async()=>{if(!items.length)return;setError('');try{const[q,adminNumber]=await Promise.all([getAuthoritativeQuote(items),getAdminWhatsAppNumber()]);const lines=q.items.map((validated:any,n:number)=>{const cartItem=items[n]||{},quantity=Number(cartItem.quantity||cartItem.qty||validated.quantity||1),cartPrice=priceOf(cartItem),image=String(validated.image||validated.imageUrl||imageOf(cartItem)||'').trim();return[`${n+1}. ${titleOf(cartItem)||validated.title} x ${quantity}`,`- ${variantText(cartItem.variant||validated.variant)}`,`- Price: Rs. ${cartPrice.toLocaleString()}`,`- Image: ${image||'N/A'}`].join('\n');});const cartTotal=items.reduce((sum:number,item:any)=>sum+priceOf(item)*Number(item.quantity||item.qty||1),0);const text=['*Order from PrimeHub*','',...lines,'','*Customer Details:*',`Name: ${customer.name||'-'}`,`Phone: ${customer.phone||'-'}`,`Address: ${customer.address||'-'}`,`City: ${customer.city||'-'}`,`*Total: Rs. ${cartTotal.toLocaleString()}*`].join('\n');window.open(`https://wa.me/${adminNumber}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');}catch(err){console.error(err);setError(err instanceof Error?err.message:'Unable to prepare WhatsApp order.');}};
  return{items,customer,placing,orderId,error,totalItems,subtotal,update,placeOrder,whatsappOrder};
}
