import { NextResponse } from 'next/server';
import { consumeSalarRateLimit, ensureSalarConversation, listConversationMessages, normalizeMessageText, readSalarSid, SALAR_UNBLOCK_EMAIL, verifiedCustomerUid } from '@/lib/salar/chatStore';
import { buildSalarBrainPrompt } from '@/lib/salar/brainStore';
import { chatCompletionWithTools, SALAR_SAFE_ERROR_MESSAGE, type SalarLlmMessage, type SalarToolDefinition } from '@/lib/salar/keyRotator';
import { runWorker } from '@/lib/salar/worker';
import { refreshSalarCatalogue } from '@/lib/salar/catalogIndex';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { isR2PublicUrl } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PHONE = '03238878009';
const ADVANCE = 300;
const ALLOWED_TOPICS = new Set(['reseller_club', 'prime_skill', 'shopping']);
const TOOLS: SalarToolDefinition[] = [
  { name: 'catalogue', description: 'Search the verified PrimeHub catalogue for collections or products. Use q for a broad need or an exact product/category phrase; use collection for a chosen collection and productId for one exact recent card. If the customer asks for a named item’s photo/image, call this tool with the customer’s exact wording so the real product card and image can be rendered. Never answer a product-image request from memory.', parameters: { type: 'object', properties: { q: { type: 'string' }, collection: { type: 'string' }, collectionId: { type: 'string' }, productId: { type: 'string' }, limit: { type: 'number' }, sort: { type: 'string', enum: ['price_asc','price_desc'] } }, additionalProperties: false } },
  { name: 'knowledge', description: 'Search the current PrimeHub website for any fact: homepage, Sale Mela, deals, rewards, Reseller Club, Prime Skills, delivery, payment, contact, or policies.', parameters: { type: 'object', properties: { query: { type: 'string' }, topic: { type: 'string' } }, additionalProperties: false } },
  { name: 'inspect_image', description: 'Inspect the customer image against recent verified product cards. Use whenever the customer asks about an uploaded image.', parameters: { type: 'object', properties: { question: { type: 'string' } }, additionalProperties: false } },
  { name: 'order', description: 'Progress the server-validated order. Start with a verified recent product id; record advance only when an image was uploaded; save only the currently requested customer field. Use status when unsure.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['start','record_advance','set_customer_field','status'] }, productId: { type: 'string' }, productName: { type: 'string' }, quantity: { type: 'number' }, field: { type: 'string', enum: ['name','city','phone','address'] }, value: { type: 'string' } }, required: ['action'], additionalProperties: false } },
];

let catalogueRefreshPromise: Promise<unknown> | null = null;
async function refreshCatalogueOnce(request: Request) {
  if (!catalogueRefreshPromise) {
    console.info('[salar-catalogue] automatic refresh started');
    const active = refreshSalarCatalogue(request);
    catalogueRefreshPromise = active;
    active.finally(() => { if (catalogueRefreshPromise === active) catalogueRefreshPromise = null; }).catch(() => undefined);
  }
  return catalogueRefreshPromise;
}
async function runCustomerWorker(request: Request, input: Parameters<typeof runWorker>[0]) {
  let result: any = await runWorker(input);
  if ((input.job === 'catalogue' || input.job === 'knowledge') && result?.refreshNeeded === true) {
    try {
      await refreshCatalogueOnce(request);
      result = await runWorker(input);
      console.info('[salar-catalogue] automatic refresh retry completed', { job: input.job, found: result?.found !== false });
    } catch (error) {
      console.error('[salar-catalogue] automatic refresh failed', { error: error instanceof Error ? error.message : 'unknown' });
    }
  }
  return result;
}

type StoredMessage = { id?: string; role?: string; text?: string; attachments?: any; created_at?: string; type?: string };
type WorkerProduct = { id: string; name: string; price: number; image_url?: string | null; url?: string; size?: string | null; material?: string | null; collection_names?: string[] };
type Draft = { stage?: 'awaiting_advance'|'collecting_details'|'complete'; items?: Array<{ productId: string; quantity: number }>; advance_amount?: number; advance_status?: string; advance_screenshot_url?: string; advance_screenshot_at?: string; next_field?: 'name'|'city'|'phone'|'address'|null; customer?: { name?: string; city?: string; phone?: string; address?: string }; order_id?: string; whatsapp_url?: string };

function historyForModel(messages: StoredMessage[]): SalarLlmMessage[] { return messages.slice(-8).filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role as 'user'|'assistant', content: String(m.text || '').slice(0,1200) })); }
function safeArgs(value: unknown) { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }
function objectAttachments(v: any) { return v && !Array.isArray(v) ? v : {}; }
function productsFromAttachments(v: any): WorkerProduct[] { const a = objectAttachments(v); return Array.isArray(a.products) ? a.products : []; }
function recentProducts(messages: StoredMessage[]) { const m = [...messages].reverse().find((x) => x.role === 'assistant' && productsFromAttachments(x.attachments).length); return m ? productsFromAttachments(m.attachments).slice(0, 30) : []; }
function normalizeHint(v: unknown) { return String(v || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function noVerifiedResult() { return `Mujhe website index mein verified information nahi mili. PrimeHub se rabta karein: ${PHONE}`; }
function validPhone(v: string) { const d = v.replace(/\D/g, ''); return d.length >= 10 && d.length <= 15; }
function fieldPrompt(field: Draft['next_field']) { if (field === 'name') return 'Shukriya ❤️ Screenshot mil gaya. Staff is advance ko verify karegi. Aap apna naam batayein?'; if (field === 'city') return 'Shukriya. Aap kis city mein delivery chahte hain?'; if (field === 'phone') return 'Aap ka contact phone number batayein?'; if (field === 'address') return 'Ab complete delivery address batayein?'; return ''; }
function moderationReply(result: any) { const categories = Array.isArray(result?.categories) ? result.categories : []; if (categories.some((c: string) => ['sexual_minors','attack','illegal_instruction'].includes(c))) return 'Is request mein main madad nahi kar sakta. PrimeHub shopping, products ya order help ke liye main khushi se madad karunga.'; if (categories.includes('spam')) return 'Meherbani karke ek clear message bhej dein. PrimeHub shopping ya order help ke liye main yahan hoon.'; return 'Main adab aur ehtram ke saath madad ke liye hoon. PrimeHub shopping ya order ka sawal batayein.'; }
function orderSummaryAttachment(result: any, draft: Draft) { const c = draft.customer || {}; return { complete:true, orderId:result.orderId, whatsappUrl:result.whatsappUrl || '', items:Array.isArray(result.items) ? result.items : [], subtotal:Number(result.subtotal || 0), advance:ADVANCE, remaining:Number(result.remaining || 0), delivery:Number(result.deliveryCharge || 0), total:Number(result.total || 0), name:String(c.name || ''), city:String(c.city || ''), phone:String(c.phone || ''), address:String(c.address || ''), paymentNote:'Advance screenshot received — pending staff verification. Complete order ready karke VIDEO share hoga; remaining payment video ke baad.' }; }
function summaryText(s: any) { const items=(s.items||[]).map((i:any)=>`• ${i.title} x${i.quantity} — Rs ${Number(i.lineTotal || i.price || 0).toLocaleString()}`).join('\n'); return `Order Summary\n${items}\n\nSubtotal: Rs ${s.subtotal.toLocaleString()}\nDelivery: Rs ${s.delivery.toLocaleString()}\nTotal: Rs ${s.total.toLocaleString()}\nAdvance: Rs ${s.advance.toLocaleString()} (pending staff verification)\nRemaining after video: Rs ${s.remaining.toLocaleString()}\n\nName: ${s.name}\nCity: ${s.city}\nPhone: ${s.phone}\nAddress: ${s.address}\n\nOrder website par save ho gaya. WhatsApp pe bhejne ke liye button daba dein. Video ready karke share karenge; uske baad baqi payment.`; }
async function updateDraft(conversation:any,draft:Draft){const now=new Date().toISOString();await conversation.ref.set({order_draft:{...draft,updated_at:now},updated_at:now},{merge:true});}
async function saveAssistant(conversation:any,text:string,attachments:any,type='message'){const db=getAdminDb();const conversationRef=db.collection('salar_conversations').doc(String(conversation.id));const ref=db.collection('salar_messages').doc();const createdAt=new Date().toISOString();await db.runTransaction(async tx=>{const snap=await tx.get(conversationRef);if(!snap.exists||snap.data()?.blocked===true)throw new Error('SALAR_BLOCKED');tx.set(ref,{id:ref.id,conversation_id:conversation.id,role:'assistant',type,text,attachments,created_at:createdAt});tx.set(conversationRef,{updated_at:createdAt,last_message_at:createdAt,last_message_preview:text.slice(0,160)},{merge:true});});return{id:ref.id,conversation_id:conversation.id,role:'assistant' as const,type,text,attachments,created_at:createdAt};}

type AgentToolExecution = { result: any; products?: WorkerProduct[]; links?: Array<{title:string;url:string}>; orderSummary?: any };
async function executeAgentTool(request:Request,conversation:any,call:{name:string;arguments:Record<string,any>},stored:StoredMessage[],customerText:string,imageUrl:string,liveProducts:WorkerProduct[]=[]):Promise<AgentToolExecution>{
  const args=safeArgs(call.arguments);
  if(call.name==='catalogue'){
    const result:any=await runCustomerWorker(request,{job:'catalogue',payload:args,conversationId:conversation.id});
    const cardProducts=result?.type==='products'&&Array.isArray(result.products)?result.products:result?.type==='product'&&result.product?[result.product]:undefined;
    return {result,products:cardProducts};
  }
  if(call.name==='knowledge'){
    const result:any=await runCustomerWorker(request,{job:'knowledge',payload:{query:String(args.query||args.topic||customerText)},conversationId:conversation.id});
    const sources=Array.isArray(result?.sources)?result.sources:[result];
    return {result,links:result?.found===false?undefined:sources.map((source:any)=>({title:String(source?.title||'PrimeHub Mall'),url:String(source?.url||'')})).filter((link:any)=>link.url)};
  }
  if(call.name==='inspect_image'){
    if(!imageUrl)return{result:{ok:false,reason:'No customer image is available in this turn.'}};
    const candidates=liveProducts.length?liveProducts:recentProducts(stored);const vision:any=await runWorker({job:'vision',payload:{imageUrl,question:String(args.question||customerText),productCandidates:candidates},conversationId:conversation.id});
    if(vision?.ok===true&&vision.matchProductId){const exact:any=await runCustomerWorker(request,{job:'catalogue',payload:{productId:vision.matchProductId},conversationId:conversation.id});if(exact?.type==='product'&&exact.product)return{result:{...vision,verifiedProduct:exact.product},products:[exact.product]};}
    return{result:vision};
  }
  if(call.name==='order'){
    const latest=await conversation.ref.get();const draft:Draft=latest.data()?.order_draft||{};const action=String(args.action||'status');
    if(action==='status')return{result:{ok:true,state:draft.stage||'not_started',nextField:draft.next_field||null,hasAdvance:Boolean(draft.advance_screenshot_url),customer:draft.customer||{}}};
    if(action==='start'){
      const candidates=liveProducts.length?liveProducts:recentProducts(stored);const wantedId=String(args.productId||'').trim();const wantedName=normalizeHint(args.productName);const selected=candidates.find((product)=>product.id===wantedId)||candidates.find((product)=>wantedName&&normalizeHint(product.name).includes(wantedName))||(candidates.length===1?candidates[0]:null);
      if(!selected)return{result:{ok:false,reason:'A verified recent product card must be selected before starting an order.'}};
      const next:Draft={stage:'awaiting_advance',items:[{productId:selected.id,quantity:Math.max(1,Math.min(50,Math.floor(Number(args.quantity)||1)))}],advance_amount:ADVANCE,advance_status:'awaiting_screenshot',customer:{}};await updateDraft(conversation,next);
      return{result:{ok:true,state:'awaiting_advance',advanceAmount:ADVANCE,paymentStatus:'not_received',nextStep:'Ask for the advance screenshot, then explain video-before-remaining-payment policy naturally.'},products:[selected]};
    }
    if(action==='record_advance'){
      if(draft.stage!=='awaiting_advance')return{result:{ok:false,reason:'The order is not waiting for an advance screenshot.',state:draft.stage||'not_started'}};
      if(!imageUrl)return{result:{ok:false,reason:'No uploaded screenshot is available in this turn.'}};
      const next:Draft={...draft,stage:'collecting_details',advance_amount:ADVANCE,advance_status:'pending_verify',advance_screenshot_url:imageUrl,advance_screenshot_at:new Date().toISOString(),next_field:'name',customer:draft.customer||{}};await updateDraft(conversation,next);
      return{result:{ok:true,state:'collecting_details',paymentStatus:'pending_staff_verification',nextField:'name'}};
    }
    if(action==='set_customer_field'){
      if(draft.stage!=='collecting_details')return{result:{ok:false,reason:'The order is not collecting customer details.',state:draft.stage||'not_started'}};
      const field=String(args.field||'') as Draft['next_field'];const value=String(args.value||'').trim();if(!field||field!==draft.next_field)return{result:{ok:false,reason:'Only the currently requested order field may be saved.',nextField:draft.next_field||null}};
      if(!value)return{result:{ok:false,reason:'The customer detail is empty.',nextField:field}};if(field==='phone'&&!validPhone(value))return{result:{ok:false,reason:'Phone must contain 10 to 15 digits.',nextField:field}};if(field==='address'&&value.length<8)return{result:{ok:false,reason:'A more complete delivery address is required.',nextField:field}};
      const customer={...(draft.customer||{}),[field]:value};const nextField:Draft['next_field']=field==='name'?'city':field==='city'?'phone':field==='phone'?'address':null;const next:Draft={...draft,customer,next_field:nextField};await updateDraft(conversation,next);
      if(nextField)return{result:{ok:true,state:'collecting_details',savedField:field,nextField}};
      const committed:any=await runWorker({job:'order',payload:{conversationId:conversation.id,action:'commit'},conversationId:conversation.id});if(committed?.ok!==true)return{result:{ok:false,reason:committed?.reason||'Website order could not be completed.'}};
      const completeDraft:Draft={...next,stage:'complete',order_id:committed.orderId,whatsapp_url:committed.whatsappUrl||''};const orderSummary=orderSummaryAttachment(committed,completeDraft);
      return{result:{ok:true,state:'complete',order:orderSummary,nextStep:'Explain the verified summary naturally and invite the customer to use the WhatsApp button.'},orderSummary};
    }
  }
  return{result:{found:false,reason:'Unsupported tool request.'}};
}

export async function GET(request:Request){const sid=readSalarSid(request);if(!sid)return NextResponse.json({error:'session_required'},{status:401});try{const customerUid=await verifiedCustomerUid(request);const conversation=await ensureSalarConversation(sid,customerUid);const snap=await conversation.ref.get();const blocked=snap.data()?.blocked===true;const messages=await listConversationMessages(conversation.id);return NextResponse.json({conversationId:conversation.id,blocked,messages,unblockEmail:blocked?SALAR_UNBLOCK_EMAIL:undefined},{headers:{'Cache-Control':'no-store, private'}});}catch{return NextResponse.json({error:'Unable to load Salar messages.'},{status:500});}}

export async function POST(request:Request){
  const sid=readSalarSid(request);if(!sid)return NextResponse.json({error:'session_required'},{status:401});
  const body=await request.json().catch(()=>null);const imageUrl=typeof body?.imageUrl==='string'&&isR2PublicUrl(body.imageUrl)?body.imageUrl.trim():'';const topic=typeof body?.topic==='string'&&ALLOWED_TOPICS.has(body.topic)?body.topic:'';const enteredText=normalizeMessageText(body?.text);
  if(body?.imageUrl&&!imageUrl)return NextResponse.json({error:'Invalid image URL.'},{status:400});if(body?.topic&&!topic)return NextResponse.json({error:'Invalid quick area.'},{status:400});if(!enteredText&&!imageUrl&&!topic)return NextResponse.json({error:'Message text, image, or quick area is required.'},{status:400});const text=enteredText||(imageUrl?'Advance screenshot.':topic.replace('_',' '));
  try{
    const customerUid=await verifiedCustomerUid(request);const conversation=await ensureSalarConversation(sid,customerUid);const before=await conversation.ref.get();const beforeData:any=before.data()||{};if(beforeData.blocked===true)return NextResponse.json({error:'blocked',unblockEmail:SALAR_UNBLOCK_EMAIL},{status:403});if(!consumeSalarRateLimit(conversation.id))return NextResponse.json({error:'rate_limited'},{status:429});
    const db=getAdminDb();const userRef=db.collection('salar_messages').doc();const now=new Date().toISOString();const userAttachments=imageUrl?{images:[{url:imageUrl}]}:[];
    await db.runTransaction(async tx=>{const snap=await tx.get(conversation.ref);if(!snap.exists||snap.data()?.blocked===true)throw new Error('SALAR_BLOCKED');tx.set(userRef,{id:userRef.id,conversation_id:conversation.id,role:'user',text,attachments:userAttachments,created_at:now});tx.set(conversation.ref,{updated_at:now,last_message_at:now,last_message_preview:text.slice(0,160)},{merge:true});});
    const userMessage={id:userRef.id,conversation_id:conversation.id,role:'user' as const,text,attachments:userAttachments,created_at:now};
    const moderation:any=await runWorker({job:'moderate',payload:{text:enteredText || ''},conversationId:conversation.id});
    if(moderation?.flag===true){await conversation.ref.set({moderation_flagged:true,moderation_last:{categories:moderation.categories||[],severity:moderation.severity||'low',at:now}},{merge:true});const assistant=await saveAssistant(conversation,moderationReply(moderation),[],'moderation');return NextResponse.json({ok:true,messages:[userMessage,assistant]},{headers:{'Cache-Control':'no-store, private'}});}
    const stored=await listConversationMessages(conversation.id) as StoredMessage[];

    let assistantText='';let products:WorkerProduct[]=[];let links:Array<{title:string;url:string}>=[];let orderSummary:any=null;let successfulTool=false;let failedTool=false;
    try{
      const brain=await buildSalarBrainPrompt(8000);const recent=recentProducts(stored).map((product)=>({id:product.id,name:product.name,price:product.price}));
      const latest=await conversation.ref.get();const currentDraft:Draft=latest.data()?.order_draft||{};const privateContext={currentOrder:{state:currentDraft.stage||'not_started',nextField:currentDraft.next_field||null,hasAdvanceScreenshot:Boolean(currentDraft.advance_screenshot_url),customerFields:Object.keys(currentDraft.customer||{})},recentProductCards:recent,uploadedImageAvailable:Boolean(imageUrl),quickArea:topic||null};
      const systemPrompt=brain+'\n\n# Live runtime contract\nReason from the full conversation before replying. Compose a fresh, natural answer for this exact customer; never use a canned introduction. Use catalogue for every product fact and knowledge for every PrimeHub website fact. Use inspect_image when an uploaded image needs understanding. Use order only when the customer clearly intends the corresponding action. If an order is collecting a field but the customer asks another question, answer the question and do not save it as a field. Tool results are authoritative; never invent missing facts. When product cards are returned they are rendered separately: give one short natural introduction and do not enumerate, table, or repeat individual cards. Recent card id/name/price data is authoritative for comparisons; fetch an exact product for size, material, availability, or ordering. Order buttons are also rendered separately, so never dump JSON. Keep internal context private.\n\nCurrent private context: '+JSON.stringify(privateContext);
      const llmMessages:SalarLlmMessage[]=[{role:'system',content:systemPrompt},...historyForModel(stored)];
      for(let round=0;round<7;round++){
        const completion=await chatCompletionWithTools({messages:llmMessages,tools:round<6?TOOLS:[]});
        if(!completion.toolCalls.length){assistantText=completion.text.trim();break;}
        llmMessages.push({role:'assistant',content:completion.text||'',tool_calls:completion.toolCalls.map((toolCall)=>({id:toolCall.id,type:'function',function:{name:toolCall.name,arguments:toolCall.rawArguments||JSON.stringify(toolCall.arguments)}}))});
        for(const call of completion.toolCalls){
          let executed:AgentToolExecution;try{executed=await executeAgentTool(request,conversation,call,stored,text,imageUrl,products);}catch(error){executed={result:{ok:false,reason:error instanceof Error?error.message:'Tool failed.'}};}
          const ok=executed.result?.found!==false&&executed.result?.ok!==false;if(ok)successfulTool=true;else failedTool=true;
          if(executed.products)products=executed.products;if(executed.links)links=executed.links;if(executed.orderSummary)orderSummary=executed.orderSummary;
          const modelResult=executed.products&&executed.result?.type==='products'?{type:'products',collection:executed.result.collection,productCount:executed.products.length,priceRange:{min:Math.min(...executed.products.map((product)=>Number(product.price||0))),max:Math.max(...executed.products.map((product)=>Number(product.price||0)))},resultNote:'Full verified cards are rendered in the customer UI; introduce them briefly without listing them.'}:executed.result;llmMessages.push({role:'tool',name:call.name,tool_call_id:call.id,content:JSON.stringify(modelResult)});
        }
      }
      if(!assistantText)assistantText=failedTool&&!successfulTool?noVerifiedResult():SALAR_SAFE_ERROR_MESSAGE;
    }catch(error){console.error('[salar-messages] completion failed',{conversationId:conversation.id,error:error instanceof Error?error.message:'unknown'});assistantText=SALAR_SAFE_ERROR_MESSAGE;products=[];links=[];orderSummary=null;}
    const attachments:any={};if(products.length)attachments.products=products;if(links.length)attachments.links=links;if(orderSummary)attachments.order_summary=orderSummary;
    const a=await saveAssistant(conversation,assistantText,attachments,orderSummary?'order_summary':'message');return NextResponse.json({ok:true,messages:[userMessage,a]},{headers:{'Cache-Control':'no-store, private'}});
  }catch(error){if(error instanceof Error&&error.message==='SALAR_BLOCKED')return NextResponse.json({error:'blocked',unblockEmail:SALAR_UNBLOCK_EMAIL},{status:403});console.error('[salar-messages] request failed',{error:error instanceof Error?error.message:'unknown'});return NextResponse.json({error:'Unable to save Salar message.'},{status:500});}
}
