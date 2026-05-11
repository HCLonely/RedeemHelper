import { extractSteamKeys } from '../../shared/regex';
import { showModal } from '../../shared/ui';
import { asfRedeem } from './asf';
import { getSteamSettings } from './settings';
import { webRedeem } from './steamWeb';

interface PurchaseLineItem {
  packageid: number;
  line_item_description: string;
}

interface PurchaseReceiptInfo {
  line_items: PurchaseLineItem[];
}

interface RedeemResponse {
  success: number;
  purchase_result_details?: number;
  purchase_receipt_info?: PurchaseReceiptInfo;
}

const FAILURE_DETAILS: Record<number, string> = {
  14: '无效激活码',
  15: '重复激活',
  53: '次数上限',
  13: '地区限制',
  9: '已拥有',
  24: '缺少主游戏',
  36: '需要PS3?',
  50: '这是充值码'
};

const UNUSED_KEY_REASONS = ['次数上限', '地区限制', '已拥有', '缺少主游戏', '其他错误', '未知错误', '网络错误或超时'];
const AUTO_DIVIDE_NUM = 9;
const WAITING_SECONDS = 20;

const state = {
  allUnusedKeys: [] as string[],
  keyCount: 0,
  recvCount: 0,
  renderRoot: null as ParentNode | null,
  popupFlow: false,
  sessionID: ''
};

const texts = {
  fail: '失败',
  success: '成功',
  network: '网络错误或超时',
  line: '——',
  nothing: '',
  others: '其他错误',
  redeeming: '激活中',
  waiting: '等待中'
};

function getSessionID(): string {
  if (state.sessionID) return state.sessionID;
  try {
    state.sessionID = typeof g_sessionID === 'string' ? g_sessionID : '';
  } catch {
    state.sessionID = '';
  }
  return state.sessionID;
}

export function setSteamSessionID(sessionID: string): void {
  state.sessionID = sessionID;
}

export function getSteamSessionID(): string {
  return getSessionID();
}

export function setRedeemRenderRoot(root: ParentNode, popupFlow = true): void {
  state.renderRoot = root;
  state.popupFlow = popupFlow;
  state.keyCount = 0;
  state.recvCount = 0;
  state.allUnusedKeys = [];
}

export function clearRedeemRenderRoot(root?: ParentNode): void {
  if ((!root || state.renderRoot === root) && state.recvCount >= state.keyCount) {
    state.renderRoot = null;
    state.popupFlow = false;
  }
}

function queryRedeemRoot<T extends Element>(selector: string): T | null {
  return (state.renderRoot ?? document).querySelector<T>(selector);
}

function queryRedeemRootAll<T extends Element>(selector: string): NodeListOf<T> {
  return (state.renderRoot ?? document).querySelectorAll<T>(selector);
}

function table(): HTMLTableElement | null {
  return queryRedeemRoot<HTMLTableElement>('table');
}

function tbody(): HTMLTableSectionElement | null {
  return queryRedeemRoot<HTMLTableSectionElement>('tbody');
}

function createCell(tag: 'td' | 'th', html: string, className?: string): HTMLTableCellElement {
  const cell = document.createElement(tag);
  if (className) cell.className = className;
  cell.innerHTML = html;
  return cell;
}

function createSubCell(subId: number, subName: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  if (subId === 0) {
    cell.textContent = '——';
    return cell;
  }

  const code = document.createElement('code');
  code.textContent = String(subId);
  const link = document.createElement('a');
  link.href = `https://steamdb.info/sub/${subId}/`;
  link.target = '_blank';
  link.textContent = subName;
  cell.append(code, ' ', link);
  return cell;
}

function setUnusedKeys(key: string, success: boolean, reason: string, subId: number, subName: string): void {
  const unusedKeys = queryRedeemRoot<HTMLOListElement>('#unusedKeys');
  if (!unusedKeys) return;

  if (success && state.allUnusedKeys.includes(key)) {
    state.allUnusedKeys = state.allUnusedKeys.filter((keyItem) => keyItem !== key);
    unusedKeys.querySelectorAll('li').forEach((li) => {
      if (li.textContent?.includes(key)) li.remove();
    });
  } else if (!success && !state.allUnusedKeys.includes(key) && UNUSED_KEY_REASONS.includes(reason)) {
    const li = document.createElement('li');
    li.append(`${key} (${reason}`);
    if (subId !== 0) {
      li.append(': ');
      const code = document.createElement('code');
      code.textContent = String(subId);
      li.append(code, ` ${subName}`);
    }
    li.append(')');
    unusedKeys.append(li);
    state.allUnusedKeys.push(key);
  }
}

export function tableInsertKey(key: string): void {
  state.keyCount++;
  const row = document.createElement('tr');
  row.append(createCell('td', String(state.keyCount), 'nobr'));
  row.append(createCell('td', `<code>${key}</code>`, 'nobr'));
  const waitCell = createCell('td', `${texts.redeeming}...`);
  waitCell.colSpan = 3;
  row.append(waitCell);
  tbody()?.prepend(row);
}

export function tableWaitKey(key: string): void {
  state.keyCount++;
  const row = document.createElement('tr');
  row.append(createCell('td', String(state.keyCount), 'nobr'));
  row.append(createCell('td', `<code>${key}</code>`, 'nobr'));
  const waitCell = createCell('td', `${texts.waiting} (${WAITING_SECONDS}秒)...`);
  waitCell.colSpan = 3;
  row.append(waitCell);
  tbody()?.prepend(row);
}

export function tableUpdateKey(key: string, result: string, detail: string, subId: number, subName: string): void {
  setUnusedKeys(key, result === texts.success, detail, subId, subName);
  state.recvCount++;

  if (!state.popupFlow && state.recvCount === state.keyCount) {
    document.querySelector<HTMLElement>('#buttonRedeem, #redeemKey')?.style.removeProperty('display');
    document.querySelector<HTMLTextAreaElement>('#inputKey')?.removeAttribute('disabled');
  }

  const rows = Array.from(queryRedeemRootAll<HTMLTableRowElement>('table tr')).slice(1);
  for (const row of rows) {
    const cells = row.children;
    if (cells[1]?.innerHTML.includes(key) && cells[2]?.innerHTML.includes(texts.redeeming)) {
      cells[2].remove();
      const resultCell = createCell('td', result, 'nobr');
      resultCell.style.color = result === texts.fail ? 'red' : 'green';
      row.append(resultCell);
      row.append(createCell('td', detail, 'nobr'));
      row.append(createSubCell(subId, subName));
      break;
    }
  }
}

export function redeemKey(key: string): void {
  GM_xmlhttpRequest<RedeemResponse>({
    url: 'https://store.steampowered.com/account/ajaxregisterkey/',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: 'https://store.steampowered.com',
      Referer: 'https://store.steampowered.com/account/registerkey'
    },
    data: `product_key=${encodeURIComponent(key)}&sessionid=${encodeURIComponent(getSessionID())}`,
    method: 'POST',
    responseType: 'json',
    onloadstart: () => {
      const currentTable = table();
      if (currentTable && currentTable.style.display === 'none') currentTable.style.display = '';
    },
    onload: (response) => {
      if (response.status === 200 && response.response) {
        const data = response.response;
        if (data.success === 1 && data.purchase_receipt_info?.line_items[0]) {
          const item = data.purchase_receipt_info.line_items[0];
          tableUpdateKey(key, texts.success, texts.line, item.packageid, item.line_item_description);
          return;
        }

        if (data.purchase_result_details !== undefined && data.purchase_receipt_info) {
          const item = data.purchase_receipt_info.line_items[0];
          const failureReason = FAILURE_DETAILS[data.purchase_result_details] || texts.others;
          tableUpdateKey(key, texts.fail, failureReason, item?.packageid ?? 0, item?.line_item_description ?? texts.nothing);
          return;
        }

        tableUpdateKey(key, texts.fail, texts.nothing, 0, texts.nothing);
      } else {
        tableUpdateKey(key, texts.fail, texts.network, 0, texts.nothing);
      }
    },
    ontimeout: () => tableUpdateKey(key, texts.fail, texts.network, 0, texts.nothing),
    onerror: () => tableUpdateKey(key, texts.fail, texts.network, 0, texts.nothing),
    onabort: () => tableUpdateKey(key, texts.fail, texts.network, 0, texts.nothing)
  });
}

function startTimer(): void {
  const timer = window.setInterval(() => {
    let hasWaiting = false;
    let nowKey = 0;
    const rows = Array.from(queryRedeemRootAll<HTMLTableRowElement>('table tr')).slice(1).reverse();

    for (const row of rows) {
      const cell = row.children[2] as HTMLElement | undefined;
      if (cell?.innerHTML.includes(texts.waiting)) {
        nowKey++;
        if (nowKey <= AUTO_DIVIDE_NUM) {
          const key = row.children[1]?.textContent?.trim() ?? '';
          cell.innerHTML = `${texts.redeeming}...`;
          redeemKey(key);
        } else {
          hasWaiting = true;
          break;
        }
      }
    }

    if (!hasWaiting) window.clearInterval(timer);
  }, 1000 * WAITING_SECONDS);
}

export function redeem(keys: string[]): void {
  if (keys.length <= 0) return;

  if (!state.popupFlow) {
    document.querySelector<HTMLElement>('#buttonRedeem, #redeemKey')?.style.setProperty('display', 'none');
    document.querySelector<HTMLTextAreaElement>('#inputKey')?.setAttribute('disabled', 'disabled');
  }

  let nowKey = 0;
  keys.forEach((key) => {
    nowKey++;
    if (nowKey <= AUTO_DIVIDE_NUM) {
      tableInsertKey(key);
      redeemKey(key);
    } else {
      tableWaitKey(key);
    }
  });

  if (nowKey > AUTO_DIVIDE_NUM) startTimer();
}

export function redeemKeys(key?: string): void {
  const keys = key ? key.split(',').map((item) => item.trim()).filter(Boolean) : extractSteamKeys(document.querySelector<HTMLTextAreaElement>('#inputKey')?.value.trim() || '');
  redeem(keys);
}

export function registerSteamKeys(raw: string): void {
  const setting = getSteamSettings();
  const keys = extractSteamKeys(raw);
  if (keys.length === 0) return;

  if (setting.asf) {
    const asfCommand = `!redeem ${setting.asfBot ? `${setting.asfBot} ` : ''}${keys.join(',')}`;
    asfRedeem(asfCommand);
  } else if (setting.newTab) {
    window.open(`https://store.steampowered.com/account/registerkey?key=${keys.join(',')}`, '_blank');
  } else {
    webRedeem(keys.join(','));
  }
}

export const registerkey = registerSteamKeys;

function copyUnusedKeys(): void {
  GM_setClipboard(extractSteamKeys(queryRedeemRoot('#unusedKeys')?.textContent || '').join(','));
  showModal({ title: '复制成功！', icon: 'success' });
}

export function toggleUnusedKeyArea(): void {
  if (!state.popupFlow) {
    const unusedKeyArea = queryRedeemRoot<HTMLElement>('#unusedKeyArea');
    if (unusedKeyArea) unusedKeyArea.style.display = unusedKeyArea.style.display === 'none' ? '' : 'none';
  }
}

export function initSteamRedeemPage(): void {
  state.renderRoot = null;
  state.popupFlow = false;
  state.keyCount = 0;
  state.recvCount = 0;
  state.allUnusedKeys = [];
  getSessionID();

  const examples = document.querySelector<HTMLElement>('#registerkey_examples_text');
  if (examples) {
    examples.innerHTML = `
      <div class="notice_box_content" id="unusedKeyArea" style="display: none">
        <b>未使用的Key：</b>
        <a tabindex="300" class="btnv6_blue_hoverfade btn_medium" id="copyUnuseKey"><span>提取未使用key</span></a><br>
        <div><ol id="unusedKeys"></ol></div>
      </div>
      <div class="table-responsive table-condensed">
        <table class="table table-hover" style="display: none">
          <caption><h2>激活记录</h2></caption>
          <thead><tr><th>No.</th><th>Key</th><th>结果</th><th>详情</th><th>Sub</th></tr></thead>
          <tbody></tbody>
        </table>
      </div><br>`;
    setRedeemRenderRoot(examples, false);
  }

  const inputBox = document.querySelector<HTMLElement>('.registerkey_input_box_text')?.parentElement;
  inputBox?.style.setProperty('float', 'none');
  inputBox?.insertAdjacentHTML('beforeend', '<textarea class="form-control" rows="3" id="inputKey" placeholder="支持批量激活，可以把整个网页文字复制过来&#10;若一次激活的Key的数量超过9个则会自动分批激活（等待20秒）&#10;激活多个SUB时每个SUB之间用英文逗号隔开" style="margin: 3px 0px 0px; width: 525px; height: 102px;"></textarea><br>');

  const keyFromUrl = new URL(window.location.href).searchParams.get('key');
  if (keyFromUrl) {
    const input = document.querySelector<HTMLTextAreaElement>('#inputKey');
    if (input) input.value = keyFromUrl;
  }

  document.querySelectorAll<HTMLElement>('.registerkey_input_box_text,#purchase_confirm_ssa').forEach((el) => {
    el.style.display = 'none';
  });

  const registerButton = document.querySelector<HTMLElement>('#register_btn');
  registerButton?.parentElement?.style.setProperty('margin', '10px 0');
  registerButton?.parentElement?.insertAdjacentHTML('beforeend', `
    <a tabindex="300" class="btnv6_blue_hoverfade btn_medium" style="margin-left:0" id="redeemKey"><span>激活key</span></a> &nbsp;&nbsp;
    <a tabindex="300" class="btnv6_blue_hoverfade btn_medium" style="margin-left:0" id="redeemSub"><span>激活sub</span></a> &nbsp;&nbsp;
    <a tabindex="300" class="btnv6_blue_hoverfade btn_medium" style="margin-left:0" id="changeCountry"><span>更换国家/地区</span></a> &nbsp;&nbsp;`);
  registerButton?.remove();

  document.querySelector('#copyUnuseKey')?.addEventListener('click', copyUnusedKeys);
  document.querySelector('#redeemKey')?.addEventListener('click', () => redeemKeys());

  if (keyFromUrl) redeem(extractSteamKeys(keyFromUrl));
  toggleUnusedKeyArea();
}

export function bindCopySelectClickListeners(): void {
  const setting = getSteamSettings();

  if (setting.selectListen) {
    bindSelectListener();
  }

  if (!/https?:\/\/store\.steampowered\.com\/account\/registerkey/.test(window.location.href) && setting.copyListen) {
    window.addEventListener('copy', activateCopiedProduct, false);
  }

  if (setting.clickListen) {
    bindClickListener();
  }
}

function activateCopiedProduct(event: ClipboardEvent): void {
  const setting = getSteamSettings();
  const productKey = window.getSelection()?.toString()?.trim() || (event.target as HTMLInputElement | null)?.value || '';
  void navigator.clipboard?.writeText(productKey).catch(() => undefined);

  if (/^([\w\W]*)?([\d\w]{5}(-[\d\w]{5}){2}(\r|,|，)?){1,}/.test(productKey)) {
    if (!document.querySelector('div.rh-modal-overlay')) {
      showModal({ title: '检测到神秘key,是否激活？', icon: 'success', buttons: { confirm: '激活', cancel: '取消' } }).then((value) => {
        if (value) registerSteamKeys(productKey);
      });
    }
  } else if (/^![\w\d]+\s+asf\s+.+/gi.test(productKey) && setting.asf) {
    if (!document.querySelector('div.rh-modal-overlay')) {
      showModal({ closeOnClickOutside: false, className: 'swal-user', title: '检测到您复制了以下ASF指令，是否执行？', text: productKey, buttons: { confirm: '执行', cancel: '取消' } }).then((value) => {
        if (value) asfRedeem(productKey);
      });
    }
  }
}

function bindSelectListener(): void {
  const icon = document.createElement('div');
  icon.className = 'icon-div';
  icon.title = '激活';
  icon.innerHTML = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAABsFBMVEVHcEz9/f3+/v8Tdaf///8LGTP+/v4NPWX+/v8GGDj8/f4OGzX///////////8ZJ1ALJ0oNGzf+/v4mOGXX2+T8/f3z9vkPH0UjMFj5+fr///8NGzMJG0ERHS8SKEgXW40Ubp8WY5Ula5ePnrb3+PlnhKUfQ3Q3R3C2vMvt8PRcZH7///8TgrMTgbITfa4YNmcPHDT///8JGj0HGT2rucxGWYJ0g6H///9aZYbGy9jFyNQhL1TO0dp5lbOTma39/f7///+Sl6br7O6SlqT///////8UY5UUY5UJGTgTc6QThLUTfa8VToETdKYQK1sRK1sUWowUY5X///+mq7tlc5MzWX7Mztl5gZuytcJPV3AjL08iLlEUTYAUPXATK10Tfa4FO3IVToHEz9wAL2fj5+5GUG4JFz1mbIC8wMsFFzYFGDwHGkILGTIJG0cLHUoFGD8RJFMUU4YUN2kOIE4TSHsUYJMUbqAUQnUVTYAQLWEUWowUPG8SKFoTZ5kRHDATfq8Tdqf///8IIFQUaJkeWYrA0N4JMmgHQndAc5wJTYIIVooGXpNllrdchanT3ui2xtaZV9eJAAAAaXRSTlMAj/j97/vmAtD8xzncwJvwJay59uHd/ObqgnBtlpgLPfz8Femx+/7s0vitXqVLf53k3VmE9fDr59vaxLSY/qmGRnxeXjI/lGy5MLbr+8A/cPuiqLzgfLHJhJfN17bjr6z8xfmu9cH4cHitMXlOAAACjUlEQVQ4y2XTh1faQBgA8IMGQqCiGPaQAgUE3OLeFTfurR120SYkAQSrQUABUSyOf7l3kQC+/i7JfXff9/Ly4DsAXuA4AG0qi02jsVlUbS/rRnCpsvXkqnpsKmGrnsZBy2KOyTGyHBrooWlpeAkMLAzDyBiRDIayvloFnKwMJSOoKgJGsghD9YsVOLASBEE3pKtz/8t34MBCEXQddbQ7O/trjKAiVB96BY630I2ow1BobjoUmjXQdAR+KRyL0Ug0VhWlD+c+jBkMxzNzM3BXgwrWog1oYyBgODr47adnpv2xSBT+HkDDRlgxz9H+wM/jgNkc8BvNBzGWtQLgNLAcy8JbGLFJs3HSZDJNmQzjpmaWM7SBviRXk2SbxyXGSQkCI1jAqUB/Mp6sYbfV6mGvWq2W7JOSPQ7urIPuJBsXccNbkNG7t7cf397aQQkrMLUPZLh4JoMushV5P0yS3vatUbSV+QwkytaRQbJQ4DOFwqiySQnBR1PTKAnTPCyY0ikUSoVrgPcOjihE2vYdPnPK8yTfDczytwKtbsQVhHOvTqcd4Hn+VMCvg2lM3itHMK3LMyiXD/UGPbeXkFBwuQacrh8Yhg1hiM8TxHxu/vT8UvQJtud3j/ubVKCXTrix8O15Xaob/hf21MlJOZiX5qXSvHvi+Tacqgmn7Kgfvl6E7+58ped8vpTyTdwlLkThi49CP9gTiZv7R/1juXxTerpPNEINA6/d9Eb6/kH/VNKXbtJ1G+kFsSk3zxyOv46Hh3KlclbjOJsHYleDzWKxmK1UskUkixSzxfnGc9f1DvkjQvHCq6OHL61eX1+/qYLR6tKrw4lKOr+sXFWtdNj/O99wiTs7uzqWlzu6Op14Pf0P2PD9NrHDeWsAAAAASUVORK5CYII=" class="icon-img" alt="激活图标">';
  document.documentElement.append(icon);

  document.addEventListener('selectionchange', () => {
    if (!window.getSelection()?.toString()?.trim()) icon.style.display = 'none';
  });

  document.addEventListener('mouseup', (event) => {
    if (event.target === icon || icon.contains(event.target as Node)) {
      event.preventDefault();
      return;
    }

    const text = window.getSelection()?.toString()?.trim() || '';
    const productKey = text || (event.target as HTMLInputElement | null)?.value || '';
    if (/[\d\w]{5}(-[\d\w]{5}){2}/.test(productKey) && text && icon.style.display === 'none') {
      icon.style.top = `${event.pageY + 12}px`;
      icon.style.left = `${event.pageX + 18}px`;
      icon.style.display = 'block';
    } else if (!text) {
      icon.style.display = 'none';
    }
  });

  icon.addEventListener('mousedown', (event) => event.preventDefault());
  icon.addEventListener('click', (event) => {
    const productKey = window.getSelection()?.toString()?.trim() || (event.target as HTMLInputElement | null)?.value || '';
    registerSteamKeys(productKey);
  });
}

function bindClickListener(): void {
  document.body?.addEventListener('click', (event) => {
    const htmlEl = event.target as HTMLElement | null;
    if (!htmlEl || htmlEl.closest('.rh-modal-overlay') || ['A', 'BUTTON', 'TEXTAREA'].includes(htmlEl.tagName) || ['button', 'text'].includes(htmlEl.getAttribute('type') || '')) return;
    if (htmlEl.children.length > 0 && extractSteamKeys(Array.from(htmlEl.children).map((child) => child.textContent ?? '').join('')).length > 0) return;

    const keys = extractSteamKeys(htmlEl.textContent ?? '');
    if (keys.length === 0) return;

    mouseClick(event);
    let html = htmlEl.innerHTML;
    keys.forEach((key) => {
      html = html.replace(new RegExp(key, 'gi'), `<a class="redee-key" href="javascript:void(0)" target="_self" data-key="${key}">${key}</a>`);
    });
    htmlEl.innerHTML = html;
    htmlEl.querySelectorAll<HTMLElement>('.redee-key').forEach((link) => {
      link.addEventListener('click', () => registerSteamKeys(link.dataset.key || ''));
    });
  });
}

function mouseClick(event: MouseEvent): void {
  const span = document.createElement('span');
  span.textContent = 'Steam Key';
  span.style.cssText = `z-index:2147483647;top:${event.pageY - 20}px;left:${event.pageX}px;position:absolute;font-weight:bold;color:#ff6651;transition:all 1.5s ease;`;
  document.body.append(span);
  requestAnimationFrame(() => {
    span.style.top = `${event.pageY - 180}px`;
    span.style.opacity = '0';
  });
  window.setTimeout(() => span.remove(), 1500);
}
