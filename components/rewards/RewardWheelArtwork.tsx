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

// This order is shared by Admin, Home and Reseller Club. It matches the
// customer-facing premium wheel clockwise from the top pointer.
export const PREMIUM_REWARD_WHEEL_ORDER: RewardWheelArtworkKind[] = [
  'points',
  'voucher',
  'free-delivery',
  'free-product',
  'try-again',
];

const ARTWORK: Record<RewardWheelArtworkKind, string> = {
  points: '/rewards/wheel/points.svg',
  'try-again': '/rewards/wheel/try-again.svg',
  'free-delivery': '/rewards/wheel/delivery.svg',
  'free-product': '/rewards/wheel/product.svg',
  voucher: '/rewards/wheel/voucher.svg',
};

// Premium pastel palette from the approved reference: pink, yellow, blue,
// purple and mint green, separated by slim gold dividers.
const WHEEL_COLORS = ['#F4B6D2', '#F3D25C', '#7EC4F4', '#C4A3F5', '#7FDEB0'];

export function rewardWheelBackground(count: number) {
  const safeCount = Math.max(1, count);
  const step = 360 / safeCount;
  const separator = Math.min(2.1, step * 0.045);
  const stops = Array.from({ length: safeCount }, (_, index) => {
    const start = index * step;
    const end = (index + 1) * step;
    const color = WHEEL_COLORS[index % WHEEL_COLORS.length];
    return `#D89C2E ${start.toFixed(2)}deg ${(start + separator).toFixed(2)}deg, ${color} ${(start + separator).toFixed(2)}deg ${(end - separator).toFixed(2)}deg, #D89C2E ${(end - separator).toFixed(2)}deg ${end.toFixed(2)}deg`;
  });
  return `conic-gradient(from ${(-step / 2).toFixed(2)}deg, ${stops.join(', ')})`;
}

export function rewardWheelArtworkKind(prize: RewardWheelPrizeLike): RewardWheelArtworkKind {
  const type = String(prize.type || '').toLowerCase();
  const name = String(prize.name || '').toLowerCase();

  if (type === 'points' || name.includes('point')) return 'points';
  if (type === 'free-delivery' || name.includes('delivery')) return 'free-delivery';
  if (type === 'coupon' || type === 'voucher' || name.includes('voucher') || name.includes('coupon')) return 'voucher';
  if (type === 'product' || name.includes('product') || name.includes('gift') || name.includes('deal box')) return 'free-product';
  return 'try-again';
}

function voucherName(prize: RewardWheelPrizeLike) {
  const name = String(prize.name || '').trim();
  return name || 'Free Voucher';
}

export function rewardWheelPrizeLabel(prize: RewardWheelPrizeLike) {
  const kind = rewardWheelArtworkKind(prize);
  if (kind === 'points') {
    const points = Math.max(0, Number(prize.points || 0));
    return points > 0 ? `Free Points · ${points.toLocaleString()} points` : 'Free Points';
  }
  if (kind === 'voucher') {
    const amount = Math.max(0, Number(prize.voucherAmount || 0));
    const name = voucherName(prize);
    return amount > 0 ? `${name} · Rs. ${amount.toLocaleString()}` : name;
  }
  if (kind === 'free-delivery') return 'Free Delivery';
  if (kind === 'free-product') return 'Free Deal Box';
  return 'Try Again';
}

export function rewardWheelArtworkSource(prize: RewardWheelPrizeLike) {
  return ARTWORK[rewardWheelArtworkKind(prize)];
}

function splitWheelLabel(value: string, fallback: [string, string]): [string, string] {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  const words = clean.split(' ');
  if (words.length === 1) return [words[0], ''];
  if (words.length === 2) return [words[0], words[1]];
  const middle = Math.ceil(words.length / 2);
  return [words.slice(0, middle).join(' '), words.slice(middle).join(' ')];
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
  const labelParts: [string, string] = kind === 'points'
    ? ['Free', 'Points']
    : kind === 'voucher'
      ? splitWheelLabel(voucherName(prize), ['Free', 'Voucher'])
      : kind === 'free-delivery'
        ? ['Free', 'Delivery']
        : kind === 'free-product'
          ? ['Free', 'Deal Box']
          : ['Try', 'Again'];

  return (
    <span
      className={`reward-wheel-artwork ${compact ? 'reward-wheel-artwork--compact' : ''}`}
      data-reward-artwork={kind}
      aria-label={label}
      title={label}
    >
      <img src={ARTWORK[kind]} alt="" aria-hidden="true" draggable={false} />
      <strong aria-hidden="true">
        <span>{labelParts[0]}</span>
        {labelParts[1] ? <span>{labelParts[1]}</span> : null}
      </strong>
    </span>
  );
}
