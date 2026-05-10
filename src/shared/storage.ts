const SETTINGS_KEY = 'setting';

export const defaultSettings: UnifiedSettings = {
  newTab: true,
  copyListen: true,
  selectListen: true,
  clickListen: true,
  allKeyListen: false,
  asf: false,
  asfProtocol: 'http',
  asfHost: '127.0.0.1',
  asfPort: '1242',
  asfPassword: '',
  asfBot: ''
};

export function getSettings(): UnifiedSettings {
  return {
    ...defaultSettings,
    ...GM_getValue<Partial<UnifiedSettings>>(SETTINGS_KEY, {})
  };
}

export function setSettings(settings: Partial<UnifiedSettings>): void {
  GM_setValue(SETTINGS_KEY, {
    ...getSettings(),
    ...settings
  });
}
