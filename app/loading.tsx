export default function Loading() {
  return (
    <main
      className="min-h-[calc(100vh-6rem)] bg-[#F4F4F1] px-4 pb-28 pt-5"
      role="status"
      aria-live="polite"
      aria-label="Opening page"
    >
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="rounded-[28px] border border-black/5 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-black/[0.07]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-28 rounded-full bg-black/[0.08]" />
              <div className="h-5 w-48 max-w-[70%] rounded-full bg-black/[0.1]" />
            </div>
          </div>
          <div className="mt-4 h-12 rounded-2xl bg-black/[0.055]" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="rounded-[22px] border border-black/5 bg-white p-3 shadow-sm"
            >
              <div className="aspect-square rounded-[18px] bg-black/[0.06]" />
              <div className="mt-3 h-3 w-4/5 rounded-full bg-black/[0.08]" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-black/[0.055]" />
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[28px] border border-black/5 bg-white p-4 shadow-sm sm:p-5">
          <div className="h-3 w-24 rounded-full bg-[#0F6A5F]/15" />
          <div className="mt-2 h-6 w-44 max-w-[65%] rounded-full bg-black/[0.09]" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="h-24 rounded-[20px] bg-black/[0.055]" />
            <div className="h-24 rounded-[20px] bg-black/[0.055]" />
          </div>
        </div>
      </div>
      <span className="sr-only">Opening the selected page…</span>
    </main>
  );
}
