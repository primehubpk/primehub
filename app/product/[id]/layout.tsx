import ProductRewardInfo from '@/components/ProductRewardInfo';

export default function ProductLayout({children,params}:{children:React.ReactNode;params:{id:string}}){
 return <>{<ProductRewardInfo productId={params.id}/>} {children}</>;
}
