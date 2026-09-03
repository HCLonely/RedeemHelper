import { getItchBundleGames } from './bundle';
import { removeOwnedItchGames, updateItchLinkage } from './linkage';
import { reportItch } from './logging';
import { redeemItchGame } from './redeem';
import type { ItchBatchResult, ItchRedeemResult, ItchReporter } from './types';

const GAME_LINK_RE = /^https?:\/\/.+?\.itch\.io\/[^/?#]+\/?(?:purchase)?$/i;
const REWARD_LINK_RE = /^https?:\/\/.+?\.itch\.io\/[^/?#]+\/purchase\?[^#]*reward_id=/i;
const BUNDLE_LINK_RE = /^https?:\/\/itch\.io\/s\/\d+\/.+/i;

export function normalizeItchHref(href: string, baseUrl = window.location.href): string | null {
  try {
    const url = new URL(href, baseUrl);
    url.hash = '';

    if (/itch\.io\/(?:b|c)\//i.test(url.href)) return null;
    if (BUNDLE_LINK_RE.test(url.href) || REWARD_LINK_RE.test(url.href)) return url.href.replace(/\/$/, '');
    if (!GAME_LINK_RE.test(url.href)) return null;

    if (url.pathname.endsWith('/purchase')) {
      url.pathname = url.pathname.replace(/\/purchase\/?$/, '');
      url.search = '';
    }

    return url.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function extractItchHrefs(html: string, baseUrl: string): string[] {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const links = Array.from(parsed.querySelectorAll<HTMLAnchorElement>('a[href*="itch.io"]'))
    .map((link) => link.getAttribute('href') || link.href)
    .map((href) => normalizeItchHref(href, baseUrl))
    .filter((href): href is string => Boolean(href));

  return [...new Set(links)];
}

export async function prepareItchRedeemQueue(hrefs: string[], reporter?: ItchReporter): Promise<string[]> {
  const games: string[] = [];
  const bundleCache = new Map<string, string[]>();

  try {
    for (const href of [...new Set(hrefs)]) {
      reportItch(reporter, '正在处理游戏/优惠包链接', 'info', href);
      if (BUNDLE_LINK_RE.test(href)) {
        let bundleGames = bundleCache.get(href);
        if (!bundleGames) {
          bundleGames = await getItchBundleGames(href, reporter);
          bundleCache.set(href, bundleGames);
        }
        games.push(...bundleGames);
      } else {
        const normalized = normalizeItchHref(href);
        if (normalized) games.push(normalized);
      }
    }

    return [...new Set(games)];
  } finally {
    bundleCache.clear();
    games.length = 0;
  }
}

function emptyBatchResult(): ItchBatchResult {
  return { total: 0, claimed: 0, owned: 0, expired: 0, loginRequired: 0, failed: 0, cannot: 0, unknown: 0 };
}

export async function redeemItchQueue(
  games: string[],
  reporter?: ItchReporter,
  onProgress?: (item: ItchRedeemResult, completed: number, total: number) => void,
  onPrepared?: (remaining: number, removedOwned: number) => void
): Promise<ItchBatchResult> {
  const result = emptyBatchResult();
  const originalTotal = games.length;
  const unownedGames = await removeOwnedItchGames(games);
  onPrepared?.(unownedGames.length, originalTotal - unownedGames.length);
  let completed = 0;

  for (const [index, game] of unownedGames.entries()) {
    const item = await redeemItchGame(game, reporter, {
      skipLinkedOwnershipCheck: true,
      deferLinkageUpdate: true
    });
    completed = index + 1;
    result.total += 1;
    if (item.status === 'login-required') result.loginRequired += 1;
    else result[item.status] += 1;
    onProgress?.(item, completed, unownedGames.length);

    if (originalTotal > 50 && completed % 30 === 0) await updateItchLinkage();

    if (item.status === 'login-required') {
      reportItch(reporter, '检测到 itch.io 未登录，已终止剩余领取任务', 'error', game);
      break;
    }
  }

  if (originalTotal <= 50 || completed === 0 || completed % 30 !== 0) await updateItchLinkage();

  return result;
}

export async function extractAndRedeemItchLinks(): Promise<void> {
  reportItch(undefined, '正在提取链接，请稍候...');

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="itch.io"]'))
    .filter((link) => !link.classList.contains('itch-io-game-link-owned'))
    .map((link) => link.dataset.itchHref || link.href)
    .map((href) => normalizeItchHref(href))
    .filter((href): href is string => Boolean(href));

  const queue = await prepareItchRedeemQueue(links);
  await redeemItchQueue(queue);
  reportItch(undefined, '全部领取完成！', 'success');
}

// !DEBUG
// @ts-ignore
// unsafeWindow.extractAndRedeemItchLinks =  async (links: string[]): Promise<void> => {
//   reportItch(undefined, '正在提取链接，请稍候...');
//   const queue = await prepareItchRedeemQueue(links);
//   await redeemItchQueue(queue);
//   reportItch(undefined, '全部领取完成！', 'success');
// }
