'use client';

import { useEffect } from 'react';

const SELECT_PREFIX = 'Select ';

function normalizedText(element: Element | null) {
  return String(element?.textContent || '').replace(/\s+/g, ' ').trim();
}

function asButton(target: EventTarget | null) {
  return target instanceof Element ? target.closest('button') as HTMLButtonElement | null : null;
}

function productCardFor(element: Element | null) {
  let node = element?.parentElement || null;
  for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
    if (node.querySelector(`button[aria-label^="${SELECT_PREFIX}"]`)) return node;
  }
  return null;
}

function selectButtonFor(element: Element | null) {
  return productCardFor(element)?.querySelector<HTMLButtonElement>(`button[aria-label^="${SELECT_PREFIX}"]`) || null;
}

function titleFromSelect(button: HTMLButtonElement | null) {
  return String(button?.getAttribute('aria-label') || '').replace(/^Select\s+/i, '').trim();
}

function productHref(shell: HTMLElement, selectButton: HTMLButtonElement | null) {
  if (!selectButton) return '';
  const card = productCardFor(selectButton);
  const direct = card?.querySelector<HTMLAnchorElement>('a[href*="/product/"]');
  if (direct?.getAttribute('href')) return direct.getAttribute('href') || '';

  const title = titleFromSelect(selectButton).toLowerCase();
  if (!title) return '';
  const match = Array.from(shell.querySelectorAll<HTMLAnchorElement>('a[href*="/product/"]'))
    .find((link) => normalizedText(link).toLowerCase() === title);
  return match?.getAttribute('href') || '';
}

function actionStyle(button: HTMLButtonElement) {
  button.style.padding = '6px 9px';
  button.style.fontSize = '7px';
  button.style.lineHeight = '1';
  button.style.minHeight = '30px';
  button.style.gap = '4px';
}

function createOpenProductButton(href: string, imageOverlay = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.salarOpenProduct = '1';
  button.dataset.href = href;
  button.textContent = 'Open product';
  button.style.border = '0';
  button.style.borderRadius = '999px';
  button.style.background = '#14140F';
  button.style.color = '#fff';
  button.style.fontWeight = '900';
  button.style.fontSize = '8px';
  button.style.lineHeight = '1';
  button.style.padding = '7px 10px';
  button.style.cursor = 'pointer';
  button.style.marginTop = imageOverlay ? '0' : '8px';
  if (imageOverlay) {
    button.style.position = 'absolute';
    button.style.left = '6px';
    button.style.bottom = '6px';
    button.style.zIndex = '12';
    button.style.boxShadow = '0 4px 12px rgba(0,0,0,.2)';
  }
  return button;
}

function tagAndReplaceCardEditors(shell: HTMLElement) {
  const buttons = Array.from(shell.querySelectorAll<HTMLButtonElement>('button'));
  for (const button of buttons) {
    if (button.dataset.salarToolbarEdit || button.dataset.salarOpenProduct || button.dataset.salarFullImage) continue;
    const text = normalizedText(button).toLowerCase();
    if (text !== 'edit' && text !== 'edit colour' && text !== 'edit color') continue;

    button.dataset.salarOriginalEdit = '1';
    const selectButton = selectButtonFor(button);
    const href = productHref(shell, selectButton);
    button.style.display = 'none';
    if (!href) continue;

    const host = button.parentElement;
    if (!host || host.querySelector('[data-salar-open-product="1"]')) continue;
    const imageOverlay = Boolean(host.querySelector(`button[aria-label^="${SELECT_PREFIX}"]`));
    host.appendChild(createOpenProductButton(href, imageOverlay));
  }
}

function enhanceTitleLinks(shell: HTMLElement) {
  for (const link of Array.from(shell.querySelectorAll<HTMLAnchorElement>('a[href*="/product/"]'))) {
    if (link.dataset.salarProductTitle === '1') continue;
    if (!selectButtonFor(link)) continue;
    link.dataset.salarProductTitle = '1';
    link.setAttribute('role', 'button');
    link.setAttribute('aria-label', `${normalizedText(link)} select karein`);
  }
}

function selectedPanelFromAction(button: HTMLButtonElement | null) {
  return button?.parentElement?.parentElement as HTMLElement | null;
}

function selectedCount(panel: HTMLElement | null) {
  const match = normalizedText(panel).match(/(\d+)\s+selected/i);
  return match ? Number(match[1]) : 0;
}

function enhanceSelectedActions(shell: HTMLElement) {
  const sendButton = Array.from(shell.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => normalizedText(button).toLowerCase() === 'send selected');
  if (!sendButton) return;

  const panel = selectedPanelFromAction(sendButton);
  const row = sendButton.parentElement;
  if (!panel || !row) return;
  row.dataset.salarSelectedActions = '1';
  row.style.gap = '6px';

  const orderButton = Array.from(row.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => normalizedText(button).toLowerCase() === 'make order');
  actionStyle(sendButton);
  if (orderButton) actionStyle(orderButton);

  const existing = row.querySelector<HTMLButtonElement>('[data-salar-toolbar-edit="1"]');
  const count = selectedCount(panel);
  const editorTriggers = Array.from(shell.querySelectorAll<HTMLButtonElement>('[data-salar-original-edit="1"]'));

  if (count !== 1 || !editorTriggers.length) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.dataset.salarToolbarEdit = '1';
  edit.textContent = '✎ Edit';
  edit.style.flex = '0.72 1 0%';
  edit.style.border = '0';
  edit.style.borderRadius = '999px';
  edit.style.background = '#FFF';
  edit.style.color = '#14140F';
  edit.style.fontWeight = '900';
  edit.style.boxShadow = 'inset 0 0 0 1px rgba(20,20,15,.14)';
  actionStyle(edit);
  row.appendChild(edit);
}

function enhanceImageEditor(shell: HTMLElement) {
  const heading = Array.from(shell.querySelectorAll<HTMLElement>('p'))
    .find((node) => normalizedText(node).toLowerCase() === 'colour mark karein');
  if (!heading) return;

  const overlay = heading.closest<HTMLElement>('.absolute.inset-0');
  if (!overlay || overlay.querySelector('[data-salar-full-image="1"]')) return;
  const sendMarked = Array.from(overlay.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => normalizedText(button).toLowerCase() === 'send marked image');
  const row = sendMarked?.parentElement;
  if (!row) return;

  const full = document.createElement('button');
  full.type = 'button';
  full.dataset.salarFullImage = '1';
  full.textContent = 'Full image';
  full.style.height = '36px';
  full.style.border = '0';
  full.style.borderRadius = '999px';
  full.style.padding = '0 12px';
  full.style.background = 'rgba(255,255,255,.12)';
  full.style.color = '#fff';
  full.style.fontSize = '8px';
  full.style.fontWeight = '900';
  row.insertBefore(full, row.firstChild);
}

function clearSelectionAfterAction(button: HTMLButtonElement) {
  const panel = selectedPanelFromAction(button);
  window.setTimeout(() => {
    const firstRow = panel?.firstElementChild as HTMLElement | null;
    const clearButton = firstRow?.querySelector<HTMLButtonElement>('button');
    clearButton?.click();
  }, 0);
}

function openFullImageViewer(shell: HTMLElement) {
  const heading = Array.from(shell.querySelectorAll<HTMLElement>('p'))
    .find((node) => normalizedText(node).toLowerCase() === 'colour mark karein');
  const overlay = heading?.closest<HTMLElement>('.absolute.inset-0');
  const canvas = overlay?.querySelector<HTMLCanvasElement>('canvas');
  if (!canvas) return;

  let src = '';
  try {
    src = canvas.toDataURL('image/png');
  } catch {
    return;
  }
  if (!src) return;

  document.querySelector('[data-salar-full-viewer="1"]')?.remove();
  const viewer = document.createElement('div');
  viewer.dataset.salarFullViewer = '1';
  viewer.style.position = 'fixed';
  viewer.style.inset = '0';
  viewer.style.zIndex = '9999';
  viewer.style.background = 'rgba(10,10,8,.98)';
  viewer.style.display = 'flex';
  viewer.style.alignItems = 'center';
  viewer.style.justifyContent = 'center';
  viewer.style.padding = '14px';
  viewer.style.overflow = 'auto';

  const image = document.createElement('img');
  image.src = src;
  image.alt = 'Full product image';
  image.style.display = 'block';
  image.style.maxWidth = '100%';
  image.style.maxHeight = '100%';
  image.style.objectFit = 'contain';
  image.style.borderRadius = '12px';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close full image');
  close.style.position = 'fixed';
  close.style.top = '14px';
  close.style.right = '14px';
  close.style.zIndex = '10000';
  close.style.width = '42px';
  close.style.height = '42px';
  close.style.border = '0';
  close.style.borderRadius = '999px';
  close.style.background = 'rgba(255,255,255,.16)';
  close.style.color = '#fff';
  close.style.fontSize = '28px';
  close.style.lineHeight = '1';
  close.addEventListener('click', () => viewer.remove());

  viewer.append(image, close);
  document.body.appendChild(viewer);
}

export default function SalarInteractionEnhancer() {
  useEffect(() => {
    const shell = document.getElementById('salar-viewport-shell');
    if (!shell) return;

    let scheduled = 0;
    const enhance = () => {
      scheduled = 0;
      enhanceTitleLinks(shell);
      tagAndReplaceCardEditors(shell);
      enhanceSelectedActions(shell);
      enhanceImageEditor(shell);
    };
    const scheduleEnhance = () => {
      if (scheduled) return;
      scheduled = window.requestAnimationFrame(enhance);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('#salar-viewport-shell')) return;

      const openProduct = target.closest<HTMLButtonElement>('[data-salar-open-product="1"]');
      if (openProduct) {
        event.preventDefault();
        event.stopPropagation();
        const href = openProduct.dataset.href;
        if (href) {
          try { window.sessionStorage.setItem('primehub-salar-product-visit', '1'); } catch {}
          window.location.assign(href);
        }
        return;
      }

      const toolbarEdit = target.closest<HTMLButtonElement>('[data-salar-toolbar-edit="1"]');
      if (toolbarEdit) {
        event.preventDefault();
        event.stopPropagation();
        const triggers = Array.from(shell.querySelectorAll<HTMLButtonElement>('[data-salar-original-edit="1"]'));
        triggers.at(-1)?.click();
        return;
      }

      const fullImage = target.closest<HTMLButtonElement>('[data-salar-full-image="1"]');
      if (fullImage) {
        event.preventDefault();
        event.stopPropagation();
        openFullImageViewer(shell);
        return;
      }

      const titleLink = target.closest<HTMLAnchorElement>('a[data-salar-product-title="1"]');
      if (titleLink) {
        event.preventDefault();
        event.stopPropagation();
        selectButtonFor(titleLink)?.click();
        return;
      }

      const button = asButton(event.target);
      const text = normalizedText(button).toLowerCase();
      if (button && (text === 'send selected' || text === 'make order')) clearSelectionAfterAction(button);
    };

    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(shell, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    shell.addEventListener('click', onClick, true);
    enhance();

    return () => {
      observer.disconnect();
      shell.removeEventListener('click', onClick, true);
      if (scheduled) window.cancelAnimationFrame(scheduled);
      document.querySelector('[data-salar-full-viewer="1"]')?.remove();
    };
  }, []);

  return null;
}
