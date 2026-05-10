import { isHost } from '../../shared/dom';
import { mountObserver } from '../../shared/observer';
import { redeemCurrentItchBundle } from './bundle';
import { extractAndRedeemItchLinks } from './extract';
import { handleItchDownloadPage, injectItchPurchaseButton, redeemItchGame } from './redeem';

const ITCH_PROCESSED_CLASS = 'redeem-itch-game';
const ITCH_BUTTON_CLASS = 'redeem-itch-button';
const EXTERNAL_HOSTS = [
  'keylol.com',
  'www.steamgifts.com',
  'www.reddit.com',
  'new.isthereanydeal.com',
  'freegames.codes',
  'itchclaim.tmbpeter.com',
  'shaigrorb.github.io'
];

const ITCH_CSS = `
.rh-modal.break-all .rh-modal-title{word-wrap:break-word;word-break:break-all;}
.${ITCH_BUTTON_CLASS}{margin-left:10px !important;}
.freegames-codes .${ITCH_BUTTON_CLASS}{margin-top:10px !important;margin-left:0 !important;}
.shaigrorb-itch-button{position:relative;height:min-content;right:39px;background-color:#16a34a;top:4px;text-decoration-line:none;color:white;font-weight:bold;border-radius:2px;padding:5px;font-size:13px;}
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

function createRedeemButton(href: string): HTMLAnchorElement {
  const button = document.createElement('a');
  button.href = 'javascript:void(0);';
  button.target = '_self';
  button.dataset.itchHref = href;
  button.textContent = '领取';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    void redeemItchGame(href);
  });

  if (window.location.hostname === 'freegames.codes') {
    button.className = `details__buy ${ITCH_BUTTON_CLASS}`;
  } else if (window.location.hostname === 'shaigrorb.github.io') {
    button.className = `shaigrorb-itch-button ${ITCH_BUTTON_CLASS}`;
  } else {
    button.className = ITCH_BUTTON_CLASS;
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

  GM_addStyle(ITCH_CSS);

  if (isHost('itch.io')) {
    initItchHostPage();
    return;
  }

  if (!isHost(EXTERNAL_HOSTS)) return;

  document.documentElement.classList.toggle('freegames-codes', window.location.hostname === 'freegames.codes');
  observer = mountObserver(addExternalRedeemButtons);
}

export async function runItchExtract(): Promise<void> {
  await extractAndRedeemItchLinks();
}

export function getItchObserver(): MutationObserver | null {
  return observer;
}
