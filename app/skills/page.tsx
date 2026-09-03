import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function SkillsPage() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-8 sm:px-6 sm:pt-12">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-black/5 bg-[#FFFCF7] shadow-[0_18px_50px_rgba(20,20,15,0.08)]">
        <div className="relative px-5 py-10 text-center sm:px-10 sm:py-14">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F6A5F] text-white shadow-[0_10px_24px_rgba(15,106,95,0.24)]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>

          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#0F6A5F]">Prime Skills</p>
          <h1 className="mx-auto max-w-3xl text-3xl font-black tracking-[-0.03em] text-[#181914] sm:text-5xl">
            Aap kya karte hain?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-6 text-black/60 sm:text-base">
            Apni skill ya service PrimeHub par add karwa sakte hain. Humein WhatsApp par batayein — hum aapki service, image, video ya link yahan professionally add kar denge.
          </p>

          <Link
            href="https://wa.me/923238878009?text=Assalam%20o%20Alaikum%2C%20mujhe%20PrimeHub%20par%20apni%20skill%20ya%20service%20add%20karwani%20hai."
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#181914] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Apni Skill Add Karwayein
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-5xl">
        <div className="rounded-[24px] border border-dashed border-black/10 bg-white/60 px-5 py-10 text-center sm:px-8">
          <p className="text-sm font-bold text-black/70">Skills aur services yahan show hongi.</p>
          <p className="mt-2 text-xs font-medium text-black/45">Admin-controlled cards, thumbnails, prices, WhatsApp aur external links next phases mein connect honge.</p>
        </div>
      </section>
    </main>
  );
}
