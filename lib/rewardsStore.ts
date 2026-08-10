import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RewardVoucher = {
  code: string;
  title: string;
  percent: number;
  maxDiscount: number;
  expires: string;
  source: 'spin' | 'welcome';
};

export const POINT_VALUE = 0.1;

const DEFAULT_VOUCHERS: RewardVoucher[] = [
  {
    code: 'WELCOME20',
    title: '20% OFF Welcome Voucher',
    percent: 20,
    maxDiscount: 1000,
    expires: 'Use on your next order',
    source: 'welcome',
  },
];

interface RewardsState {
  rewardPoints: number;
  vouchers: RewardVoucher[];
  appliedVoucher: string | null;
  pointsToRedeem: number;
  hasSpun: boolean;
  addVoucher: (voucher: RewardVoucher) => void;
  applyVoucher: (code: string) => void;
  removeVoucher: () => void;
  setPointsToRedeem: (points: number) => void;
  spinAndWin: () => RewardVoucher;
  getVoucherDiscount: (subtotal: number) => number;
  getPointsDiscount: (subtotalAfterVoucher: number) => number;
  getRewardsDiscount: (subtotal: number) => number;
  resetRewardsForOrder: () => void;
}

const clampPoints = (points: number, balance: number) => {
  const normalized = Math.max(0, Math.floor(Number(points) / 100) * 100);
  return Math.min(normalized, balance);
};

export const useRewardsStore = create<RewardsState>()(
  persist(
    (set, get) => ({
      rewardPoints: 350,
      vouchers: DEFAULT_VOUCHERS,
      appliedVoucher: null,
      pointsToRedeem: 0,
      hasSpun: false,
      addVoucher: (voucher) => set((state) => ({
        vouchers: state.vouchers.some((item) => item.code === voucher.code) ? state.vouchers : [...state.vouchers, voucher],
      })),
      applyVoucher: (code) => set((state) => ({
        appliedVoucher: state.vouchers.some((voucher) => voucher.code === code) ? code : state.appliedVoucher,
      })),
      removeVoucher: () => set({ appliedVoucher: null }),
      setPointsToRedeem: (points) => set((state) => ({ pointsToRedeem: clampPoints(points, state.rewardPoints) })),
      spinAndWin: () => {
        const rewards: RewardVoucher[] = [
          { code: 'SPIN10', title: '10% OFF Spin Voucher', percent: 10, maxDiscount: 500, expires: 'Valid for 7 days', source: 'spin' },
          { code: 'SPIN15', title: '15% OFF Spin Voucher', percent: 15, maxDiscount: 750, expires: 'Valid for 7 days', source: 'spin' },
          { code: 'SPIN20', title: '20% OFF Spin Voucher', percent: 20, maxDiscount: 1000, expires: 'Valid for 7 days', source: 'spin' },
        ];
        const voucher = rewards[Math.floor(Math.random() * rewards.length)];
        set((state) => ({
          vouchers: state.vouchers.some((item) => item.code === voucher.code) ? state.vouchers : [...state.vouchers, voucher],
          hasSpun: true,
          appliedVoucher: voucher.code,
        }));
        return voucher;
      },
      getVoucherDiscount: (subtotal) => {
        const voucher = get().vouchers.find((item) => item.code === get().appliedVoucher);
        if (!voucher || subtotal <= 0) return 0;
        return Math.min(Math.round(subtotal * (voucher.percent / 100)), voucher.maxDiscount, subtotal);
      },
      getPointsDiscount: (subtotalAfterVoucher) => {
        const points = get().pointsToRedeem;
        if (points <= 0 || subtotalAfterVoucher <= 0) return 0;
        return Math.min(Math.round(points * POINT_VALUE), subtotalAfterVoucher);
      },
      getRewardsDiscount: (subtotal) => {
        const voucherDiscount = get().getVoucherDiscount(subtotal);
        return voucherDiscount + get().getPointsDiscount(Math.max(0, subtotal - voucherDiscount));
      },
      resetRewardsForOrder: () => set({ appliedVoucher: null, pointsToRedeem: 0 }),
    }),
    {
      name: 'phdeals-rewards',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        rewardPoints: state.rewardPoints,
        vouchers: state.vouchers,
        appliedVoucher: state.appliedVoucher,
        pointsToRedeem: state.pointsToRedeem,
        hasSpun: state.hasSpun,
      }),
    }
  )
);
