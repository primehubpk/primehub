'use client';

import { useEffect } from 'react';

const ASSETS = {
  delivery: '/rewards/wheel/delivery.svg',
  points: '/rewards/wheel/points.svg',
  voucher: '/rewards/wheel/voucher.svg',
  retry: '/rewards/wheel/try-again.svg',
  gift: '/rewards/wheel/product.svg',
} as const;

type AssetKey = keyof typeof ASSETS;

function classifyPrize(node: HTMLElement): AssetKey {
  const icon = node.querySelector(':scope > span');
  const iconText = String(icon?.textContent || '').trim();
  const label = String(node.textContent || '').trim().toLowerCase();

  if (iconText.includes('📦') || label.includes('free delivery')) return 'delivery';
  if (iconText.includes('⭐') || label.includes('points')) return 'points';
  if (iconText.includes('₨') || label.includes('voucher')) return 'voucher';
  if (iconText.includes('↻') || label.includes('try again') || label.includes('rewards loading')) return 'retry';
  return 'gift';
}

function cleanPrizeLabel(node: HTMLElement) {
  const icon = node.querySelector(':scope > span');
  const full = String(node.textContent || '').trim();
  const iconText = String(icon?.textContent || '').trim();
  return (iconText && full.startsWith(iconText) ? full.slice(iconText.length) : full).trim();
}

function decorateDashboardWheel() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('section'));

  for (const section of sections) {
    const heading = Array.from(section.querySelectorAll('h2')).find(
      (node) => node.textContent?.trim() === 'Your reward wheel',
    );
    if (!heading) continue;

    const wrap = Array.from(section.querySelectorAll<HTMLElement>('div')).find(
      (node) => node.classList.contains('aspect-square') && node.classList.contains('relative') && node.querySelector(':scope > div.rounded-full'),
    );
    if (!wrap) continue;

    const disc = wrap.querySelector<HTMLElement>(':scope > div.rounded-full');
    if (!disc) continue;

    const children = Array.from(disc.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
    const center = children.find((node) => node.textContent?.trim() === 'WIN');
    const prizes = children.filter((node) => node !== center);

    section.dataset.phSharedWheel = 'true';
    wrap.dataset.phWheelWrap = 'true';
    disc.dataset.phWheelDisc = 'true';
    if (center) center.dataset.phWheelCenter = 'true';

    const width = disc.getBoundingClientRect().width || wrap.getBoundingClientRect().width || 300;
    const radius = Math.round(Math.min(108, Math.max(78, width * 0.35)));

    prizes.forEach((prize, index) => {
      const key = classifyPrize(prize);
      const label = cleanPrizeLabel(prize);
      const angle = index * 72 + 36;

      prize.dataset.phWheelPrize = 'true';
      prize.dataset.phWheelAsset = key;
      prize.dataset.phWheelLabel = label;
      prize.style.transform = `translate(-50%,-50%) rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg)`;
    });
  }
}

export default function RewardWheelPresentationEnhancer() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(decorateDashboardWheel);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    schedule();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <style jsx global>{`
      /* One presentation language for both reward wheels. Reward selection and admin data stay untouched. */
      .ph-prize {
        border-radius: 12px !important;
        border: 2px solid rgba(255,255,255,.96) !important;
        background: #fff !important;
        padding: 2px !important;
        overflow: hidden !important;
        box-shadow: 0 3px 9px rgba(20,20,15,.3) !important;
      }
      .ph-prize img {
        width: 100% !important;
        height: 100% !important;
        border-radius: 9px !important;
        background: #fff !important;
        object-fit: contain !important;
        object-position: center !important;
      }
      .ph-wheel-disc,
      [data-ph-wheel-disc="true"] {
        border-color: #fffdf8 !important;
        box-shadow: 0 12px 28px rgba(0,0,0,.28) !important;
      }
      .ph-wheel-disc em,
      [data-ph-wheel-center="true"] {
        border-color: #fff !important;
        background: #14140f !important;
        color: #fff !important;
        box-shadow: 0 3px 10px rgba(0,0,0,.32) !important;
      }

      [data-ph-shared-wheel="true"] {
        background: linear-gradient(160deg,#16332e,#0c1c19) !important;
      }
      [data-ph-wheel-wrap="true"] {
        width: min(100%, 310px) !important;
        max-width: 310px !important;
      }
      [data-ph-wheel-prize="true"] {
        width: clamp(62px, 20vw, 76px) !important;
        color: #fff !important;
        font-size: 0 !important;
        line-height: 1 !important;
        text-align: center !important;
        pointer-events: none !important;
        text-shadow: 0 1px 3px rgba(0,0,0,.45) !important;
      }
      [data-ph-wheel-prize="true"] > span {
        display: block !important;
        width: clamp(38px, 12vw, 48px) !important;
        height: clamp(38px, 12vw, 48px) !important;
        margin: 0 auto 3px !important;
        border: 2px solid rgba(255,255,255,.96) !important;
        border-radius: 12px !important;
        background-color: #fff !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        background-size: contain !important;
        box-shadow: 0 3px 9px rgba(20,20,15,.3) !important;
        color: transparent !important;
        font-size: 0 !important;
        overflow: hidden !important;
      }
      [data-ph-wheel-prize="true"] > span > img {
        display: none !important;
      }
      [data-ph-wheel-prize="true"]::after {
        content: attr(data-ph-wheel-label);
        display: -webkit-box;
        min-height: 20px;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        color: #fff;
        font-size: clamp(7px, 2.2vw, 9px);
        font-weight: 900;
        line-height: 1.08;
        text-align: center;
      }
      [data-ph-wheel-asset="delivery"] > span { background-image: url('${ASSETS.delivery}') !important; }
      [data-ph-wheel-asset="points"] > span { background-image: url('${ASSETS.points}') !important; }
      [data-ph-wheel-asset="voucher"] > span { background-image: url('${ASSETS.voucher}') !important; }
      [data-ph-wheel-asset="retry"] > span { background-image: url('${ASSETS.retry}') !important; }
      [data-ph-wheel-asset="gift"] > span { background-image: url('${ASSETS.gift}') !important; }

      @media (max-width: 390px) {
        [data-ph-wheel-wrap="true"] { max-width: 286px !important; }
        [data-ph-wheel-prize="true"] { width: 64px !important; }
        [data-ph-wheel-prize="true"] > span { width: 40px !important; height: 40px !important; border-radius: 10px !important; }
        [data-ph-wheel-prize="true"]::after { font-size: 7.5px !important; }
      }

      @media (min-width: 768px) {
        [data-ph-wheel-wrap="true"] { max-width: 330px !important; }
        [data-ph-wheel-prize="true"] { width: 78px !important; }
        [data-ph-wheel-prize="true"] > span { width: 50px !important; height: 50px !important; }
        [data-ph-wheel-prize="true"]::after { font-size: 9px !important; }
      }
    `}</style>
  );
}
