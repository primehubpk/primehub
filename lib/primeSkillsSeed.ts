export type PrimeSkillSeedItem = {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  thumbnailUrl: string;
  mediaType: 'image' | 'video-link' | 'external-link';
  externalUrl: string;
  whatsapp: string;
  buttonText: string;
  active: boolean;
  sortOrder: number;
};

export const PRIME_SKILLS_SEED: PrimeSkillSeedItem[] = [
  {
    id: 'starter-website-build',
    title: 'Apni Website Banwayein',
    subtitle: 'Business, store ya portfolio website professional design ke sath.',
    price: 15000,
    thumbnailUrl: '/prime-skills/website-build.svg',
    mediaType: 'image',
    externalUrl: '',
    whatsapp: '03238878009',
    buttonText: 'Order Place',
    active: true,
    sortOrder: 1,
  },
  {
    id: 'starter-quran-memoona',
    title: 'Online Quran Tutor — Mrs Memoona',
    subtitle: 'Apnay bacho ko Quran ki taleem. Nazra, basic duas aur online classes.',
    price: 3500,
    thumbnailUrl: '/prime-skills/quran-memoona.svg',
    mediaType: 'image',
    externalUrl: '',
    whatsapp: '03111452840',
    buttonText: 'Order Place',
    active: true,
    sortOrder: 2,
  },
  {
    id: 'starter-quran-ayesha',
    title: 'Hafiza Ayesha',
    subtitle: 'Bacho ko Hifz o Nazra Quran ki taleem — online / home learning support.',
    price: 4000,
    thumbnailUrl: '/prime-skills/quran-ayesha.svg',
    mediaType: 'image',
    externalUrl: '',
    whatsapp: '03224765192',
    buttonText: 'Order Place',
    active: true,
    sortOrder: 3,
  },
  {
    id: 'starter-quran-tajweed',
    title: 'Alma Tajweed Teacher',
    subtitle: 'Bachay ko Quran parhaye — Tajweed, Nazra aur bunyadi taleem.',
    price: 3000,
    thumbnailUrl: '/prime-skills/quran-tajweed.svg',
    mediaType: 'image',
    externalUrl: '',
    whatsapp: '03214564368',
    buttonText: 'Order Place',
    active: true,
    sortOrder: 4,
  },
  {
    id: 'starter-website-rent',
    title: 'Complete Ready Website For Rent',
    subtitle: 'Business ke liye ready website hasil kry — fast setup aur modern design.',
    price: 8000,
    thumbnailUrl: '/prime-skills/website-rent.svg',
    mediaType: 'image',
    externalUrl: '',
    whatsapp: '03039598676',
    buttonText: 'Order Place',
    active: true,
    sortOrder: 5,
  },
];
