import SkillDetail from '@/components/SkillDetail';

export default function SkillDetailPage({ params }: { params: { id: string } }) {
  return <SkillDetail skillId={decodeURIComponent(params.id)} />;
}
