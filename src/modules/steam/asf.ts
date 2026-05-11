import { request } from '../../shared/http';
import { extractSteamKeys } from '../../shared/regex';
import { showModal } from '../../shared/ui';
import { getSteamSettings } from './settings';
import { ASF_COMMANDS_HTML } from './asfCommands.generated';

type ASFResponse = {
  Success?: boolean;
  Message?: string;
  Result?: string;
};

function getASFHeaders(setting = getSteamSettings()): Record<string, string> {
  const origin = `${setting.asfProtocol}://${setting.asfHost}:${setting.asfPort}`;
  return {
    accept: 'application/json',
    'Content-Type': 'application/json',
    Authentication: setting.asfPassword,
    Host: `${setting.asfHost}:${setting.asfPort}`,
    Origin: origin,
    Referer: `${origin}/page/commands`
  };
}

function getASFUrl(setting = getSteamSettings()): string {
  return `${setting.asfProtocol}://${setting.asfHost}:${setting.asfPort}/Api/Command`;
}

function htmlToElement(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return (template.content.firstElementChild as HTMLElement | null) ?? document.createElement('div');
}

function showASFRequired(): void {
  showModal({
    closeOnClickOutside: false,
    className: 'swal-user',
    icon: 'warning',
    title: '此功能需要在设置中配置ASF IPC并开启ASF功能！',
    buttons: { confirm: '确定' }
  });
}

function normalizeASFCommandFromTable(rawCommand: string, asfBot: string): string {
  const command = rawCommand.trim().replace(/^!/, '');
  if (!command) return '';
  if (asfBot.trim()) {
    return `!${command.replace(/\[Bots\]/g, asfBot.trim())}`;
  }
  return `!${command}`;
}

export function asfSend(command = ''): void {
  const setting = getSteamSettings();
  if (!setting.asf) {
    showASFRequired();
    return;
  }

  const input = document.createElement('input');
  input.placeholder = '输入ASF指令';
  input.value = command ? `!${command.replace(/^!/, '')}` : '';

  const modalPromise = showModal({
    closeOnClickOutside: false,
    className: 'swal-user',
    text: '请在下方输入要执行的ASF指令：',
    content: input,
    buttons: {
      test: '连接测试',
      redeem: '激活key',
      pause: '暂停挂卡',
      resume: '恢复挂卡',
      '2fa': '获取令牌',
      '2faok': '2faok',
      more: '更多ASF指令',
      confirm: '确定',
      cancel: '取消'
    }
  });
  requestAnimationFrame(() => input.focus());

  modalPromise.then((value) => {
    switch (value) {
      case 'redeem':
        swalRedeem();
        break;
      case 'pause':
      case 'resume':
      case '2fa':
      case '2faok':
        asfRedeem(`!${value}`);
        break;
      case 'test':
        asfTest();
        break;
      case 'more':
        showASFCommands();
        break;
      case null:
      case undefined:
        break;
      default: {
        const inputValue = input.value.trim();
        if (!inputValue) {
          showModal({ closeOnClickOutside: false, title: 'ASF指令不能为空！', icon: 'warning', buttons: { confirm: '确定' } }).then(() => asfSend(command));
        } else {
          asfRedeem(inputValue);
        }
      }
    }
  });
}

function showASFCommands(): void {
  const content = htmlToElement(ASF_COMMANDS_HTML);

  content.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('button.rh-asf-use[data-command]');
    if (!button) return;
    const setting = getSteamSettings();
    const normalizedCommand = normalizeASFCommandFromTable(button.dataset.command ?? '', setting.asfBot ?? '');
    if (!normalizedCommand) return;
    asfSend(normalizedCommand);
  });

  showModal({
    closeOnClickOutside: false,
    className: 'swal-user',
    text: 'ASF指令',
    content,
    buttons: { confirm: '返回', cancel: '关闭' }
  }).then((value) => {
    if (value) asfSend();
  });
}

export function swalRedeem(): void {
  const textarea = document.createElement('textarea');
  textarea.id = 'keyText';
  textarea.className = 'asf-output';

  showModal({
    closeOnClickOutside: false,
    className: 'swal-user',
    title: '请输入要激活的key:',
    content: textarea,
    buttons: { confirm: '激活', cancel: '返回' }
  }).then((value) => {
    if (value) {
      const keys = extractSteamKeys(textarea.value.trim());
      if (keys.length > 0) {
        const setting = getSteamSettings();
        const asfBot = setting.asfBot ? `${setting.asfBot} ` : '';
        asfRedeem(`!redeem ${asfBot}${keys.join(',')}`);
      } else {
        showModal({ closeOnClickOutside: false, title: 'steam key不能为空！', icon: 'error', buttons: { confirm: '返回', cancel: '关闭' } }).then((v) => {
          if (v) swalRedeem();
        });
      }
    } else {
      asfSend();
    }
  });
}

export function asfTest(): void {
  const setting = getSteamSettings();
  if (!setting.asf) {
    showModal({ closeOnClickOutside: false, title: '请先在设置中开启ASF功能', icon: 'warning', buttons: { confirm: '确定' } });
    return;
  }

  const apiUrl = getASFUrl(setting);
  showModal({ closeOnClickOutside: false, title: 'ASF连接测试', text: `正在尝试连接 "${apiUrl}"`, buttons: { confirm: '确定' } });

  void request<ASFResponse>({
    method: 'POST',
    url: apiUrl,
    data: '{"Command":"!stats"}',
    responseType: 'json',
    headers: getASFHeaders(setting)
  }).then(({ status, data, text }) => {
    if (status === 200) {
      if (data?.Success === true && data.Message === 'OK' && data.Result) {
        showModal({ closeOnClickOutside: false, title: 'ASF连接成功！', icon: 'success', text: `连接地址 "${apiUrl}" \n返回内容 "${data.Result.trim()}"`, buttons: { confirm: '确定' } });
      } else if (data?.Message) {
        showModal({ closeOnClickOutside: false, title: 'ASF连接成功？', icon: 'info', text: `连接地址 "${apiUrl}" \n返回内容 "${data.Message.trim()}"`, buttons: { confirm: '确定' } });
      } else {
        showModal({ closeOnClickOutside: false, title: 'ASF连接失败！', icon: 'error', text: `连接地址 "${apiUrl}" \n返回内容 "${text ?? ''}"`, buttons: { confirm: '确定' } });
      }
    } else {
      showModal({ closeOnClickOutside: false, title: `ASF连接失败：${status}`, icon: 'error', text: `连接地址 "${apiUrl}"`, buttons: { confirm: '确定' } });
    }
  });
}

export function asfRedeem(command: string): void {
  const setting = getSteamSettings();
  const apiUrl = getASFUrl(setting);
  const textarea = document.createElement('textarea');
  textarea.className = 'asf-output';
  textarea.readOnly = true;
  const isRedeemCommand = /!redeem/gim.test(command);

  showModal({
    closeOnClickOutside: false,
    className: 'swal-user',
    text: `正在执行ASF指令：${command}`,
    content: textarea,
    buttons: isRedeemCommand ? { confirm: '提取未使用key', cancel: '关闭' } : { confirm: '确定' }
  }).then((value) => {
    if (!isRedeemCommand) return;
    GM_setValue('history', [document.querySelector('.rh-modal-content')?.innerHTML ?? '', textarea.value]);
    if (value) {
      const unusedKeys = textarea.value
        .split(/[(\r\n)\r\n]+/)
        .filter((line) => /未使用/gim.test(line))
        .join(',');
      if (unusedKeys) {
        GM_setClipboard(extractSteamKeys(unusedKeys).join(','));
        showModal({ title: '复制成功！', icon: 'success' });
      }
    }
  });

  void request<ASFResponse>({
    method: 'POST',
    url: apiUrl,
    data: JSON.stringify({ Command: command }),
    responseType: 'json',
    headers: getASFHeaders(setting)
  }).then(({ status, data, text, error }) => {
    if (status === 200) {
      if (data?.Success && data.Message === 'OK' && data.Result) {
        textarea.value += `${data.Result.trim()} \n`;
      } else if (data?.Message) {
        textarea.value += `${data.Message.trim()} \n`;
      } else {
        textarea.value += text ?? '';
      }
      return;
    }

    showModal({
      closeOnClickOutside: false,
      className: 'swal-user',
      title: `执行ASF指令(${command})失败！请检查ASF配置是否正确！`,
      text: text || String(error ?? status),
      icon: 'error',
      buttons: { confirm: '关闭' }
    });
  });
}

export function openASFDialog(): void {
  asfSend();
}
