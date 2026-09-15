import 'server-only';

import { answerWithModelDrivenSalar, type SalarModelImageInput } from '@/lib/salar/modelDrivenEngine';

export type SalarImageInput = SalarModelImageInput;

// Compatibility entry point for any older caller. The legacy pre-model decision
// engine is intentionally retired: all live decisions now go through the
// model-driven engine, where the model understands first, catalogue retrieval
// follows that interpretation, and the final model decides the reply/display.
export async function answerWithSalar(input: {
  message?: unknown;
  history?: unknown;
  context?: unknown;
  customerName?: unknown;
  exactProductIds?: unknown;
  image?: SalarModelImageInput;
  [key: string]: unknown;
}) {
  return answerWithModelDrivenSalar({
    message: input.message,
    history: input.history,
    context: input.context,
    customerName: input.customerName,
    exactProductIds: input.exactProductIds,
    image: input.image,
  });
}
