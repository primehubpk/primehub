import 'server-only';

type SalarPurpose = 'text' | 'vision';
type Provider = 'groq' | 'gemini' | 'openrouter';
export type SalarLlmToolCall = { id: string; name: string; arguments: Record<string, any>; rawArguments: string };
export type SalarLlmMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: unknown;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
};
export type SalarToolDefinition = { name: string; description: string; parameters: Record<string, unknown> };
type LastGood = { provider: Provider; index: number; at: number };
type CompletionResult = { text: string; toolCalls: SalarLlmToolCall[]; provider: Provider; keyIndex: number };

const LAST_GOOD_TTL_MS = 15 * 60 * 1000;
export const SALAR_SAFE_ERROR_MESSAGE = 'Sorry, Salar is temporarily unavailable. Please contact PrimeHub at 03238878009.';

declare global {
  // eslint-disable-next-line no-var
  var __salarLastGood: LastGood | undefined;
}

class RotatableProviderError extends Error {}
class SalarServiceError extends Error {}

export function parseKeys(value?: string | null): string[] {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function currentLastGood(): LastGood | undefined {
  const value = globalThis.__salarLastGood;
  if (!value || Date.now() - value.at > LAST_GOOD_TTL_MS) return undefined;
  return value;
}
function remember(provider: Provider, index: number) { globalThis.__salarLastGood = { provider, index, at: Date.now() }; }
function keyOrder(provider: Provider, length: number): number[] {
  if (length <= 0) return [];
  const last = currentLastGood();
  const start = last?.provider === provider && last.index >= 0 && last.index < length ? last.index : 0;
  return Array.from({ length }, (_, offset) => (start + offset) % length);
}
function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => typeof part === 'string' ? part : part && typeof part === 'object' && 'text' in part ? String((part as any).text || '') : '').filter(Boolean).join('\n');
  return content == null ? '' : String(content);
}
function safeJsonObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}
function normalizedToolCalls(raw: any): SalarLlmToolCall[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((call: any, index: number) => {
    const rawArguments = typeof call?.function?.arguments === 'string' ? call.function.arguments : JSON.stringify(call?.function?.arguments || {});
    return { id: String(call?.id || `tool-${index + 1}`), name: String(call?.function?.name || ''), arguments: safeJsonObject(rawArguments), rawArguments };
  }).filter((call) => call.name);
}
function geminiSchema(value: unknown): any {
  if (Array.isArray(value)) return value.map(geminiSchema);
  if (!value || typeof value !== 'object') return value;
  const output: Record<string, any> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'additionalProperties') continue;
    output[key] = geminiSchema(item);
  }
  return output;
}
function shouldRotate(status: number, payload: string): boolean {
  if ([401, 403, 429].includes(status)) return true;
  return /quota|billing|resource[_\s-]?exhausted|rate[_\s-]?limit|too many requests|api.?key|unauthorized|forbidden|authentication/i.test(payload);
}
async function requestJson(url: string, init: RequestInit): Promise<{ response: Response; text: string; json: any }> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
  try { const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' }); const text = await response.text(); let json: any = null; try { json = text ? JSON.parse(text) : null; } catch {} return { response, text, json }; }
  finally { clearTimeout(timeout); }
}
function openAiTools(tools: SalarToolDefinition[]) { return tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } })); }

async function callOpenAiCompatible(url: string, key: string, model: string, messages: SalarLlmMessage[], maxTokens: number, tools: SalarToolDefinition[]) {
  const body: Record<string, any> = { model, messages, temperature: 0, max_tokens: maxTokens };
  if (tools.length) { body.tools = openAiTools(tools); body.tool_choice = 'auto'; }
  const { response, text, json } = await requestJson(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) {
    if (shouldRotate(response.status, text)) throw new RotatableProviderError('provider rejected key');
    throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  }
  const message = json?.choices?.[0]?.message || {};
  const toolCalls = normalizedToolCalls(message.tool_calls);
  const value = typeof message.content === 'string' ? message.content.trim() : '';
  if (!value && !toolCalls.length) throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  return { text: value, toolCalls };
}

function geminiContents(messages: SalarLlmMessage[]) {
  const contents: any[] = [];
  for (const message of messages) {
    if (message.role === 'system') continue;
    if (message.role === 'tool') {
      contents.push({ role: 'user', parts: [{ functionResponse: { name: message.name || 'tool', response: safeJsonObject(textFromContent(message.content)) } }] });
      continue;
    }
    const parts: any[] = [];
    const text = textFromContent(message.content);
    if (text) parts.push({ text });
    if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) parts.push({ functionCall: { name: call.function.name, args: safeJsonObject(call.function.arguments) } });
    }
    if (parts.length) contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts });
  }
  return contents;
}
async function callGemini(key: string, model: string, messages: SalarLlmMessage[], maxTokens: number, tools: SalarToolDefinition[]) {
  const systemText = messages.filter((item) => item.role === 'system').map((item) => textFromContent(item.content)).filter(Boolean).join('\n');
  const body: Record<string, any> = { contents: geminiContents(messages), generationConfig: { maxOutputTokens: maxTokens, temperature: 0 } };
  if (!body.contents.length) body.contents = [{ role: 'user', parts: [{ text: 'ping' }] }];
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
  if (tools.length) body.tools = [{ functionDeclarations: tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: geminiSchema(tool.parameters) })) }];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const { response, text, json } = await requestJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) {
    if (shouldRotate(response.status, text)) throw new RotatableProviderError('provider rejected key');
    throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  }
  const parts = Array.isArray(json?.candidates?.[0]?.content?.parts) ? json.candidates[0].content.parts : [];
  const value = parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim();
  const toolCalls = parts.map((part: any, index: number) => part?.functionCall ? ({ id: `gemini-${index + 1}`, name: String(part.functionCall.name || ''), arguments: safeJsonObject(part.functionCall.args), rawArguments: JSON.stringify(part.functionCall.args || {}) }) : null).filter(Boolean) as SalarLlmToolCall[];
  if (!value && !toolCalls.length) throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  return { text: value, toolCalls };
}

async function attemptProvider(provider: Provider, keys: string[], model: string, messages: SalarLlmMessage[], purpose: SalarPurpose, maxTokens: number, tools: SalarToolDefinition[]): Promise<CompletionResult | null> {
  if (!keys.length || !model.trim()) return null;
  for (const index of keyOrder(provider, keys.length)) {
    try {
      const result = provider === 'groq'
        ? await callOpenAiCompatible('https://api.groq.com/openai/v1/chat/completions', keys[index], model, messages, maxTokens, tools)
        : provider === 'gemini'
          ? await callGemini(keys[index], model, messages, maxTokens, tools)
          : await callOpenAiCompatible('https://openrouter.ai/api/v1/chat/completions', keys[index], model, messages, maxTokens, tools);
      remember(provider, index);
      return { ...result, provider, keyIndex: index };
    } catch (error) {
      if (error instanceof RotatableProviderError) continue;
      if (purpose === 'vision' && error instanceof SalarServiceError) continue;
      throw error;
    }
  }
  return null;
}
async function runCompletion(messages: SalarLlmMessage[], purpose: SalarPurpose, maxTokens: number, tools: SalarToolDefinition[]): Promise<CompletionResult> {
  const providers: Array<{ provider: Provider; keys: string[]; model: string }> = [
    { provider: 'groq', keys: parseKeys(process.env.GROQ_API_KEYS), model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile' },
    { provider: 'gemini', keys: parseKeys(process.env.GEMINI_API_KEYS), model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash' },
    { provider: 'openrouter', keys: parseKeys(process.env.OPENROUTER_API_KEYS), model: process.env.OPENROUTER_MODEL?.trim() || '' },
  ];
  for (const item of providers) { const result = await attemptProvider(item.provider, item.keys, item.model, messages, purpose, maxTokens, tools); if (result) return result; }
  throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
}

export async function chatCompletion({ messages, purpose }: { messages: SalarLlmMessage[]; purpose: SalarPurpose }): Promise<string> {
  try { return (await runCompletion(messages, purpose, 256, [])).text; } catch { throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE); }
}
export async function chatCompletionWithTools({ messages, tools = [] }: { messages: SalarLlmMessage[]; tools?: SalarToolDefinition[] }): Promise<CompletionResult> {
  try { return await runCompletion(messages, 'text', 700, tools); } catch { throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE); }
}
export async function ping(): Promise<{ ok: true; provider: Provider; keyIndex: number }> {
  try { const result = await runCompletion([{ role: 'user', content: 'ping' }], 'text', 1, []); return { ok: true, provider: result.provider, keyIndex: result.keyIndex }; }
  catch { throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE); }
}
