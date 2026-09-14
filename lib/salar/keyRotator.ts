import 'server-only';

type SalarPurpose = 'text' | 'vision';
type Provider = 'groq' | 'gemini' | 'openrouter';
export type SalarLlmToolCall = { id: string; name: string; arguments: Record<string, any>; rawArguments: string };
export type SalarLlmMessage = { role: 'system'|'user'|'assistant'|'tool'; content: unknown; name?: string; tool_call_id?: string; tool_calls?: Array<{ id:string; type:'function'; function:{ name:string; arguments:string } }> };
export type SalarToolDefinition = { name: string; description: string; parameters: Record<string, unknown> };
type LastGood = { provider: Provider; index: number; at: number };
type CompletionResult = { text: string; toolCalls: SalarLlmToolCall[]; provider: Provider; keyIndex: number; model: string };

const LAST_GOOD_TTL_MS = 15 * 60 * 1000;
const DEAD_KEY_TTL_MS = 5 * 60 * 1000;
export const SALAR_SAFE_ERROR_MESSAGE = 'Sorry, Salar is temporarily unavailable. Please contact PrimeHub at 03238878009.';

declare global {
  // eslint-disable-next-line no-var
  var __salarLastGood: LastGood | undefined;
  // eslint-disable-next-line no-var
  var __salarDeadKeySlots: Map<string, number> | undefined;
}

class RotatableProviderError extends Error { constructor(readonly status: number | null, readonly code: string, readonly keyRejected: boolean) { super(code); } }
class SalarServiceError extends Error {}
export function parseKeys(value?: string | null): string[] { return String(value || '').split(',').map((x)=>x.trim()).filter(Boolean); }
function unique(values:string[]){return [...new Set(values.map((value)=>value.trim()).filter(Boolean))];}
function envList(...names:string[]){return unique(names.flatMap((name)=>parseKeys(process.env[name])));}
function modelList(names:string[],fallbacks:string[]){return unique([...names.flatMap((name)=>parseKeys(process.env[name])),...fallbacks]);}
function deadMap(){ if(!globalThis.__salarDeadKeySlots) globalThis.__salarDeadKeySlots=new Map(); return globalThis.__salarDeadKeySlots; }
function slot(provider:Provider,index:number){return `${provider}:${index}`;}
function markDead(provider:Provider,index:number){deadMap().set(slot(provider,index),Date.now()+DEAD_KEY_TTL_MS);}
function clearDead(provider:Provider,index:number){deadMap().delete(slot(provider,index));}
function isCooling(provider:Provider,index:number){const until=deadMap().get(slot(provider,index))||0;if(until<=Date.now()){deadMap().delete(slot(provider,index));return false;}return true;}
function currentLastGood(){const v=globalThis.__salarLastGood;if(!v||Date.now()-v.at>LAST_GOOD_TTL_MS)return undefined;return v;}
function remember(provider:Provider,index:number){globalThis.__salarLastGood={provider,index,at:Date.now()};clearDead(provider,index);}
function keyOrder(provider:Provider,length:number){if(length<=0)return[];const last=currentLastGood();const start=last?.provider===provider&&last.index>=0&&last.index<length?last.index:0;return Array.from({length},(_,o)=>(start+o)%length).filter((index)=>!isCooling(provider,index));}
function textFromContent(content:unknown){if(typeof content==='string')return content;if(Array.isArray(content))return content.map((p)=>typeof p==='string'?p:p&&typeof p==='object'&&'text'in p?String((p as any).text||''):'').filter(Boolean).join('\n');return content==null?'':String(content);}
function safeJsonObject(value:unknown):Record<string,any>{if(value&&typeof value==='object'&&!Array.isArray(value))return value as Record<string,any>;if(typeof value!=='string')return{};try{const p=JSON.parse(value);return p&&typeof p==='object'&&!Array.isArray(p)?p:{};}catch{return{};}}
function normalizedToolCalls(raw:any):SalarLlmToolCall[]{if(!Array.isArray(raw))return[];return raw.map((call:any,index:number)=>{const rawArguments=typeof call?.function?.arguments==='string'?call.function.arguments:JSON.stringify(call?.function?.arguments||{});return{id:String(call?.id||`tool-${index+1}`),name:String(call?.function?.name||''),arguments:safeJsonObject(rawArguments),rawArguments};}).filter((c)=>c.name);}
function geminiSchema(value:unknown):any{if(Array.isArray(value))return value.map(geminiSchema);if(!value||typeof value!=='object')return value;const out:Record<string,any>={};for(const [k,v] of Object.entries(value as Record<string,unknown>)){if(k==='additionalProperties')continue;out[k]=geminiSchema(v);}return out;}
function shouldRotate(status:number,payload:string){if([400,404,413,422].includes(status))return false;return [401,403,429].includes(status)||/quota|billing|resource[_\s-]?exhausted|rate[_\s-]?limit|too many requests|api.?key|unauthorized|forbidden|authentication/i.test(payload);}
async function requestJson(url:string,init:RequestInit){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{...init,signal:controller.signal,cache:'no-store'});const text=await response.text();let json:any=null;try{json=text?JSON.parse(text):null;}catch{}return{response,text,json};}finally{clearTimeout(timeout);}}
function openAiTools(tools:SalarToolDefinition[]){return tools.map((tool)=>({type:'function',function:{name:tool.name,description:tool.description,parameters:tool.parameters}}));}

async function callOpenAiCompatible(url:string,key:string,model:string,messages:SalarLlmMessage[],maxTokens:number,tools:SalarToolDefinition[]){const body:Record<string,any>={model,messages,temperature:0,max_tokens:maxTokens};if(tools.length){body.tools=openAiTools(tools);body.tool_choice='auto';}const{response,text,json}=await requestJson(url,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw new RotatableProviderError(response.status,'http_error',shouldRotate(response.status,text));const message=json?.choices?.[0]?.message||{};const toolCalls=normalizedToolCalls(message.tool_calls);const value=typeof message.content==='string'?message.content.trim():'';if(!value&&!toolCalls.length)throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);return{text:value,toolCalls};}
function geminiContents(messages:SalarLlmMessage[]){const contents:any[]=[];for(const message of messages){if(message.role==='system')continue;if(message.role==='tool'){contents.push({role:'user',parts:[{functionResponse:{name:message.name||'tool',response:safeJsonObject(textFromContent(message.content))}}]});continue;}const parts:any[]=[];const text=textFromContent(message.content);if(text)parts.push({text});if(message.role==='assistant'&&Array.isArray(message.tool_calls))for(const call of message.tool_calls)parts.push({functionCall:{name:call.function.name,args:safeJsonObject(call.function.arguments)}});if(parts.length)contents.push({role:message.role==='assistant'?'model':'user',parts});}return contents;}
async function callGemini(key:string,model:string,messages:SalarLlmMessage[],maxTokens:number,tools:SalarToolDefinition[]){const systemText=messages.filter((m)=>m.role==='system').map((m)=>textFromContent(m.content)).filter(Boolean).join('\n');const body:Record<string,any>={contents:geminiContents(messages),generationConfig:{maxOutputTokens:maxTokens,temperature:0}};if(!body.contents.length)body.contents=[{role:'user',parts:[{text:'ping'}]}];if(systemText)body.systemInstruction={parts:[{text:systemText}]};if(tools.length)body.tools=[{functionDeclarations:tools.map((tool)=>({name:tool.name,description:tool.description,parameters:geminiSchema(tool.parameters)}))}];const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;const{response,text,json}=await requestJson(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw new RotatableProviderError(response.status,'http_error',shouldRotate(response.status,text));const parts=Array.isArray(json?.candidates?.[0]?.content?.parts)?json.candidates[0].content.parts:[];const value=parts.map((p:any)=>typeof p?.text==='string'?p.text:'').join('').trim();const toolCalls=parts.map((p:any,index:number)=>p?.functionCall?({id:`gemini-${index+1}`,name:String(p.functionCall.name||''),arguments:safeJsonObject(p.functionCall.args),rawArguments:JSON.stringify(p.functionCall.args||{})}):null).filter(Boolean) as SalarLlmToolCall[];if(!value&&!toolCalls.length)throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);return{text:value,toolCalls};}

async function attemptProvider(provider:Provider,keys:string[],models:string[],messages:SalarLlmMessage[],purpose:SalarPurpose,maxTokens:number,tools:SalarToolDefinition[]):Promise<CompletionResult|null>{
  if(!keys.length||!models.length)return null;
  for(const model of models){
    const order=keyOrder(provider,keys.length);
    if(!order.length)break;
    for(const index of order){
      try{
        const result=provider==='groq'
          ?await callOpenAiCompatible('https://api.groq.com/openai/v1/chat/completions',keys[index],model,messages,maxTokens,tools)
          :provider==='gemini'
            ?await callGemini(keys[index],model,messages,maxTokens,tools)
            :await callOpenAiCompatible('https://openrouter.ai/api/v1/chat/completions',keys[index],model,messages,maxTokens,tools);
        remember(provider,index);
        console.info('[salar-provider] completion succeeded',{provider,model,keySlot:index+1,purpose});
        return{...result,provider,keyIndex:index,model};
      }catch(error){
        if(error instanceof RotatableProviderError){
          console.warn('[salar-provider] attempt failed',{provider,model,keySlot:index+1,status:error.status,code:error.code,keyRejected:error.keyRejected});
          if(error.keyRejected){markDead(provider,index);continue;}
          break;
        }
        console.warn('[salar-provider] attempt failed',{provider,model,keySlot:index+1,status:null,code:error instanceof Error?error.name:'unknown',keyRejected:false});
        // A transport timeout/fetch failure can be transient or isolated to one attempt.
        // Continue through the remaining key slots before falling back to another provider.
        continue;
      }
    }
  }
  return null;
}
async function runCompletion(messages:SalarLlmMessage[],purpose:SalarPurpose,maxTokens:number,tools:SalarToolDefinition[]):Promise<CompletionResult>{
  const providers:Array<{provider:Provider;keys:string[];models:string[]}>= [
    {provider:'groq',keys:envList('GROQ_API_KEYS','GROQ_API_KEY'),models:modelList(['GROQ_MODELS','GROQ_MODEL'],['openai/gpt-oss-120b','openai/gpt-oss-20b'])},
    {provider:'gemini',keys:envList('GEMINI_API_KEYS','GEMINI_API_KEY'),models:modelList(['GEMINI_MODELS','GEMINI_MODEL'],['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-3.1-flash-lite'])},
    {provider:'openrouter',keys:envList('OPENROUTER_API_KEYS','OPENROUTER_API_KEY'),models:modelList(['OPENROUTER_MODELS','OPENROUTER_MODEL'],['openrouter/auto'])},
  ];
  for(const item of providers){const result=await attemptProvider(item.provider,item.keys,item.models,messages,purpose,maxTokens,tools);if(result)return result;}
  console.error('[salar-provider] all providers unavailable',{configured:providers.map((item)=>({provider:item.provider,keyCount:item.keys.length,modelCount:item.models.length}))});
  throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
}
export async function chatCompletion({messages,purpose}:{messages:SalarLlmMessage[];purpose:SalarPurpose}){try{return(await runCompletion(messages,purpose,256,[])).text;}catch{throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);}}
export async function chatCompletionWithTools({messages,tools=[]}:{messages:SalarLlmMessage[];tools?:SalarToolDefinition[]}){try{return await runCompletion(messages,'text',700,tools);}catch{throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);}}
export async function ping():Promise<{ok:true;provider:Provider;keyIndex:number;model:string}>{try{const result=await runCompletion([{role:'user',content:'Reply with OK only.'}],'text',32,[]);return{ok:true,provider:result.provider,keyIndex:result.keyIndex,model:result.model};}catch{throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);}}
