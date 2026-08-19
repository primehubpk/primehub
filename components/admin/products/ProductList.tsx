'use client';
import { Search } from 'lucide-react';
import ProductRow from './ProductRow';
import type { ProductListProps } from './ProductTypes';
export default function ProductList({products,query,onQueryChange,onEdit,onDelete}: ProductListProps) {
  return <><div className="mt-6 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm"><Search size={15}/><input value={query} onChange={event=>onQueryChange(event.target.value)} placeholder="Search products" className="w-full bg-transparent text-sm outline-none"/></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{products.map(product=><ProductRow key={product.id} product={product} onEdit={onEdit} onDelete={onDelete}/>)}</div></>;
}
