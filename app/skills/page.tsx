import SkillsShowcase from '@/components/SkillsShowcase';
import { getPrimeSkillsSnapshot } from '@/lib/publicCatalogServer';

export default async function SkillsPage() {
  const snapshot = await getPrimeSkillsSnapshot();
  return <SkillsShowcase initialItems={snapshot.skills} initialPage={snapshot.skillsPage} />;
}
