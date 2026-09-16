'use client';

import { useEffect } from 'react';

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
        [data-salar-whatsapp-row="true"] { gap: 6px; padding: 7px 8px; }
        [data-salar-whatsapp-link="true"] { gap: 5px; padding: 6px; }
        [data-salar-whatsapp-icon="true"] { width: 25px; height: 25px; flex-basis: 25px; font-size: 7px; }
        [data-salar-whatsapp-copy="true"] strong { font-size: 8px; }
        [data-salar-whatsapp-copy="true"] small { font-size: 7px; }
      }

    `}</style>
  );
}
