export interface MenuHandlers {
  openSettings?: () => void;
  redeemWithAsf?: () => void;
  extractLinks?: () => void;
  redeemAllKeys?: () => void;
}

export function registerMenuCommands(handlers: MenuHandlers): void {
  if (handlers.openSettings) {
    GM_registerMenuCommand('⚙设置', handlers.openSettings);
  }

  if (handlers.redeemWithAsf) {
    GM_registerMenuCommand('执行ASF指令', handlers.redeemWithAsf);
  }

  if (handlers.extractLinks) {
    GM_registerMenuCommand('提取所有链接', handlers.extractLinks);
  }

  if (handlers.redeemAllKeys) {
    GM_registerMenuCommand('入库所有', handlers.redeemAllKeys);
  }
}
