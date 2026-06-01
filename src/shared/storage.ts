const SETTINGS_KEY = 'setting';

type PartialUnifiedSettings = {
  steam?: Partial<UnifiedSettings['steam']>;
  ig?: Partial<UnifiedSettings['ig']>;
  itch?: Partial<UnifiedSettings['itch']>;
  gog?: Partial<UnifiedSettings['gog']>;
};

export const defaultSettings: UnifiedSettings = {
  steam: {
    newTab: false,
    copyListen: true,
    selectListen: true,
    clickListen: true,
    allKeyListen: false,
    asf: false,
    asfProtocol: 'http',
    asfHost: '127.0.0.1',
    asfPort: 1242,
    asfPassword: '',
    asfBot: ''
  },
  ig: {
    enableButtons: true
  },
  itch: {
    autoClose: true
  },
  gog: {
    enableButtons: true
  }
};

function mergeSettings(settings: PartialUnifiedSettings = {}, base: UnifiedSettings = defaultSettings): UnifiedSettings {
  return {
    steam: {
      ...base.steam,
      ...settings.steam
    },
    ig: {
      ...base.ig,
      ...settings.ig
    },
    itch: {
      ...base.itch,
      ...settings.itch
    },
    gog: {
      ...base.gog,
      ...settings.gog
    }
  };
}

export function getSettings(): UnifiedSettings {
  return mergeSettings(GM_getValue<PartialUnifiedSettings>(SETTINGS_KEY, {}));
}

export function setSettings(settings: PartialUnifiedSettings): void {
  GM_setValue(SETTINGS_KEY, mergeSettings(settings, getSettings()));
}
