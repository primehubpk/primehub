import SkillDetail from '@/components/SkillDetail';
import { getPrimeSkillsSnapshot } from '@/lib/publicCatalogServer';

export default async function SkillDetailPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const resolved = await Promise.resolve(params);
  const snapshot = await getPrimeSkillsSnapshot();
  return <SkillDetail skillId={decodeURIComponent(resolved.id)} initialItems={snapshot.skills} />;
}
