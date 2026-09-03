import { request, type RequestResult } from '../../shared/http';
import { getSettings } from '../../shared/storage';
import { redeemItchBundle } from './bundle';
import { reportItch } from './logging';
import type { ItchRedeemResult, ItchReporter } from './types';

interface DownloadUrlResponse {
  url?: string;
  errors?: string[];
}

type ClaimCheckWindow = Window & typeof globalThis & {
  checkItchGame?: () => void;
};

const GAME_URL_RE = /^https?:\/\/.+?\.itch\.io\/[^/?#]+\/?(?:purchase(?:\?.*)?)?$/i;
const REWARD_PURCHASE_URL_RE = /^https?:\/\/.+?\.itch\.io\/[^/?#]+\/purchase\?[^#]*reward_id=/i;
const BUNDLE_URL_RE = /^https?:\/\/itch\.io\/s\/\d+\/.+/i;

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

function requestFailure(url: string, message: string, response: RequestResult<unknown>, reporter?: ItchReporter): ItchRedeemResult {
  const details = `${url} (${response.status} ${response.statusText || 'Request failed'})`;
  reportItch(reporter, message, 'error', details);
  return { url, status: 'failed', message: details };
}

async function checkOwnedAndRedeem(url: string, reporter?: ItchReporter): Promise<ItchRedeemResult> {
  reportItch(reporter, '正在检测游戏是否拥有...', 'info', url);

  const response = await request<string>({
    url,
    method: 'GET'
  });

  if (response.status === 404) {
    if (response.text.includes('You do not have access to this page')) {
      return requestFailure(url, "无权访问此页面，可能已被作者修改为页面不可见！", response, reporter);
    }
    return requestFailure(url, "游戏页面不存在！", response, reporter);
  }

  if (!response.ok || !response.text) {
    return requestFailure(url, '游戏页面请求失败！', response, reporter);
  }

  if (isOwnedPageText(response.text)) {
    reportItch(reporter, '游戏已拥有！', 'success', url);
    return { url, status: 'owned' };
  }

  return purchase(url, reporter);
}

async function purchase(url: string, reporter?: ItchReporter): Promise<ItchRedeemResult> {
  try {
    reportItch(reporter, '正在加载购买页面...', 'info', url);
    const purchaseUrl = url.includes('/purchase') ? url : `${url}/purchase`;
    const response = await request<string>({
      url: purchaseUrl,
      method: 'GET'
    });

    if (!response.ok || !response.text) {
      if (response.status === 404) {
        reportItch(reporter, '当前游戏不可购买/领取！', 'warning', url);
        return { url, status: 'cannot' };
      }
      return requestFailure(url, '购买页面请求失败！', response, reporter);
    }

    const document = parseHtml(response.text);
    if (!isFreePurchasePage(document)) {
      reportItch(reporter, '价格不为 0，可能活动已结束！', 'warning', url);
      return { url, status: 'expired' };
    }

    const csrfToken = inputValue(document, '[name="csrf_token"]');
    const rewardId = inputValue(document, '[name="reward_id"]');

    if (!csrfToken) {
      reportItch(reporter, '获取 csrf_token 失败！', 'error', url);
      return { url, status: 'failed', message: 'Missing csrf_token' };
    }

    return download(purchaseUrl.replace(/\/purchase.*/, ''), csrfToken, rewardId, reporter);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportItch(reporter, '领取请求失败！', 'error', `${url}: ${message}`);
    return { url, status: 'failed', message };
  }
}

async function download(url: string, csrfToken: string, rewardId: string | undefined, reporter?: ItchReporter): Promise<ItchRedeemResult> {
  reportItch(reporter, '正在请求下载页面...', 'info', url);

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
    return loadDownload(response.data.url, url, reporter);
  }

  const errorMessage = response.data?.errors?.filter((error): error is string => typeof error === 'string').join('\n');
  if (errorMessage) {
    if (errorMessage === 'you must buy this game to download') {
      const message = '当前游戏需购买！';
      reportItch(reporter, message, 'error', url);
      return { url, status: 'failed', message };
    }

    reportItch(reporter, errorMessage, 'error', url);
    return { url, status: 'failed', message: errorMessage };
  }

  return requestFailure(url, '下载地址请求失败！', response, reporter);
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

async function loadDownload(downloadUrl: string, referer: string, reporter?: ItchReporter): Promise<ItchRedeemResult> {
  reportItch(reporter, '正在加载下载页面...', 'info', referer);
  const url = new URL(downloadUrl);
  const response = await request<string>({
    url: url.href,
    method: 'GET',
    headers: downloadHeaders(url, referer)
  });

  if (!response.ok || !response.text) {
    return requestFailure(referer, '下载页面请求失败！', response, reporter);
  }

  const document = parseHtml(response.text);
  const claimButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button.button'))
    .find((button) => /link|claim|链接/i.test(button.textContent || ''));
  const claimForm = document.querySelector<HTMLFormElement>('form[action*="claim-key"]')
    || claimButton?.closest('form') as HTMLFormElement | null;

  if (isLinkedDownloadPage(document)) {
    reportItch(reporter, '领取成功！', 'success', referer);
    return { url: referer, status: 'claimed' };
  } else if (claimForm) {
    const action = claimForm.getAttribute('action');
    const csrfToken = claimForm.querySelector<HTMLInputElement>('input[name="csrf_token"]')?.value || '';
    if (action && csrfToken) {
      return claimGame(new URL(action, url.href).href, csrfToken, url.href, referer, reporter);
    } else {
      reportItch(reporter, '获取领取表单失败！', 'error', referer);
      return { url: referer, status: 'failed', message: 'Invalid claim form' };
    }
  } else if (response.response?.finalUrl?.includes('/register')) {
    reportItch(reporter, '领取失败，请先登录！', 'error', referer);
    return { url: referer, status: 'login-required' };
  } else {
    reportItch(reporter, '领取完成，结果未知！', 'warning', referer);
    return { url: referer, status: 'unknown' };
  }
}

async function claimGame(action: string, token: string, referer: string, gameUrl: string, reporter?: ItchReporter): Promise<ItchRedeemResult> {
  reportItch(reporter, '正在领取游戏...', 'info', gameUrl);
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
    const claimed = isLinkedDownloadPage(document);
    reportItch(reporter, claimed ? '领取成功！' : '领取完成，结果未知！', claimed ? 'success' : 'warning', gameUrl);
    const checker = (window as ClaimCheckWindow).checkItchGame;
    if (typeof checker === 'function') checker();
    return { url: gameUrl, status: claimed ? 'claimed' : 'unknown' };
  } else if (response.response?.finalUrl?.includes('/register')) {
    reportItch(reporter, '请先登录！', 'error', gameUrl);
    return { url: gameUrl, status: 'login-required' };
  } else {
    return requestFailure(gameUrl, '领取请求失败！', response, reporter);
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

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button redeem-itch-purchase';
  button.title = '仅支持免费游戏';
  button.dataset.itchHref = buyButton.href;
  button.textContent = '后台领取';
  button.addEventListener('click', () => {
    void redeemItchGame(button.dataset.itchHref || buyButton.href);
  });

  buyButton.after(button);
}

export async function redeemItchGame(target: string, reporter?: ItchReporter): Promise<ItchRedeemResult> {
  reportItch(reporter, '当前游戏/优惠包链接:', 'info', target);

  if (BUNDLE_URL_RE.test(target)) {
    await redeemItchBundle(target, reporter);
    return { url: target, status: 'unknown', message: 'Bundle processed' };
  }

  const url = normalizeGameUrl(target);
  if (!url) {
    reportItch(reporter, '无效的 itch.io 链接，已跳过', 'warning', target);
    return { url: target, status: 'failed', message: 'Invalid itch.io URL' };
  }

  return checkOwnedAndRedeem(url, reporter);
}
