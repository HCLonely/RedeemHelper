import { initGOG } from './modules/gog';
import { initIG, runIGBatch } from './modules/ig';
import { initItch, runItchExtract } from './modules/itch';
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
    // onGOGBatch: runGOGBatch,
  });
}

bootstrap();
