import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getDualCatalog, getDualSettings, getDualSkills } from '@/lib/dualReadServer';
import { BASE_DELIVERY_CHARGE, WHOLESALE_ITEM_DELIVERY_CHARGE } from '@/lib/deliveryCharges';
import { clearSalarCache, SALAR_INDEX_SCHEMA_VERSION } from '@/lib/salar/worker';

const PAGE_ROUTES = [
  ['home','PrimeHub Mall Home','/'],['shopping','Shopping','/shop'],['sale_mela','Sale Mela','/sale-mela'],['weekly_deals','Weekly Deals','/weekly-deals'],['deals','Deals','/deals'],['rewards','Rewards','/rewards'],['reseller_club','Reseller Club','/reseller'],['prime_skill','Prime Skill','/skills'],['checkout','Checkout / Payment','/checkout'],['contact','Contact','/contact'],['privacy','Privacy Policy','/privacy-policy'],['returns','Return Policy','/return-policy'],['terms','Terms','/terms'],
] as const;

function text(value: unknown, max=12000) { return String(value ?? '').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim().slice(0,max); }
function arr(value: unknown) { return Array.isArray(value) ? value : []; }
function imageUrls(p:any) { const values:any[] = [p.imageUrl,p.image,...arr(p.images).map((x:any)=>typeof x==='string'?x:x?.url),...arr(p.imageUrls)]; return [...new Set(values.map((x)=>String(x||'').trim()).filter(Boolean))]; }
function sizes(p:any) { const values:any[]=[...arr(p.sizes),...arr(p.variants).map((v:any)=>v?.size ?? v?.name),...arr(p.variantMatrix).map((v:any)=>v?.size)]; return [...new Set(values.map((x)=>String(x||'').trim()).filter(Boolean))]; }
function shortDescription(p:any){ return text(p.description ?? p.shortDescription ?? '', 1200); }
function categoryRefs(p:any, map:Map<string,any>) {
  const ids = [...arr(p.categoryIds), p.categoryId].map((x)=>String(x||'').trim()).filter(Boolean);
  const names:string[] = [];
  const mixed = [...arr(p.categories), p.category];
  for (const value of mixed) {
    const raw = typeof value === 'string' ? value.trim() : String(value?.id || value?.name || '').trim();
    if (!raw) continue;
    if (map.has(raw)) ids.push(raw); else names.push(raw);
  }
  for (const id of ids) {
    const category=map.get(id);
    if(category) names.push(String(category.name||category.title||category.slug||id));
  }
  return { ids:[...new Set(ids)], names:[...new Set(names)] };
}
async function replaceCollection(name:string, rows:any[]) { const db=getAdminDb(); const old=await db.collection(name).get(); for(let i=0;i<old.docs.length;i+=400){const b=db.batch(); old.docs.slice(i,i+400).forEach((d)=>b.delete(d.ref)); await b.commit();} for(let i=0;i<rows.length;i+=400){const b=db.batch(); rows.slice(i,i+400).forEach((row)=>b.set(db.collection(name).doc(String(row.id)),row)); await b.commit();} }
function pageId(pathname:string){ return pathname==='/'?'home':`page-${pathname.replace(/^\\/+|\\/+$/g,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}`.slice(0,180); }
async function discoverPublicPages(origin:string){
  const seeded=PAGE_ROUTES.map(([key,title,url])=>({key,title,url})); const seen=new Set(seeded.map((row)=>row.url));
  try{
    const response=await fetch(`${origin}/sitemap.xml`,{cache:'no-store'}); const xml=response.ok?await response.text():'';
    for(const match of xml.matchAll(/<loc>([^<]+)<\\/loc>/gi)){
      try{const parsed=new URL(match[1].replace(/&amp;/g,'&'));if(parsed.origin!==origin)continue;const url=parsed.pathname.replace(/\\/$/,'')||'/';if(seen.has(url)||/^\\/(api|admin|product|category)(\\/|$)/i.test(url))continue;seen.add(url);seeded.push({key:pageId(url),title:url.split('/').filter(Boolean).pop()?.replace(/[-_]+/g,' ')||'PrimeHub Mall',url});}catch{}
    }
  }catch{}
  return seeded.slice(0,120);
}

export async function readIndexMeta(){ const snap=await getAdminDb().collection('salar_index_meta').doc('current').get(); return snap.exists ? snap.data() : { status:'never', stats:{collections:0,products:0,pages:0}, refreshed_at:null, error:null }; }

export async function refreshSalarCatalogue(request: Request) {
  const db=getAdminDb(); const meta=db.collection('salar_index_meta').doc('current'); const startedAt=new Date().toISOString(); await meta.set({status:'running',started_at:startedAt,error:null},{merge:true});
  try {
    const [catalog,settings,skills] = await Promise.all([getDualCatalog({cache:'no-store'}),getDualSettings({cache:'no-store'}),getDualSkills({cache:'no-store'})]);
    const categoryMap=new Map<string,any>();
    const collections=arr(catalog.categories).map((c:any)=>{const id=String(c.id); categoryMap.set(id,c); return {id,source_id:id,name:String(c.name??c.title??c.slug??id),slug:String(c.slug??''),parent:c.parentId??c.parent??null,extra:{active:c.active,sortOrder:c.sortOrder??c.order,imageUrl:c.imageUrl??c.iconUrl??null}}});
    const products=arr(catalog.products).map((p:any)=>{const sourceId=String(p.id); const refs=categoryRefs(p,categoryMap); const stock=Number(p.stock ?? p.quantity); return {id:sourceId,source_id:sourceId,name:String(p.title??p.name??sourceId),collection_ids:refs.ids,collection_names:refs.names,price:Number(p.price)||0,currency:String(p.currency||'PKR'),sizes:sizes(p),material:String(p.material??p.materials??''),description:shortDescription(p),image_urls:imageUrls(p),product_url:`/product/${encodeURIComponent(sourceId)}`,in_stock:Number.isFinite(stock)?stock>0:null,raw:{originalPrice:p.originalPrice??null,stock:Number.isFinite(stock)?stock:null,active:p.active??null,variants:arr(p.variants),variantMatrix:arr(p.variantMatrix)}}});
    const origin=(process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin).replace(/\/$/,'');
    const pageRows:any[]=[]; const publicPages=await discoverPublicPages(origin);
    for(let i=0;i<publicPages.length;i+=8){const batch=publicPages.slice(i,i+8);const rows=await Promise.all(batch.map(async ({key,title,url})=>{let excerpt='';try{const res=await fetch(`${origin}${url}`,{cache:'no-store'});if(res.ok)excerpt=text(await res.text());}catch{}return{id:key,key,title,url,text_excerpt:excerpt};}));pageRows.push(...rows);}
    const docs:any=(settings as any).documents||{}; const main=docs.main||{}; const contact=docs.contact||{}; const policy=docs.policy||{};
    pageRows.push({id:'delivery',key:'delivery',title:'Delivery',url:'/checkout',text_excerpt:text(`Base delivery charge: Rs ${BASE_DELIVERY_CHARGE}. Wholesale surcharge: Rs ${WHOLESALE_ITEM_DELIVERY_CHARGE} per wholesale item. ${main.storePolicyInfo||''} ${main.freeDelivery?.message||''}`)});
    pageRows.push({id:'payment_info',key:'payment_info',title:'Payment Information',url:'/checkout',text_excerpt:text([main.paymentInfo,main.paymentDetails,main.advancePaymentInfo,docs.payment?.text].filter(Boolean).join(' '))});
    pageRows.push({id:'contact_settings',key:'contact_settings',title:'Contact Information',url:'/contact',text_excerpt:text(`${contact.email||''} ${contact.whatsappNumber||main.whatsappNumber||''} ${contact.physicalAddress||''}`)});
    pageRows.push({id:'policy_settings',key:'policy_settings',title:'Store Policies',url:'/privacy-policy',text_excerpt:text(`${policy.privacyPolicy||''} ${policy.returnPolicy||''}`)});
    pageRows.push({id:'prime_skill_data',key:'prime_skill_data',title:'Prime Skill Catalogue',url:'/skills',text_excerpt:text(arr((skills as any).skills).map((s:any)=>`${s.title||s.name||''}: ${s.description||''} Price ${s.price??''}`).join(' | '),20000)});
    await Promise.all([replaceCollection('salar_index_collections',collections),replaceCollection('salar_index_products',products),replaceCollection('salar_index_pages',pageRows)]);
    await clearSalarCache();
    const refreshedAt=new Date().toISOString(); const stats={collections:collections.length,products:products.length,pages:pageRows.length}; await meta.set({status:'done',schema_version:SALAR_INDEX_SCHEMA_VERSION,refreshed_at:refreshedAt,stats,error:null,source:{catalog:(catalog as any).source,skills:(skills as any).source}}, {merge:true}); return {status:'done',refreshed_at:refreshedAt,stats};
  } catch(error) { const message=error instanceof Error?error.message:'Catalogue refresh failed.'; await meta.set({status:'error',error:message,finished_at:new Date().toISOString()},{merge:true}); throw error; }
}
