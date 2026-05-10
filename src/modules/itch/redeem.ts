import { request, type RequestResult } from '../../shared/http';
import { getSettings } from '../../shared/storage';
import { showModal } from '../../shared/ui';
import { redeemItchBundle } from './bundle';

interface DownloadUrlResponse {
  url?: string;
}

type ClaimCheckWindow = Window & typeof globalThis & {
  checkItchGame?: () => void;
};

const GAME_URL_RE = /^https?:\/\/.+?\.itch\.io\/[^/?#]+\/?(?:purchase(?:\?.*)?)?$/i;
const REWARD_PURCHASE_URL_RE = /^https?:\/\/.+?\.itch\.io\/[^/?#]+\/purchase\?[^#]*reward_id=/i;
const BUNDLE_URL_RE = /^https?:\/\/itch\.io\/s\/\d+\/.+/i;

function updateModal(options: SwalOptions): void {
  const updater = (typeof Swal !== 'undefined' ? Swal as unknown as { update?: (options: SwalOptions) => void } : undefined)?.update;

  if (typeof updater === 'function') {
    updater(options);
    return;
  }

  void showModal(options);
}

function log(message: unknown, icon: SwalIcon = 'info'): void {
  if (typeof message !== 'string') {
    console.log(message);
    return;
  }

  updateModal({
    title: message,
    icon,
    className: 'break-all'
  });

  console.log(message);
}

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function textContent(documentOrElement: Document | Element, selector: string): string {
  return documentOrElement.querySelector(selector)?.textContent?.trim() || '';
}

function inputValue(document: Document, selector: string): string {
  const element = document.querySelector<HTMLInputElement>(selector);
  return element?.value || element?.getAttribute('value') || '';
}

function isFreePurchasePage(document: Document): boolean {
  const buttonMessage = document.querySelector('.button_message');
  const dollars = buttonMessage?.querySelector('.dollars[itemprop]')?.textContent || '';
  const buyMessage = buttonMessage?.querySelector('.buy_message')?.textContent || '';
  const placeholder = document.querySelector<HTMLInputElement>('.money_input')?.placeholder || '';

  return /0\.00/i.test(dollars)
    || /0\.00/i.test(placeholder)
    || /自己出价|Name your own price/i.test(buyMessage);
}

function isOwnedPageText(html: string): boolean {
  return html.includes('purchase_banner_inner');
}

function isLinkedDownloadPage(document: Document): boolean {
  const innerText = textContent(document, 'div.inner_column');
  return /This page is linked|此页面已链接到帐户/i.test(innerText)
    || document.querySelector('a.button.download_btn[data-upload_id]') !== null;
}

function normalizeGameUrl(target: string): string | null {
  let url: URL;

  try {
    url = new URL(target, window.location.href);
  } catch {
    return null;
  }

  if (REWARD_PURCHASE_URL_RE.test(url.href)) return url.href;
  if (!GAME_URL_RE.test(url.href)) return null;

  if (url.pathname.endsWith('/purchase')) {
    url.pathname = url.pathname.replace(/\/purchase\/?$/, '');
    url.search = '';
  }

  url.hash = '';
  return url.href.replace(/\/$/, '');
}

async function reportRequestFailure(message: string, response: RequestResult<unknown>): Promise<void> {
  log(message, 'error');
  log(response);
}

async function checkOwnedAndRedeem(url: string): Promise<void> {
  log(`当前游戏链接: <br/>${url}`);
  log(`正在检测游戏是否拥有...<br/>${url}`);

  const response = await request<string>({
    url,
    method: 'GET'
  });

  if (!response.ok || !response.text) {
    await reportRequestFailure('请求失败！', response);
    return;
  }

  if (isOwnedPageText(response.text)) {
    log('游戏已拥有！', 'success');
    return;
  }

  await purchase(url);
}

async function purchase(url: string): Promise<void> {
  try {
    log(`正在加载购买页面...<br/>${url}`);
    const purchaseUrl = url.includes('/purchase') ? url : `${url}/purchase`;
    const response = await request<string>({
      url: purchaseUrl,
      method: 'GET'
    });

    if (!response.ok || !response.text) {
      await reportRequestFailure('请求失败！', response);
      return;
    }

    const document = parseHtml(response.text);
    if (!isFreePurchasePage(document)) {
      log('价格不为 0, 可能活动已结束！', 'error');
      return;
    }

    const csrfToken = inputValue(document, '[name="csrf_token"]');
    const rewardId = inputValue(document, '[name="reward_id"]');

    if (!csrfToken) {
      log('获取 csrf_token 失败！', 'error');
      return;
    }

    await download(purchaseUrl.replace(/\/purchase.*/, ''), csrfToken, rewardId);
  } catch (error) {
    log('请求失败！', 'error');
    log(error);
  }
}

async function download(url: string, csrfToken: string, rewardId?: string): Promise<void> {
  log(`正在请求下载页面...<br/>${url}`);

  const body = new URLSearchParams({ csrf_token: csrfToken });
  if (rewardId) body.set('reward_id', rewardId);

  const response = await request<DownloadUrlResponse, string>({
    url: `${url}/download_url`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    data: body.toString(),
    responseType: 'json'
  });

  if (response.ok && response.data?.url) {
    await loadDownload(response.data.url, url);
    return;
  }

  await reportRequestFailure('请求失败！', response);
}

function downloadHeaders(url: URL, referer: string): Record<string, string> {
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    DNT: '1',
    Host: url.hostname,
    Referer: referer,
    'Upgrade-Insecure-Requests': '1'
  };
}

async function loadDownload(downloadUrl: string, referer: string): Promise<void> {
  log('正在加载下载页面...');
  const url = new URL(downloadUrl);
  const response = await request<string>({
    url: url.href,
    method: 'GET',
    headers: downloadHeaders(url, referer)
  });

  if (!response.ok || !response.text) {
    await reportRequestFailure('请求失败！', response);
    return;
  }

  const document = parseHtml(response.text);
  const claimButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button.button'))
    .find((button) => /link|claim|链接/i.test(button.textContent || ''));
  const claimForm = document.querySelector<HTMLFormElement>('form[action*="claim-key"]')
    || claimButton?.closest('form') as HTMLFormElement | null;

  if (isLinkedDownloadPage(document)) {
    log('领取成功！', 'success');
  } else if (claimForm) {
    const action = claimForm.getAttribute('action');
    const csrfToken = claimForm.querySelector<HTMLInputElement>('input[name="csrf_token"]')?.value || '';
    if (action && csrfToken) {
      await claimGame(new URL(action, url.href).href, csrfToken, url.href);
    } else {
      log('获取领取表单失败！', 'error');
    }
  } else if (response.response?.finalUrl?.includes('/register')) {
    log('领取失败，请先登录！', 'error');
  } else {
    log('领取完成，结果未知！', 'success');
  }

  const checker = (unsafeWindow as ClaimCheckWindow).checkItchGame;
  if (typeof checker === 'function') checker();
}

async function claimGame(action: string, token: string, referer: string): Promise<void> {
  log('正在领取游戏...');
  const url = new URL(action);
  const response = await request<string, string>({
    url: url.href,
    method: 'POST',
    headers: {
      ...downloadHeaders(url, referer),
      'Cache-Control': 'max-age=0',
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: url.origin
    },
    data: `csrf_token=${encodeURIComponent(token)}`
  });

  if (response.ok && response.text) {
    const document = parseHtml(response.text);
    log(isLinkedDownloadPage(document) ? '领取成功！' : '领取完成，结果未知！', 'success');
  } else if (response.response?.finalUrl?.includes('/register')) {
    log('请先登录！', 'error');
    log(response);
  } else {
    await reportRequestFailure('请求失败！', response);
  }
}

export function handleItchDownloadPage(): void {
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('button.button'))) {
    if (/link|claim|链接/i.test(button.textContent || '')) button.click();
  }

  if (getSettings().itch.autoClose && isLinkedDownloadPage(document)) {
    window.close();
  }
}

export function injectItchPurchaseButton(): void {
  const directDownloadButton = document.querySelector<HTMLAnchorElement>('a.direct_download_btn');
  if (/No thanks, just take me to the downloads|不用了，请带我去下载页面/i.test(directDownloadButton?.textContent || '')) {
    directDownloadButton?.click();
    return;
  }

  if (document.querySelector('.purchase_banner_inner') || !isFreePurchasePage(document)) return;

  const buyButton = document.querySelector<HTMLAnchorElement>('.buy_btn');
  if (!buyButton || buyButton.nextElementSibling?.classList.contains('redeem-itch-purchase')) return;

  const button = document.createElement('a');
  button.href = 'javascript:void(0)';
  button.target = '_self';
  button.className = 'button redeem-itch-purchase';
  button.title = '仅支持免费游戏';
  button.dataset.itchHref = buyButton.href;
  button.textContent = '后台领取';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    void redeemItchGame(button.dataset.itchHref || buyButton.href);
  });

  buyButton.after(button);
}

export async function redeemItchGame(target: string): Promise<void> {
  log(`当前游戏/优惠包链接: <br/>${target}`);

  if (BUNDLE_URL_RE.test(target)) {
    await redeemItchBundle(target);
    return;
  }

  const url = normalizeGameUrl(target);
  if (!url) return;

  await checkOwnedAndRedeem(url);
}
