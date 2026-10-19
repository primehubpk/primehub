import {executePairing} from './pairing-backend.mjs';
import {checkTikTokByPairCode} from './tiktok-login.mjs';
import {viewOwnerScreen,ownerNavigate} from './agent-bridge.mjs';
// PrimeHub Social AI - public, stateless read-only MCP connector.
// IMPORTANT: This server does NOT access an Android device or social account.
// It only prepares owner-reviewable handoff links for a separate native app.
export const MCP_MODERN = '2026-07-28';
export const MCP_LEGACY = '2025-11-25';
export const SOCIAL_ORIGIN = 'https://primehub-social-ai-primehubmall.vercel.app';
export const SERVER_INFO = {name:'primehub-social-ai-handoff', version:'0.1.0'};
export const CAPABILITIES = [
  'Generate owner-reviewable TikTok/Facebook/Instagram/YouTube/Google Business post drafts',
  'Create a tappable HTTPS link to PrimeHub Social AI Android task inbox',
  'Explain which steps need mobile owner approval'
];
export const LIMIT = 8000;
const OWNER_PAIR_TOOLS = [
  { name:'pair_owner_android_device', title:'Pair private Android device',
    description:'Only pair a phone when the owner provides the 26-character code shown on the Android device. Does not permit phone screen access or app control.',
    inputSchema:{type:'object',properties:{owner_pair_code:{type:'string',minLength:26,maxLength:26}},required:['owner_pair_code'],additionalProperties:false},
    annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false} },
  { name:'check_owner_android_connection', title:'Check paired phone status',
    description:'Read pairing status only while the phone pairing screen is running. Requires a private pairing code; does not read other applications.',
    inputSchema:{type:'object',properties:{owner_pair_code:{type:'string',minLength:26,maxLength:26}},required:['owner_pair_code'],additionalProperties:false},
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false} },
  { name:'check_owner_tiktok_account', title:'Check owner-authorized TikTok account',
    description:'Read TikTok verified identity after owner OAuth; requires the private Android pairing code. No TikTok tokens, cookies, app control or automatic posting.',
    inputSchema:{type:'object',properties:{owner_pair_code:{type:'string',minLength:26,maxLength:26}},required:['owner_pair_code'],additionalProperties:false},
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false} }
];
const AGENT_TOOLS=[
 {name:'inspect_owner_android_screen',title:'Inspect my owner-approved Android TikTok screen',
 description:'Only when owner explicitly starts a time-limited navigation session in PrimeHub Social AI on their Android phone and gives you the NEW 26-character session code. Read its currently visible sanitized Accessibility labels. TikTok only; no screenshots, video/audio, messages, typed text or private credentials. If offline, ask owner to keep TikTok open. This does not publish posts.',
 inputSchema:{type:'object',properties:{owner_session_code:{type:'string',minLength:26,maxLength:26}},required:['owner_session_code'],additionalProperties:false},
 annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:'navigate_owner_android',title:'Navigate TikTok with owner-approved Android session',
 description:'During the owners live 15-minute TikTok-only Android session, perform ONE low-risk navigation operation based on a FRESH inspected screen revision. Actions: tap exact visible safe label, scroll forward/backward or Android Back. Never post, publish, message, comment, follow, like, delete, pay, change account or enter text. An expired session or stale screen prevents action. Use inspect_owner_android_screen again afterward.',
 inputSchema:{type:'object',properties:{
    owner_session_code:{type:'string',minLength:26,maxLength:26},
    operation:{type:'string',enum:['tap_label','scroll_forward','scroll_backward','back']},
    label:{type:'string',maxLength:65,description:'Exact visible label; only for tap_label'},
    expected_revision:{type:'integer',minimum:0}
 },required:['owner_session_code','operation','expected_revision'],additionalProperties:false},
 annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}}
];
const platforms = Object.freeze(['TikTok','Facebook','Instagram','YouTube','Google Business']);
export const TOOL_DEFS = [
  ...OWNER_PAIR_TOOLS,
  ...AGENT_TOOLS,
  {
    name: 'prepare_android_post',
    title: 'Prepare a post for PrimeHub Social AI Android',
    description: 'Use this when a PrimeHub Social AI owner wants a caption/task sent to their Android app. Generate a review link; the user must tap it and approve inside their phone. DOES NOT post, schedule an online platform, log in, control a device, or save private data remotely.',
    inputSchema: {
      type:'object',
      properties: {
        title:{type:'string',minLength:1,maxLength:100,description:'Short name for the post'},
        caption:{type:'string',minLength:1,maxLength:2400,description:'Post copy/hashtags; text only, no credentials'},
        platform:{type:'string',enum:platforms,description:'One target social platform'},
        reminder_at_ms:{type:'integer',minimum:0,description:'Optional Unix epoch milliseconds for an approximate Android local reminder (0 for none). This is NOT automatic publishing.'}
      },
      required:['title','caption','platform'],
      additionalProperties:false
    },
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
  },
  {
    name: 'android_bridge_capabilities',
    title: 'Describe PrimeHub Social AI Android bridge capabilities',
    description: 'Use to clarify what the connected MCP plugin can actually do with the PrimeHub Android app, and what it cannot. Explains user confirmation, device isolation, and why installing app shortcuts does not grant access to the installed apps.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
  }
];
export function toolResult(data, error=false) {
  return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,...(error?{isError:true}:{})};
}
const own=Object.hasOwn || ((o,k)=>Object.prototype.hasOwnProperty.call(o,k));
const hasOwn=(o,k)=>own(o,k);
export function buildHandoff(args, time=Date.now()) {
  if (!args || typeof args!=='object' || Array.isArray(args)) throw new Error('Arguments must be an object.');
  const accepted=new Set(['title','caption','platform','reminder_at_ms']);
  if(Object.keys(args).some(k=>!accepted.has(k)))throw new Error('Unexpected parameter.');
  const {title,caption,platform,reminder_at_ms}=args;
  if(typeof title!=='string'||typeof caption!=='string'||typeof platform!=='string')
    throw new Error('Title, caption and platform must be strings.');
  if(!title.trim()||title.length>100||!caption.trim()||caption.length>2400)
    throw new Error('Title must be 1–100 characters and caption 1–2400 characters.');
  if(!platforms.includes(platform))throw new Error('Unsupported social platform.');
  const at=reminder_at_ms===undefined?0:reminder_at_ms;
  if(!Number.isSafeInteger(at)||at<0||(at>0 && (at<time || at>time+366*86_400_000)))
    throw new Error('reminder_at_ms must be 0 or a future Unix millisecond timestamp within a year.');
  // This URL contains post text as visible query parameters: never place personal data or tokens in a caption.
  const params=new URLSearchParams({title:title.trim(),caption:caption.trim(),platform,at:String(at)});
  const deeplink='primehubsocial://import?'+params.toString();
  if(deeplink.length>4200) throw new Error('Post text too long for mobile handoff; shorten it.');
  const url=SOCIAL_ORIGIN+'/handoff.html?'+params.toString();
  if(url.length>4300) throw new Error('Handoff link too long.');
  return {
    title:title.trim(),
    platform,
    preview_url:url,
    next_step:'On your Android phone open the preview_url, tap Open PrimeHub Social AI Android, read the draft, then approve Save to my tasks.',
    reminder:at>0?'Approximate local notification only; Android power management can delay it.':'No reminder requested.',
    requires_owner_approval:true,
    saved_to_device:false,
    automatically_published:false,
    remotely_connected_to_social_app:false,
    privacy:'The preview link embeds your post title and caption in its URL. Never include passwords, tokens, customer details or sensitive data.'
  };
}
export function capabilities() {
  return {
    product:'PrimeHub Social AI Android + ChatGPT handoff bridge',
    status:'MCP draft-link generation only (owner approval required)',
    can:CAPABILITIES,
    cannot:['Read a phone screen','Use or extract TikTok/Instagram/Google login cookies','Press buttons in installed Android applications','Publish social posts automatically','Access Google Business Profile via installed Google Maps','Queue instructions on a phone in the background without it opening a handoff link'],
    native_apps:'Android installed-app shortcuts launch their real apps, preserving the app provider login independently; no connector privileges are implied.',
    note:'Native automation requires a separate secure device-pairing component and platform-compliant user authorization. This MCP endpoint does not expose a remote-control tool.'
  };
}
export function processRpc(payload, headers={}) {
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.jsonrpc!=='2.0'||typeof payload.method!=='string')
    return {jsonrpc:'2.0',id:payload?.id??null,error:{code:-32600,message:'Invalid JSON-RPC 2.0 request'}};
  const id=payload.id??null;
  const method=payload.method;
  const params=(payload.params&&typeof payload.params==='object'&&!Array.isArray(payload.params))?payload.params:{};
  const modern=headers['mcp-protocol-version']===MCP_MODERN || params._meta?.['io.modelcontextprotocol/protocolVersion']===MCP_MODERN;
  if(modern && (headers['mcp-method']!==method ||
    (method==='tools/call' && headers['mcp-name']!==params.name)))
    return {jsonrpc:'2.0',id,error:{code:-32020,message:'MCP routing headers do not match'}};
  let result;
  if(method==='server/discover'){
    result={
      supportedVersions:[MCP_MODERN,MCP_LEGACY],
      capabilities:{tools:{listChanged:false}},
      instructions:'PrimeHub Social AI prepares only owner-reviewed Android tasks. NEVER claim to control the Android device, log in to Facebook/TikTok/Google or publish automatically. The user must explicitly open the generated link and approve in their own native app.',
      ttlMs:60_000,cacheScope:'public',
      _meta:{'io.modelcontextprotocol/serverInfo':SERVER_INFO}
    };
  }else if(method==='initialize'){
    result={protocolVersion:MCP_LEGACY,capabilities:{tools:{listChanged:false}},serverInfo:SERVER_INFO,
      instructions:'Read-only post handoff generation. User must open generated link on their Android device and approve.'};
  }else if(method==='ping'){
    result={};
  }else if(method==='tools/list'){
    result={tools:TOOL_DEFS,...(modern?{ttlMs:60_000,cacheScope:'public'}:{})};
  }else if(method==='tools/call'){
    const args=params.arguments;
    if(params.name==='android_bridge_capabilities'){
      result=toolResult(capabilities());
    }else if(params.name==='prepare_android_post'){
      try{ result=toolResult(buildHandoff(args)); }
      catch(e){result=toolResult({error:e.message||'Invalid draft'},true);}
    }else{
      return {jsonrpc:'2.0',id,error:{code:-32602,message:'Unknown tool'}};
    }
  }else{
    return {jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}};
  }
  if(modern && ['server/discover','tools/list','tools/call'].includes(method))result={resultType:'complete',...result,_meta:{...(result._meta||{}),'io.modelcontextprotocol/serverInfo':SERVER_INFO}};
  return {jsonrpc:'2.0',id,result};
}

// Keep the original synchronous JSON-RPC adapter for existing, read-only tools.
// Owner pairing RPC requires async HTTPS and is handled separately. No secrets logged.
export async function processRpcWithPairing(payload,headers={}) {
  const method=payload?.method,params=payload?.params;
  const target=params?.name;
  if(method!=='tools/call'||!['pair_owner_android_device','check_owner_android_connection','check_owner_tiktok_account','inspect_owner_android_screen','navigate_owner_android'].includes(target))
    return processRpc(payload,headers);
  const id=payload?.id??null;
  if(payload.jsonrpc!=='2.0'||typeof id!=='number'&&typeof id!=='string')
    return {jsonrpc:'2.0',id,error:{code:-32600,message:'Invalid JSON-RPC request'}};
  const modern=headers['mcp-protocol-version']===MCP_MODERN ||
    params?._meta?.['io.modelcontextprotocol/protocolVersion']===MCP_MODERN;
  if(modern && (headers['mcp-method']!==method||headers['mcp-name']!==target))
    return {jsonrpc:'2.0',id,error:{code:-32020,message:'MCP routing headers do not match'}};
  const args=params.arguments;
  if(target==='inspect_owner_android_screen'||target==='navigate_owner_android'){
    try{
      if(!args||typeof args!=='object'||Array.isArray(args)||
        !/^[A-Z2-7]{26}$/.test(args.owner_session_code||'')||
        Object.keys(args).some(x=>!['owner_session_code','operation','label','expected_revision'].includes(x)))
        throw Error('Valid personal Android live-session code required');
      let out;
      if(target==='inspect_owner_android_screen'){
        if(Object.keys(args).some(x=>x!=='owner_session_code'))throw Error('Unexpected argument');
        out=await viewOwnerScreen(args.owner_session_code);
      }else{
        out=await ownerNavigate(args.owner_session_code,args.operation,args.expected_revision,args.label);
      }
      let response=toolResult(out,out.active===false||out.queued===false);
      if(modern)response={resultType:'complete',...response,
        _meta:{'io.modelcontextprotocol/serverInfo':SERVER_INFO}};
      return {jsonrpc:'2.0',id,result:response};
    }catch(err){
      return {jsonrpc:'2.0',id,result:toolResult({error:err.message||'Owner navigation unavailable'},true)};
    }
  }
  if(!args||typeof args!=='object'||Array.isArray(args)||
    Object.keys(args).some(x=>x!=='owner_pair_code')||
    !/^[A-Z2-7]{26}$/.test(args.owner_pair_code||''))
    return {jsonrpc:'2.0',id,result:toolResult({error:'A valid private 26-character owner code is required.'},true)};
  try{
    const result=target==='check_owner_tiktok_account'?
      {ok:true,result:await checkTikTokByPairCode(args.owner_pair_code)}:
      await executePairing(target==='pair_owner_android_device'?'finish':'status',{code:args.owner_pair_code});
    const data=result.ok?result.result:{error:result.error};
    // No secrets, pairing tokens, raw device identifiers, or customer data in tool outputs.
    const safe=target==='check_owner_tiktok_account'?
      {authorized:data?.authorized===true,connected:data?.connected===true,
       display_name:data?.connected===true?data?.display_name:null,
       verified_at:data?.connected===true?data?.verified_at:null,
       can_publish:false,can_control_app:false,
       note:'TikTok Login Kit identity verification only; TikTok Developer Login Kit setup required first.'}:
      target==='pair_owner_android_device'?
      {paired:data?.paired===true,message:data?.message||data?.reason||data?.error||'Pairing not completed',
       reminder:'Keep the Pairing screen open to report presence. No remote control or automatic posting is enabled.'}:
      {found:data?.found===true,paired:data?.paired===true,online:data?.online===true,
       last_seen:data?.last_seen||null,
       capabilities:['owner-approved task handoff','foreground-only heartbeat'],
       can_control_other_apps:false};
    let response=toolResult(safe,!result.ok);
    if(modern)response={resultType:'complete',...response,
      _meta:{'io.modelcontextprotocol/serverInfo':SERVER_INFO}};
    return {jsonrpc:'2.0',id,result:response};
  }catch{
    return {jsonrpc:'2.0',id,result:toolResult({error:'Pairing service unavailable.'},true)};
  }
}
