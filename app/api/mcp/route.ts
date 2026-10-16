import { NextResponse } from 'next/server';
import {
  getPublicCatalogSnapshot,
  getPublicCategoriesSnapshot,
  getPublicProductSnapshot,
} from '@/lib/publicCatalogServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Read-only MCP surface. Never expose orders, members, admin settings, or writes here.
const VERSION = '2026-07-28';
const LEGACY_VERSION = '2025-11-25';
const PUBLIC_STORE = 'https://www.primehubmall.com';
const JSON_HEADERS = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
const SERVER_INFO = { name: 'primehubmall-store', version: '0.1.0' };
const INSTRUCTIONS = 'Search the public PrimeHubMall product catalog and categories. These tools are read-only. Never claim that this connector can update stock, prices, orders, customers, or the admin panel.';

type RpcRequest = {
  jsonrpc?: string;
  id?: unknown;
  method?: unknown;
  params?: Record<string, unknown>;
};

const TOOLS = [
  {
    name: 'search_products',
    title: 'Search PrimeHubMall products',
    description: 'Find currently visible public PrimeHubMall products by name or category, with current public prices. No customer data or admin access.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 2, maxLength: 80, description: 'Product name, such as glass bangles or jelly bangles' },
        limit: { type: 'integer', minimum: 1, maximum: 8, default: 6 },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'list_categories',
    title: 'List PrimeHubMall categories',
    description: 'List the active public storefront categories, without private store settings.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'get_product',
    title: 'Get a PrimeHubMall product',
    description: 'Look up one public product by its exact storefront product id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', minLength: 1, maxLength: 120 } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
] as const;

function rpc(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result }, { headers: JSON_HEADERS });
}
function rpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json(
    { jsonrpc: '2.0', id: id ?? null, error: { code, message } },
    { status, headers: JSON_HEADERS },
  );
}
function toolResult(value: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  };
}
function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
function isPublic(item: any) {
  return item && typeof item === 'object' && item.active !== false && item.published !== false;
}
function numberOrNull(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value);
  return value != null && value !== '' && Number.isFinite(n) ? n : null;
}
function safeProduct(item: any) {
  if (!isPublic(item)) return null;
  const id = text(item.id);
  if (!id) return null;
  const title = text(item.title) || text(item.name) || 'Product';
  const picture = text(item.imageUrl) || text(item.image_url) || text(item.image);
  return {
    id,
    title,
    category: text(item.category),
    price: numberOrNull(item.price),
    originalPrice: numberOrNull(item.originalPrice ?? item.original_price),
    imageUrl: picture || (Array.isArray(item.images) ? text(item.images[0]) : ''),
    url: PUBLIC_STORE + '/product/' + encodeURIComponent(id),
    inStock: numberOrNull(item.stock) === null ? null : Number(item.stock) > 0,
  };
}
function safeCategory(category: any) {
  if (!isPublic(category)) return null;
  const name = typeof category === 'string'
    ? category.trim()
    : text(category.title) || text(category.name) || text(category.label);
  return name ? { name, id: typeof category === 'string' ? '' : text(category.id) } : null;
}
async function executeTool(name: string, args: Record<string, unknown>) {
  if (name === 'list_categories') {
    const snapshot = await getPublicCategoriesSnapshot();
    const categories = (Array.isArray(snapshot.categories) ? snapshot.categories : [])
      .map(safeCategory)
      .filter(Boolean);
    return toolResult({ categories, count: categories.length, website: PUBLIC_STORE });
  }

  if (name === 'search_products') {
    const query = text(args.query).slice(0, 80).toLowerCase();
    if (query.length < 2) return { ...toolResult({ error: 'query must contain at least two characters.' }), isError: true };
    const requested = Number(args.limit ?? 6);
    const limit = Number.isInteger(requested) ? Math.min(8, Math.max(1, requested)) : 6;
    const snapshot = await getPublicCatalogSnapshot();
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = (Array.isArray(snapshot.products) ? snapshot.products : [])
      .filter(isPublic)
      .filter((product: any) => {
        const haystack = [product.title, product.name, product.category, product.brand]
          .map((part) => text(part).toLowerCase()).join(' ');
        return terms.every((term) => haystack.includes(term));
      })
      .slice(0, limit)
      .map(safeProduct)
      .filter(Boolean);
    return toolResult({ query, products: matches, count: matches.length, website: PUBLIC_STORE });
  }

  if (name === 'get_product') {
    const id = text(args.id);
    if (!id || id.length > 120) return { ...toolResult({ error: 'Valid product id required.' }), isError: true };
    const snapshot = await getPublicProductSnapshot(id);
    const product = safeProduct(snapshot.product);
    return toolResult({ product, found: Boolean(product), website: PUBLIC_STORE });
  }
  return { ...toolResult({ error: 'Unknown tool.' }), isError: true };
}

export async function GET() {
  return NextResponse.json(
    { error: 'Use MCP Streamable HTTP POST.' },
    { status: 405, headers: { ...JSON_HEADERS, Allow: 'POST' } },
  );
}
export async function DELETE() {
  return NextResponse.json(
    { error: 'This stateless MCP endpoint does not use sessions.' },
    { status: 405, headers: { ...JSON_HEADERS, Allow: 'POST' } },
  );
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  // Reject cross-site browser calls; server-to-server MCP clients omit Origin.
  if (origin && origin !== PUBLIC_STORE) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403, headers: JSON_HEADERS });
  }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return NextResponse.json({ error: 'Content-Type must be application/json.' }, { status: 415, headers: JSON_HEADERS });
  }
  if (Number(request.headers.get('content-length') || 0) > 16_384) {
    return NextResponse.json({ error: 'Request too large.' }, { status: 413, headers: JSON_HEADERS });
  }

  let payload: RpcRequest;
  try {
    const raw = await request.text();
    if (raw.length > 16_384) return rpcError(null, -32600, 'Request too large.', 413);
    payload = JSON.parse(raw);
  } catch {
    return rpcError(null, -32700, 'Invalid JSON.', 400);
  }
  if (!payload || Array.isArray(payload) || payload.jsonrpc !== '2.0' || typeof payload.method !== 'string') {
    return rpcError(payload?.id ?? null, -32600, 'Invalid JSON-RPC request.', 400);
  }
  const { id, method } = payload;
  const params = payload.params && typeof payload.params === 'object' && !Array.isArray(payload.params)
    ? payload.params : {};
  const modern = request.headers.get('mcp-protocol-version') === VERSION ||
    (params._meta as Record<string, unknown> | undefined)?.['io.modelcontextprotocol/protocolVersion'] === VERSION;

  // The 2026 transport requires routeable method and name headers.
  if (modern && (request.headers.get('mcp-method') !== method ||
    (method === 'tools/call' && request.headers.get('mcp-name') !== params.name))) {
    return rpcError(id, -32020, 'MCP routing headers do not match.', 400);
  }

  if (id === undefined) {
    return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  }

  let result: unknown;
  if (method === 'server/discover') {
    result = {
      supportedVersions: [VERSION, LEGACY_VERSION],
      capabilities: { tools: { listChanged: false } },
      instructions: INSTRUCTIONS,
      ttlMs: 60_000,
      cacheScope: 'public',
      _meta: { 'io.modelcontextprotocol/serverInfo': SERVER_INFO },
    };
  } else if (method === 'initialize') {
    result = {
      protocolVersion: LEGACY_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
    };
  } else if (method === 'ping') {
    result = {};
  } else if (method === 'tools/list') {
    result = { tools: TOOLS, ...(modern ? { ttlMs: 60_000, cacheScope: 'public' } : {}) };
  } else if (method === 'tools/call') {
    const name = text(params.name);
    if (!TOOLS.some((tool) => tool.name === name)) return rpcError(id, -32602, 'Unknown tool.');
    const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
      ? params.arguments as Record<string, unknown> : {};
    try {
      result = await executeTool(name, args);
    } catch {
      return rpc(id, { ...toolResult({ error: 'Public storefront catalog is temporarily unavailable.' }), isError: true });
    }
  } else {
    return rpcError(id, -32601, 'Method not found.');
  }
  return rpc(id, modern ? { resultType: 'complete', ...result as Record<string, unknown>,
    _meta: { ...(result && typeof result === 'object' ? (result as any)._meta : {}), 'io.modelcontextprotocol/serverInfo': SERVER_INFO } } : result);
}
