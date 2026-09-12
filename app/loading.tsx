export default function GlobalRouteLoading() {
  return (
    <main
      className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-5"
      role="status"
      aria-label="Opening page"
    >
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-12 rounded-2xl bg-white shadow-sm" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="aspect-square bg-black/[0.06]" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-4/5 rounded-full bg-black/[0.08]" />
                <div className="h-3 w-1/2 rounded-full bg-black/[0.05]" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Opening page…</span>
    </main>
  );
}
