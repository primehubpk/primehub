import CatalogProductCard from './CatalogProductCard';
import { Product } from './ShopTypes';

type Props = { products: Product[]; addedId: string | null; addProduct: (product: Product) => void; loading?: boolean };
export default function CatalogProductGrid({ products, addedId, addProduct, loading }: Props) {
  if (loading) return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-square animate-pulse rounded-[22px] bg-white ring-1 ring-black/5" />)}</div>;
  if (products.length === 0) return <div className="rounded-[28px] bg-white p-10 text-center shadow-sm ring-1 ring-black/5"><h2 className="text-base font-black">No products found</h2><p className="mt-1 text-xs text-black/40">Try another search or clear the filters.</p></div>;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {products.map((product) => (
        <CatalogProductCard key={product.id} product={product} addedId={addedId} addProduct={addProduct} />
      ))}
    </div>
  );
}
