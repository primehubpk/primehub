import type { FormEvent, RefObject } from 'react';
import type { PriceBucket } from '@/lib/types';
import type { Category } from '../shared';
export type CategoryWithMeta = Category & { slug?: string; active?: boolean; sortOrder?: number };
export type MediaAsset = { id: string; name?: string; url: string };
export type Tab = 'categories' | 'buckets';
export type CategoryFormState = { title: string; slug: string; iconUrl: string; active: boolean };
export type GalleryTarget = 'category' | 'bucket';
export type CategoryFormProps = { form: CategoryFormState; editingId: string | null; isSaving: boolean; uploading: boolean; fileInputRef: RefObject<HTMLInputElement>; onTitleChange: (value: string) => void; onSlugChange: (value: string) => void; onOpenGallery: () => void; onUploadDevice: () => void; onActiveChange: (value: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>; onCancel: () => void };
export type CategoryRowProps = { category: CategoryWithMeta; index: number; total: number; onMove: (category: CategoryWithMeta, direction: -1 | 1) => Promise<void>; onToggleActive: (category: CategoryWithMeta) => Promise<void>; onEdit: (category: CategoryWithMeta) => void; onRemove: (category: CategoryWithMeta) => Promise<void> };
export type CategoryListProps = { categories: CategoryWithMeta[]; onMove: CategoryRowProps['onMove']; onToggleActive: CategoryRowProps['onToggleActive']; onEdit: CategoryRowProps['onEdit']; onRemove: CategoryRowProps['onRemove'] };
export type BucketFormProps = { bucketForm: PriceBucket; editingBucketId: string | null; isSaving: boolean; uploading: boolean; fileInputRef: RefObject<HTMLInputElement>; onChange: (updater: (current: PriceBucket) => PriceBucket) => void; onOpenGallery: () => void; onUploadDevice: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>; onCancel: () => void };
export type BucketListProps = { buckets: PriceBucket[]; onMove: (index: number, direction: -1 | 1) => Promise<void>; onToggle: (bucket: PriceBucket) => Promise<void>; onEdit: (bucket: PriceBucket) => void; onRemove: (bucket: PriceBucket) => Promise<void> };
export type CategoryGalleryProps = { showGallery: boolean; gallerySearch: string; galleryTarget: GalleryTarget; gallery: MediaAsset[]; selectedUrl: string; uploading: boolean; fileInputRef: RefObject<HTMLInputElement>; onClose: () => void; onSearchChange: (value: string) => void; onChoose: (url: string) => void; onUpload: () => void };
export const EMPTY_FORM: CategoryFormState = { title: '', slug: '', iconUrl: '', active: true };
export const EMPTY_BUCKET: PriceBucket = { id: '', title: '', amount: 0, iconUrl: '', accent: '#FFB020', sortOrder: 1, active: true };
export const DEFAULT_BUCKETS: PriceBucket[] = [
  { id: 'under-99', title: 'Under 99', amount: 99, iconUrl: '', accent: '#E1352B', sortOrder: 1, active: true },
  { id: 'under-299', title: 'Under 299', amount: 299, iconUrl: '', accent: '#D99A17', sortOrder: 2, active: true },
  { id: 'under-999', title: 'Under 999', amount: 999, iconUrl: '', accent: '#0F6A5F', sortOrder: 3, active: true },
];
export function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
