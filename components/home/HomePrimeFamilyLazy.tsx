'use client';

import PrimeFamilyDashboard from '@/components/reseller/PrimeFamilyDashboard';

// Use the original dashboard directly: no secondary chunk fallback or preview card.
// The embedded dashboard renders its sections while account state is syncing.
export default function HomePrimeFamilyLazy({
  initialSettings,
}: {
  initialSettings?: Record<string, unknown>;
}) {
  return (
    <section className="home-prime-family-lazy" aria-label="Prime Family full dashboard">
      <PrimeFamilyDashboard embedded initialSettings={initialSettings} />
    </section>
  );
}
