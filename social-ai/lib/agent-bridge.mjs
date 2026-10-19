// PrimeHub Social AI owner Android screen/navigation agent.
// Small, user-consented and time-limited. Never reads credentials or controls native apps
// without Android owner activation and fresh 26-character session capability.
const ENDPOINTS=Object.freeze({
 start:'ph_social_agent_start',stop:'ph_social_agent_stop',
 push:'ph_social_agent_update_screen',poll:'ph_social_agent_poll',
 complete:'ph_social_agent_complete',view:'ph_social_agent_view',
 queue:'ph_social_agent_queue'
});
const SESSION_RE=/^[A-Z2-7]{26}$/;
const ID_RE=/^[a-f0-9-]{36}$/i;
const TOKEN_RE=/^[a-f0-9]{64}$/;
const OPS=Object.freeze(['tap_label','scroll_forward','scroll_backward','back']);

export async function agentRpc(op,fields={}) {
 if(!Object.hasOwn(ENDPOINTS,op))throw Error('Unknown agent RPC');
 const base=process.env.PH_SOCIAL_PAIR_SUPABASE_URL;
 const key=process.env.PH_SOCIAL_PAIR_SUPABASE_ANON;
 if(!base||!key||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base))
   throw Error('Private agent database is not configured');
 const response=await fetch(base+'/rest/v1/rpc/'+ENDPOINTS[op],{
   method:'POST',headers:{'content-type':'application/json','apikey':key,'authorization':'Bearer '+key},
   body:JSON.stringify(fields),signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw Error('Private agent operation was rejected ('+response.status+')');
 const data=await response.json();
 if(!data||typeof data!=='object')throw Error('Invalid agent response');
 return data;
}
export function validateAgentDevice(request) {
 if(!request||typeof request!=='object'||!ID_RE.test(request.deviceId||'')||!TOKEN_RE.test(request.deviceToken||''))
  throw Error('Invalid device identity');
 return {p_device_id:request.deviceId,p_device_token:request.deviceToken};
}
export function validateAgentSession(code){
 if(typeof code!=='string'||!SESSION_RE.test(code))throw Error('Invalid or expired owner session code');
 return code;
}
export async function viewOwnerScreen(code) {
 return await agentRpc('view',{p_session_code:validateAgentSession(code)});
}
export async function ownerNavigate(code,action,revision,label=''){
 validateAgentSession(code);
 if(!OPS.includes(action)||!Number.isInteger(revision)||revision<0||revision>2147483647)
  throw Error('Invalid navigation request');
 if(action==='tap_label' && (typeof label!=='string'||label.length<1||label.length>65))
  throw Error('Choose an exact button label from the most recent screen');
 if(action!=='tap_label')label='';
 // Server-side Postgres function enforces exact label availability, session expiry,
 // revision matching, one outstanding action and blocks sensitive actions.
 return await agentRpc('queue',{
   p_session_code:code,p_operation:action,p_label:label||null,p_expected_revision:revision
 });
}
