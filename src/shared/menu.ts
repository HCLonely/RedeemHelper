export interface MenuHandlers {
  onOpenSettings?: () => void;
  onSteamASF?: () => void;
  onIGBatch?: () => void;
  onItchExtract?: () => void;
  onSetItchLinkageCode?: () => void;
  onGOGBatch?: () => void;
}

export function registerMenus(handlers: MenuHandlers): void {
  const wrapMenuHandler = (handler: () => void) => (): void => {
    if (window.self !== window.top) {
      return;
    }
    handler();
  };

  if (handlers.onOpenSettings) {
    GM_registerMenuCommand('⚙Steam设置', wrapMenuHandler(handlers.onOpenSettings));
  }

  if (handlers.onSteamASF) {
    GM_registerMenuCommand('执行ASF指令', wrapMenuHandler(handlers.onSteamASF));
  }

  if (handlers.onIGBatch) {
    GM_registerMenuCommand('入库所有IndieGala链接', wrapMenuHandler(handlers.onIGBatch));
  }

  if (handlers.onItchExtract) {
    GM_registerMenuCommand('入库所有ItchIo链接', wrapMenuHandler(handlers.onItchExtract));
  }

  if (handlers.onSetItchLinkageCode) {
    GM_registerMenuCommand('输入Itch联动码', wrapMenuHandler(handlers.onSetItchLinkageCode));
  }

  if (handlers.onGOGBatch) {
    GM_registerMenuCommand('领取所有GOG链接', wrapMenuHandler(handlers.onGOGBatch));
  }
}
