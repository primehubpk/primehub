export default function CategoryRouteLoading() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-5" role="status" aria-label="Opening categories">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-24 rounded-[28px] bg-white shadow-sm" />
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className="rounded-[22px] bg-white p-3 shadow-sm">
              <div className="aspect-square rounded-2xl bg-black/[0.06]" />
              <div className="mx-auto mt-3 h-3 w-4/5 rounded-full bg-black/[0.07]" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading categories…</span>
    </main>
  );
}
