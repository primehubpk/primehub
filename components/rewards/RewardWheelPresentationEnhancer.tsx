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

const ASSET_LABELS: Record<AssetKey, string> = {
  delivery: 'Free Delivery',
  points: 'Points',
  voucher: 'Voucher',
  retry: 'Try Again',
  gift: 'Free Gift',
};

function classifyText(value: string): AssetKey {
  const text = value.toLowerCase();
  if (text.includes('delivery')) return 'delivery';
  if (text.includes('point')) return 'points';
  if (text.includes('voucher') || text.includes('coupon')) return 'voucher';
  if (text.includes('try-again') || text.includes('try again') || text.includes('retry') || text.includes('rewards loading')) return 'retry';
  return 'gift';
}

function classifyPrize(node: HTMLElement): AssetKey {
  const icon = node.querySelector(':scope > span');
  const image = node.querySelector<HTMLImageElement>('img');
  const iconText = String(icon?.textContent || '').trim();
  const label = String(node.textContent || '').trim();
  const source = `${image?.getAttribute('src') || ''} ${image?.getAttribute('alt') || ''} ${iconText} ${label}`;

  if (iconText.includes('📦')) return 'delivery';
  if (iconText.includes('⭐')) return 'points';
  if (iconText.includes('₨')) return 'voucher';
  if (iconText.includes('↻')) return 'retry';
  return classifyText(source);
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
    const radius = Math.round(Math.min(110, Math.max(82, width * 0.345)));

    prizes.forEach((prize, index) => {
      const key = classifyPrize(prize);
      const label = cleanPrizeLabel(prize) || ASSET_LABELS[key];
      const angle = index * 72 + 36;

      prize.dataset.phWheelPrize = 'true';
      prize.dataset.phWheelAsset = key;
      prize.dataset.phWheelLabel = label;
      prize.style.transform = `translate(-50%,-50%) rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg)`;
    });
  }
}

function decorateHomeWheel() {
  const prizes = Array.from(document.querySelectorAll<HTMLElement>('.ph-wheel-disc .ph-prize'));
  prizes.forEach((prize) => {
    const key = classifyPrize(prize);
    prize.dataset.phWheelAsset = key;
    prize.dataset.phWheelHomePrize = 'true';
    prize.setAttribute('aria-label', ASSET_LABELS[key]);
  });
}

function decorateSalarLauncher() {
  const root = document.getElementById('salar-viewport-shell');
  if (!root || root.querySelector('button[aria-label="Close Salar"]')) return;
  const label = root.querySelector<HTMLElement>(':scope > div > div > span');
  if (!label || label.textContent?.trim() !== 'Need help?') return;

  label.style.setProperty('display', 'block', 'important');
  label.style.setProperty('margin-right', '5px', 'important');
  label.style.setProperty('padding', '5px 10px', 'important');
  label.style.setProperty('border', '1px solid rgba(20,20,15,.08)', 'important');
  label.style.setProperty('border-radius', '999px', 'important');
  label.style.setProperty('background', '#fffdf8', 'important');
  label.style.setProperty('color', '#14140f', 'important');
  label.style.setProperty('font-size', '10px', 'important');
  label.style.setProperty('font-weight', '900', 'important');
  label.style.setProperty('box-shadow', '0 5px 16px rgba(20,20,15,.13)', 'important');
}

function createWhatsAppLink(title: string, number: string, href: string) {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.dataset.salarWhatsappLink = 'true';
  link.setAttribute('aria-label', `${title} WhatsApp ${number}`);

  const icon = document.createElement('span');
  icon.dataset.salarWhatsappIcon = 'true';
  icon.textContent = 'WA';

  const copy = document.createElement('span');
  copy.dataset.salarWhatsappCopy = 'true';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const small = document.createElement('small');
  small.textContent = number;
  copy.append(strong, small);
  link.append(icon, copy);
  return link;
}

function decorateSalarWhatsApp() {
  const close = document.querySelector<HTMLButtonElement>('#salar-viewport-shell button[aria-label="Close Salar"]');
  if (!close) return;
  const header = close.parentElement?.parentElement;
  const shell = header?.parentElement;
  if (!header || !shell || shell.querySelector('[data-salar-whatsapp-row="true"]')) return;

  const row = document.createElement('div');
  row.dataset.salarWhatsappRow = 'true';
  row.append(
    createWhatsAppLink('PrimeHub', '0303 5958676', 'https://wa.me/923035958676'),
    createWhatsAppLink('Complaints / Helpline', '0323 8878009', 'https://wa.me/923238878009'),
  );
  header.insertAdjacentElement('afterend', row);
}

function decoratePresentation() {
  decorateDashboardWheel();
  decorateHomeWheel();
  decorateSalarLauncher();
  decorateSalarWhatsApp();
}

export default function RewardWheelPresentationEnhancer() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(decoratePresentation);
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
      /* Shared visual layer only: reward selection, wallet, spin and admin values remain untouched. */
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

      .ph-prize[data-ph-wheel-home-prize="true"] {
        border: 2px solid rgba(255,255,255,.98) !important;
        border-radius: 13px !important;
        background-color: #fff !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        background-size: contain !important;
        padding: 2px !important;
        overflow: hidden !important;
        box-shadow: 0 3px 9px rgba(20,20,15,.28) !important;
      }
      .ph-prize[data-ph-wheel-home-prize="true"] img {
        opacity: 0 !important;
      }
      .ph-prize[data-ph-wheel-asset="delivery"] { background-image: url('${ASSETS.delivery}') !important; }
      .ph-prize[data-ph-wheel-asset="points"] { background-image: url('${ASSETS.points}') !important; }
      .ph-prize[data-ph-wheel-asset="voucher"] { background-image: url('${ASSETS.voucher}') !important; }
      .ph-prize[data-ph-wheel-asset="retry"] { background-image: url('${ASSETS.retry}') !important; }
      .ph-prize[data-ph-wheel-asset="gift"] { background-image: url('${ASSETS.gift}') !important; }

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
        width: clamp(40px, 12vw, 50px) !important;
        height: clamp(40px, 12vw, 50px) !important;
        margin: 0 auto 4px !important;
        border: 2px solid rgba(255,255,255,.98) !important;
        border-radius: 13px !important;
        background-color: #fff !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        background-size: contain !important;
        box-shadow: 0 3px 9px rgba(20,20,15,.28) !important;
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

      [data-salar-whatsapp-row="true"] {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 7px;
        flex: 0 0 auto;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(20,20,15,.08);
        background: #fffdf8;
      }
      [data-salar-whatsapp-link="true"] {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 7px;
        border: 1px solid rgba(16,128,79,.16);
        border-radius: 13px;
        background: #eefaf4;
        padding: 7px 8px;
        color: #12663f;
        text-decoration: none;
        box-shadow: 0 3px 10px rgba(20,20,15,.04);
      }
      [data-salar-whatsapp-icon="true"] {
        display: grid;
        width: 28px;
        height: 28px;
        flex: 0 0 28px;
        place-items: center;
        border-radius: 999px;
        background: #20b86a;
        color: white;
        font-size: 8px;
        font-weight: 950;
      }
      [data-salar-whatsapp-copy="true"] {
        min-width: 0;
      }
      [data-salar-whatsapp-copy="true"] strong,
      [data-salar-whatsapp-copy="true"] small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      [data-salar-whatsapp-copy="true"] strong {
        font-size: 9px;
        line-height: 1.1;
        font-weight: 950;
      }
      [data-salar-whatsapp-copy="true"] small {
        margin-top: 2px;
        font-size: 8px;
        line-height: 1.1;
        font-weight: 800;
        opacity: .72;
      }

      @media (max-width: 390px) {
        [data-ph-wheel-wrap="true"] { max-width: 286px !important; }
        [data-ph-wheel-prize="true"] { width: 64px !important; }
        [data-ph-wheel-prize="true"] > span { width: 40px !important; height: 40px !important; border-radius: 10px !important; }
        [data-ph-wheel-prize="true"]::after { font-size: 7.5px !important; }
        [data-salar-whatsapp-row="true"] { gap: 6px; padding: 7px 8px; }
        [data-salar-whatsapp-link="true"] { gap: 5px; padding: 6px; }
        [data-salar-whatsapp-icon="true"] { width: 25px; height: 25px; flex-basis: 25px; font-size: 7px; }
        [data-salar-whatsapp-copy="true"] strong { font-size: 8px; }
        [data-salar-whatsapp-copy="true"] small { font-size: 7px; }
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
