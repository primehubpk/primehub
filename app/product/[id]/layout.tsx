import ProductRewardInfo from '@/components/ProductRewardInfo';
import WeeklyDealProductExtras from '@/components/WeeklyDealProductExtras';

export default function ProductLayout({children,params}:{children:React.ReactNode;params:{id:string}}){
 return <><ProductRewardInfo productId={params.id}/><WeeklyDealProductExtras productId={params.id}/>{children}</>;
}
