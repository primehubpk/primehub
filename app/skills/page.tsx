import SkillsShowcase from '@/components/SkillsShowcase';
import { getPrimeSkillsSnapshot } from '@/lib/publicCatalogServer';

export const revalidate = 600;

export default async function SkillsPage() {
  const snapshot = await getPrimeSkillsSnapshot();
  return <SkillsShowcase initialItems={snapshot.skills} initialPage={snapshot.skillsPage} />;
}
