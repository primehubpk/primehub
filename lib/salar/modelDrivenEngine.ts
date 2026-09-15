import 'server-only';

import { getSalarState, type SalarCatalogue, type SalarImageInput as BaseSalarImageInput } from '@/lib/salar/server';
import { normalizeSearchText, productSearchScore } from '@/lib/smartSearch';

export type SalarModelImageInput = BaseSalarImageInput;

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ChatContext = { lastProductQuery?: string; shownProductIds?: string[]; confirmedOrderProductIds?: string[] };
type DisplayMode = 'none' | 'products' | 'categories' | 'product_images';
type CatalogueMode = 'none' | 'products' | 'categories';
type ResultScope = 'focused' | 'all';
type ShoppingMode = 'retail' | 'wholesale';
type ProviderName = 'groq' | 'gemini' | 'openrouter';
