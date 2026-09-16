import './RewardWheelArtwork.css';

type RewardWheelPrizeLike = {
  name?: string;
  type?: string;
  points?: number;
  voucherAmount?: number;
};

export type RewardWheelArtworkKind =
  | 'points'
  | 'try-again'
  | 'free-delivery'
  | 'free-product'
  | 'voucher';

const ARTWORK: Record<RewardWheelArtworkKind, string> = {
  points: '/rewards/wheel/points.svg',
  'try-again': '/rewards/wheel/try-again.svg',
  'free-delivery': '/rewards/wheel/delivery.svg',
  'free-product': '/rewards/wheel/product.svg',
  voucher: '/rewards/wheel/voucher.svg',
};

export function rewardWheelArtworkKind(prize: RewardWheelPrizeLike): RewardWheelArtworkKind {
  const type = String(prize.type || '').toLowerCase();
  const name = String(prize.name || '').toLowerCase();

  if (type === 'points' || name.includes('point')) return 'points';
  if (type === 'free-delivery' || name.includes('delivery')) return 'free-delivery';
  if (type === 'coupon' || type === 'voucher' || name.includes('voucher') || name.includes('coupon')) return 'voucher';
  if (type === 'product' || name.includes('product') || name.includes('gift')) return 'free-product';
  return 'try-again';
}

export function rewardWheelPrizeLabel(prize: RewardWheelPrizeLike) {
  const kind = rewardWheelArtworkKind(prize);
  if (kind === 'points') return `${Math.max(0, Number(prize.points || 0)).toLocaleString()} Points`;
  if (kind === 'voucher') {
    const amount = Math.max(0, Number(prize.voucherAmount || 0));
    return amount > 0 ? `Rs. ${amount.toLocaleString()} Voucher` : 'Voucher';
  }
  if (kind === 'free-delivery') return 'Free Delivery';
  if (kind === 'free-product') return 'Free Product';
  return 'Try Again';
}

export function rewardWheelArtworkSource(prize: RewardWheelPrizeLike) {
  return ARTWORK[rewardWheelArtworkKind(prize)];
}

export default function RewardWheelArtwork({
  prize,
  compact = false,
}: {
  prize: RewardWheelPrizeLike;
  compact?: boolean;
}) {
  const kind = rewardWheelArtworkKind(prize);
  const label = rewardWheelPrizeLabel(prize);

  return (
    <span
      className={`reward-wheel-artwork ${compact ? 'reward-wheel-artwork--compact' : ''}`}
      data-reward-artwork={kind}
      aria-label={label}
      title={label}
    >
      <img src={ARTWORK[kind]} alt="" aria-hidden="true" draggable={false} />
      <strong>{label}</strong>
    </span>
  );
}
