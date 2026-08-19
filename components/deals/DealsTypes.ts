'use client';
import type { Product, Weekday, WeeklyDeal } from '@/lib/types';
export type DealStatus='live'|'upcoming'|'next-week';
export type DealProduct=Product & { description?: string };
export type DealProducts=Record<string, DealProduct|null>;
export type DealDay={key:Weekday;label:string};
export type DealCardProps={deal:WeeklyDeal;label:string;status:DealStatus;product:DealProduct|null;adding:boolean;onAdd:(deal:WeeklyDeal,status:DealStatus)=>void};
export const DAYS:DealDay[]=[{key:'monday',label:'Monday'},{key:'tuesday',label:'Tuesday'},{key:'wednesday',label:'Wednesday'},{key:'thursday',label:'Thursday'},{key:'friday',label:'Friday'},{key:'saturday',label:'Saturday'},{key:'sunday',label:'Sunday'}];
export const DAY_ORDER=DAYS.map(({key})=>key);
export function statusForDay(day:Weekday,today:Weekday):DealStatus{const a=DAY_ORDER.indexOf(day),b=DAY_ORDER.indexOf(today);return a===b?'live':a>b?'upcoming':'next-week'}
export function statusLabel(status:DealStatus){return status==='live'?'🔴 LIVE TODAY':status==='upcoming'?'🔵 UPCOMING':'🔵 UPCOMING (NEXT WEEK)'}
export function statusStyles(status:DealStatus){return status==='live'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-sky-50 text-sky-700 border-sky-200'}
export function imageOf(product:DealProduct|null,deal:WeeklyDeal){return product?.imageUrl||deal.imageUrl||''}
export function regularPriceOf(product:DealProduct|null,deal:WeeklyDeal){const p=Number(product?.price||0);return p>0?p:Number(deal.originalPrice||0)}
