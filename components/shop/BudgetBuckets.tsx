import { Package, Sparkles } from 'lucide-react';

type Bucket = {
  id: string;
  title?: string;
  amount?: number | null;
  accent?: string;
  iconUrl?: string;
};

type Props = {
  buckets: Bucket[];
  maxPrice: string;
  setMaxPrice: (value: string) => void;
  wholesaleOnly: boolean;
  setWholesaleOnly: (value: boolean) => void;
};

function isWholesaleBucket(bucket: Bucket) {
  return String(bucket.title || '').toLowerCase().includes('wholesale') || Number(bucket.amount) === 0 || bucket.amount == null;
}

export default function BudgetBuckets({ buckets, maxPrice, setMaxPrice, wholesaleOnly, setWholesaleOnly }: Props) {
  if (!buckets.length) return null;

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Smart shopping</p>
          <h2 className="mt-0.5 text-base font-black text-[#14140F]">Shop by budget</h2>
        </div>
        {(maxPrice !== 'all' || wholesaleOnly) && (
          <button
            type="button"
            onClick={() => {
              setMaxPrice('all');
              setWholesaleOnly(false);
            }}
            className="rounded-full bg-white/80 px-3 py-1.5 text-[9px] font-black text-[#0F6A5F] shadow-sm ring-1 ring-black/5 backdrop-blur"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
        {buckets.map((bucket) => {
          const wholesale = isWholesaleBucket(bucket);
          const selected = wholesale ? wholesaleOnly : !wholesaleOnly && maxPrice === String(bucket.amount);
          const accent = bucket.accent || (wholesale ? '#0F6A5F' : '#FFB020');
          return (
            <button
              key={bucket.id}
              type="button"
              onClick={() => {
                if (wholesale) {
                  setWholesaleOnly(!wholesaleOnly);
                  setMaxPrice('all');
                  return;
                }
                setWholesaleOnly(false);
                setMaxPrice(selected ? 'all' : String(bucket.amount));
              }}
              className={`relative min-w-[168px] shrink-0 overflow-hidden rounded-full border px-4 py-3 text-left transition active:scale-[0.98] ${
                selected
                  ? 'border-white/20 text-white shadow-[0_14px_34px_rgba(15,106,95,0.22)]'
                  : 'border-white/50 text-[#14140F] shadow-[0_10px_28px_rgba(20,20,15,0.06)]'
              }`}
              style={
                selected
                  ? { background: `linear-gradient(135deg, ${accent}, #14140F)` }
                  : { background: `linear-gradient(135deg, rgba(255,255,255,0.86), ${accent}22)` }
              }
            >
              <div className="absolute inset-0 backdrop-blur-md" />
              <div className="relative flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full shadow-sm ${selected ? 'bg-white/15 text-white' : 'bg-white/80 text-[#14140F]'}`}
                >
                  {bucket.iconUrl ? (
                    <img src={bucket.iconUrl} alt="" className="h-full w-full object-cover" />
                  ) : wholesale ? (
                    <Package size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[8px] font-black uppercase tracking-[0.16em] ${selected ? 'text-white/70' : 'text-black/40'}`}>
                    {wholesale ? 'Wholesale Deals' : bucket.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] font-black leading-4">
                    {wholesale ? 'Special Wholesale Pricing' : `Under Rs. ${Number(bucket.amount).toLocaleString()}`}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
