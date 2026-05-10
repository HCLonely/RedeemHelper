import { request } from '../../shared/http';
import { extractSteamKeys } from '../../shared/regex';
import { showModal } from '../../shared/ui';
import { clearRedeemRenderRoot, getSteamSessionID, redeemKeys, setRedeemRenderRoot, setSteamSessionID } from './redeem';

type StoreTokenParams = {
  steamID: string;
  nonce: string;
  redir: string;
  auth: string;
};

type RefreshTokenResponse = {
  success?: boolean;
  steamID: string;
  nonce: string;
  redir: string;
  auth: string;
};

type CartConfig = {
  rgUserCountryOptions: Record<string, string>;
};

type UserInfo = {
  country_code: string;
};

const STEAM_HOSTS = {
  STORE: 'store.steampowered.com',
  LOGIN: 'login.steampowered.com'
} as const;

function showSwalMessage(options: SwalOptions): Promise<unknown> {
  return showModal({ className: 'swal-user', closeOnClickOutside: false, ...options });
}

function htmlToElement(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return (template.content.firstElementChild as HTMLElement | null) ?? document.createElement('div');
}

export async function refreshToken(): Promise<boolean> {
  const formData = new FormData();
  formData.append('redir', `https://${STEAM_HOSTS.STORE}/`);

  const response = await request<RefreshTokenResponse>({
    url: `https://${STEAM_HOSTS.LOGIN}/jwt/ajaxrefresh`,
    method: 'POST',
    responseType: 'json',
    headers: {
      Host: STEAM_HOSTS.LOGIN,
      Origin: `https://${STEAM_HOSTS.STORE}`,
      Referer: `https://${STEAM_HOSTS.STORE}/`
    },
    data: formData
  });

  if (response.ok && response.data?.success) {
    return setStoreToken(response.data);
  }
  return false;
}

export async function setStoreToken(param: StoreTokenParams): Promise<boolean> {
  const formData = new FormData();
  formData.append('steamID', param.steamID);
  formData.append('nonce', param.nonce);
  formData.append('redir', param.redir);
  formData.append('auth', param.auth);

  const response = await request({
    url: `https://${STEAM_HOSTS.STORE}/login/settoken`,
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Host: STEAM_HOSTS.STORE,
      Origin: `https://${STEAM_HOSTS.STORE}`
    },
    data: formData
  });

  return response.status === 200;
}

export async function updateStoreAuth(retry = false): Promise<boolean> {
  const response = await request<string>({
    url: `https://${STEAM_HOSTS.STORE}/`,
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Cache-Control': 'max-age=0',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Upgrade-Insecure-Requests': '1'
    },
    fetch: false,
    redirect: 'manual'
  });

  const html = response.text ?? '';
  if (response.status === 200) {
    if (!html.includes('data-miniprofile=')) {
      if (await refreshToken()) return retry ? false : updateStoreAuth(true);
      return false;
    }

    const storeSessionID = html.match(/g_sessionID = "(.+?)";/)?.[1];
    if (storeSessionID) {
      setSteamSessionID(storeSessionID);
      return true;
    }
    return false;
  }

  if ([301, 302].includes(response.status)) {
    if (await refreshToken()) return retry ? false : updateStoreAuth(true);
    return false;
  }

  return false;
}

function createRedeemContent(): HTMLElement {
  return htmlToElement(`
    <div id="registerkey_examples_text">
      <div class="notice_box_content" id="unusedKeyArea">
        <b>未使用的Key：</b><br>
        <div><ol id="unusedKeys" align="left"></ol></div>
      </div>
      <div class="table-responsive table-condensed">
        <table class="table table-hover hclonely">
          <caption><h2>激活记录</h2></caption>
          <thead><tr><th>No.</th><th>Key</th><th>结果</th><th>详情</th><th>Sub</th></tr></thead>
          <tbody></tbody>
        </table>
      </div><br>
    </div>
  `);
}

export function webRedeem(keysCsv: string): void {
  const redeemContent = createRedeemContent();
  showSwalMessage({ title: '正在获取sessionID...', buttons: { confirm: '关闭' } });

  if (!getSteamSessionID()) {
    handleNoSession(keysCsv, redeemContent);
    return;
  }

  showRedeemDialog(keysCsv, redeemContent);
}

function handleNoSession(keysCsv: string, redeemContent: HTMLElement): void {
  GM_xmlhttpRequest({
    method: 'GET',
    url: 'https://store.steampowered.com/account/registerkey',
    onload: async (data) => {
      if (data.finalUrl.includes('login') && !(await updateStoreAuth())) {
        showSwalMessage({
          title: '请先登录steam！',
          icon: 'warning',
          buttons: { confirm: '登录', cancel: '关闭' }
        }).then((value) => {
          if (value) window.open('https://store.steampowered.com/login/', '_blank');
        });
      } else if (data.status === 200) {
        setSteamSessionID(data.responseText?.match(/g_sessionID = "(.+?)";/)?.[1] || '');
        showRedeemDialog(keysCsv, redeemContent);
      } else {
        showSwalMessage({ title: '获取sessionID失败！', icon: 'error', buttons: { confirm: '关闭' } });
      }
    }
  });
}

function showRedeemDialog(keysCsv: string, redeemContent: HTMLElement): void {
  setRedeemRenderRoot(redeemContent);
  showSwalMessage({
    title: '正在激活steam key...',
    content: redeemContent,
    buttons: { confirm: '提取未使用key', cancel: '关闭' }
  }).then((value) => {
    const modalContent = document.querySelector('.rh-modal-content');
    const textareaValue = modalContent?.querySelector<HTMLTextAreaElement>('textarea')?.value || '';
    GM_setValue('history', [modalContent?.innerHTML || '', textareaValue]);
    if (value) {
      GM_setClipboard(extractSteamKeys(redeemContent.querySelector('#unusedKeys')?.textContent || '').join(','));
      showSwalMessage({ title: '复制成功！', icon: 'success' });
    }
    clearRedeemRenderRoot(redeemContent);
  });

  redeemKeys(keysCsv);
}

export function redeemSub(raw?: string): void {
  const subText = raw || document.querySelector<HTMLTextAreaElement>('#gameSub')?.value;
  if (!subText) return;

  const ownedPackages: Record<number, boolean> = {};
  document.querySelectorAll<HTMLAnchorElement>('.account_table a').forEach((link) => {
    const match = link.href.match(/javascript:RemoveFreeLicense\( ([0-9]+), '/);
    if (match) ownedPackages[Number(match[1])] = true;
  });

  const freePackages = subText.match(/[\d]{2,}/g) || [];
  let loaded = 0;
  const total = freePackages.length;
  if (total === 0) return;

  const showCompletion = () => {
    if (window.location.href.includes('licenses')) {
      window.open('https://store.steampowered.com/account/licenses/', '_self');
    } else {
      showModal({
        title: '全部激活完成，是否前往账户页面查看结果？',
        buttons: { cancel: '取消', confirm: '确定' }
      }).then((value) => {
        if (value) window.open('https://store.steampowered.com/account/licenses/', '_blank');
      });
    }
  };

  const markLoaded = () => {
    loaded++;
    if (loaded >= total) {
      showCompletion();
    } else {
      showModal('正在激活…', `进度：${loaded}/${total}.`);
    }
  };

  showModal('正在执行…', '请等待所有请求完成。 忽略所有错误，让它完成。');

  freePackages.forEach((packageText) => {
    const packageId = Number.parseInt(packageText, 10);
    if (ownedPackages[packageId]) {
      markLoaded();
      return;
    }

    void request({
      url: 'https://store.steampowered.com/checkout/addfreelicense',
      method: 'POST',
      data: new URLSearchParams({ action: 'add_to_cart', sessionid: getSteamSessionID() || safeGlobalSessionID(), subid: String(packageId) }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
    }).then(markLoaded);
  });
}

export function redeemSubs(): void {
  const key = document.querySelector<HTMLTextAreaElement>('#inputKey')?.value.trim();
  if (key) redeemSub(key);
}

function safeGlobalSessionID(): string {
  try {
    return typeof g_sessionID === 'string' ? g_sessionID : '';
  } catch {
    return '';
  }
}

export function changeStoreCountryFlow(): void {
  void fetchCartData()
    .then((cartData) => {
      const { cartConfig, userInfo } = parseCartData(cartData);
      if (!cartConfig || !userInfo || Object.keys(cartConfig.rgUserCountryOptions).length <= 2) {
        showSwalMessage({ title: '需要挂相应地区的梯子！', icon: 'warning' });
        return;
      }
      showCountryChangeDialog(cartConfig, userInfo, cartData);
    })
    .catch(() => showSwalMessage({ title: '获取当前国家/地区失败！', icon: 'error' }));

  showSwalMessage({ title: '正在获取当前国家/地区...', icon: 'info' });
}

function fetchCartData(): Promise<string> {
  return request<string>({ url: 'https://store.steampowered.com/cart/', method: 'GET' }).then((response) => {
    if (!response.ok && !response.text) throw new Error('Failed to fetch cart');
    return response.text ?? '';
  });
}

function decodeHtml(value: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = value;
  return temp.textContent || temp.innerText || '';
}

function parseCartData(data: string): { cartConfig: CartConfig; userInfo: UserInfo } {
  const cartConfig = JSON.parse(decodeHtml(data.match(/data-cart_config="(.*?)"/)?.[1] || '')) as CartConfig;
  const userInfo = JSON.parse(decodeHtml(data.match(/data-userinfo="(.*?)"/)?.[1] || '')) as UserInfo;
  return { cartConfig, userInfo };
}

function bindCurrencyChangeOption(): void {
  const intervalId = window.setInterval(() => {
    const options = document.querySelectorAll<HTMLElement>('.currency_change_option');
    if (options.length > 0) {
      options.forEach((option) => option.addEventListener('click', () => {
        const newCountry = option.dataset.country;
        if (newCountry) changeCountry(newCountry);
      }));
      window.clearInterval(intervalId);
    }
  }, 500);

  window.setTimeout(() => window.clearInterval(intervalId), 10000);
}

function showCountryChangeDialog(cartConfig: CartConfig, userInfo: UserInfo, cartData: string): void {
  const divContent = cartData.match(/<div class="currency_change_options">([\w\W]*?)<p/i)?.[1]?.trim();
  const div = `${divContent || ''}</div>`;
  showSwalMessage({
    closeOnClickOutside: false,
    title: `当前国家/地区：${cartConfig.rgUserCountryOptions[userInfo.country_code] || userInfo.country_code}`,
    content: htmlToElement(`<div>${div}</div>`)
  });
  bindCurrencyChangeOption();
}

export function changeCountry(country: string): void {
  showSwalMessage({ closeOnClickOutside: false, icon: 'info', title: '正在更换国家/地区...' });
  void request({
    url: 'https://store.steampowered.com/country/setcountry',
    method: 'POST',
    data: new URLSearchParams({ sessionid: getSteamSessionID() || safeGlobalSessionID(), cc: country }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
  }).then(() => {
    void fetchCartData()
      .then((data) => {
        const { cartConfig, userInfo } = parseCartData(data);
        const divContent = data.match(/<div class="currency_change_options">([\w\W]*?)<p/i)?.[1]?.trim();
        const div = `${divContent || ''}</div>`;
        if (userInfo.country_code === country) {
          showSwalMessage({ title: '更换成功！', icon: 'success' }).then(() => {
            showSwalMessage({
              closeOnClickOutside: false,
              title: `当前国家/地区：${cartConfig.rgUserCountryOptions[userInfo.country_code] || userInfo.country_code}`,
              content: htmlToElement(`<div>${div}</div>`)
            });
            bindCurrencyChangeOption();
          });
        } else {
          showSwalMessage({ title: '更换失败！', icon: 'error' });
        }
      })
      .catch(() => showSwalMessage({ title: '获取当前国家/地区失败！', icon: 'error' }));
  });
}

export const cc = changeStoreCountryFlow;
