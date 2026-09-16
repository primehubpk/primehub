'use client';

import { useEffect } from 'react';

type RewardArt = 'delivery' | 'points' | 'voucher' | 'retry' | 'gift';

const ART: Record<RewardArt, string> = {
  delivery: '/rewards/wheel/delivery.svg',
  points: '/rewards/wheel/points.svg',
  voucher: '/rewards/wheel/voucher.svg',
  retry: '/rewards/wheel/try-again.svg',
  gift: '/rewards/wheel/product.svg',
};

const ORDER: RewardArt[] = ['delivery', 'points', 'voucher', 'retry', 'gift'];

function rewardArtFrom(value: string, fallbackIndex: number): RewardArt {
  const text = value.toLowerCase();
  if (text.includes('delivery')) return 'delivery';
  if (text.includes('point')) return 'points';
  if (text.includes('voucher') || text.includes('coupon')) return 'voucher';
  if (text.includes('try again') || text.includes('try-again') || text.includes('retry')) return 'retry';
  if (text.includes('gift') || text.includes('product') || text.includes('mystery')) return 'gift';
  return ORDER[fallbackIndex % ORDER.length];
}

function forceStyle(node: HTMLElement, property: string, value: string) {
  node.style.setProperty(property, value, 'important');
}

function fixHomeWheel() {
  const prizes = Array.from(document.querySelectorAll<HTMLElement>('.ph-wheel-disc .ph-prize'));
  prizes.forEach((prize, index) => {
    const image = prize.querySelector<HTMLImageElement>('img');
    if (!image) return;

    const key = rewardArtFrom(`${image.alt || ''} ${image.getAttribute('src') || ''}`, index);
    const expected = ART[key];
    if (image.getAttribute('src') !== expected) image.setAttribute('src', expected);

    forceStyle(prize, 'background-image', 'none');
    forceStyle(prize, 'background-color', '#fff');
    forceStyle(image, 'display', 'block');
    forceStyle(image, 'opacity', '1');
    forceStyle(image, 'visibility', 'visible');
    forceStyle(image, 'width', '100%');
    forceStyle(image, 'height', '100%');
    forceStyle(image, 'object-fit', 'contain');
    forceStyle(image, 'object-position', 'center');
    forceStyle(image, 'background', '#fff');
  });
}

function fixDashboardWheel() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('section'));
  for (const section of sections) {
    const heading = Array.from(section.querySelectorAll('h2')).find(
      (node) => node.textContent?.trim() === 'Your reward wheel',
    );
    if (!heading) continue;

    const disc = Array.from(section.querySelectorAll<HTMLElement>('div')).find(
      (node) => node.classList.contains('rounded-full') && node.textContent?.includes('WIN'),
    );
    if (!disc) continue;

    const prizes = Array.from(disc.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement && node.textContent?.trim() !== 'WIN',
    );

    prizes.forEach((prize, index) => {
      const span = prize.querySelector<HTMLElement>(':scope > span');
      if (!span) return;
      const currentImage = span.querySelector<HTMLImageElement>('img');
      const source = `${prize.textContent || ''} ${currentImage?.alt || ''} ${currentImage?.getAttribute('src') || ''}`;
      const key = rewardArtFrom(source, index);
      let image = currentImage;
      if (!image) {
        image = document.createElement('img');
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        span.appendChild(image);
      }
      const expected = ART[key];
      if (image.getAttribute('src') !== expected) image.setAttribute('src', expected);

      forceStyle(span, 'background-image', 'none');
      forceStyle(image, 'display', 'block');
      forceStyle(image, 'opacity', '1');
      forceStyle(image, 'visibility', 'visible');
      forceStyle(image, 'width', '100%');
      forceStyle(image, 'height', '100%');
      forceStyle(image, 'object-fit', 'contain');
      forceStyle(image, 'object-position', 'center');
      forceStyle(image, 'border-radius', '10px');
      forceStyle(image, 'background', '#fff');
    });
  }
}

function fixWheelImages() {
  fixHomeWheel();
  fixDashboardWheel();
}

export default function RewardWheelImageFix() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(fixWheelImages);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ['src', 'alt'],
    });
    window.addEventListener('resize', schedule);
    schedule();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
