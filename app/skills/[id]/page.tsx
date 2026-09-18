import SkillDetail from '@/components/SkillDetail';
import { getPrimeSkillsSnapshot } from '@/lib/publicCatalogServer';

export default async function SkillDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const resolved = params;
  const snapshot = await getPrimeSkillsSnapshot();
  return <SkillDetail skillId={decodeURIComponent(resolved.id)} initialItems={snapshot.skills} />;
}
