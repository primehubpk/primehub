// Version metadata for PrimeHub Social AI Android app only.
// Authored GitHub releases are a public distribution channel; app still verifies signing cert.
const OWNER='primehubpk', REPO='primehub', PREFIX='social-ai-v', ASSET='primehub-social-ai-debug.apk';
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=1800');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  try{
    const r=await fetch('https://api.github.com/repos/'+OWNER+'/'+REPO+'/releases?per_page=30',{
      headers:{accept:'application/vnd.github+json','user-agent':'PrimeHubSocialAI-Updater/1.0'},
      signal:AbortSignal.timeout(7000)
    });
    if(!r.ok)throw Error('Releases unavailable');
    const releases=await r.json();
    if(!Array.isArray(releases))throw Error('Invalid releases');
    let best=null;
    for(const release of releases){
      if(release.draft||release.prerelease)continue;
      const match=new RegExp('^'+PREFIX+'([1-9][0-9]{0,5})$').exec(release.tag_name||'');
      if(!match)continue;
      const code=Number(match[1]);
      if(!Number.isSafeInteger(code))continue;
      const asset=release.assets?.find(a=>a.name===ASSET&&typeof a.digest==='string'&&/^sha256:[a-f0-9]{64}$/i.test(a.digest));
      if(!asset)continue;
      const url='https://github.com/'+OWNER+'/'+REPO+'/releases/download/'+release.tag_name+'/'+ASSET;
      if(!best||code>best.versionCode)best={versionCode:code,versionName:release.name||'PrimeHub Social AI',apkUrl:url,sha256:asset.digest.slice(7).toLowerCase(),packageName:'com.primehub.socialai.debug',releaseNotes:(release.body||'').slice(0,600)};
    }
    return res.status(200).json(best||{versionCode:0,status:'not_published',message:'A stable signed Android update is not available yet. Your installed APK cannot silently update.'});
  }catch(e){
    console.error('Android update check error',e.message);
    return res.status(503).json({error:'Update information temporarily unavailable.'});
  }
}
