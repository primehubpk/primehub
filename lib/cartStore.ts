/**
 * lib/cartStore.ts
 * Global cart state using Zustand.
 *
 * Install first:
 *   npm install zustand
 *
 * This store is the single source of truth for:
 *  - cart line items (add / remove / update qty)
 *  - derived totals (count, subtotal)
 *  - free delivery threshold + progress logic
 *  - cart drawer open/close toggle
 */
import { create } from 'zustand';
export const FREE_DELIVERY_THRESHOLD = 5;
export interface CartItem { id: string | number; name: string; price: number; originalPrice: number; qty: number; }
interface CartState { items: CartItem[]; isDrawerOpen: boolean; addItem: (item: Omit<CartItem,'qty'>)=>void; removeItem:(id:string|number)=>void; updateQty:(id:string|number,qty:number)=>void; clearCart:()=>void; openDrawer:()=>void; closeDrawer:()=>void; toggleDrawer:()=>void; getCartCount:()=>number; getSubtotal:()=>number; getItemsToFreeDelivery:()=>number; getDeliveryProgress:()=>number; }
export const useCartStore = create<CartState>((set,get)=>({
 items:[], isDrawerOpen:false,
 addItem:(item)=>set(state=>{const existing=state.items.find(i=>i.id===item.id); if(existing)return{items:state.items.map(i=>i.id===item.id?{...i,qty:i.qty+1}:i)}; return{items:[...state.items,{...item,qty:1}]};}),
 removeItem:(id)=>set(state=>({items:state.items.filter(i=>i.id!==id)})),
 updateQty:(id,qty)=>set(state=>({items:qty<=0?state.items.filter(i=>i.id!==id):state.items.map(i=>i.id===id?{...i,qty}:i)})),
 clearCart:()=>set({items:[]}), openDrawer:()=>set({isDrawerOpen:true}), closeDrawer:()=>set({isDrawerOpen:false}), toggleDrawer:()=>set(state=>({isDrawerOpen:!state.isDrawerOpen})),
 getCartCount:()=>get().items.reduce((sum,i)=>sum+i.qty,0), getSubtotal:()=>get().items.reduce((sum,i)=>sum+i.price*i.qty,0),
 getItemsToFreeDelivery:()=>Math.max(0,FREE_DELIVERY_THRESHOLD-get().items.reduce((sum,i)=>sum+i.qty,0)),
 getDeliveryProgress:()=>Math.min(100,Math.round((get().items.reduce((sum,i)=>sum+i.qty,0)/FREE_DELIVERY_THRESHOLD)*100)),
}));
