import fs from 'node:fs';
import path from 'node:path';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
if(typeof process.loadEnvFile==='function')process.loadEnvFile('.env.local');
const ids='Riu6HTTbebHg9s4QoC7R QjsbPQ1r9GNDjfwyGIsa 2mhPxdjcdeyGidSf1Fqr PmO732wzz8Dgnijiyyio suSc3HQL1ZWRuiIrHTJw wU841eYNEJ7PrAz6hw9H ZTBDgwfsxf3HO3a78yj9 3WB6Vd72t3i5Odj8qTr5 04ihUwJw5f7sT2u3JOku 9XTlQw0jeTps2jWabFTg hWKL8k1q2x2B1P4gTy8t KRUVuYHMVbxVezPfG7OX qnYosUyF1kZdy9KkteUT WJIQ0A3rZWIVtJWNr1ql BNmENm8YSkltLXu5g3yd 1m52FIzZ2nkZjsJQLbk3 rNVuilIMLoT83i0m8vMM GJT1RkACu92bw07BeHZD fQPxqc3pWmWz9mfoyJmA DLRHlxZXJiA4Wfq1OPCS P3xKMYJ8IXLycKqhp0yu XAka2CHJyAaUzOTW1Ho8'.split(' ');
const multiId='PmO732wzz8Dgnijiyyio', marker='fixedWrongBabyHandSizes20261120';
const url=(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!service||!process.env.FIREBASE_SERVICE_ACCOUNT_KEY)throw Error('Admin database credentials unavailable.');
const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
const applying=process.argv.includes('--apply');
if(applying&&!process.argv.includes('--confirm=FIX_22_KIDS_HAND_SIZES_20261120'))throw Error('Exact authorization required.');
if(new Set(ids).size!==22)throw Error('Incorrect target ID count');
const now=new Date().toISOString();
if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))});
const db=getFirestore();
async function load(){
 const query=new URLSearchParams({select:'id,title,stock,price,payload,variant_matrix,variants,updated_at,sync_version',id:'in.('+ids.map(id=>'"'+id+'"').join(',')+')',limit:'50'});
 const res=await fetch(url+'/rest/v1/products?'+query,{headers,cache:'no-store'});
 if(!res.ok)throw Error('Supabase read failed '+res.status);
 const rows=await res.json();
 if(rows.length!==22)throw Error('Expected 22 source rows, received '+rows.length);
 return rows;
}
const normalize=value=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])])):value;
const rows=await load();
const docs=await db.getAll(...ids.map(id=>db.collection('products').doc(id)));
const docById=Object.fromEntries(docs.map(d=>[d.id,d]));
for(const row of rows){
 const d=docById[row.id];
 if(!d?.exists)throw Error('Missing Firebase mirror '+row.id);
 const a=row.payload||{}, b=d.data()||{};
 for(const key of ['variantMatrix','variantSizes','variantOptions','hasVariants']){
  if(JSON.stringify(normalize(a[key]??null))!==JSON.stringify(normalize(b[key]??null)))
   throw Error('Firebase/Admin differs: '+row.id+' '+key+' primary='+JSON.stringify(a[key]).slice(0,450)+' mirror='+JSON.stringify(b[key]).slice(0,450));
 }
}
const backup=path.join(process.cwd(),'scripts','kids-size-correction-20261120-backup.local.json');
if(!fs.existsSync(backup))fs.writeFileSync(backup,JSON.stringify({createdAt:now,ids,rows:rows.map(row=>({...row,firestore:docById[row.id].data()}))},null,2),{flag:'wx'});
const plan=[];
for(const row of rows){
 const original=row.payload||{};
 if(original[marker]===true && row.id===multiId) {
  const current=Array.isArray(original.variantMatrix)?original.variantMatrix:[];
  if(current.length!==4)throw Error('Expected 4 preserved designs');
  if(current.some(r=>/normal\s+hand/i.test(String(r.label||'')))) {
   const repaired=current.map((entry,index)=>({...entry,id:'design-'+String(index+1),label:String(entry.color||'Design '+(index+1))}));
   const payload={...original,variantMatrix:repaired,updatedAt:now};
   plan.push({id:row.id,expected:row.updated_at,payload,beforeStock:row.stock,beforePrice:row.price,oldRows:4,newRows:4,syncVersion:row.sync_version});
  }
  continue;
 }
 if(original[marker]===true)continue;
 const matrix=Array.isArray(original.variantMatrix)?original.variantMatrix:[];
 const sizes=Array.isArray(original.variantSizes)?original.variantSizes:[];
 const wrong=x=>/normal\s+hand/i.test(String(x||''));
 if(sizes.length!==3||!sizes.every(wrong))throw Error('Unexpected sizes '+row.id);
 if(matrix.length!==(row.id===multiId?12:3)||!matrix.every(x=>wrong(x.size)))throw Error('Unexpected matrix '+row.id);
 const colors=[...new Set(matrix.map(x=>String(x.color||'').trim()).filter(Boolean))];
 if(row.id===multiId&&(colors.length!==4||colors.some(c=>!/^Design [1-4]$/.test(c))))throw Error('Four designs not found');
 if(row.id!==multiId&&(colors.length!==1||colors[0]!=='As shown'))throw Error('Unexpected colors '+row.id);
 const surviving=row.id===multiId?colors.map(color=>{
  const entry={...matrix.find(x=>x.color===color)};
  delete entry.size;delete entry.variantSize;
  if(entry.options&&typeof entry.options==='object'){entry.options={...entry.options};delete entry.options.size;}
  return entry;
 }):[];
 const payload={...original,variantMatrix:surviving,variants:[],variantSizes:[],sizes:[],availableSizes:[],
  variantOptions:Array.isArray(original.variantOptions)?original.variantOptions.filter(x=>String(x.id||'').toLowerCase()!=='size'):[],
  hasVariants:row.id===multiId,[marker]:true,updatedAt:now};
 if(row.id!==multiId){payload.variantColors=[];payload.colors=[];}
 plan.push({id:row.id,expected:row.updated_at,payload,beforeStock:row.stock,beforePrice:row.price,oldRows:matrix.length,newRows:surviving.length,syncVersion:row.sync_version});
}
console.log(JSON.stringify({mode:applying?'apply':'dry-run',targets:rows.length,pending:plan.length,alreadyFixed:rows.length-plan.length,backup,preview:plan.slice(0,4).map(x=>({id:x.id,oldRows:x.oldRows,newRows:x.newRows}))},null,2));
if(!applying)process.exit(0);
const changed=[],failures=[];
for(const item of plan){
 try{
  const q=new URLSearchParams({id:'eq.'+item.id,updated_at:'eq.'+item.expected});
  const body={payload:item.payload,variant_matrix:item.payload.variantMatrix,variants:[],updated_at:now,
   sync_version:Number(item.syncVersion||0)+1,mirror_status:'pending'};
  const resp=await fetch(url+'/rest/v1/products?'+q,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify(body)});
  if(!resp.ok)throw Error('PATCH status '+resp.status+' '+(await resp.text()).slice(0,130));
  const returned=await resp.json();
  if(!Array.isArray(returned)||returned.length!==1)throw Error('Concurrent Admin edit: zero rows');
  changed.push(item);
 }catch(error){failures.push({id:item.id,error:String(error)})}
}
const current=await load();
const mirrorList=current.filter(row=>row.payload?.[marker]===true);
const batch=db.batch();
for(const row of mirrorList){
 const p=row.payload;
 const fields={variantMatrix:p.variantMatrix,variants:p.variants,variantSizes:p.variantSizes,
  sizes:p.sizes,availableSizes:p.availableSizes,variantOptions:p.variantOptions,
  hasVariants:p.hasVariants,[marker]:true,updatedAt:p.updatedAt};
 if(row.id!==multiId){fields.variantColors=p.variantColors;fields.colors=p.colors;}
 batch.set(db.collection('products').doc(row.id),fields,{merge:true});
}
let mirrorError=null;
try{if(mirrorList.length)await batch.commit();}catch(error){mirrorError=String(error);}
const finalRows=await load();
const freshDocs=await db.getAll(...ids.map(id=>db.collection('products').doc(id)));
const verified=finalRows.filter(row=>{
 const d=freshDocs.find(x=>x.id===row.id)?.data();
 const old=rows.find(x=>x.id===row.id);
 return row.payload?.[marker]===true&&d?.[marker]===true &&
  !JSON.stringify(row.payload.variantMatrix).includes('normal hand') &&
  !JSON.stringify(d.variantMatrix).includes('normal hand') &&
  JSON.stringify(normalize(row.payload.variantMatrix))===JSON.stringify(normalize(d.variantMatrix)) &&
  row.stock===old.stock && row.price===old.price &&
  (row.id===multiId?row.payload.variantMatrix.length===4:row.payload.variantMatrix.length===0);
});
const failedVerification=finalRows.filter(row=>!verified.some(v=>v.id===row.id)).map(row=>row.id);
const report={failedVerification,updatedPrimary:changed.length,failures,mirrored:mirrorError?0:mirrorList.length,
 mirrorError,verified:verified.length,targets:22,backup};
fs.writeFileSync(path.join(process.cwd(),'scripts','kids-size-correction-20261120-run.local.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length||mirrorError||verified.length!==22)process.exitCode=1;
