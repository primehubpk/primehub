'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'primehub-salar-chat-v5';
const CHAT_ID_KEY = 'primehub-salar-chat-id-v1';
const SENT_PREFIX = 'primehub-salar-feedback-v1:';

function normalized(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function readOrderState() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as { orderId?: string };
  } catch {
    return {} as { orderId?: string };
  }
}

function orderSuccessHost(shell: HTMLElement) {
  const button = Array.from(shell.querySelectorAll<HTMLButtonElement>('button'))
    .find((candidate) => normalized(candidate.textContent).toLowerCase() === 'send to whatsapp');
  const host = button?.parentElement as HTMLElement | null;
  if (!host || !normalized(host.textContent).toLowerCase().includes('order placed')) return null;
  return host;
}

function styleButton(button: HTMLButtonElement) {
  button.style.border = '0';
  button.style.borderRadius = '999px';
  button.style.fontWeight = '900';
  button.style.cursor = 'pointer';
}

function renderThanks(root: HTMLElement) {
  root.innerHTML = '';
  const thanks = document.createElement('div');
  thanks.textContent = 'Shukriya ✓ Aapka Salar feedback save ho gaya.';
  thanks.style.borderRadius = '12px';
  thanks.style.background = 'rgba(15,106,95,.08)';
  thanks.style.padding = '10px 12px';
  thanks.style.fontSize = '9px';
  thanks.style.fontWeight = '900';
  thanks.style.color = '#0F6A5F';
  root.appendChild(thanks);
}

function installFeedback(shell: HTMLElement) {
  const state = readOrderState();
  const orderId = normalized(state.orderId).slice(0, 200);
  const chatId = normalized(window.localStorage.getItem(CHAT_ID_KEY)).slice(0, 80);
  if (!orderId || !chatId) return;

  const host = orderSuccessHost(shell);
  if (!host) return;

  const existing = host.querySelector<HTMLElement>('[data-salar-order-feedback="1"]');
  if (existing?.dataset.orderId === orderId) return;
  existing?.remove();

  const root = document.createElement('div');
  root.dataset.salarOrderFeedback = '1';
  root.dataset.orderId = orderId;
  root.style.marginTop = '12px';
  root.style.borderTop = '1px solid rgba(15,106,95,.14)';
  root.style.paddingTop = '11px';
  root.style.color = '#14140F';
  host.appendChild(root);

  if (window.localStorage.getItem(`${SENT_PREFIX}${orderId}`) === '1') {
    renderThanks(root);
    return;
  }

  const heading = document.createElement('p');
  heading.textContent = 'Salar kaisa raha?';
  heading.style.margin = '0';
  heading.style.fontSize = '10px';
  heading.style.fontWeight = '900';

  const helper = document.createElement('p');
  helper.textContent = 'Apna chhota sa experience share karein — is se Salar ko aur behtar banane mein madad milegi.';
  helper.style.margin = '3px 0 8px';
  helper.style.fontSize = '8px';
  helper.style.lineHeight = '1.45';
  helper.style.color = 'rgba(20,20,15,.58)';

  const stars = document.createElement('div');
  stars.style.display = 'flex';
  stars.style.gap = '4px';
  stars.style.marginBottom = '8px';

  let selectedRating = 0;
  const starButtons: HTMLButtonElement[] = [];
  const paintStars = () => {
    starButtons.forEach((button, index) => {
      button.style.color = index < selectedRating ? '#F2A900' : '#CFCFC8';
      button.setAttribute('aria-pressed', index < selectedRating ? 'true' : 'false');
    });
  };

  for (let rating = 1; rating <= 5; rating += 1) {
    const star = document.createElement('button');
    star.type = 'button';
    star.textContent = '★';
    star.setAttribute('aria-label', `${rating} out of 5`);
    star.style.width = '28px';
    star.style.height = '28px';
    star.style.background = '#FFF';
    star.style.fontSize = '20px';
    star.style.lineHeight = '1';
    star.style.boxShadow = 'inset 0 0 0 1px rgba(20,20,15,.08)';
    styleButton(star);
    star.addEventListener('click', () => {
      selectedRating = rating;
      paintStars();
    });
    starButtons.push(star);
    stars.appendChild(star);
  }
  paintStars();

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Salar ke sath dealing kaisi rahi?';
  textarea.maxLength = 700;
  textarea.rows = 3;
  textarea.style.width = '100%';
  textarea.style.resize = 'none';
  textarea.style.border = '1px solid rgba(20,20,15,.09)';
  textarea.style.borderRadius = '12px';
  textarea.style.background = '#FFF';
  textarea.style.padding = '9px 10px';
  textarea.style.fontSize = '9px';
  textarea.style.lineHeight = '1.5';
  textarea.style.color = '#14140F';
  textarea.style.outline = 'none';
  textarea.style.boxSizing = 'border-box';

  const status = document.createElement('p');
  status.style.minHeight = '14px';
  status.style.margin = '5px 0 0';
  status.style.fontSize = '8px';
  status.style.fontWeight = '800';
  status.style.color = '#E1352B';

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.textContent = 'Review send karein';
  submit.style.marginTop = '6px';
  submit.style.background = '#14140F';
  submit.style.color = '#FFF';
  submit.style.padding = '9px 13px';
  submit.style.fontSize = '8px';
  styleButton(submit);

  submit.addEventListener('click', async () => {
    if (!selectedRating) {
      status.textContent = 'Pehle 1 se 5 star rating select karein.';
      return;
    }

    submit.disabled = true;
    submit.style.opacity = '.6';
    status.textContent = '';
    try {
      const response = await fetch('/api/salar/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          chatId,
          orderId,
          rating: selectedRating,
          comment: textarea.value.trim(),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Feedback save nahi ho saka.');
      window.localStorage.setItem(`${SENT_PREFIX}${orderId}`, '1');
      renderThanks(root);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Feedback save nahi ho saka. Dobara try karein.';
      submit.disabled = false;
      submit.style.opacity = '1';
    }
  });

  root.append(heading, helper, stars, textarea, status, submit);
}

export default function SalarOrderFeedbackBridge() {
  useEffect(() => {
    const shell = document.getElementById('salar-viewport-shell');
    if (!shell) return;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        installFeedback(shell);
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(shell, { childList: true, subtree: true });
    window.addEventListener('storage', schedule);
    schedule();

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
