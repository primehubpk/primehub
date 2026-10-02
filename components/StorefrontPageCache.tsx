'use client';

import type { ReactNode } from 'react';

// The homepage picture keep lives on the home node itself. This wrapper only
// passes the active route through, so Shop is not painted a second time.
export default function StorefrontPageCache({ children }: { children: ReactNode }) {
  return children;
}
