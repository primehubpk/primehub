// Owner-only pairing with cryptographic knowledge proofs (no device control).
// Supabase legacy ANON key is a publishable key used only for hardened RLS RPCs.
// No service-role keys, no customer tables, no writes outside isolated pairing table.
const RPC={
  begin:'ph_social_begin_pair',
  finish:'ph_social_finish_pair',
  heartbeat:'ph_social_heartbeat',
  status:'ph_social_owner_status',
  revoke:'ph_social_revoke'
};
const text=x=>typeof x==='string'?x:'';
export async function executePairing(action,params={}) {
  const rpc=RPC[action];
  if(!rpc)throw Object.assign(new Error('Unknown pairing operation'),{status:400});
  let payload;
  const code=text(params.code);
  const id=text(params.deviceId),secret=text(params.deviceToken);
  if(action==='finish'||action==='status'){
    if(!/^[A-Z2-7]{26}$/.test(code))throw Object.assign(new Error('Valid 26-character pairing code required'),{status:400});
    payload={p_pair_code:code};
  }else{
    if(!/^[0-9a-fA-F-]{36}$/.test(id) || !/^[a-f0-9]{64}$/.test(secret))
      throw Object.assign(new Error('Invalid device identity'),{status:400});
    payload={p_device_id:id,p_device_token:secret};
    if(action==='begin'){
      if(!/^[A-Z2-7]{26}$/.test(code))throw Object.assign(new Error('Invalid pairing code'),{status:400});
      payload.p_pair_code=code;
    }
  }
  const url=process.env.PH_SOCIAL_PAIR_SUPABASE_URL;
  const apiKey=process.env.PH_SOCIAL_PAIR_SUPABASE_ANON;
  if(!url||!apiKey)throw Object.assign(new Error('Pairing backend is not configured'),{status:503});
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw new Error('Invalid backend configuration');
  const res=await fetch(url+'/rest/v1/rpc/'+rpc,{
    method:'POST',headers:{'content-type':'application/json',apikey:apiKey,authorization:'Bearer '+apiKey},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)
  });
  if(!res.ok){
    // Deliberately never disclose Supabase error details or credentials.
    if(res.status===429)return {ok:false,error:'Too many requests, try later.'};
    return {ok:false,error:'Pairing unavailable or rejected ('+res.status+').'};
  }
  let result;
  try{result=await res.json()}catch{return {ok:false,error:'Unexpected pairing response.'}}
  return {ok:true,result};
}
export const availablePairOperations=Object.freeze(Object.keys(RPC));
