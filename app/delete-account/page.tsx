import Link from 'next/link';

export const metadata = {
  title: 'Delete Account | PrimeHub',
  description: 'How PrimeHub users can request deletion of their account and associated personal data.',
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 py-10 pb-28 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-black/6 bg-white p-6 shadow-sm sm:p-10">
        <div className="border-b border-black/8 pb-6">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#E1352B]">PrimeHub</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#14140F] sm:text-4xl">
            Delete Your PrimeHub Account
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-black/60">
            This page explains how users of the PrimeHub app and website can request deletion of their account and associated personal data.
          </p>
        </div>

        <section className="mt-8 space-y-7 text-[15px] leading-8 text-black/65">
          <div>
            <h2 className="text-lg font-black text-[#14140F]">How to request account deletion</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Contact PrimeHub support through the contact or WhatsApp option available on the PrimeHub website/app.</li>
              <li>Tell us that you want your PrimeHub account deleted.</li>
              <li>Provide the email address or other account identifier you used to create the account so we can verify the request.</li>
              <li>After verification, PrimeHub will process the account deletion request.</li>
            </ol>
          </div>

          <div>
            <h2 className="text-lg font-black text-[#14140F]">Data that may be deleted</h2>
            <p className="mt-3">
              Depending on the services you used, deletion may include your account profile, reseller profile information, saved account details, and other personal information linked to your PrimeHub account that is not required to be retained.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black text-[#14140F]">Data that may be retained</h2>
            <p className="mt-3">
              Some records may be kept when reasonably required for legal, accounting, fraud-prevention, dispute-resolution, or business record purposes. This can include completed order records, payment or withdrawal records, and transaction history. Such records are retained only for as long as necessary for those purposes and then deleted or anonymised where appropriate.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black text-[#14140F]">Need help?</h2>
            <p className="mt-3">
              Use the contact or WhatsApp option on PrimeHub and mention <strong>“Account Deletion Request”</strong> so the request can be identified quickly.
            </p>
          </div>
        </section>

        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white transition hover:bg-[#0F6A5F]">
            Back to Home
          </Link>
          <Link href="/privacy-policy" className="inline-flex rounded-full border border-black/10 px-5 py-3 text-xs font-black text-[#14140F] transition hover:bg-black/5">
            Privacy Policy
          </Link>
        </div>
      </article>
    </main>
  );
}
