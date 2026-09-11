import { Suspense } from 'react';
import SkillsShowcase from '@/components/SkillsShowcase';
import { getPrimeSkillsSnapshot } from '@/lib/publicCatalogServer';

export const revalidate = 600;

function SkillsLoadingState() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-5" role="status" aria-label="Opening Prime Skills">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <div className="h-4 w-24 rounded-full bg-black/[0.08]" />
          <div className="mt-3 h-8 w-3/4 rounded-full bg-black/[0.1]" />
          <div className="mt-3 h-4 w-full rounded-full bg-black/[0.05]" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="aspect-[4/3] rounded-xl bg-black/[0.06]" />
              <div className="mt-3 h-3 w-4/5 rounded-full bg-black/[0.08]" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-black/[0.05]" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading Prime Skills…</span>
    </main>
  );
}

async function SkillsContent() {
  const snapshot = await getPrimeSkillsSnapshot();
  return <SkillsShowcase initialItems={snapshot.skills} initialPage={snapshot.skillsPage} />;
}

export default function SkillsPage() {
  return (
    <Suspense fallback={<SkillsLoadingState />}>
      <SkillsContent />
    </Suspense>
  );
}
