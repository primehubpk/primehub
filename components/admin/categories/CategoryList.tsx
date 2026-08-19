'use client';
import type { CategoryListProps } from './CategoryTypes';
import CategoryRow from './CategoryRow';
export default function CategoryList({ categories, onMove, onToggleActive, onEdit, onRemove }: CategoryListProps) {
  return <div className="mt-6 space-y-2">{categories.map((category, index) => <CategoryRow key={category.id} category={category} index={index} total={categories.length} onMove={onMove} onToggleActive={onToggleActive} onEdit={onEdit} onRemove={onRemove} />)}{!categories.length && <p className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-black/45">No categories yet.</p>}</div>;
}
