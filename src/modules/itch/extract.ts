import { getItchBundleGames } from './bundle';
import { redeemItchGame } from './redeem';

const GAME_LINK_RE = /^https?:\/\/.+?\.itch\.io\/[^/?#]+\/?(?:purchase)?$/i;
const REWARD_LINK_RE = /^https?:\/\/.+?\.itch\.io\/[^/?#]+\/purchase\?[^#]*reward_id=/i;
const BUNDLE_LINK_RE = /^https?:\/\/itch\.io\/s\/\d+\/.+/i;

function updateModal(options: SwalOptions): void {
  const updater = (typeof Swal !== 'undefined' ? Swal as unknown as { update?: (options: SwalOptions) => void } : undefined)?.update;

  if (typeof updater === 'function') {
    updater(options);
    return;
  }

  if (typeof Swal !== 'undefined' && Swal?.fire) {
    void Swal.fire(options);
  } else if (typeof swal === 'function') {
    void swal(options);
  }
}

function log(message: string, icon: SwalIcon = 'info'): void {
  updateModal({ title: message, icon, className: 'break-all' });
  console.log(message);
}

function normalizeHref(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    url.hash = '';

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

async function expandItchLink(href: string): Promise<string[]> {
  if (BUNDLE_LINK_RE.test(href)) {
    return getItchBundleGames(href);
  }

  const normalized = normalizeHref(href);
  return normalized ? [normalized] : [];
}

export async function extractAndRedeemItchLinks(): Promise<void> {
  log('正在提取链接，请稍候...');

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="itch.io"]'))
    .filter((link) => !link.classList.contains('itch-io-game-link-owned'))
    .filter((link) => !/itch\.io\/(?:b|c)\//i.test(link.href))
    .map((link) => link.dataset.itchHref || link.href);

  const games: string[] = [];
  for (const link of links) {
    log(`正在处理游戏/优惠包链接: <br/>${link}`);
    games.push(...await expandItchLink(link));
  }

  for (const game of [...new Set(games)]) {
    await redeemItchGame(game);
  }

  log('全部领取完成！', 'success');
}
