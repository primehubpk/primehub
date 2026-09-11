export default function ShopRouteLoading() {
  return (
    <main
      className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-5"
      role="status"
      aria-live="polite"
      aria-label="Opening shop"
    >
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-12 rounded-2xl bg-white shadow-sm" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="aspect-square rounded-xl bg-black/[0.06]" />
              <div className="mt-3 h-3 w-4/5 rounded-full bg-black/[0.08]" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-black/[0.05]" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading shop products…</span>
    </main>
  );
}
