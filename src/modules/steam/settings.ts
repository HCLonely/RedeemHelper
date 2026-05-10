import { extractSteamKeys } from '../../shared/regex';
import { defaultSettings, getSettings, setSettings } from '../../shared/storage';
import { showModal } from '../../shared/ui';

export type SteamSettings = UnifiedSettings['steam'];

type LegacySteamSettings = Partial<SteamSettings> & { steam?: never };

type ActivationHistory = [string, string | null];

export function getSteamSettings(): SteamSettings {
  const raw = GM_getValue<Partial<UnifiedSettings> | LegacySteamSettings>('setting', {});

  if (raw && 'steam' in raw) {
    return getSettings().steam;
  }

  if (raw && Object.keys(raw).some((key) => key in defaultSettings.steam)) {
    const migrated = { ...defaultSettings.steam, ...raw } as SteamSettings;
    if (typeof migrated.asfPort === 'string') {
      migrated.asfPort = Number.parseInt(migrated.asfPort, 10) || defaultSettings.steam.asfPort;
    }
    setSettings({ steam: migrated });
    return migrated;
  }

  return getSettings().steam;
}

export function saveSteamSettings(settings: Partial<SteamSettings>): void {
  const next: SteamSettings = {
    ...getSteamSettings(),
    ...settings,
    asfPort: Number(settings.asfPort ?? getSteamSettings().asfPort) || defaultSettings.steam.asfPort
  };

  setSettings({ steam: next });
}

function showHistory(): void {
  const history = GM_getValue<ActivationHistory | undefined>('history');

  if (Array.isArray(history)) {
    showModal({
      closeOnClickOutside: false,
      className: 'swal-user',
      title: '上次激活记录：',
      content: htmlToElement(history[0]),
      buttons: { confirm: '确定' }
    });

    if (history[1]) {
      setTimeout(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>('.rh-modal-content textarea');
        if (textarea) textarea.value = history[1] ?? '';
      }, 0);
    }
  } else {
    showModal({ closeOnClickOutside: false, title: '没有操作记录！', icon: 'error', buttons: { cancel: '关闭' } });
  }
}

function showSwitchKey(): void {
  const content = htmlToElement(`
    <div class="switch-key">
      <div class="switch-key-left"><p>key</p><p>key</p><p>key</p><input name="keyType" type="radio" value="1"/></div>
      <div class="switch-key-right"><p>&nbsp;</p><p>key,key,key</p><p>&nbsp;</p><input name="keyType" type="radio" value="2"/></div>
    </div>
  `);

  showModal({
    closeOnClickOutside: false,
    title: '请选择要转换成什么格式：',
    content,
    buttons: { confirm: '确定', cancel: '关闭' }
  }).then((value) => {
    if (value) {
      const selectedValue = document.querySelector<HTMLInputElement>('input[name="keyType"]:checked')?.value;
      if (selectedValue) {
        showSwitchArea(selectedValue);
      } else {
        showModal({ closeOnClickOutside: false, title: '请选择要将key转换成什么格式！', icon: 'warning' }).then(() => showSwitchKey());
      }
    }
  });

  content.querySelectorAll('div').forEach((div) => div.addEventListener('click', () => div.querySelector<HTMLInputElement>('input')?.click()));
}

function showSwitchArea(type: string): void {
  const textarea = document.createElement('textarea');
  textarea.style.width = '80%';
  textarea.style.height = '100px';

  showModal({
    closeOnClickOutside: false,
    title: '请输入要转换的key:',
    content: textarea,
    buttons: { confirm: '转换', back: '返回', cancel: '关闭' }
  }).then((value) => {
    if (value === 'back') {
      showSwitchKey();
    } else if (value) {
      switchKey(textarea.value, type);
    }
  });
}

function switchKey(key: string, type: string): void {
  const keys = extractSteamKeys(key);
  if (type === '1') {
    showKey(keys.join('\n'), type);
  } else if (type === '2') {
    showKey(keys.join(','), type);
  }
}

function showKey(key: string, type: string): void {
  const textarea = document.createElement('textarea');
  textarea.style.width = '80%';
  textarea.style.height = '100px';
  textarea.readOnly = true;
  textarea.value = key;
  textarea.addEventListener('click', () => textarea.select());

  showModal({
    closeOnClickOutside: false,
    icon: 'success',
    title: '转换成功！',
    content: textarea,
    buttons: { confirm: '返回', cancel: '关闭' }
  }).then((value) => {
    if (value) showSwitchArea(type);
  });
}

function htmlToElement(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return (template.content.firstElementChild as HTMLElement | null) ?? document.createElement('div');
}

export function openSteamSettingsDialog(): void {
  const setting = getSteamSettings();
  const div = htmlToElement(`
    <div id="hclonely-asf">
      <input type="checkbox" name="newTab" ${setting.newTab ? 'checked' : ''} title="开启ASF激活后此功能无效"/>
      <span title="开启ASF激活后此功能无效">新标签页激活</span><br/>
      <input type="checkbox" name="copyListen" ${setting.copyListen ? 'checked' : ''} title="复制key时询问是否激活"/>
      <span title="复制key时询问是否激活">开启复制捕捉</span>
      <input type="checkbox" name="selectListen" ${setting.selectListen ? 'checked' : ''} title="选中key时显示激活图标"/>
      <span title="选中key时显示激活图标">开启选中捕捉</span>
      <input type="checkbox" name="clickListen" ${setting.clickListen ? 'checked' : ''} title="点击key时添加激活链接"/>
      <span title="点击key时添加激活链接">开启点击捕捉</span><br/>
      <input type="checkbox" name="allKeyListen" ${setting.allKeyListen ? 'checked' : ''} title="匹配页面内所有符合steam key格式的内容"/>
      <span title="匹配页面内所有符合steam key格式的内容">捕捉页面内所有key</span>
      <div class="rh-modal-title">ASF IPC设置</div>
      <span>ASF IPC协议</span><input type="text" name="asfProtocol" value="${setting.asfProtocol}" placeholder="http或https,默认为http"/><br/>
      <span>ASF IPC地址</span><input type="text" name="asfHost" value="${setting.asfHost}" placeholder="ip地址或域名,默认为127.0.0.1"/><br/>
      <span>ASF IPC端口</span><input type="text" name="asfPort" value="${setting.asfPort}" placeholder="默认1242"/><br/>
      <span>ASF IPC密码</span><input type="text" name="asfPassword" value="${setting.asfPassword}" placeholder="ASF IPC密码"/><br/>
      <span>ASF Bot名字</span><input type="text" name="asfBot" value="${setting.asfBot}" placeholder="ASF Bot name,可留空"/><br/>
      <input type="checkbox" name="asf" ${setting.asf ? 'checked' : ''} title="此功能默认关闭新标签页激活"/>
      <span title="此功能默认关闭新标签页激活">开启ASF激活</span>
    </div>
  `);

  showModal({
    closeOnClickOutside: false,
    className: 'asf-class',
    title: '全局设置',
    content: div,
    buttons: { save: '保存', showHistory: '上次激活记录', showSwitchKey: 'Key格式转换', cancel: '取消' }
  }).then((value) => {
    if (value === 'save') {
      const next: Partial<SteamSettings> = {};
      div.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
        const name = input.name as keyof SteamSettings;
        if (!name) return;
        if (input.type === 'checkbox') {
          (next as Record<string, boolean>)[name] = input.checked;
        } else if (name === 'asfPort') {
          next.asfPort = Number.parseInt(input.value, 10) || defaultSettings.steam.asfPort;
        } else {
          (next as Record<string, string>)[name] = input.value;
        }
      });
      saveSteamSettings(next);
      showModal({ closeOnClickOutside: false, icon: 'success', title: '保存成功！', text: '刷新页面后生效！', buttons: { confirm: '确定' } });
    } else if (value === 'showHistory') {
      showHistory();
    } else if (value === 'showSwitchKey') {
      showSwitchKey();
    }
  });
}
