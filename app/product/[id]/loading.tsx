export default function ProductLoading() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 h-10 w-10 animate-pulse rounded-full bg-black/8" />
        <div className="grid gap-4 md:grid-cols-[1.05fr_.95fr]">
          <div className="aspect-square animate-pulse rounded-[30px] bg-white md:aspect-[4/3]" />
          <div className="rounded-[30px] bg-white p-6">
            <div className="h-8 w-4/5 animate-pulse rounded bg-black/8" />
            <div className="mt-5 h-16 w-1/2 animate-pulse rounded bg-black/8" />
            <div className="mt-5 h-28 animate-pulse rounded-2xl bg-black/8" />
          </div>
        </div>
      </div>
    </main>
  );
}
