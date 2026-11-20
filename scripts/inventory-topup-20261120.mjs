import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Explicitly guarded, one-time inventory adjustment. Safe mode is read-only.
const apply = process.argv.includes('--apply');
const requiredConfirmation = '--confirm=ADD30_TO_ALL_PRODUCTS_NOV20';
if (apply && !process.argv.includes(requiredConfirmation)) throw new Error('Missing explicit batch confirmation.');
if (typeof process.loadEnvFile === 'function') process.loadEnvFile('.env.local');
const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase server credentials unavailable.');
const headers = { apikey:key, Authorization:'Bearer '+key, 'Content-Type':'application/json' };
const stamp = 'stockTopUp20261120';
const delta = 30;
const now = new Date().toISOString();
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const numeric = (value, fallback=30) => (value === null || value === '' || value === undefined || !Number.isFinite(Number(value))) ? fallback : Math.max(0,Number(value));
function incrementRows(rows, parent) {
  return Array.isArray(rows) ? rows.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    return {...row, stock:numeric(row.stock,parent)+delta};
  }) : rows;
}
async function supabaseRead() {
  const response = await fetch(url+'/rest/v1/products?select=id,stock,payload,variant_matrix,variants,updated_at,sync_version,mirror_status&order=id.asc',
    {headers:{...headers,Range:'0-999'},cache:'no-store'});
  if (!response.ok) throw new Error('Read-only Supabase inventory fetch failed '+response.status);
  const rows=await response.json();
  if (!Array.isArray(rows) || rows.length<700 || rows.length>1000) throw new Error('Unexpected catalog size: '+rows?.length);
  return rows;
}
const rows=await supabaseRead();
const planned=rows.filter(row=>row.payload?.[stamp] !== true).map(row => {
  const source=row.payload && typeof row.payload==='object'?row.payload:{};
  const base=numeric(source.stock ?? source.quantity ?? row.stock);
  const payload={...source, stock:base+delta, [stamp]:true, inventoryTopUpAt:now};
  if (source.quantity !== undefined && source.quantity !== null) payload.quantity=numeric(source.quantity)+delta;
  if (Array.isArray(source.variantMatrix)) payload.variantMatrix=incrementRows(source.variantMatrix,base);
  if (Array.isArray(source.variants)) payload.variants=incrementRows(source.variants,base);
  const write={stock:base+delta,
    variant_matrix:incrementRows(row.variant_matrix,base),
    variants:incrementRows(row.variants,base), payload,
    sync_version:Number(row.sync_version||0)+1, updated_at:now, mirror_status:'pending', mirror_error:null};
  return {id:row.id,before:base,after:base+delta,expectedUpdatedAt:row.updated_at,write};
});
const backupPath=path.join(process.cwd(),'scripts','inventory-topup-20261120-originals.local.json');
const backup={createdAt:now,delta,source:'Supabase primary products',rows:rows.map(row=>({
  id:row.id,stock:row.stock,payloadStock:row.payload?.stock,payloadQuantity:row.payload?.quantity,
  variantMatrix:row.payload?.variantMatrix,variants:row.payload?.variants,
  variant_matrix:row.variant_matrix,variant_column:row.variants,
  updatedAt:row.updated_at,syncVersion:row.sync_version,mirrorStatus:row.mirror_status,
}))};
if(!fs.existsSync(backupPath))fs.writeFileSync(backupPath,JSON.stringify(backup,null,2),{flag:'wx'});
const overview={mode:apply?'apply':'dry-run',total:rows.length,alreadyApplied:rows.length-planned.length,planned:planned.length,
  rowsWithMatrix:planned.filter(p=>p.write.payload.variantMatrix?.length).length,
  rowsWithVariants:planned.filter(p=>p.write.payload.variants?.length).length,
  backup:backupPath, sample:planned.slice(0,4).map(p=>({id:p.id,before:p.before,after:p.after}))};
console.log(JSON.stringify(overview,null,2));
if (!apply) process.exit(0);
const updated=[];const failed=[];
let index=0;
const concurrency=10;
async function worker() {
  while(index<planned.length) {
    const p=planned[index++];
    try {
      const qs=new URLSearchParams({id:'eq.'+p.id, updated_at:'eq.'+p.expectedUpdatedAt});
      const response=await fetch(url+'/rest/v1/products?'+qs.toString(),
        {method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify(p.write)});
      if(!response.ok) throw new Error('Supabase status '+response.status+' '+(await response.text()).slice(0,200));
      const changed=await response.json();
      if(!Array.isArray(changed)||changed.length!==1) throw new Error('Concurrent edit: expected exactly one updated record');
      updated.push(p);
    }catch(error){failed.push({id:p.id,error:String(error).slice(0,200)})}
    if(updated.length && updated.length%100===0) console.log('Primary updated '+updated.length+'/'+planned.length);
  }
}
await Promise.all(Array.from({length:concurrency},()=>worker()));
console.log(JSON.stringify({primaryUpdated:updated.length,primaryFailed:failed.length,examples:failed.slice(0,8)}));
const serviceJson=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if(!serviceJson) throw new Error('Firebase mirror unavailable; primary updated, rerun mirror from audit.');
if(!getApps().length)initializeApp({credential:cert(JSON.parse(serviceJson))});
const db=getFirestore();
const previouslyMarked=rows.filter(row=>row.payload?.[stamp]===true)
  .map(row=>({id:row.id,payload:row.payload}));
const mirrorPlans=[
  ...updated.map(p=>({id:p.id,payload:p.write.payload})),
  ...previouslyMarked,
];
let mirrored=0;
const mirrorFailures=[];
for(let i=0;i<mirrorPlans.length;i+=200) {
 const group=mirrorPlans.slice(i,i+200);
 const batch=db.batch();
 for(const p of group){
   const payload=p.payload;
   // Mirror ONLY inventory fields. Preserve Firebase-only assets and Admin edits.
   const changes={stock:payload.stock,[stamp]:true,inventoryTopUpAt:payload.inventoryTopUpAt};
   if(payload.quantity !== undefined)changes.quantity=payload.quantity;
   if(Array.isArray(payload.variantMatrix))changes.variantMatrix=payload.variantMatrix;
   if(Array.isArray(payload.variants))changes.variants=payload.variants;
   batch.set(db.collection('products').doc(p.id),changes,{merge:true});
 }
 try{await batch.commit();mirrored+=group.length;}
 catch(error){mirrorFailures.push({ids:group.map(p=>p.id),error:String(error).slice(0,300)})}
}
const finish={primaryUpdated:updated.length,primaryFailed:failed,firestoreMirrored:mirrored,
 firestoreFailures:mirrorFailures,backup:backupPath};
const reportPath=path.join(process.cwd(),'scripts','inventory-topup-20261120-run.local.json');
fs.writeFileSync(reportPath,JSON.stringify(finish,null,2));
console.log(JSON.stringify({...finish,firestoreFailures:mirrorFailures.map(x=>({...x,idsCount:x.ids.length,ids:undefined}))},null,2));
if(failed.length || mirrorFailures.length)process.exitCode=1;
