// PrimeHubMall public, read-only catalog proxy. No social credentials or store admin keys.
const STORE='https://www.primehubmall.com';
let snapshot=null;
let updatedAt=0;
const TTL=5*60*1000;
const safeText=(v,n=200)=>String(v??'').slice(0,n).trim();
const numeric=(v)=>v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
function sanitizeProduct(p){
  if(!p||typeof p!=='object'||p.active===false||p.published===false)return null;
  const id=safeText(p.id,120);
  if(!id)return null;
  const title=safeText(p.title||p.name,120);
  if(!title)return null;
  let image=safeText(p.imageUrl||p.image_url||p.image||p.images?.[0],1000);
  if(image&&!/^https:\/\//i.test(image))image='';
  return {id,title,category:safeText(p.category,100),price:numeric(p.price),imageUrl:image,url:STORE+'/product/'+encodeURIComponent(id)};
}
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const raw=Array.isArray(req.query?.q)?req.query.q[0]:req.query?.q;
  const q=safeText(raw,80).toLowerCase();
  if(q.length<2||q.length>80)return res.status(400).json({error:'Enter a search query (2–80 characters).'});
  try{
    if(!snapshot||Date.now()-updatedAt>TTL){
      const response=await fetch(STORE+'/api/storefront/read?type=catalog',{headers:{accept:'application/json'},signal:AbortSignal.timeout(7500)});
      if(!response.ok)throw new Error('Storefront catalog unavailable');
      const value=await response.json();
      if(!Array.isArray(value.products))throw new Error('Invalid catalog shape');
      snapshot=value.products.map(sanitizeProduct).filter(Boolean);
      updatedAt=Date.now();
    }
    const terms=q.split(/\s+/).filter(Boolean);
    const result=snapshot.filter(p=>terms.every(t=>(p.title+' '+p.category).toLowerCase().includes(t))).slice(0,12);
    res.setHeader('Cache-Control','public, s-maxage=120, stale-while-revalidate=300');
    return res.status(200).json({products:result,count:result.length,source:'PrimeHubMall public catalog'});
  }catch(e){
    console.error('Social studio public catalog error:',e instanceof Error?e.message:'unknown');
    return res.status(503).json({error:'PrimeHubMall catalog temporarily unavailable',products:[]});
  }
}