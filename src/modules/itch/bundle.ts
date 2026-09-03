import { request } from '../../shared/http';
import { removeOwnedItchGames, updateItchLinkage } from './linkage';
import { reportItch } from './logging';
import { redeemItchGame } from './redeem';
import type { ItchReporter } from './types';

const BUNDLE_URL_RE = /^https?:\/\/itch\.io\/s\/\d+\/.+/i;

function parseBundleGames(html: string, baseUrl: string): string[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const games = Array.from(document.querySelectorAll<HTMLAnchorElement>('.game_grid_widget.promo_game_grid a.thumb_link.game_link, a.thumb_link.game_link'))
    .map((link) => new URL(link.href || link.getAttribute('href') || '', baseUrl).href.replace(/\/$/, ''))
    .filter((href) => /^https?:\/\/.+?\.itch\.io\/[^/?#]+$/i.test(href));

  return [...new Set(games)];
}

export async function getItchBundleGames(url: string, reporter?: ItchReporter): Promise<string[]> {
  reportItch(reporter, '正在获取优惠包信息...', 'info', url);

  const response = await request<string>({
    url,
    method: 'GET'
  });

  if (!response.ok || !response.text) {
    reportItch(reporter, '优惠包请求失败！', 'error', `${url} (${response.status} ${response.statusText})`);
    return [];
  }

  if (response.text.includes('not_active_notification')) {
    reportItch(reporter, '优惠包活动已结束！', 'warning', url);
    return [];
  }

  return parseBundleGames(response.text, url);
}

export async function redeemItchBundle(url: string, reporter?: ItchReporter): Promise<void> {
  if (!BUNDLE_URL_RE.test(url)) return;

  const games = await getItchBundleGames(url, reporter);
  const originalTotal = games.length;
  const unownedGames = await removeOwnedItchGames(games);
  let completed = 0;

  for (const [index, game] of unownedGames.entries()) {
    await redeemItchGame(game, reporter, {
      skipLinkedOwnershipCheck: true,
      deferLinkageUpdate: true
    });
    completed = index + 1;
    if (originalTotal > 50 && completed % 30 === 0) await updateItchLinkage();
  }

  if (originalTotal <= 50 || completed % 30 !== 0) await updateItchLinkage();
}

export async function redeemCurrentItchBundle(): Promise<void> {
  const games = Array.from(document.querySelectorAll<HTMLAnchorElement>('.thumb_link.game_link'), (game) => game.href);
  const originalTotal = games.length;
  const unownedGames = await removeOwnedItchGames(games);
  let completed = 0;

  for (const [index, game] of unownedGames.entries()) {
    await redeemItchGame(game, undefined, {
      skipLinkedOwnershipCheck: true,
      deferLinkageUpdate: true
    });
    completed = index + 1;
    if (originalTotal > 50 && completed % 30 === 0) await updateItchLinkage();
  }

  if (originalTotal <= 50 || completed % 30 !== 0) await updateItchLinkage();
}
