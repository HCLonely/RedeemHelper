import { isHost } from '../../shared/dom';
import { mountObserver } from '../../shared/observer';
import { mountItchAutoConsole } from './autoConsole';
import { redeemCurrentItchBundle } from './bundle';
import { extractAndRedeemItchLinks } from './extract';
import itchFreeListSites from './itchFreeListSite.json';
import { getItchLinkage } from './linkage';
import { handleItchDownloadPage, injectItchPurchaseButton, redeemItchGame } from './redeem';

const ITCH_PROCESSED_CLASS = 'redeem-itch-game';
const ITCH_BUTTON_CLASS = 'redeem-itch-button';
const ITCH_EXTRACT_BUTTON_ID = 'redeem-itch-extract';
const ITCH_AUTO_CONSOLE_BUTTON_ID = 'redeem-itch-auto-console-button';
const ITCH_EXTRACT_BUTTON_POSITION_KEY = 'itchExtractButtonPosition';
const ITCH_AUTO_CONSOLE_BUTTON_POSITION_KEY = 'itchAutoConsoleButtonPosition';
const EXTERNAL_HOSTS = [...new Set([
  'keylol.com',
  'www.steamgifts.com',
  'www.reddit.com',
  'new.isthereanydeal.com',
  'freegames.codes',
  ...itchFreeListSites.map((site) => new URL(site).hostname)
])];

const ITCH_CSS = `
.rh-modal.break-all .rh-modal-title{word-wrap:break-word;word-break:break-all;}
.rh-claim-button{
  display:inline-flex;align-items:center;gap:0.25em;
  padding:0.15em 0.7em;
  background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);
  color:#ffffff !important;
  font-weight:600;font-size:0.85em;line-height:1.35;
  border:none;border-radius:0.35em;
  cursor:pointer;text-decoration:none !important;
  box-shadow:0 1px 3px rgba(22,163,74,0.35);
  transition:all 0.2s ease;
  vertical-align:middle;
  white-space:nowrap;
  margin-left:0.5em;
}
.rh-claim-button:hover{
  background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);
  box-shadow:0 2px 8px rgba(22,163,74,0.45);
  transform:translateY(-1px);
  color:#ffffff !important;text-decoration:none !important;
}
.rh-claim-button:active{
  transform:translateY(0);
  box-shadow:0 1px 2px rgba(22,163,74,0.2);
}
.freegames-codes .rh-claim-button{margin-top:0.5em !important;margin-left:0 !important;}
.shaigrorb-itch-button{position:relative;height:min-content;right:39px;background-color:#16a34a;top:4px;text-decoration-line:none;color:white;font-weight:bold;border-radius:2px;padding:5px;font-size:13px;}
#${ITCH_EXTRACT_BUTTON_ID},#${ITCH_AUTO_CONSOLE_BUTTON_ID}{position:fixed;right:16px;z-index:2147483647;margin:0;padding:8px 16px;font-size:14px;line-height:1.5;cursor:grab;user-select:none;touch-action:none;}
#${ITCH_EXTRACT_BUTTON_ID}{top:16px;}
#${ITCH_AUTO_CONSOLE_BUTTON_ID}{top:60px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);box-shadow:0 1px 3px rgba(37,99,235,0.35);}
#${ITCH_EXTRACT_BUTTON_ID}.rh-dragging,#${ITCH_AUTO_CONSOLE_BUTTON_ID}.rh-dragging{cursor:grabbing;transition:none;transform:none;}
`;

let initialized = false;
let observer: MutationObserver | null = null;

function isDownloadPage(url: string): boolean {
  return /^https?:\/\/.+\.itch\.io\/[\w-]+\/download(?:\/.*|\?.*)?$/i.test(url);
}

function isPurchasePage(url: string): boolean {
  return /^https?:\/\/.*?itch\.io\/.*?\/purchase(?:\?.*)?$/i.test(url);
}

function isBundlePage(url: string): boolean {
  return /^https?:\/\/itch\.io\/s\/\d+\/.+/i.test(url);
}

function isEligibleItchHref(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return /(^|\.)itch\.io$/i.test(url.hostname)
      && !/itch\.io\/(?:b|c)\//i.test(url.href)
      && (
        /^https?:\/\/itch\.io\/s\/\d+\/.+/i.test(url.href)
        || /^https?:\/\/.+?\.itch\.io\/[^/?#]+\/?(?:purchase(?:\?.*)?)?$/i.test(url.href)
      );
  } catch {
    return false;
  }
}

function isItchFreeListSite(): boolean {
  const currentUrl = new URL(window.location.href);

  return itchFreeListSites.some((site) => {
    const configuredUrl = new URL(site);
    const configuredPath = configuredUrl.pathname.replace(/\/$/, '');
    const currentPath = currentUrl.pathname.replace(/\/$/, '');

    return currentUrl.hostname === configuredUrl.hostname
      && (currentPath === configuredPath || currentPath.startsWith(`${configuredPath}/`));
  });
}

function injectDraggableButton(options: {
  id: string;
  text: string;
  title: string;
  positionKey: string;
  onClick: () => void;
}): void {
  if (document.getElementById(options.id)) return;

  type ButtonPosition = { left: number; top: number };

  const button = document.createElement('button');
  button.id = options.id;
  button.type = 'button';
  button.className = 'rh-claim-button';
  button.textContent = options.text;
  button.title = options.title;
  document.body.append(button);

  const clampPosition = (left: number, top: number): ButtonPosition => ({
    left: Math.max(0, Math.min(left, window.innerWidth - button.offsetWidth)),
    top: Math.max(0, Math.min(top, window.innerHeight - button.offsetHeight))
  });
  const applyPosition = (position: ButtonPosition): void => {
    const clamped = clampPosition(position.left, position.top);
    button.style.left = `${clamped.left}px`;
    button.style.top = `${clamped.top}px`;
    button.style.right = 'auto';
  };

  const savedPosition = GM_getValue<Partial<ButtonPosition> | null>(options.positionKey, null);
  if (Number.isFinite(savedPosition?.left) && Number.isFinite(savedPosition?.top)) {
    applyPosition({ left: savedPosition!.left!, top: savedPosition!.top! });
  }

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;
  let suppressClick = false;

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    const rect = button.getBoundingClientRect();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    suppressClick = false;
    button.setPointerCapture(event.pointerId);
    button.classList.add('rh-dragging');
  });

  button.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;

    if (Math.hypot(event.clientX - startX, event.clientY - startY) >= 3) {
      suppressClick = true;
    }
    if (!suppressClick) return;

    event.preventDefault();
    applyPosition({ left: event.clientX - offsetX, top: event.clientY - offsetY });
  });

  const finishDragging = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;

    pointerId = null;
    button.classList.remove('rh-dragging');
    if (!suppressClick) return;

    const rect = button.getBoundingClientRect();
    const position = clampPosition(rect.left, rect.top);
    applyPosition(position);
    GM_setValue(options.positionKey, position);
  };
  button.addEventListener('pointerup', finishDragging);
  button.addEventListener('pointercancel', finishDragging);

  button.addEventListener('click', (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
      return;
    }
    options.onClick();
  });

  window.addEventListener('resize', () => {
    const rect = button.getBoundingClientRect();
    applyPosition({ left: rect.left, top: rect.top });
  });
}

function injectItchActionButtons(): void {
  injectDraggableButton({
    id: ITCH_EXTRACT_BUTTON_ID,
    text: '一键领取',
    title: '点击一键领取，拖拽可移动位置',
    positionKey: ITCH_EXTRACT_BUTTON_POSITION_KEY,
    onClick: () => { void runItchExtract(); }
  });
  injectDraggableButton({
    id: ITCH_AUTO_CONSOLE_BUTTON_ID,
    text: '自动领取控制台',
    title: '打开自动领取控制台，拖拽可移动位置',
    positionKey: ITCH_AUTO_CONSOLE_BUTTON_POSITION_KEY,
    onClick: () => {
      observer?.disconnect();
      observer = null;
      mountItchAutoConsole();
    }
  });
}

function createRedeemButton(href: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.itchHref = href;
  button.textContent = '领取';
  button.addEventListener('click', () => {
    void redeemItchGame(href);
  });

  if (window.location.hostname === 'freegames.codes') {
    button.className = 'details__buy rh-claim-button';
  } else if (window.location.hostname === 'shaigrorb.github.io') {
    button.className = 'shaigrorb-itch-button rh-claim-button';
  } else {
    button.className = 'rh-claim-button';
  }

  return button;
}

function addExternalRedeemButtons(): void {
  for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href*="itch.io"]:not(.${ITCH_PROCESSED_CLASS})`))) {
    link.classList.add(ITCH_PROCESSED_CLASS);
    const href = link.href;
    if (!isEligibleItchHref(href)) continue;

    const button = createRedeemButton(href);
    if (window.location.hostname === 'shaigrorb.github.io') {
      const card = link.closest('.item-card');
      (card || link).after(button);
    } else {
      link.after(button);
    }
  }
}

function injectBundleButton(): void {
  if (document.querySelector('#redeem-itch-io')) return;

  const button = document.createElement('button');
  button.id = 'redeem-itch-io';
  button.className = 'button';
  button.textContent = '后台领取';
  button.addEventListener('click', () => {
    void redeemCurrentItchBundle();
  });

  const buyRowButton = document.querySelector('.promotion_buy_row .buy_game_btn');
  if (buyRowButton) {
    button.setAttribute('style', 'font-size:18px;letter-spacing:0.025em;line-height:36px;height:40px;padding:0 20px;margin:0 16px');
    buyRowButton.after(button);
    return;
  }

  const countdownRow = document.querySelector('.countdown_row');
  if (!countdownRow) return;

  const wrapper = document.createElement('div');
  wrapper.style.width = '100%';
  button.setAttribute('style', 'font-size:18px;letter-spacing:0.025em;line-height:36px;padding:0 20px;margin:10px 30%;width:40%;');
  wrapper.append(button);
  countdownRow.prepend(wrapper);
}

function initItchHostPage(): void {
  const url = window.location.href;

  if (isDownloadPage(url)) {
    handleItchDownloadPage();
    return;
  }

  if (isPurchasePage(url)) {
    injectItchPurchaseButton();
    return;
  }

  if (isBundlePage(url)) {
    injectBundleButton();
  }
}

export function initItch(): void {
  if (initialized) return;
  initialized = true;

  void getItchLinkage();

  GM_addStyle(ITCH_CSS);

  if (isHost('itch.io')) {
    initItchHostPage();
    return;
  }

  if (!isHost(EXTERNAL_HOSTS)) return;

  if (isItchFreeListSite()) injectItchActionButtons();

  document.documentElement.classList.toggle('freegames-codes', window.location.hostname === 'freegames.codes');
  observer = mountObserver(addExternalRedeemButtons);
}

export async function runItchExtract(): Promise<void> {
  await extractAndRedeemItchLinks();
}

export function getItchObserver(): MutationObserver | null {
  return observer;
}
