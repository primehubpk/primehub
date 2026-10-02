import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function HomeRailFrame({ title, href, image, icon, children, className = '', hideHeader = false }: {
  title: string; href: string; image?: string; icon?: ReactNode; children: ReactNode; className?: string; hideHeader?: boolean;
}) {
  return <div className={`home-category-rail-frame rounded-[24px] border border-[#DCCCA8]/60 bg-[#FFFCF7] py-4 shadow-sm ${className}`}>
    {!hideHeader ? (
      <Link href={href} prefetch={false} className="group mx-4 mb-3 flex w-fit items-center gap-3">
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#F4C64A] bg-[#F4F4F1] text-[#0F6A5F] shadow-md">
          {image ? <Image src={image} alt="" fill unoptimized sizes="56px" className="object-cover" /> : icon}
        </span>
        <span><span className="block text-[9px] font-black uppercase tracking-widest text-[#A26D13]">Browse collection</span>
          <span className="block text-base font-black text-[#14140F] group-hover:text-[#0F6A5F]">{title} →</span></span>
      </Link>
    ) : null}
    {children}
  </div>;
}
