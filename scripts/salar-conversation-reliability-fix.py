from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, value: str) -> None:
    Path(path).write_text(value, encoding='utf-8')


def replace_once(path: str, before: str, after: str, label: str) -> None:
    source = read(path)
    if before not in source:
        raise RuntimeError(f'{label}: target not found in {path}')
    write(path, source.replace(before, after, 1))


engine = 'lib/salar/modelDrivenEngine.ts'
route = 'app/api/salar/chat/route.ts'
store = 'lib/salar/chatStore.ts'
widget = 'components/salar/SalarWidget.tsx'

replace_once(engine, """type ProviderText = { text: string; provider: ProviderName; model: string };
type Requirement = { name: string; value: string };
""", """type ProviderText = { text: string; provider: ProviderName; model: string };
type Requirement = { name: string; value: string };
type ExactProductReference = { id: string; imageUrl?: string };
type OrderAction = 'none' | 'draft';
""", 'engine reference types')

replace_once(engine, """type FinalDecision = {
  reply: string;
  display: DisplayMode;
  productIds: string[];
  categoryIds: string[];
  showAllMatches: boolean;
};
""", """type FinalDecision = {
  reply: string;
  display: DisplayMode;
  productIds: string[];
  categoryIds: string[];
  showAllMatches: boolean;
  orderAction: OrderAction;
  orderProductIds: string[];
};
""", 'engine final decision type')

replace_once(engine, """const MAX_FINAL_SYSTEM_CHARS = 36000;
const MAX_FINAL_PROMPT_PRODUCTS = 24;
const TEXT_TIMEOUT_MS = 18000;
const VISION_TIMEOUT_MS = 22000;
""", """const MAX_FINAL_SYSTEM_CHARS = 30000;
const MAX_FINAL_PROMPT_PRODUCTS = 18;
const TEXT_TIMEOUT_MS = 5000;
const VISION_TIMEOUT_MS = 8000;
""", 'engine prompt and timeout limits')

replace_once(engine, """  // Ordering is deliberate: every Groq key first, then every Gemini key, then OpenRouter.
  return providers.flatMap((definition) => definition.keys.map((apiKey, index) => ({
    provider: definition.provider,
    apiKey,
    keyIndex: index + 1,
    model: definition.model,
    visionModel: definition.visionModel,
  })));
}
""", """  // Ordering is deliberate: every Groq key first, then every Gemini key, then OpenRouter.
  return providers.flatMap((definition) => definition.keys.map((apiKey, index) => ({
    provider: definition.provider,
    apiKey,
    keyIndex: index + 1,
    model: definition.model,
    visionModel: definition.visionModel,
  })));
}

function fastProviderTargets(useVisionModel = false) {
  const available = providerTargets().filter((target) => target.apiKey && (useVisionModel ? target.visionModel : target.model));
  const order: ProviderName[] = ['groq', 'gemini', 'openrouter'];
  return order.flatMap((provider) => {
    const matches = available.filter((target) => target.provider === provider);
    const maxAttempts = provider === 'groq' ? 3 : 2;
    return matches.slice(0, maxAttempts);
  });
}
""", 'engine fast provider targets')

replace_once(engine, """  image?: SalarModelImageInput,
  maxTokens = 900,
  temperature = 0.15,
) {
""", """  image?: SalarModelImageInput,
  maxTokens = 900,
  temperature = 0.15,
  jsonMode = false,
) {
""", 'openai call signature')

replace_once(engine, """      temperature,
      max_tokens: maxTokens,
    }),
""", """      temperature,
      max_tokens: maxTokens,
      ...(jsonMode && !image ? { response_format: { type: 'json_object' } } : {}),
    }),
""", 'openai json response mode')

replace_once(engine, """  image?: SalarModelImageInput,
  maxTokens = 900,
  temperature = 0.15,
) {
  const userParts: Array<Record<string, any>> = [{ text: user }];
""", """  image?: SalarModelImageInput,
  maxTokens = 900,
  temperature = 0.15,
  jsonMode = false,
) {
  const userParts: Array<Record<string, any>> = [{ text: user }];
""", 'gemini call signature')

replace_once(engine, """      generationConfig: { temperature, maxOutputTokens: maxTokens },
""", """      generationConfig: { temperature, maxOutputTokens: maxTokens, ...(jsonMode && !image ? { responseMimeType: 'application/json' } : {}) },
""", 'gemini json response mode')

replace_once(engine, """    maxTokens?: number;
    temperature?: number;
  },
) {
""", """    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
  },
) {
""", 'runProviderTarget input')

replace_once(engine, """  const text = target.provider === 'gemini'
    ? await callGemini(target, model, input.system, input.history, input.user, input.image, input.maxTokens, input.temperature)
    : await callOpenAiCompatible(target, model, input.system, input.history, input.user, input.image, input.maxTokens, input.temperature);
""", """  const text = target.provider === 'gemini'
    ? await callGemini(target, model, input.system, input.history, input.user, input.image, input.maxTokens, input.temperature, input.jsonMode)
    : await callOpenAiCompatible(target, model, input.system, input.history, input.user, input.image, input.maxTokens, input.temperature, input.jsonMode);
""", 'runProviderTarget json forwarding')

replace_once(engine, """  maxTokens?: number;
  temperature?: number;
}): Promise<ProviderText> {
  const targets = providerTargets().filter((target) => target.apiKey && (input.useVisionModel ? target.visionModel : target.model));
""", """  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<ProviderText> {
  const targets = fastProviderTargets(input.useVisionModel === true);
""", 'runProviders fast targets')

replace_once(engine, """async function catalogueReferenceVision(catalogue: SalarCatalogue, exactProductIds: string[], message: string) {
  if (!exactProductIds.length || !asksAboutVisibleProductImage(message)) return null;
  const exactIds = new Set(exactProductIds);
  const exactProducts = catalogue.products.filter((product: any) => exactIds.has(cleanText(product?.id, 200)));
  for (const product of exactProducts) {
    for (const imageUrl of productImageUrls(product).slice(0, 4)) {
      try {
        const response = await fetch(imageUrl, {
          cache: 'no-store',
          headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', 'User-Agent': 'PrimeHubMall-Salar/1.0' },
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) continue;
        const mimeType = imageMimeType(response.headers.get('content-type') || '');
        if (!mimeType) continue;
        const declared = Number(response.headers.get('content-length') || 0);
        if (Number.isFinite(declared) && declared > 4 * 1024 * 1024) continue;
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > 4 * 1024 * 1024) continue;
        const vision = await analyzeImage({ mimeType, base64: Buffer.from(bytes).toString('base64') }, message);
        if (vision) return vision;
      } catch (error) {
        console.warn('Salar selected catalogue image could not be inspected; trying next image.', error instanceof Error ? error.message : 'unknown');
      }
    }
  }
  return null;
}
""", """async function catalogueReferenceVision(
  catalogue: SalarCatalogue,
  exactProductIds: string[],
  message: string,
  exactReferences: ExactProductReference[] = [],
) {
  if (!exactProductIds.length || !asksAboutVisibleProductImage(message)) return null;
  const exactIds = new Set(exactProductIds);
  const exactProducts = catalogue.products.filter((product: any) => exactIds.has(cleanText(product?.id, 200)));
  for (const product of exactProducts) {
    const productId = cleanText(product?.id, 200);
    const catalogueUrls = productImageUrls(product);
    const exactUrls = exactReferences
      .filter((reference) => reference.id === productId && reference.imageUrl && catalogueUrls.includes(reference.imageUrl))
      .map((reference) => reference.imageUrl as string);
    const imageUrls = [...new Set([...exactUrls, ...catalogueUrls])].slice(0, 4);
    for (const imageUrl of imageUrls) {
      try {
        const response = await fetch(imageUrl, {
          cache: 'no-store',
          headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', 'User-Agent': 'PrimeHubMall-Salar/1.0' },
          signal: AbortSignal.timeout(4500),
        });
        if (!response.ok) continue;
        const mimeType = imageMimeType(response.headers.get('content-type') || '');
        if (!mimeType) continue;
        const declared = Number(response.headers.get('content-length') || 0);
        if (Number.isFinite(declared) && declared > 4 * 1024 * 1024) continue;
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > 4 * 1024 * 1024) continue;
        const vision = await analyzeImage({ mimeType, base64: Buffer.from(bytes).toString('base64') }, message);
        if (vision) return vision;
      } catch (error) {
        console.warn('Salar selected catalogue image could not be inspected; trying next image.', error instanceof Error ? error.message : 'unknown');
      }
    }
  }
  return null;
}
""", 'exact selected image vision')

replace_once(engine, """    'Set resultScope=all when the customer asks for all/every/sab/sari/complete matching items, or when Admin Training says a broad category/family request should show the whole matching collection. Set focused for a specific named design/product unless the customer explicitly asks for all of that exact design.',
""", """    'Set resultScope=all when the customer asks for all/every/sab/sari/complete matching items, or when Admin Training says a broad category/family request should show the whole matching collection. Set focused for a specific named design/product unless the customer explicitly asks for all of that exact design.',
    'When the current message is only the answer to a clarification you just asked (for example size, colour, quantity or another missing requirement), carry forward the unresolved original request and its broad/focused result scope according to Admin Training. Do not reset a broad collection request to focused merely because the customer reply is short.',
""", 'preserve scope after clarification')

old_understanding = """  const targets = providerTargets().filter((target) => target.apiKey && target.model);
  if (!targets.length) throw new Error('No Salar AI provider is configured in the existing environment.');

  let lastError: unknown = null;
  for (const target of targets) {
    try {
      const result = await runProviderTarget(target, {
        system,
        history: input.history,
        user,
        maxTokens: 520,
        temperature: 0.03,
      });
      const interpretation = parseInterpretation(result.text);
      if (interpretation) return { interpretation, provider: result.provider, model: result.model };
      lastError = new Error(`${target.provider} returned invalid understanding JSON`);
      console.warn(`Salar ${target.provider} key ${target.keyIndex} returned invalid understanding JSON; trying next key/provider.`);
    } catch (error) {
      lastError = error;
      console.warn(`Salar ${target.provider} key ${target.keyIndex} understanding failed; trying next key/provider.`, error instanceof Error ? error.message : 'unknown');
    }
  }
"""
new_understanding = """  const targets = fastProviderTargets(false);
  if (!targets.length) throw new Error('No Salar AI provider is configured in the existing environment.');

  let lastError: unknown = null;
  const invalidFormatProviders = new Set<ProviderName>();
  for (const target of targets) {
    if (invalidFormatProviders.has(target.provider)) continue;
    try {
      const result = await runProviderTarget(target, {
        system,
        history: input.history,
        user,
        maxTokens: 360,
        temperature: 0.03,
        jsonMode: true,
      });
      const interpretation = parseInterpretation(result.text);
      if (interpretation) return { interpretation, provider: result.provider, model: result.model };
      invalidFormatProviders.add(target.provider);
      lastError = new Error(target.provider + ' returned invalid understanding JSON');
      console.warn('Salar ' + target.provider + ' returned invalid understanding JSON; moving to next provider.');
    } catch (error) {
      lastError = error;
      console.warn('Salar ' + target.provider + ' key ' + target.keyIndex + ' understanding failed; trying next key/provider.', error instanceof Error ? error.message : 'unknown');
    }
  }
"""
replace_once(engine, old_understanding, new_understanding, 'fast structured understanding')

replace_once(engine, """  const showAllMatches = parsed.showAllMatches === true;
  if (!reply && display === 'none') return null;
  return { reply, display, productIds, categoryIds, showAllMatches };
""", """  const showAllMatches = parsed.showAllMatches === true;
  const rawOrderAction = cleanText(parsed.orderAction, 40).toLowerCase();
  const orderAction: OrderAction = rawOrderAction === 'draft' ? 'draft' : 'none';
  const orderProductIds = Array.isArray(parsed.orderProductIds)
    ? [...new Set(parsed.orderProductIds.map((id) => cleanText(id, 200)).filter(Boolean))].slice(0, 30)
    : [];
  if (!reply && display === 'none' && orderAction === 'none') return null;
  return { reply, display, productIds, categoryIds, showAllMatches, orderAction, orderProductIds };
""", 'parse order action')

replace_once(engine, """    'ORDER/DEALING RULE: do not hardcode an advance amount, payment rule, address fields, order sequence, discount, promise, follow-up script or required customer wording here. Follow Admin Salesman Training and live website/catalogue data for those business decisions. Preserve selected product/image references in conversation context when useful so the model can apply the current admin-defined order flow accurately.',
""", """    'ORDER/DEALING RULE: do not hardcode an advance amount, payment rule, address fields, order sequence, discount, promise, follow-up script or required customer wording here. Follow Admin Salesman Training and live website/catalogue data for those business decisions. Preserve selected product/image references in conversation context when useful so the model can apply the current admin-defined order flow accurately.',
    'When the customer is clearly combining selected products and asking to prepare a bill/total/order draft, set orderAction=draft and return every exact product id that belongs in that draft in orderProductIds, including relevant selections from recent conversation. Do not set it for browsing or a vague future intention. The website will validate prices and build the bill; never calculate or invent missing prices yourself.',
""", 'model-driven order draft rule')

replace_once(engine, """    'Return exactly one JSON object with no markdown: {\"reply\":\"natural customer-facing reply\",\"display\":\"none|categories|products|product_images\",\"showAllMatches\":false,\"productIds\":[\"id\"],\"categoryIds\":[\"id\"]}.',
""", """    'Return exactly one JSON object with no markdown: {\"reply\":\"natural customer-facing reply\",\"display\":\"none|categories|products|product_images\",\"showAllMatches\":false,\"productIds\":[\"id\"],\"categoryIds\":[\"id\"],\"orderAction\":\"none|draft\",\"orderProductIds\":[\"id\"]}.',
""", 'final JSON schema')

replace_once(engine, """    `MATCHING PRODUCT SAMPLE: ${limitedJson(sampleFacts, 8000)}`,
    `EXACT REFERENCED PRODUCT FACTS: ${limitedJson(input.candidates.exactProductFacts, 5000)}`,
    `NEAR MATCH FACTS: ${limitedJson(input.candidates.nearMatchFacts.map(compactPromptFact), 3000)}`,
    `CATEGORY CANDIDATES: ${limitedJson(input.candidates.categories, 3800)}`,
    `WEBSITE KNOWLEDGE: ${limitedJson(input.knowledge, 4200)}`,
""", """    `MATCHING PRODUCT SAMPLE: ${limitedJson(sampleFacts, 5600)}`,
    `EXACT REFERENCED PRODUCT FACTS: ${limitedJson(input.candidates.exactProductFacts, 4200)}`,
    `NEAR MATCH FACTS: ${limitedJson(input.candidates.nearMatchFacts.map(compactPromptFact), 2200)}`,
    `CATEGORY CANDIDATES: ${limitedJson(input.candidates.categories, 2600)}`,
    `WEBSITE KNOWLEDGE: ${limitedJson(input.knowledge, 2800)}`,
""", 'shrink final prompt payload')

replace_once(engine, """  exactProductIds?: unknown;
  image?: SalarModelImageInput;
}) {
""", """  exactProductIds?: unknown;
  exactProductReferences?: unknown;
  image?: SalarModelImageInput;
}) {
""", 'engine input references')

replace_once(engine, """  const exactProductIds = Array.isArray(input.exactProductIds)
    ? input.exactProductIds.map((id) => cleanText(id, 200)).filter(Boolean).slice(0, 40)
    : [];
  const uploadedVision = input.image ? await analyzeImage(input.image, message) : null;
  const selectedProductVision = !input.image
    ? await catalogueReferenceVision(state.catalogue, exactProductIds, message)
    : null;
""", """  const exactProductReferences: ExactProductReference[] = Array.isArray(input.exactProductReferences)
    ? input.exactProductReferences.slice(0, 30).map((reference: any) => ({
        id: cleanText(reference?.id, 200),
        imageUrl: safeHttpsUrl(reference?.imageUrl) || undefined,
      })).filter((reference) => reference.id)
    : [];
  const exactProductIds = [...new Set([
    ...(Array.isArray(input.exactProductIds) ? input.exactProductIds.map((id) => cleanText(id, 200)).filter(Boolean) : []),
    ...exactProductReferences.map((reference) => reference.id),
  ])].slice(0, 40);
  const uploadedVision = input.image ? await analyzeImage(input.image, message) : null;
  const selectedProductVision = !input.image
    ? await catalogueReferenceVision(state.catalogue, exactProductIds, message, exactProductReferences)
    : null;
""", 'engine exact reference vision input')

old_final_loop = """  const targets = providerTargets().filter((target) => target.apiKey && target.model);
  if (!targets.length) throw new Error('No Salar AI provider is configured in the existing environment.');

  let finalProvider: ProviderText | null = null;
  let decision: FinalDecision | null = null;
  let lastNatural = '';
  let lastError: unknown = null;

  for (const target of targets) {
    try {
      const result = await runProviderTarget(target, {
        system,
        history,
        user: message || 'Customer shared a product image.',
        maxTokens: 1200,
        temperature: 0.35,
      });
      lastNatural = result.text;
      const parsed = parseFinalDecision(result.text);
      if (parsed) {
        finalProvider = result;
        decision = parsed;
        break;
      }
      lastError = new Error(`${target.provider} returned invalid final JSON`);
      console.warn(`Salar ${target.provider} key ${target.keyIndex} returned invalid final JSON; trying next key/provider.`);
    } catch (error) {
      lastError = error;
      console.warn(`Salar ${target.provider} key ${target.keyIndex} final reply failed; trying next key/provider.`, error instanceof Error ? error.message : 'unknown');
    }
  }
"""
new_final_loop = """  const targets = fastProviderTargets(false);
  if (!targets.length) throw new Error('No Salar AI provider is configured in the existing environment.');

  let finalProvider: ProviderText | null = null;
  let decision: FinalDecision | null = null;
  let lastNatural = '';
  let lastError: unknown = null;
  const invalidFormatProviders = new Set<ProviderName>();

  for (const target of targets) {
    if (invalidFormatProviders.has(target.provider)) continue;
    try {
      const result = await runProviderTarget(target, {
        system,
        history,
        user: message || 'Customer shared a product image.',
        maxTokens: 700,
        temperature: 0.3,
        jsonMode: true,
      });
      lastNatural = result.text;
      const parsed = parseFinalDecision(result.text);
      if (parsed) {
        finalProvider = result;
        decision = parsed;
        break;
      }
      invalidFormatProviders.add(target.provider);
      lastError = new Error(target.provider + ' returned invalid final JSON');
      console.warn('Salar ' + target.provider + ' returned invalid final JSON; moving to next provider.');
    } catch (error) {
      lastError = error;
      console.warn('Salar ' + target.provider + ' key ' + target.keyIndex + ' final reply failed; trying next key/provider.', error instanceof Error ? error.message : 'unknown');
    }
  }
"""
replace_once(engine, old_final_loop, new_final_loop, 'fast structured final reply')

replace_once(engine, """      decision = { reply: cleanText(lastNatural, 6000), display: 'none', productIds: [], categoryIds: [], showAllMatches: false };
""", """      decision = { reply: cleanText(lastNatural, 6000), display: 'none', productIds: [], categoryIds: [], showAllMatches: false, orderAction: 'none', orderProductIds: [] };
""", 'fallback final decision')

replace_once(engine, """  const displayMode: DisplayMode = products.length
    ? decision.display === 'product_images' ? 'product_images' : 'products'
    : categories.length
      ? 'categories'
      : 'none';

  const nextShown = [...(context.shownProductIds || []), ...products.map((product) => product.id)].filter(Boolean).slice(-MAX_SHOWN_IDS);
""", """  const displayMode: DisplayMode = products.length
    ? decision.display === 'product_images' ? 'product_images' : 'products'
    : categories.length
      ? 'categories'
      : 'none';
  const exactCards = candidates.exactProductFacts.map(productCard);
  const orderProducts = decision.orderAction === 'draft'
    ? selectByIds(exactCards, decision.orderProductIds, 30)
    : [];
  const orderAction: OrderAction = decision.orderAction === 'draft' && orderProducts.length ? 'draft' : 'none';

  const nextShown = [...(context.shownProductIds || []), ...products.map((product) => product.id)].filter(Boolean).slice(-MAX_SHOWN_IDS);
""", 'validated order products')

replace_once(engine, """    renderedCategories: categories.length,
  });
""", """    renderedCategories: categories.length,
    orderAction,
    orderProducts: orderProducts.length,
  });
""", 'order decision logging')

replace_once(engine, """    showAllMatches: decision.showAllMatches,
    vision: vision ? { provider: vision.provider, model: vision.model } : null,
""", """    showAllMatches: decision.showAllMatches,
    orderAction,
    orderProducts,
    vision: vision ? { provider: vision.provider, model: vision.model } : null,
""", 'order decision response')

old_history = """export function salarAiHistory(chat: SalarCustomerChat, max = 10) {
  return chat.messages
    .filter((message) => message.content)
    .slice(-Math.max(1, Math.min(20, max)))
    .map((message) => ({
      role: message.role,
      content: message.actor === 'admin'
        ? `[PrimeHub Admin message] ${message.content}`
        : message.content,
    }));
}
"""
new_history = """export function recentCustomerProductReferences(chat: SalarCustomerChat, max = 12) {
  const output: Array<{ id: string; title: string; imageUrl?: string }> = [];
  const seen = new Set<string>();
  for (const message of [...chat.messages].reverse()) {
    if (message.actor !== 'customer') continue;
    const references = [
      ...(message.products || []).map((product) => ({ id: product.id, title: product.title, imageUrl: product.imageUrl })),
      ...(message.mention ? [{ id: message.mention.id, title: message.mention.title, imageUrl: message.mention.imageUrl }] : []),
    ];
    for (const reference of references) {
      if (!reference.id || seen.has(reference.id)) continue;
      seen.add(reference.id);
      output.push(reference);
      if (output.length >= max) return output;
    }
  }
  return output;
}

export function salarAiHistory(chat: SalarCustomerChat, max = 10) {
  return chat.messages
    .filter((message) => message.content)
    .slice(-Math.max(1, Math.min(20, max)))
    .map((message) => {
      const base = message.actor === 'admin' ? `[PrimeHub Admin message] ${message.content}` : message.content;
      if (message.actor !== 'customer') return { role: message.role, content: base };
      const selected = (message.products || []).slice(0, 12).map((product) => product.title + ' [product id: ' + product.id + ']');
      const mentioned = message.mention ? message.mention.title + ' [product id: ' + message.mention.id + ']' : '';
      const metadata = [
        selected.length ? '[Customer selected exact products: ' + selected.join(' | ') + ']' : '',
        mentioned ? '[Customer referenced exact product: ' + mentioned + ']' : '',
      ].filter(Boolean).join('\\n');
      return { role: message.role, content: [base, metadata].filter(Boolean).join('\\n') };
    });
}
"""
replace_once(store, old_history, new_history, 'persist product selections in AI history')

replace_once(route, """  salarAiHistory,
  saveSalarChat,
""", """  salarAiHistory,
  recentCustomerProductReferences,
  saveSalarChat,
""", 'route reference import')

replace_once(route, """    const exactProductIds = [input.mention?.id, ...input.references.map((product) => product.id)].filter(Boolean) as string[];
    const result = await answerWithModelDrivenSalar({
      message: aiMessage,
      history: aiHistory,
      context: chat.context,
      customerName: chat.customerName,
      exactProductIds,
      image: input.image,
    });
""", """    const recentReferences = recentCustomerProductReferences(chat, 12);
    const exactReferenceMap = new Map<string, { id: string; imageUrl?: string }>();
    const currentReferences = [
      ...(input.mention ? [{ id: input.mention.id, imageUrl: input.mention.imageUrl }] : []),
      ...input.references.map((product) => ({ id: product.id, imageUrl: product.imageUrl })),
    ];
    for (const reference of [...currentReferences, ...recentReferences]) {
      const id = cleanText(reference.id, 200);
      if (!id || exactReferenceMap.has(id)) continue;
      const imageUrl = safeHttpsUrl(reference.imageUrl);
      exactReferenceMap.set(id, { id, ...(imageUrl ? { imageUrl } : {}) });
    }
    const exactProductReferences = [...exactReferenceMap.values()];
    const exactProductIds = exactProductReferences.map((reference) => reference.id);
    const result = await answerWithModelDrivenSalar({
      message: aiMessage,
      history: aiHistory,
      context: chat.context,
      customerName: chat.customerName,
      exactProductIds,
      exactProductReferences,
      image: input.image,
    });
""", 'route recent exact references')

replace_once(widget, """function orderIntent(value: string) {
  return /(order|final|confirm|book|place|mangwa|mangwana|mangva|mangwana|order kr|order kar|final kr|final kar|پکا|آرڈر)/i.test(value);
}

""", '', 'remove hardcoded order intent parser')

replace_once(widget, """      'Advance requested: Rs. 300',
""", '', 'remove WhatsApp hardcoded advance')

replace_once(widget, """          customer: { ...customer, notes: 'Order prepared through Salar chat. Advance requested: Rs. 300; remaining payment after ready-order video confirmation.' },
""", """          customer: { ...customer, notes: 'Order prepared through Salar chat.' },
""", 'remove order notes hardcoding')

replace_once(widget, """      const candidatesForOrder = references.length ? references : lastSharedProducts;
      const lastAssistant = [...messages].reverse().find((item) => item.role === 'assistant')?.content || '';
      const simpleYes = /^(?:yes|y|haan|han|haa|hmm yes|ok|okay|theek|thik|ji|g|jee|bilkul|kr do|kar do)[.! ]*$/i.test(message.trim());
      const confirmsPreviousOrderQuestion = simpleYes && /(order|final|bill|design|baqi|remaining|include|add|3|teen)/i.test(lastAssistant);
      const shouldDraftOrder = orderIntent(message) || confirmsPreviousOrderQuestion;
      let currentOrderItems = orderItems;
      if (shouldDraftOrder && !currentOrderItems.length && candidatesForOrder.length) {
        currentOrderItems = candidatesForOrder.map((product) => ({ ...product, quantity: 1 }));
        setOrderItems(currentOrderItems);
        void quoteOrder(currentOrderItems);
      }
      if (orderIntent(message) && currentOrderItems.length && customerComplete(mergedCustomer) && !orderId) {
        void placeChatOrder(false, currentOrderItems, mergedCustomer);
      }
""", """      const modelOrderProducts: ProductCard[] = Array.isArray(result?.orderProducts)
        ? result.orderProducts.filter((product: any) => product?.id && product?.title).slice(0, 30)
        : [];
      if (result?.orderAction === 'draft' && modelOrderProducts.length) {
        await startOrderDraft(modelOrderProducts);
      }
""", 'model-driven order draft handling')

replace_once(widget, """<p className=\"text-[8px] text-black/40\">Advance Rs. 300 · balance after ready-order video</p>""", """<p className=\"text-[8px] text-black/40\">Live bill from selected products</p>""", 'remove order card advance hardcoding')

print('Salar conversation reliability patch applied.')
