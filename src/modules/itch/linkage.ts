import type { ItchLinkage } from './types';

declare const unsafeWindow: Window & typeof globalThis & Record<string, unknown>;

interface SweetAlertResult {
  isConfirmed: boolean;
  value?: unknown;
}

declare const Swal: {
  fire(options: {
    title: string;
    text?: string;
    icon?: SwalIcon;
    input?: 'text';
    inputValue?: string;
    showCancelButton?: boolean;
    confirmButtonText?: string;
    cancelButtonText?: string;
  }): Promise<SweetAlertResult>;
};

export const ITCH_LINKAGE_CODE_KEY = 'itchLinkageCode';

function isItchLinkage(value: unknown): value is ItchLinkage {
  if (typeof value !== 'object' || value === null) return false;

  const linkage = value as Partial<ItchLinkage>;
  return typeof linkage.connected === 'boolean'
    && typeof linkage.has === 'function'
    && typeof linkage.get === 'function'
    && typeof linkage.add === 'function'
    && typeof linkage.update === 'function'
    && typeof linkage.removeOwned === 'function';
}

export function getItchLinkage(): ItchLinkage | null {
  const linkageCode = GM_getValue<string>(ITCH_LINKAGE_CODE_KEY, '').trim();
  const linkage = linkageCode ? unsafeWindow[linkageCode] : undefined;
  return isItchLinkage(linkage) && linkage.connected ? linkage : null;
}

export async function setItchLinkageCode(): Promise<void> {
  const savedCode = GM_getValue<string>(ITCH_LINKAGE_CODE_KEY, '').trim();
  const result = await Swal.fire({
    title: '输入Itch联动码',
    text: '请输入提供 Itch 联动服务的全局变量名。',
    input: 'text',
    inputValue: savedCode,
    showCancelButton: true,
    confirmButtonText: '保存',
    cancelButtonText: '取消'
  });

  if (!result.isConfirmed) return;

  const linkageCode = typeof result.value === 'string' ? result.value.trim() : '';
  GM_setValue(ITCH_LINKAGE_CODE_KEY, linkageCode);

  if (linkageCode && !getItchLinkage()) {
    await Swal.fire({
      title: 'Itch联动码不可用',
      text: '未找到已连接的 Itch 联动服务，请确认联动码及对应脚本已启用。',
      icon: 'error'
    });
  }
}

export async function isItchOwned(game: string): Promise<boolean> {
  const linkage = getItchLinkage();
  return linkage ? await linkage.has(game) : false;
}

export async function removeOwnedItchGames(games: string[]): Promise<string[]> {
  const linkage = getItchLinkage();
  if (!linkage) return [...games];

  try {
    const unownedGames = await linkage.removeOwned([...games]);
    return Array.isArray(unownedGames) && unownedGames.every((game) => typeof game === 'string')
      ? [...unownedGames]
      : [...games];
  } catch {
    return [...games];
  }
}

export async function updateItchLinkage(): Promise<void> {
  const linkage = getItchLinkage();
  if (linkage) await linkage.update();
}
