// import './shared/trusted-types';
import { initGOG, runGOGBatch } from './modules/gog';
import { initIG, runIGBatch } from './modules/ig';
import { initItch, runItchExtract } from './modules/itch';
import { setItchLinkageCode } from './modules/itch/linkage';
import { initSteam, openSteamSettings, runSteamASF } from './modules/steam';
import { registerMenus } from './shared/menu';

function bootstrap(): void {
  initSteam();
  initIG();
  initItch();
  initGOG();

  registerMenus({
    onOpenSettings: openSteamSettings,
    onSteamASF: runSteamASF,
    onIGBatch: runIGBatch,
    onItchExtract: runItchExtract,
    onSetItchLinkageCode: () => { void setItchLinkageCode(); },
    onGOGBatch: runGOGBatch,
  });
}

bootstrap();
