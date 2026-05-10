export interface MenuHandlers {
  onOpenSettings?: () => void;
  onSteamASF?: () => void;
  onIGBatch?: () => void;
  onItchExtract?: () => void;
}

export function registerMenus(handlers: MenuHandlers): void {
  if (handlers.onOpenSettings) {
    GM_registerMenuCommand('⚙设置', handlers.onOpenSettings);
  }

  if (handlers.onSteamASF) {
    GM_registerMenuCommand('执行ASF指令', handlers.onSteamASF);
  }

  if (handlers.onIGBatch) {
    GM_registerMenuCommand('入库所有', handlers.onIGBatch);
  }

  if (handlers.onItchExtract) {
    GM_registerMenuCommand('提取所有链接', handlers.onItchExtract);
  }
}
