import { showModal } from '../../shared/ui';
import type { ItchLinkage } from './types';

declare const unsafeWindow: Window & typeof globalThis & Record<string, unknown>;

export const ITCH_LINKAGE_CODE_KEY = 'itchLinkageCode';

function isItchLinkage(value: unknown): value is ItchLinkage {
  if (typeof value !== 'function' || value === null) return false;

  const linkage = value as Partial<ItchLinkage>;
  return typeof linkage.connected === 'boolean'
    && typeof linkage.has === 'function'
    && typeof linkage.get === 'function'
    && typeof linkage.add === 'function'
    && typeof linkage.update === 'function'
    && typeof linkage.removeOwned === 'function';
}

export function getItchLinkage(): ItchLinkage | null {
  const linkageCode = GM_getValue<string>(ITCH_LINKAGE_CODE_KEY)?.trim();
  const linkage = linkageCode ? unsafeWindow[linkageCode] : undefined;
  return isItchLinkage(linkage) && linkage.connected ? linkage : null;
}

export async function setItchLinkageCode(): Promise<void> {
  const savedCode = GM_getValue<string>(ITCH_LINKAGE_CODE_KEY).trim();
  const input = document.createElement('input');
  input.type = 'text';
  input.value = savedCode;
  input.placeholder = 'Itch 联动服务的全局变量名';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Itch联动码');

  const resultPromise = showModal({
    title: '输入Itch联动码',
    text: '请输入提供 Itch 联动服务的全局变量名。',
    content: input,
    buttons: {
      confirm: '保存',
      cancel: '取消'
    }
  });
  input.focus();
  input.select();
  const confirmed = await resultPromise;

  if (confirmed !== true) return;

  const linkageCode = input.value.trim();
  GM_setValue(ITCH_LINKAGE_CODE_KEY, linkageCode);

  if (linkageCode && !getItchLinkage()) {
    await showModal({
      title: 'Itch联动码不可用',
      text: '未找到已连接的 Itch 联动服务，请确认联动码及对应脚本已启用。',
      icon: 'error'
    });
  }
}

export async function isItchOwned(game: string): Promise<boolean> {
  const linkage = getItchLinkage();
  if (!linkage) return false;

  try {
    return Boolean(await linkage.has(game.match(/https?:\/\/(.+?\/[^/]+)/i)?.[1]));
  } catch (error) {
    reportLinkageFailure('ownership check', error);
    return false;
  }
}

export async function removeOwnedItchGames(games: string[]): Promise<string[]> {
  const linkage = getItchLinkage();
  if (!linkage) return [...games];

  try {
    const unownedGames = await linkage.removeOwned([...games].map((game) => game.match(/https?:\/\/(.+?\/[^/]+)/i)?.[1]));
    return Array.isArray(unownedGames) && unownedGames.every((game) => typeof game === 'string')
      ? [...unownedGames].map((game) => `https://${game}`)
      : [...games];
  } catch {
    return [...games];
  }
}

export async function updateItchLinkage(): Promise<void> {
  const linkage = getItchLinkage();
  if (!linkage) return;

  try {
    await linkage.update();
  } catch (error) {
    reportLinkageFailure('update', error);
  }
}

function reportLinkageFailure(operation: string, error: unknown): void {
  try {
    console.warn(`[RedeemHelper] Itch linkage ${operation} failed; continuing without linkage.`, error);
  } catch {
    // Linkage is optional, including its diagnostic path.
  }
}
