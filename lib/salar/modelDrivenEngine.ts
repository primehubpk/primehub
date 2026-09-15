import 'server-only';

import { getSalarState, type SalarCatalogue, type SalarImageInput as BaseSalarImageInput } from '@/lib/salar/server';
import { normalizeSearchText, productSearchScore } from '@/lib/smartSearch';

export type SalarModelImageInput = BaseSalarImageInput;
