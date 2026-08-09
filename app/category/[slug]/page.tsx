import ShopCatalog from '@/components/ShopCatalog';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ShopCatalog initialCategory={decodeURIComponent(slug)} />;
}
