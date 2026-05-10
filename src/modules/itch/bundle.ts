import { request } from '../../shared/http';
import { updateOrShowModal } from '../../shared/ui';
import { redeemItchGame } from './redeem';

const BUNDLE_URL_RE = /^https?:\/\/itch\.io\/s\/\d+\/.+/i;

function log(message: unknown, icon: SwalIcon = 'info', details?: string): void {
  if (typeof message !== 'string') {
    console.log(message);
    return;
  }

  updateOrShowModal({ title: message, text: details, icon, className: 'break-all' });
  console.log(details ? `${message}\n${details}` : message);
}

function parseBundleGames(html: string, baseUrl: string): string[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const games = Array.from(document.querySelectorAll<HTMLAnchorElement>('.game_grid_widget.promo_game_grid a.thumb_link.game_link, a.thumb_link.game_link'))
    .map((link) => new URL(link.href || link.getAttribute('href') || '', baseUrl).href.replace(/\/$/, ''))
    .filter((href) => /^https?:\/\/.+?\.itch\.io\/[^/?#]+$/i.test(href));

  return [...new Set(games)];
}

export async function getItchBundleGames(url: string): Promise<string[]> {
  log('正在获取优惠包信息...', 'info', url);

  const response = await request<string>({
    url,
    method: 'GET'
  });

  if (!response.ok || !response.text) {
    log('请求失败！', 'error');
    log(response);
    return [];
  }

  if (response.text.includes('not_active_notification')) {
    log('活动已结束！', 'error');
    return [];
  }

  return parseBundleGames(response.text, url);
}

export async function redeemItchBundle(url: string): Promise<void> {
  if (!BUNDLE_URL_RE.test(url)) return;

  const games = await getItchBundleGames(url);
  for (const game of games) {
    await redeemItchGame(game);
  }
}

export async function redeemCurrentItchBundle(): Promise<void> {
  const games = Array.from(document.querySelectorAll<HTMLAnchorElement>('.thumb_link.game_link'));
  for (const game of games) {
    await redeemItchGame(game.href);
  }
}
