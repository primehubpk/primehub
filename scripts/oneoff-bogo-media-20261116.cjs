
'use strict';
// One-time BOGO media transfer. DO NOT MERGE: temporary signed media URLs expire.
const crypto=require('node:crypto');
const {S3Client,PutObjectCommand}=require('@aws-sdk/client-s3');
const urls={"gold":"https://sdmntpritalynorth.oaiusercontent.com/files/00000000-43b8-8246-aa41-12a6fee9117b/raw?se=2026-11-16T06%3A16%3A37Z&sp=r&sv=2026-06-06&sr=b&scid=ee268f14-accb-515b-834c-7e4ba812f993&skoid=82a3371f-2f6c-4f81-8a78-2701b362559b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-11-15T09%3A23%3A31Z&ske=2026-11-16T09%3A23%3A31Z&sks=b&skv=2026-06-06&sig=lmLWECU7S7lacic00gWms1GHz8EijnI9zGOobuadAcU%3D","silver":"https://sdmntpritalynorth.oaiusercontent.com/files/00000000-0bf0-8246-bb82-1bd21d7390b0/raw?se=2026-11-16T06%3A16%3A37Z&sp=r&sv=2026-06-06&sr=b&scid=b2125990-5e0a-5e9b-ace9-22a67e13348d&skoid=82a3371f-2f6c-4f81-8a78-2701b362559b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-11-15T15%3A47%3A20Z&ske=2026-11-16T15%3A47%3A20Z&sks=b&skv=2026-06-06&sig=XKcU3ps0tI0yXJbBFAI/vovyzCz2OLH4R4UN/jmSj7o%3D"};
const expected={gold:{size:98740,sha:'9e8e9d6e4287edfa1e94eb9c8fc557f2fcc75e5c92d7a2f8e5b99213bcd186f9',key:'products/bogo-nov16/gold-ball-bead-9e8e9d6e4287.webp'},silver:{size:94274,sha:'15172d207ec635e6c98d273989d1a7d43398c5f1885b1df0adf3b8ff77b8cf6a',key:'products/bogo-nov16/silver-ball-bead-15172d207ec6.webp'}};
const required=n=>{const x=process.env[n]?.trim();if(!x)throw Error('Required image storage environment missing: '+n);return x;};
(async()=>{
 const account=required('R2_ACCOUNT_ID'),bucket=required('R2_BUCKET_NAME');
 const base=required('R2_PUBLIC_BASE_URL').replace(/\/+$/,'');
 const r2=new S3Client({endpoint:'https://'+account+'.r2.cloudflarestorage.com',region:'auto',credentials:{accessKeyId:required('R2_ACCESS_KEY_ID'),secretAccessKey:required('R2_SECRET_ACCESS_KEY')}});
 for(const [name,info] of Object.entries(expected)){
   const incoming=await fetch(urls[name],{cache:'no-store'});
   if(!incoming.ok)throw Error(name+' source download HTTP '+incoming.status);
   const image=Buffer.from(await incoming.arrayBuffer());
   const hash=crypto.createHash('sha256').update(image).digest('hex');
   if(image.length!==info.size||hash!==info.sha||image.subarray(0,4).toString('latin1')!=='RIFF')throw Error(name+' media integrity mismatch');
   await r2.send(new PutObjectCommand({Bucket:bucket,Key:info.key,Body:image,ContentType:'image/webp',CacheControl:'public,max-age=31536000,immutable'}));
   const target=base+'/'+info.key;
   const resp=await fetch(target,{cache:'no-store'});
   if(!resp.ok)throw Error(name+' CDN verification HTTP '+resp.status);
   const actual=Buffer.from(await resp.arrayBuffer());
   if(actual.length!==info.size||crypto.createHash('sha256').update(actual).digest('hex')!==hash)throw Error(name+' CDN image checksum mismatch');
   console.log('VERIFIED '+name+' '+actual.length+' bytes '+target);
 }
})().catch(error=>{console.error('BOGO one-off upload failed: '+error.message);process.exitCode=1;});
