'use client';

import { useId } from 'react';
import RewardWheelArtwork, { rewardWheelBackground } from './RewardWheelArtwork';
import './PremiumSpinWheel.css';

type Prize = {
  id?: string;
  name?: string;
  type?: string;
  points?: number;
  voucherAmount?: number;
};

const BULB_COUNT = 28;

function GoldPointer({ pinId }: { pinId: string }) {
  return (
    <svg className="psw-pointer-svg" viewBox="0 0 72 96" aria-hidden="true">
      <defs>
        <linearGradient id={pinId} x1="36" y1="4" x2="36" y2="92" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFF4C2" />
          <stop offset=".42" stop-color="#E8B83A" />
          <stop offset="1" stop-color="#A66B10" />
        </linearGradient>
      </defs>
      <path
        d="M36 6c15.5 0 28 12.4 28 27.6 0 20.2-28 56.4-28 56.4S8 53.8 8 33.6C8 18.4 20.5 6 36 6z"
        fill={`url(#${pinId})`}
        stroke="#FFF6D0"
        strokeWidth="3"
      />
      <circle cx="36" cy="34" r="11" fill="#FFF9EC" stroke="#D59A1F" strokeWidth="3" />
    </svg>
  );
}

function Crown() {
  return (
    <svg className="psw-crown" viewBox="0 0 64 36" aria-hidden="true">
      <path
        d="M6 28 14 8l12 14L32 4l6 18 12-14 8 20H6Z"
        fill="#E8B83A"
        stroke="#FFF3B0"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <rect x="8" y="26" width="48" height="7" rx="2" fill="#F0C44A" />
    </svg>
  );
}

export default function PremiumSpinWheel({
  prizes,
  rotation,
  compact = false,
}: {
  prizes: Prize[];
  rotation: number;
  compact?: boolean;
}) {
  const count = Math.max(1, prizes.length);
  const radius = compact ? 34 : 33;
  const pinId = `pswpin${useId().replace(/:/g, '')}`;

  return (
    <div className={`psw ${compact ? 'psw--compact' : 'psw--full'}`}>
      <div className="psw-glow" aria-hidden="true" />
      <GoldPointer pinId={pinId} />
      <div className="psw-stage">
        <div className="psw-rim" aria-hidden="true">
          {Array.from({ length: BULB_COUNT }, (_, index) => (
            <span
              key={index}
              className="psw-bulb"
              style={{ transform: `rotate(${(index * 360) / BULB_COUNT}deg)` }}
            />
          ))}
        </div>
        <div
          className="psw-disc"
          style={{
            transform: `rotate(${rotation}deg)`,
            background: rewardWheelBackground(count),
          }}
        >
          <div className="psw-disc-sheen" aria-hidden="true" />
          {prizes.map((prize, index) => {
            const angle = index * (360 / count);
            const radians = (angle * Math.PI) / 180;
            const x = 50 + radius * Math.sin(radians);
            const y = 50 - radius * Math.cos(radians);
            return (
              <div
                key={prize.id || `${prize.name}-${index}`}
                className="psw-slice"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <RewardWheelArtwork prize={prize} compact={compact} />
              </div>
            );
          })}
        </div>
        <div className="psw-hub">
          <Crown />
          <strong>PrimeHub</strong>
          <em>SPIN</em>
        </div>
      </div>
    </div>
  );
}
