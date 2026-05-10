import { showModal } from '../../shared/ui';
import { openASFDialog } from './asf';
import { bindCopySelectClickListeners, initSteamRedeemPage, registerSteamKeys } from './redeem';
import { openSteamSettingsDialog } from './settings';
import { changeStoreCountryFlow, redeemSub, redeemSubs } from './steamWeb';
import { extractSteamKeys } from '../../shared/regex';
import { getSteamSettings } from './settings';

const STEAM_CSS = `
table.hclonely { font-family: verdana,arial,sans-serif; font-size: 11px; color: #333333; border-width: 1px; border-color: #999999; border-collapse: collapse; }
table.hclonely th { background-color: #c3dde0; border-width: 1px; padding: 8px; border-style: solid; border-color: #a9c6c9; }
table.hclonely tr { background-color: #d4e3e5; }
table.hclonely td { border-width: 1px; padding: 8px; border-style: solid; border-color: #a9c6c9; }
table.hclonely caption { padding-top: 8px; color: #808294; text-align: center; caption-side: top; background-color: #94d7df; }
table.hclonely h2 { margin: 0; font-size: 25px; }
.swal-user { width: 80%; }
table.hclonely a { color: #2196F3; }
table.hclonely .swal-button { padding: 5px; }
#unusedKeyArea code { padding: 2px 4px; font-size: 90%; color: #c7254e; background-color: #f9f2f4; border-radius: 3px; }
.notice_box_content { border: 1px solid #a25024; border-radius: 3px; color: #acb2b8; font-size: 14px; font-family: "Motiva Sans", Sans-serif; font-weight: normal; padding: 15px 15px; margin-bottom: 15px; }
.notice_box_content b { font-weight: normal; color: #f47b20; float: left; }
#unusedKeys { margin:0 15px; }
#copyUnuseKey span { font-size: 15px; line-height: 20px; }
#unusedKeyArea li { white-space: nowrap; color: #007fff; }
.currency_change_option_ctn { vertical-align: top; margin: 0 6%; }
.currency_change_option_ctn:first-child { margin-bottom: 12px; }
.currency_change_option_ctn > p { font-size: 12px; margin: 8px 8px 0 8px; }
.currency_change_option { font-family: "Motiva Sans", Sans-serif; font-weight: 300; display: block; }
.currency_change_option > span { display: block; padding: 9px 19px; }
.currency_change_option .country { font-size: 20px; }
.currency_change_option .notes { font-size: 13px; line-height: 18px; }
.asf-class input[type="text"] { border: 1px solid #c2e9ee; width:180px; }
.asf-output { width:90%; min-height:150px; }
.switch-key { margin:0 15%; height:100px; }
.switch-key-left { float:left; }
.switch-key-right { float:right; }
.switch-key div { width: 50%; position: relative; cursor:default; }
.switch-key input { margin:10px 0; }
.switch-key p { font-size:25px; height:25px; color:black; margin:0; }
.swal-content * { color:#000; }
.swal-content textarea { background: #fff; }
#allKey { display: inline-block; padding: 6px 12px; margin-bottom: 0; font-size: 14px; font-weight: 400; line-height: 1.42857143; text-align: center; white-space: nowrap; vertical-align: middle; cursor: pointer; user-select: none; background-image: none; border: 1px solid #ccc; border-radius: 4px; color: #333; background-color: #fff; }
#allKey:hover, #allKey:focus { color: #333; background-color: #e6e6e6; border-color: #adadad; text-decoration: none; }
.icon-img { position: absolute; width: 32px; height: 32px; margin: 0!important; }
.icon-div { width: 32px!important; height: 32px!important; display: none; background: #fff!important; border-radius: 16px!important; box-shadow: 4px 4px 8px #888!important; position: absolute!important; z-index: 2147483647!important; cursor: pointer; }
`;

let initialized = false;

export function initSteam(): void {
  if (initialized) return;
  initialized = true;

  try {
    GM_addStyle(STEAM_CSS);
    const url = window.location.href;

    if (/^https?:\/\/store\.steampowered\.com\/account\/registerkey/.test(url)) {
      initSteamRedeemPage();
      document.querySelector('#redeemSub')?.addEventListener('click', redeemSubs);
      document.querySelector('#changeCountry')?.addEventListener('click', changeStoreCountryFlow);
      return;
    }

    if (/https?:\/\/steamdb\.info\/freepackages\//.test(url)) {
      bindSteamDBFreePackages();
      return;
    }

    if (/https?:\/\/store\.steampowered\.com\/account\/licenses\/(\?sub=[\w\W]{0,})?/.test(url)) {
      initSteamLicensesPage();
      return;
    }

    bindCopySelectClickListeners();
    bindStoreCountryShortcut();

    if (getSteamSettings().allKeyListen) {
      redeemAllPageKeys();
    }
  } catch (error) {
    showModal('AuTo Redeem Steamkey脚本执行出错，详情请查看控制台！', (error as Error).stack, 'error');
    console.error(error);
  }
}

export function openSteamSettings(): void {
  openSteamSettingsDialog();
}

export function runSteamASF(): void {
  openASFDialog();
}

function bindSteamDBFreePackages(): void {
  const interval = window.setInterval(() => {
    const freePackages = document.querySelector('#freepackages');
    if (!freePackages) return;
    freePackages.addEventListener('click', () => {
      const subs = Array.from(document.querySelectorAll<HTMLElement>('#freepackages span'))
        .filter((span) => span.offsetParent !== null)
        .map((span) => span.dataset.subid || span.getAttribute('data-subid') || '')
        .filter(Boolean);
      window.open(`https://store.steampowered.com/account/licenses/?sub=${subs.join(',')}`, '_self');
    });
    window.clearInterval(interval);
  }, 1000);
}

function initSteamLicensesPage(): void {
  document.querySelector('h2.pageheader')?.parentElement?.insertAdjacentHTML('beforeend', `
    <div style="float: left;">
      <textarea class="registerkey_input_box_text" rows="1" name="product_key" id="gameSub" placeholder="输入SUB,多个SUB之间用英文逗号连接" style="margin: 3px 0px 0px; width: 400px; height: 15px;background-color:#102634; padding: 6px 18px 6px 18px; font-weight:bold; color:#fff;"></textarea> &nbsp;
    </div>
    <a tabindex="300" class="btnv6_blue_hoverfade btn_medium" style="width: 95px; height: 30px;" id="buttonSUB"><span>激活SUB</span></a>
    <a tabindex="300" class="btnv6_blue_hoverfade btn_medium" style="width: 125px; height: 30px;margin-left:5px" id="changeCountry-account"><span>更改国家/地区</span></a>`);

  document.querySelector('#buttonSUB')?.addEventListener('click', () => redeemSub());
  document.querySelector('#changeCountry-account')?.addEventListener('click', changeStoreCountryFlow);

  if (/https?:\/\/store\.steampowered\.com\/account\/licenses\/\?sub=([\d]+,)+/.test(window.location.href)) {
    window.setTimeout(() => redeemSub(window.location.href), 2000);
  }
}

function bindStoreCountryShortcut(): void {
  if (!/https?:\/\/store\.steampowered\.com\//.test(window.location.href)) return;
  const accountPulldown = document.querySelector('#account_pulldown');
  if (!accountPulldown || document.querySelector('#changeCountry')) return;

  accountPulldown.insertAdjacentHTML('beforebegin', '<span id="changeCountry" style="cursor:pointer;display:inline-block;padding-left:4px;line-height:25px" class="global_action_link persona_name_text_content">更改国家/地区 |</span>');
  document.querySelector('#changeCountry')?.addEventListener('click', changeStoreCountryFlow);
}

function redeemAllPageKeys(): void {
  const div = document.createElement('div');
  div.id = 'keyDiv';
  div.style.cssText = 'position:fixed;left:5px;bottom:5px';
  const button = document.createElement('button');
  button.id = 'allKey';
  button.className = 'btn btn-default';
  button.style.display = 'none';
  button.style.zIndex = '9999';
  button.textContent = '激活本页面所有key(共0个)';
  div.append(button);
  document.body.append(div);

  let previousKeyList = '';
  window.setInterval(() => {
    const keys = extractSteamKeys(document.body.textContent || '');
    if (keys.length > 0) {
      const keyList = keys.join(',');
      if (previousKeyList !== keyList) {
        previousKeyList = keyList;
        button.dataset.key = keyList;
        button.textContent = `激活本页面所有key(共${keys.length}个)`;
        button.style.display = 'block';
      }
    } else if (button.style.display === 'block') {
      previousKeyList = '';
      button.style.display = 'none';
      button.textContent = '激活本页面所有key(共0个)';
    }
  }, 1000);

  button.addEventListener('click', () => registerSteamKeys(button.dataset.key || ''));
}
