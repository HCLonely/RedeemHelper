// ==UserScript==
// @name         RedeemHelper
// @namespace    HCLonely
// @author       HCLonely
// @description  Unified helper for extracting and redeeming game keys.
// @version      0.1.0
// @supportURL   https://github.com/HCLonely/user.js/issues
// @homepageURL  https://github.com/HCLonely/user.js
// @icon         https://blog.hclonely.com/img/avatar.jpg
// @match        *://*/*
// @exclude      *://store.steampowered.com/widget/*
// @exclude      *://*googleads*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_cookie
// @grant        unsafeWindow
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert@2.1.2/dist/sweetalert.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@9
// @connect      *
// @compatible   chrome
// ==/UserScript==
"use strict";
(() => {
  // src/modules/ig/index.ts
  function initIG() {
  }
  function runIGBatch() {
  }

  // src/modules/itch/index.ts
  function initItch() {
  }
  function runItchExtract() {
  }

  // src/shared/ui.ts
  function showModal(optionsOrTitle, text, icon) {
    if (typeof swal === "function") {
      return typeof optionsOrTitle === "string" ? swal(optionsOrTitle, text, icon) : swal(optionsOrTitle);
    }
    if (typeof Swal !== "undefined" && Swal?.fire) {
      return typeof optionsOrTitle === "string" ? Swal.fire(optionsOrTitle, text, icon) : Swal.fire(optionsOrTitle);
    }
    return Promise.resolve(void 0);
  }

  // src/shared/http.ts
  function request(options) {
    return new Promise((resolve) => {
      const finish = (response, error) => {
        const status = response?.status ?? 0;
        const statusText = response?.statusText ?? (error ? "Error" : "");
        resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText,
          data: response?.response,
          text: response?.responseText,
          response,
          error
        });
      };
      try {
        GM_xmlhttpRequest({
          timeout: 3e4,
          ...options,
          onload: (response) => finish(response),
          onerror: (response) => finish(response, response),
          ontimeout: (response) => finish(response, new Error("Request timed out")),
          onabort: (response) => finish(response, new Error("Request aborted"))
        });
      } catch (error) {
        finish(null, error);
      }
    });
  }

  // src/shared/regex.ts
  var STEAM_KEY_RE = /\b(?:[A-Z0-9]{5}-){2,4}[A-Z0-9]{5}\b/gi;
  function extractSteamKeys(input) {
    const matches = input.match(STEAM_KEY_RE) ?? [];
    return [...new Set(matches.map((key) => key.toUpperCase()))];
  }

  // src/shared/storage.ts
  var SETTINGS_KEY = "setting";
  var defaultSettings = {
    steam: {
      newTab: false,
      copyListen: true,
      selectListen: true,
      clickListen: true,
      allKeyListen: false,
      asf: false,
      asfProtocol: "http",
      asfHost: "127.0.0.1",
      asfPort: 1242,
      asfPassword: "",
      asfBot: ""
    },
    ig: {
      enableButtons: true
    },
    itch: {
      autoClose: true
    }
  };
  function mergeSettings(settings = {}, base = defaultSettings) {
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
      }
    };
  }
  function getSettings() {
    return mergeSettings(GM_getValue(SETTINGS_KEY, {}));
  }
  function setSettings(settings) {
    GM_setValue(SETTINGS_KEY, mergeSettings(settings, getSettings()));
  }

  // src/modules/steam/settings.ts
  function getSteamSettings() {
    const raw = GM_getValue("setting", {});
    if (raw && "steam" in raw) {
      return getSettings().steam;
    }
    if (raw && Object.keys(raw).some((key) => key in defaultSettings.steam)) {
      const migrated = { ...defaultSettings.steam, ...raw };
      if (typeof migrated.asfPort === "string") {
        migrated.asfPort = Number.parseInt(migrated.asfPort, 10) || defaultSettings.steam.asfPort;
      }
      setSettings({ steam: migrated });
      return migrated;
    }
    return getSettings().steam;
  }
  function saveSteamSettings(settings) {
    const next = {
      ...getSteamSettings(),
      ...settings,
      asfPort: Number(settings.asfPort ?? getSteamSettings().asfPort) || defaultSettings.steam.asfPort
    };
    setSettings({ steam: next });
  }
  function showHistory() {
    const history = GM_getValue("history");
    if (Array.isArray(history)) {
      showModal({
        closeOnClickOutside: false,
        className: "swal-user",
        title: "上次激活记录：",
        content: htmlToElement(history[0]),
        buttons: { confirm: "确定" }
      });
      if (history[1]) {
        setTimeout(() => {
          const textarea = document.querySelector(".swal-content textarea");
          if (textarea) textarea.value = history[1] ?? "";
        }, 0);
      }
    } else {
      showModal({ closeOnClickOutside: false, title: "没有操作记录！", icon: "error", buttons: { cancel: "关闭" } });
    }
  }
  function showSwitchKey() {
    const content = htmlToElement(`
    <div class="switch-key">
      <div class="switch-key-left"><p>key</p><p>key</p><p>key</p><input name="keyType" type="radio" value="1"/></div>
      <div class="switch-key-right"><p>&nbsp;</p><p>key,key,key</p><p>&nbsp;</p><input name="keyType" type="radio" value="2"/></div>
    </div>
  `);
    showModal({
      closeOnClickOutside: false,
      title: "请选择要转换成什么格式：",
      content,
      buttons: { confirm: "确定", cancel: "关闭" }
    }).then((value) => {
      if (value) {
        const selectedValue = document.querySelector('input[name="keyType"]:checked')?.value;
        if (selectedValue) {
          showSwitchArea(selectedValue);
        } else {
          showModal({ closeOnClickOutside: false, title: "请选择要将key转换成什么格式！", icon: "warning" }).then(() => showSwitchKey());
        }
      }
    });
    content.querySelectorAll("div").forEach((div) => div.addEventListener("click", () => div.querySelector("input")?.click()));
  }
  function showSwitchArea(type) {
    const textarea = document.createElement("textarea");
    textarea.style.width = "80%";
    textarea.style.height = "100px";
    showModal({
      closeOnClickOutside: false,
      title: "请输入要转换的key:",
      content: textarea,
      buttons: { confirm: "转换", back: "返回", cancel: "关闭" }
    }).then((value) => {
      if (value === "back") {
        showSwitchKey();
      } else if (value) {
        switchKey(textarea.value, type);
      }
    });
  }
  function switchKey(key, type) {
    const keys = extractSteamKeys(key);
    if (type === "1") {
      showKey(keys.join("\n"), type);
    } else if (type === "2") {
      showKey(keys.join(","), type);
    }
  }
  function showKey(key, type) {
    const textarea = document.createElement("textarea");
    textarea.style.width = "80%";
    textarea.style.height = "100px";
    textarea.readOnly = true;
    textarea.value = key;
    textarea.addEventListener("click", () => textarea.select());
    showModal({
      closeOnClickOutside: false,
      icon: "success",
      title: "转换成功！",
      content: textarea,
      buttons: { confirm: "返回", cancel: "关闭" }
    }).then((value) => {
      if (value) showSwitchArea(type);
    });
  }
  function htmlToElement(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild ?? document.createElement("div");
  }
  function openSteamSettingsDialog() {
    const setting = getSteamSettings();
    const div = htmlToElement(`
    <div id="hclonely-asf">
      <input type="checkbox" name="newTab" ${setting.newTab ? "checked" : ""} title="开启ASF激活后此功能无效"/>
      <span title="开启ASF激活后此功能无效">新标签页激活</span><br/>
      <input type="checkbox" name="copyListen" ${setting.copyListen ? "checked" : ""} title="复制key时询问是否激活"/>
      <span title="复制key时询问是否激活">开启复制捕捉</span>
      <input type="checkbox" name="selectListen" ${setting.selectListen ? "checked" : ""} title="选中key时显示激活图标"/>
      <span title="选中key时显示激活图标">开启选中捕捉</span>
      <input type="checkbox" name="clickListen" ${setting.clickListen ? "checked" : ""} title="点击key时添加激活链接"/>
      <span title="点击key时添加激活链接">开启点击捕捉</span><br/>
      <input type="checkbox" name="allKeyListen" ${setting.allKeyListen ? "checked" : ""} title="匹配页面内所有符合steam key格式的内容"/>
      <span title="匹配页面内所有符合steam key格式的内容">捕捉页面内所有key</span>
      <div class="swal-title">ASF IPC设置</div>
      <span>ASF IPC协议</span><input type="text" name="asfProtocol" value="${setting.asfProtocol}" placeholder="http或https,默认为http"/><br/>
      <span>ASF IPC地址</span><input type="text" name="asfHost" value="${setting.asfHost}" placeholder="ip地址或域名,默认为127.0.0.1"/><br/>
      <span>ASF IPC端口</span><input type="text" name="asfPort" value="${setting.asfPort}" placeholder="默认1242"/><br/>
      <span>ASF IPC密码</span><input type="text" name="asfPassword" value="${setting.asfPassword}" placeholder="ASF IPC密码"/><br/>
      <span>ASF Bot名字</span><input type="text" name="asfBot" value="${setting.asfBot}" placeholder="ASF Bot name,可留空"/><br/>
      <input type="checkbox" name="asf" ${setting.asf ? "checked" : ""} title="此功能默认关闭新标签页激活"/>
      <span title="此功能默认关闭新标签页激活">开启ASF激活</span>
    </div>
  `);
    showModal({
      closeOnClickOutside: false,
      className: "asf-class",
      title: "全局设置",
      content: div,
      buttons: { save: "保存", showHistory: "上次激活记录", showSwitchKey: "Key格式转换", cancel: "取消" }
    }).then((value) => {
      if (value === "save") {
        const next = {};
        div.querySelectorAll("input").forEach((input) => {
          const name = input.name;
          if (!name) return;
          if (input.type === "checkbox") {
            next[name] = input.checked;
          } else if (name === "asfPort") {
            next.asfPort = Number.parseInt(input.value, 10) || defaultSettings.steam.asfPort;
          } else {
            next[name] = input.value;
          }
        });
        saveSteamSettings(next);
        showModal({ closeOnClickOutside: false, icon: "success", title: "保存成功！", text: "刷新页面后生效！", buttons: { confirm: "确定" } });
      } else if (value === "showHistory") {
        showHistory();
      } else if (value === "showSwitchKey") {
        showSwitchKey();
      }
    });
  }

  // src/modules/steam/asf.ts
  var ASF_COMMANDS_HTML = `
<table class="hclonely">
  <thead><tr><th>命令</th><th>权限</th><th>描述</th></tr></thead>
  <tbody>
    <tr><td><code>redeem [Bots] &lt;Keys&gt;</code></td><td><code>Operator</code></td><td>为指定机器人激活给定的游戏序列号或钱包充值码。</td></tr>
    <tr><td><code>pause [Bots]</code></td><td><code>Operator</code></td><td>暂停指定机器人的自动挂卡模块。</td></tr>
    <tr><td><code>resume [Bots]</code></td><td><code>FamilySharing</code></td><td>恢复指定机器人的自动挂卡进程。</td></tr>
    <tr><td><code>2fa [Bots]</code></td><td><code>Master</code></td><td>为指定机器人生成临时两步验证令牌。</td></tr>
    <tr><td><code>2faok [Bots]</code></td><td><code>Master</code></td><td>为指定机器人接受所有等待操作的交易确认。</td></tr>
    <tr><td><code>stats</code></td><td><code>Owner</code></td><td>显示 ASF 进程统计信息。</td></tr>
    <tr><td><code>status [Bots]</code></td><td><code>FamilySharing</code></td><td>显示指定机器人的状态。</td></tr>
    <tr><td><code>version</code></td><td><code>FamilySharing</code></td><td>显示 ASF 的版本号。</td></tr>
  </tbody>
</table>`;
  function getASFHeaders(setting = getSteamSettings()) {
    const origin = `${setting.asfProtocol}://${setting.asfHost}:${setting.asfPort}`;
    return {
      accept: "application/json",
      "Content-Type": "application/json",
      Authentication: setting.asfPassword,
      Host: `${setting.asfHost}:${setting.asfPort}`,
      Origin: origin,
      Referer: `${origin}/page/commands`
    };
  }
  function getASFUrl(setting = getSteamSettings()) {
    return `${setting.asfProtocol}://${setting.asfHost}:${setting.asfPort}/Api/Command`;
  }
  function htmlToElement2(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild ?? document.createElement("div");
  }
  function showASFRequired() {
    showModal({
      closeOnClickOutside: false,
      className: "swal-user",
      icon: "warning",
      title: "此功能需要在设置中配置ASF IPC并开启ASF功能！",
      buttons: { confirm: "确定" }
    });
  }
  function asfSend(command = "") {
    const setting = getSteamSettings();
    if (!setting.asf) {
      showASFRequired();
      return;
    }
    const input = document.createElement("input");
    input.placeholder = "输入ASF指令";
    input.value = command ? `!${command.replace(/^!/, "")}` : "";
    showModal({
      closeOnClickOutside: false,
      className: "swal-user",
      text: "请在下方输入要执行的ASF指令：",
      content: input,
      buttons: {
        test: "连接测试",
        redeem: "激活key",
        pause: "暂停挂卡",
        resume: "恢复挂卡",
        "2fa": "获取令牌",
        "2faok": "2faok",
        more: "更多ASF指令",
        confirm: "确定",
        cancel: "取消"
      }
    }).then((value) => {
      switch (value) {
        case "redeem":
          swalRedeem();
          break;
        case "pause":
        case "resume":
        case "2fa":
        case "2faok":
          asfRedeem(`!${value}`);
          break;
        case "test":
          asfTest();
          break;
        case "more":
          showASFCommands();
          break;
        case null:
        case void 0:
          break;
        default: {
          const inputValue = input.value.trim();
          if (!inputValue) {
            showModal({ closeOnClickOutside: false, title: "ASF指令不能为空！", icon: "warning", buttons: { confirm: "确定" } }).then(() => asfSend(command));
          } else {
            asfRedeem(inputValue);
          }
        }
      }
    });
  }
  function showASFCommands() {
    const content = htmlToElement2(ASF_COMMANDS_HTML);
    showModal({
      closeOnClickOutside: false,
      className: "swal-user",
      text: "ASF指令",
      content,
      buttons: { confirm: "返回", cancel: "关闭" }
    }).then((value) => {
      if (value) asfSend();
    });
  }
  function swalRedeem() {
    const textarea = document.createElement("textarea");
    textarea.id = "keyText";
    textarea.className = "asf-output";
    showModal({
      closeOnClickOutside: false,
      className: "swal-user",
      title: "请输入要激活的key:",
      content: textarea,
      buttons: { confirm: "激活", cancel: "返回" }
    }).then((value) => {
      if (value) {
        const keys = extractSteamKeys(textarea.value.trim());
        if (keys.length > 0) {
          const setting = getSteamSettings();
          const asfBot = setting.asfBot ? `${setting.asfBot} ` : "";
          asfRedeem(`!redeem ${asfBot}${keys.join(",")}`);
        } else {
          showModal({ closeOnClickOutside: false, title: "steam key不能为空！", icon: "error", buttons: { confirm: "返回", cancel: "关闭" } }).then((v) => {
            if (v) swalRedeem();
          });
        }
      } else {
        asfSend();
      }
    });
  }
  function asfTest() {
    const setting = getSteamSettings();
    if (!setting.asf) {
      showModal({ closeOnClickOutside: false, title: "请先在设置中开启ASF功能", icon: "warning", buttons: { confirm: "确定" } });
      return;
    }
    const apiUrl = getASFUrl(setting);
    showModal({ closeOnClickOutside: false, title: "ASF连接测试", text: `正在尝试连接 "${apiUrl}"`, buttons: { confirm: "确定" } });
    void request({
      method: "POST",
      url: apiUrl,
      data: '{"Command":"!stats"}',
      responseType: "json",
      headers: getASFHeaders(setting)
    }).then(({ status, data, text }) => {
      if (status === 200) {
        if (data?.Success === true && data.Message === "OK" && data.Result) {
          showModal({ closeOnClickOutside: false, title: "ASF连接成功！", icon: "success", text: `连接地址 "${apiUrl}" 
返回内容 "${data.Result.trim()}"`, buttons: { confirm: "确定" } });
        } else if (data?.Message) {
          showModal({ closeOnClickOutside: false, title: "ASF连接成功？", icon: "info", text: `连接地址 "${apiUrl}" 
返回内容 "${data.Message.trim()}"`, buttons: { confirm: "确定" } });
        } else {
          showModal({ closeOnClickOutside: false, title: "ASF连接失败！", icon: "error", text: `连接地址 "${apiUrl}" 
返回内容 "${text ?? ""}"`, buttons: { confirm: "确定" } });
        }
      } else {
        showModal({ closeOnClickOutside: false, title: `ASF连接失败：${status}`, icon: "error", text: `连接地址 "${apiUrl}"`, buttons: { confirm: "确定" } });
      }
    });
  }
  function asfRedeem(command) {
    const setting = getSteamSettings();
    const apiUrl = getASFUrl(setting);
    const textarea = document.createElement("textarea");
    textarea.className = "asf-output";
    textarea.readOnly = true;
    const isRedeemCommand = /!redeem/gim.test(command);
    showModal({
      closeOnClickOutside: false,
      className: "swal-user",
      text: `正在执行ASF指令：${command}`,
      content: textarea,
      buttons: isRedeemCommand ? { confirm: "提取未使用key", cancel: "关闭" } : { confirm: "确定" }
    }).then((value) => {
      if (!isRedeemCommand) return;
      GM_setValue("history", [document.querySelector(".swal-content")?.innerHTML ?? "", textarea.value]);
      if (value) {
        const unusedKeys = textarea.value.split(/[(\r\n)\r\n]+/).filter((line) => /未使用/gim.test(line)).join(",");
        if (unusedKeys) {
          GM_setClipboard(extractSteamKeys(unusedKeys).join(","));
          showModal({ title: "复制成功！", icon: "success" });
        }
      }
    });
    void request({
      method: "POST",
      url: apiUrl,
      data: JSON.stringify({ Command: command }),
      responseType: "json",
      headers: getASFHeaders(setting)
    }).then(({ status, data, text, error }) => {
      if (status === 200) {
        if (data?.Success && data.Message === "OK" && data.Result) {
          textarea.value += `${data.Result.trim()} 
`;
        } else if (data?.Message) {
          textarea.value += `${data.Message.trim()} 
`;
        } else {
          textarea.value += text ?? "";
        }
        return;
      }
      showModal({
        closeOnClickOutside: false,
        className: "swal-user",
        title: `执行ASF指令(${command})失败！请检查ASF配置是否正确！`,
        text: text || String(error ?? status),
        icon: "error",
        buttons: { confirm: "关闭" }
      });
    });
  }
  function openASFDialog() {
    asfSend();
  }

  // src/modules/steam/steamWeb.ts
  var STEAM_HOSTS = {
    STORE: "store.steampowered.com",
    LOGIN: "login.steampowered.com"
  };
  function showSwalMessage(options) {
    return showModal({ className: "swal-user", closeOnClickOutside: false, ...options });
  }
  function htmlToElement3(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild ?? document.createElement("div");
  }
  async function refreshToken() {
    const formData = new FormData();
    formData.append("redir", `https://${STEAM_HOSTS.STORE}/`);
    const response = await request({
      url: `https://${STEAM_HOSTS.LOGIN}/jwt/ajaxrefresh`,
      method: "POST",
      responseType: "json",
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
  async function setStoreToken(param) {
    const formData = new FormData();
    formData.append("steamID", param.steamID);
    formData.append("nonce", param.nonce);
    formData.append("redir", param.redir);
    formData.append("auth", param.auth);
    const response = await request({
      url: `https://${STEAM_HOSTS.STORE}/login/settoken`,
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        Host: STEAM_HOSTS.STORE,
        Origin: `https://${STEAM_HOSTS.STORE}`
      },
      data: formData
    });
    return response.status === 200;
  }
  async function updateStoreAuth(retry = false) {
    const response = await request({
      url: `https://${STEAM_HOSTS.STORE}/`,
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "Cache-Control": "max-age=0",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Upgrade-Insecure-Requests": "1"
      },
      fetch: false,
      redirect: "manual"
    });
    const html = response.text ?? "";
    if (response.status === 200) {
      if (!html.includes("data-miniprofile=")) {
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
  function createRedeemContent() {
    return htmlToElement3(`
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
  function webRedeem(keysCsv) {
    const redeemContent = createRedeemContent();
    showSwalMessage({ title: "正在获取sessionID...", buttons: { confirm: "关闭" } });
    if (!getSteamSessionID()) {
      handleNoSession(keysCsv, redeemContent);
      return;
    }
    showRedeemDialog(keysCsv, redeemContent);
  }
  function handleNoSession(keysCsv, redeemContent) {
    GM_xmlhttpRequest({
      method: "GET",
      url: "https://store.steampowered.com/account/registerkey",
      onload: async (data) => {
        if (data.finalUrl.includes("login") && !await updateStoreAuth()) {
          showSwalMessage({
            title: "请先登录steam！",
            icon: "warning",
            buttons: { confirm: "登录", cancel: "关闭" }
          }).then((value) => {
            if (value) window.open("https://store.steampowered.com/login/", "_blank");
          });
        } else if (data.status === 200) {
          setSteamSessionID(data.responseText?.match(/g_sessionID = "(.+?)";/)?.[1] || "");
          showRedeemDialog(keysCsv, redeemContent);
        } else {
          showSwalMessage({ title: "获取sessionID失败！", icon: "error", buttons: { confirm: "关闭" } });
        }
      }
    });
  }
  function showRedeemDialog(keysCsv, redeemContent) {
    setRedeemRenderRoot(redeemContent);
    showSwalMessage({
      title: "正在激活steam key...",
      content: redeemContent,
      buttons: { confirm: "提取未使用key", cancel: "关闭" }
    }).then((value) => {
      const modalContent = document.querySelector(".swal-content");
      const textareaValue = modalContent?.querySelector("textarea")?.value || "";
      GM_setValue("history", [modalContent?.innerHTML || "", textareaValue]);
      if (value) {
        GM_setClipboard(extractSteamKeys(redeemContent.querySelector("#unusedKeys")?.textContent || "").join(","));
        showSwalMessage({ title: "复制成功！", icon: "success" });
      }
      clearRedeemRenderRoot(redeemContent);
    });
    redeemKeys(keysCsv);
  }
  function redeemSub(raw) {
    const subText = raw || document.querySelector("#gameSub")?.value;
    if (!subText) return;
    const ownedPackages = {};
    document.querySelectorAll(".account_table a").forEach((link) => {
      const match = link.href.match(/javascript:RemoveFreeLicense\( ([0-9]+), '/);
      if (match) ownedPackages[Number(match[1])] = true;
    });
    const freePackages = subText.match(/[\d]{2,}/g) || [];
    let loaded = 0;
    const total = freePackages.length;
    if (total === 0) return;
    const showCompletion = () => {
      if (window.location.href.includes("licenses")) {
        window.open("https://store.steampowered.com/account/licenses/", "_self");
      } else {
        showModal({
          title: "全部激活完成，是否前往账户页面查看结果？",
          buttons: { cancel: "取消", confirm: "确定" }
        }).then((value) => {
          if (value) window.open("https://store.steampowered.com/account/licenses/", "_blank");
        });
      }
    };
    const markLoaded = () => {
      loaded++;
      if (loaded >= total) {
        showCompletion();
      } else {
        showModal("正在激活…", `进度：${loaded}/${total}.`);
      }
    };
    showModal("正在执行…", "请等待所有请求完成。 忽略所有错误，让它完成。");
    freePackages.forEach((packageText) => {
      const packageId = Number.parseInt(packageText, 10);
      if (ownedPackages[packageId]) {
        markLoaded();
        return;
      }
      void request({
        url: "https://store.steampowered.com/checkout/addfreelicense",
        method: "POST",
        data: new URLSearchParams({ action: "add_to_cart", sessionid: getSteamSessionID() || safeGlobalSessionID(), subid: String(packageId) }),
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }
      }).then(markLoaded);
    });
  }
  function redeemSubs() {
    const key = document.querySelector("#inputKey")?.value.trim();
    if (key) redeemSub(key);
  }
  function safeGlobalSessionID() {
    try {
      return typeof g_sessionID === "string" ? g_sessionID : "";
    } catch {
      return "";
    }
  }
  function changeStoreCountryFlow() {
    void fetchCartData().then((cartData) => {
      const { cartConfig, userInfo } = parseCartData(cartData);
      if (!cartConfig || !userInfo || Object.keys(cartConfig.rgUserCountryOptions).length <= 2) {
        showSwalMessage({ title: "需要挂相应地区的梯子！", icon: "warning" });
        return;
      }
      showCountryChangeDialog(cartConfig, userInfo, cartData);
    }).catch(() => showSwalMessage({ title: "获取当前国家/地区失败！", icon: "error" }));
    showSwalMessage({ title: "正在获取当前国家/地区...", icon: "info" });
  }
  function fetchCartData() {
    return request({ url: "https://store.steampowered.com/cart/", method: "GET" }).then((response) => {
      if (!response.ok && !response.text) throw new Error("Failed to fetch cart");
      return response.text ?? "";
    });
  }
  function decodeHtml(value) {
    const temp = document.createElement("div");
    temp.innerHTML = value;
    return temp.textContent || temp.innerText || "";
  }
  function parseCartData(data) {
    const cartConfig = JSON.parse(decodeHtml(data.match(/data-cart_config="(.*?)"/)?.[1] || ""));
    const userInfo = JSON.parse(decodeHtml(data.match(/data-userinfo="(.*?)"/)?.[1] || ""));
    return { cartConfig, userInfo };
  }
  function bindCurrencyChangeOption() {
    const intervalId = window.setInterval(() => {
      const options = document.querySelectorAll(".currency_change_option");
      if (options.length > 0) {
        options.forEach((option) => option.addEventListener("click", () => {
          const newCountry = option.dataset.country;
          if (newCountry) changeCountry(newCountry);
        }));
        window.clearInterval(intervalId);
      }
    }, 500);
    window.setTimeout(() => window.clearInterval(intervalId), 1e4);
  }
  function showCountryChangeDialog(cartConfig, userInfo, cartData) {
    const divContent = cartData.match(/<div class="currency_change_options">([\w\W]*?)<p/i)?.[1]?.trim();
    const div = `${divContent || ""}</div>`;
    showSwalMessage({
      closeOnClickOutside: false,
      title: `当前国家/地区：${cartConfig.rgUserCountryOptions[userInfo.country_code] || userInfo.country_code}`,
      content: htmlToElement3(`<div>${div}</div>`)
    });
    bindCurrencyChangeOption();
  }
  function changeCountry(country) {
    showSwalMessage({ closeOnClickOutside: false, icon: "info", title: "正在更换国家/地区..." });
    void request({
      url: "https://store.steampowered.com/country/setcountry",
      method: "POST",
      data: new URLSearchParams({ sessionid: getSteamSessionID() || safeGlobalSessionID(), cc: country }),
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }
    }).then(() => {
      void fetchCartData().then((data) => {
        const { cartConfig, userInfo } = parseCartData(data);
        const divContent = data.match(/<div class="currency_change_options">([\w\W]*?)<p/i)?.[1]?.trim();
        const div = `${divContent || ""}</div>`;
        if (userInfo.country_code === country) {
          showSwalMessage({ title: "更换成功！", icon: "success" }).then(() => {
            showSwalMessage({
              closeOnClickOutside: false,
              title: `当前国家/地区：${cartConfig.rgUserCountryOptions[userInfo.country_code] || userInfo.country_code}`,
              content: htmlToElement3(`<div>${div}</div>`)
            });
            bindCurrencyChangeOption();
          });
        } else {
          showSwalMessage({ title: "更换失败！", icon: "error" });
        }
      }).catch(() => showSwalMessage({ title: "获取当前国家/地区失败！", icon: "error" }));
    });
  }

  // src/modules/steam/redeem.ts
  var FAILURE_DETAILS = {
    14: "无效激活码",
    15: "重复激活",
    53: "次数上限",
    13: "地区限制",
    9: "已拥有",
    24: "缺少主游戏",
    36: "需要PS3?",
    50: "这是充值码"
  };
  var UNUSED_KEY_REASONS = ["次数上限", "地区限制", "已拥有", "缺少主游戏", "其他错误", "未知错误", "网络错误或超时"];
  var AUTO_DIVIDE_NUM = 9;
  var WAITING_SECONDS = 20;
  var state = {
    allUnusedKeys: [],
    keyCount: 0,
    recvCount: 0,
    renderRoot: null,
    popupFlow: false,
    sessionID: ""
  };
  var texts = {
    fail: "失败",
    success: "成功",
    network: "网络错误或超时",
    line: "——",
    nothing: "",
    others: "其他错误",
    redeeming: "激活中",
    waiting: "等待中"
  };
  function getSessionID() {
    if (state.sessionID) return state.sessionID;
    try {
      state.sessionID = typeof g_sessionID === "string" ? g_sessionID : "";
    } catch {
      state.sessionID = "";
    }
    return state.sessionID;
  }
  function setSteamSessionID(sessionID) {
    state.sessionID = sessionID;
  }
  function getSteamSessionID() {
    return getSessionID();
  }
  function setRedeemRenderRoot(root, popupFlow = true) {
    state.renderRoot = root;
    state.popupFlow = popupFlow;
    state.keyCount = 0;
    state.recvCount = 0;
    state.allUnusedKeys = [];
  }
  function clearRedeemRenderRoot(root) {
    if ((!root || state.renderRoot === root) && state.recvCount >= state.keyCount) {
      state.renderRoot = null;
      state.popupFlow = false;
    }
  }
  function queryRedeemRoot(selector) {
    return (state.renderRoot ?? document).querySelector(selector);
  }
  function queryRedeemRootAll(selector) {
    return (state.renderRoot ?? document).querySelectorAll(selector);
  }
  function table() {
    return queryRedeemRoot("table");
  }
  function tbody() {
    return queryRedeemRoot("tbody");
  }
  function createCell(tag, html, className) {
    const cell = document.createElement(tag);
    if (className) cell.className = className;
    cell.innerHTML = html;
    return cell;
  }
  function createSubCell(subId, subName) {
    const cell = document.createElement("td");
    if (subId === 0) {
      cell.textContent = "——";
      return cell;
    }
    const code = document.createElement("code");
    code.textContent = String(subId);
    const link = document.createElement("a");
    link.href = `https://steamdb.info/sub/${subId}/`;
    link.target = "_blank";
    link.textContent = subName;
    cell.append(code, " ", link);
    return cell;
  }
  function setUnusedKeys(key, success, reason, subId, subName) {
    const unusedKeys = queryRedeemRoot("#unusedKeys");
    if (!unusedKeys) return;
    if (success && state.allUnusedKeys.includes(key)) {
      state.allUnusedKeys = state.allUnusedKeys.filter((keyItem) => keyItem !== key);
      unusedKeys.querySelectorAll("li").forEach((li) => {
        if (li.textContent?.includes(key)) li.remove();
      });
    } else if (!success && !state.allUnusedKeys.includes(key) && UNUSED_KEY_REASONS.includes(reason)) {
      const li = document.createElement("li");
      li.append(`${key} (${reason}`);
      if (subId !== 0) {
        li.append(": ");
        const code = document.createElement("code");
        code.textContent = String(subId);
        li.append(code, ` ${subName}`);
      }
      li.append(")");
      unusedKeys.append(li);
      state.allUnusedKeys.push(key);
    }
  }
  function tableInsertKey(key) {
    state.keyCount++;
    const row = document.createElement("tr");
    row.append(createCell("td", String(state.keyCount), "nobr"));
    row.append(createCell("td", `<code>${key}</code>`, "nobr"));
    const waitCell = createCell("td", `${texts.redeeming}...`);
    waitCell.colSpan = 3;
    row.append(waitCell);
    tbody()?.prepend(row);
  }
  function tableWaitKey(key) {
    state.keyCount++;
    const row = document.createElement("tr");
    row.append(createCell("td", String(state.keyCount), "nobr"));
    row.append(createCell("td", `<code>${key}</code>`, "nobr"));
    const waitCell = createCell("td", `${texts.waiting} (${WAITING_SECONDS}秒)...`);
    waitCell.colSpan = 3;
    row.append(waitCell);
    tbody()?.prepend(row);
  }
  function tableUpdateKey(key, result, detail, subId, subName) {
    setUnusedKeys(key, result === texts.success, detail, subId, subName);
    state.recvCount++;
    if (!state.popupFlow && state.recvCount === state.keyCount) {
      document.querySelector("#buttonRedeem, #redeemKey")?.style.removeProperty("display");
      document.querySelector("#inputKey")?.removeAttribute("disabled");
    }
    const rows = Array.from(queryRedeemRootAll("table tr")).slice(1);
    for (const row of rows) {
      const cells = row.children;
      if (cells[1]?.innerHTML.includes(key) && cells[2]?.innerHTML.includes(texts.redeeming)) {
        cells[2].remove();
        const resultCell = createCell("td", result, "nobr");
        resultCell.style.color = result === texts.fail ? "red" : "green";
        row.append(resultCell);
        row.append(createCell("td", detail, "nobr"));
        row.append(createSubCell(subId, subName));
        break;
      }
    }
  }
  function redeemKey(key) {
    GM_xmlhttpRequest({
      url: "https://store.steampowered.com/account/ajaxregisterkey/",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: "https://store.steampowered.com",
        Referer: "https://store.steampowered.com/account/registerkey"
      },
      data: `product_key=${encodeURIComponent(key)}&sessionid=${encodeURIComponent(getSessionID())}`,
      method: "POST",
      responseType: "json",
      onloadstart: () => {
        const currentTable = table();
        if (currentTable && currentTable.style.display === "none") currentTable.style.display = "";
      },
      onload: (response) => {
        if (response.status === 200 && response.response) {
          const data = response.response;
          if (data.success === 1 && data.purchase_receipt_info?.line_items[0]) {
            const item = data.purchase_receipt_info.line_items[0];
            tableUpdateKey(key, texts.success, texts.line, item.packageid, item.line_item_description);
            return;
          }
          if (data.purchase_result_details !== void 0 && data.purchase_receipt_info) {
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
  function startTimer() {
    const timer = window.setInterval(() => {
      let hasWaiting = false;
      let nowKey = 0;
      const rows = Array.from(queryRedeemRootAll("table tr")).slice(1).reverse();
      for (const row of rows) {
        const cell = row.children[2];
        if (cell?.innerHTML.includes(texts.waiting)) {
          nowKey++;
          if (nowKey <= AUTO_DIVIDE_NUM) {
            const key = row.children[1]?.textContent?.trim() ?? "";
            cell.innerHTML = `${texts.redeeming}...`;
            redeemKey(key);
          } else {
            hasWaiting = true;
            break;
          }
        }
      }
      if (!hasWaiting) window.clearInterval(timer);
    }, 1e3 * WAITING_SECONDS);
  }
  function redeem(keys) {
    if (keys.length <= 0) return;
    if (!state.popupFlow) {
      document.querySelector("#buttonRedeem, #redeemKey")?.style.setProperty("display", "none");
      document.querySelector("#inputKey")?.setAttribute("disabled", "disabled");
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
  function redeemKeys(key) {
    const keys = key ? key.split(",").map((item) => item.trim()).filter(Boolean) : extractSteamKeys(document.querySelector("#inputKey")?.value.trim() || "");
    redeem(keys);
  }
  function registerSteamKeys(raw) {
    const setting = getSteamSettings();
    const keys = extractSteamKeys(raw);
    if (keys.length === 0) return;
    if (setting.asf) {
      const asfCommand = `!redeem ${setting.asfBot ? `${setting.asfBot} ` : ""}${keys.join(",")}`;
      asfRedeem(asfCommand);
    } else if (setting.newTab) {
      window.open(`https://store.steampowered.com/account/registerkey?key=${keys.join(",")}`, "_blank");
    } else {
      webRedeem(keys.join(","));
    }
  }
  function copyUnusedKeys() {
    GM_setClipboard(extractSteamKeys(queryRedeemRoot("#unusedKeys")?.textContent || "").join(","));
    showModal({ title: "复制成功！", icon: "success" });
  }
  function toggleUnusedKeyArea() {
    if (!state.popupFlow) {
      const unusedKeyArea = queryRedeemRoot("#unusedKeyArea");
      if (unusedKeyArea) unusedKeyArea.style.display = unusedKeyArea.style.display === "none" ? "" : "none";
    }
  }
  function initSteamRedeemPage() {
    state.renderRoot = null;
    state.popupFlow = false;
    state.keyCount = 0;
    state.recvCount = 0;
    state.allUnusedKeys = [];
    getSessionID();
    const examples = document.querySelector("#registerkey_examples_text");
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
    const inputBox = document.querySelector(".registerkey_input_box_text")?.parentElement;
    inputBox?.style.setProperty("float", "none");
    inputBox?.insertAdjacentHTML("beforeend", '<textarea class="form-control" rows="3" id="inputKey" placeholder="支持批量激活，可以把整个网页文字复制过来&#10;若一次激活的Key的数量超过9个则会自动分批激活（等待20秒）&#10;激活多个SUB时每个SUB之间用英文逗号隔开" style="margin: 3px 0px 0px; width: 525px; height: 102px;"></textarea><br>');
    const keyFromUrl = new URL(window.location.href).searchParams.get("key");
    if (keyFromUrl) {
      const input = document.querySelector("#inputKey");
      if (input) input.value = keyFromUrl;
    }
    document.querySelectorAll(".registerkey_input_box_text,#purchase_confirm_ssa").forEach((el) => {
      el.style.display = "none";
    });
    const registerButton = document.querySelector("#register_btn");
    registerButton?.parentElement?.style.setProperty("margin", "10px 0");
    registerButton?.parentElement?.insertAdjacentHTML("beforeend", `
    <a tabindex="300" class="btnv6_blue_hoverfade btn_medium" style="margin-left:0" id="redeemKey"><span>激活key</span></a> &nbsp;&nbsp;
    <a tabindex="300" class="btnv6_blue_hoverfade btn_medium" style="margin-left:0" id="redeemSub"><span>激活sub</span></a> &nbsp;&nbsp;
    <a tabindex="300" class="btnv6_blue_hoverfade btn_medium" style="margin-left:0" id="changeCountry"><span>更换国家/地区</span></a> &nbsp;&nbsp;`);
    registerButton?.remove();
    document.querySelector("#copyUnuseKey")?.addEventListener("click", copyUnusedKeys);
    document.querySelector("#redeemKey")?.addEventListener("click", () => redeemKeys());
    if (keyFromUrl) redeem(extractSteamKeys(keyFromUrl));
    toggleUnusedKeyArea();
  }
  function bindCopySelectClickListeners() {
    const setting = getSteamSettings();
    if (setting.selectListen) {
      bindSelectListener();
    }
    if (!/https?:\/\/store\.steampowered\.com\/account\/registerkey/.test(window.location.href) && setting.copyListen) {
      window.addEventListener("copy", activateCopiedProduct, false);
    }
    if (setting.clickListen) {
      bindClickListener();
    }
  }
  function activateCopiedProduct(event) {
    const setting = getSteamSettings();
    const productKey = window.getSelection()?.toString()?.trim() || event.target?.value || "";
    void navigator.clipboard?.writeText(productKey).catch(() => void 0);
    if (/^([\w\W]*)?([\d\w]{5}(-[\d\w]{5}){2}(\r|,|，)?){1,}/.test(productKey)) {
      if (!document.querySelector("div.swal-overlay.swal-overlay--show-modal")) {
        showModal({ title: "检测到神秘key,是否激活？", icon: "success", buttons: { confirm: "激活", cancel: "取消" } }).then((value) => {
          if (value) registerSteamKeys(productKey);
        });
      }
    } else if (/^![\w\d]+\s+asf\s+.+/gi.test(productKey) && setting.asf) {
      if (!document.querySelector("div.swal-overlay.swal-overlay--show-modal")) {
        showModal({ closeOnClickOutside: false, className: "swal-user", title: "检测到您复制了以下ASF指令，是否执行？", text: productKey, buttons: { confirm: "执行", cancel: "取消" } }).then((value) => {
          if (value) asfRedeem(productKey);
        });
      }
    }
  }
  function bindSelectListener() {
    const icon = document.createElement("div");
    icon.className = "icon-div";
    icon.title = "激活";
    icon.innerHTML = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAABsFBMVEVHcEz9/f3+/v8Tdaf///8LGTP+/v4NPWX+/v8GGDj8/f4OGzX///////////8ZJ1ALJ0oNGzf+/v4mOGXX2+T8/f3z9vkPH0UjMFj5+fr///8NGzMJG0ERHS8SKEgXW40Ubp8WY5Ula5ePnrb3+PlnhKUfQ3Q3R3C2vMvt8PRcZH7///8TgrMTgbITfa4YNmcPHDT///8JGj0HGT2rucxGWtQLgNLAcy8JbGLFJs3HSZDJNmQzjpmaWM7SBviRXk2SbxyXGSQkCI1jAqUB/Mp6sYbfV6mGvWq2W7JOSPQ7urIPuJBsXccNbkNG7t7cf397aQQkrMLUPZLh4JoMushV5P0yS3vatUbSV+QwkytaRQbJQ4DOFwqiySQnBR1PTKAnTPCyY0ikUSoVrgPcOjihE2vYdPnPK8yTfDczytwKtbsQVhHOvTqcd4Hn+VMCvg2lM3itHMK3LMyiXD/UGPbeXkFBwuQacrh8Yhg1hiM8TxHxu/vT8UvQJtud3j/ubVKCXTrix8O15Xaob/hf21MlJOZiX5qXSvHvi+Tacqgmn7Kgfvl6E7+58ped8vpTyTdwlLkThi49CP9gTiZv7R/1juXxTerpPNEINA6/d9Eb6/kH/VNKXbtJ1G+kFsSk3zxyOv46Hh3KlclbjOJsHYleDzWKxmK1UskUkixSzxfnGc9f1DvkjQvHCq6OHL61eX1+/qYLR6tKrw4lKOr+sXFWtdNj/O99wiTs7uzqWlzu6Op14Pf0P2PD9NrHDeWsAAAAASUVORK5CYII=" class="icon-img" alt="激活图标">';
    document.documentElement.append(icon);
    document.addEventListener("selectionchange", () => {
      if (!window.getSelection()?.toString()?.trim()) icon.style.display = "none";
    });
    document.addEventListener("mouseup", (event) => {
      if (event.target === icon || icon.contains(event.target)) {
        event.preventDefault();
        return;
      }
      const text = window.getSelection()?.toString()?.trim() || "";
      const productKey = text || event.target?.value || "";
      if (/[\d\w]{5}(-[\d\w]{5}){2}/.test(productKey) && text && icon.style.display === "none") {
        icon.style.top = `${event.pageY + 12}px`;
        icon.style.left = `${event.pageX + 18}px`;
        icon.style.display = "block";
      } else if (!text) {
        icon.style.display = "none";
      }
    });
    icon.addEventListener("mousedown", (event) => event.preventDefault());
    icon.addEventListener("click", (event) => {
      const productKey = window.getSelection()?.toString()?.trim() || event.target?.value || "";
      registerSteamKeys(productKey);
    });
  }
  function bindClickListener() {
    document.body?.addEventListener("click", (event) => {
      const htmlEl = event.target;
      if (!htmlEl || htmlEl.closest(".swal-overlay") || ["A", "BUTTON", "TEXTAREA"].includes(htmlEl.tagName) || ["button", "text"].includes(htmlEl.getAttribute("type") || "")) return;
      if (htmlEl.children.length > 0 && extractSteamKeys(Array.from(htmlEl.children).map((child) => child.textContent ?? "").join("")).length > 0) return;
      const keys = extractSteamKeys(htmlEl.textContent ?? "");
      if (keys.length === 0) return;
      mouseClick(event);
      let html = htmlEl.innerHTML;
      keys.forEach((key) => {
        html = html.replace(new RegExp(key, "gi"), `<a class="redee-key" href="javascript:void(0)" target="_self" data-key="${key}">${key}</a>`);
      });
      htmlEl.innerHTML = html;
      htmlEl.querySelectorAll(".redee-key").forEach((link) => {
        link.addEventListener("click", () => registerSteamKeys(link.dataset.key || ""));
      });
    });
  }
  function mouseClick(event) {
    const span = document.createElement("span");
    span.textContent = "Steam Key";
    span.style.cssText = `z-index:2147483647;top:${event.pageY - 20}px;left:${event.pageX}px;position:absolute;font-weight:bold;color:#ff6651;transition:all 1.5s ease;`;
    document.body.append(span);
    requestAnimationFrame(() => {
      span.style.top = `${event.pageY - 180}px`;
      span.style.opacity = "0";
    });
    window.setTimeout(() => span.remove(), 1500);
  }

  // src/modules/steam/index.ts
  var STEAM_CSS = `
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
  var initialized = false;
  function initSteam() {
    if (initialized) return;
    initialized = true;
    try {
      GM_addStyle(STEAM_CSS);
      const url = window.location.href;
      if (/^https?:\/\/store\.steampowered\.com\/account\/registerkey/.test(url)) {
        initSteamRedeemPage();
        document.querySelector("#redeemSub")?.addEventListener("click", redeemSubs);
        document.querySelector("#changeCountry")?.addEventListener("click", changeStoreCountryFlow);
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
      showModal("AuTo Redeem Steamkey脚本执行出错，详情请查看控制台！", error.stack, "error");
      console.error(error);
    }
  }
  function openSteamSettings() {
    openSteamSettingsDialog();
  }
  function runSteamASF() {
    openASFDialog();
  }
  function bindSteamDBFreePackages() {
    const interval = window.setInterval(() => {
      const freePackages = document.querySelector("#freepackages");
      if (!freePackages) return;
      freePackages.addEventListener("click", () => {
        const subs = Array.from(document.querySelectorAll("#freepackages span")).filter((span) => span.offsetParent !== null).map((span) => span.dataset.subid || span.getAttribute("data-subid") || "").filter(Boolean);
        window.open(`https://store.steampowered.com/account/licenses/?sub=${subs.join(",")}`, "_self");
      });
      window.clearInterval(interval);
    }, 1e3);
  }
  function initSteamLicensesPage() {
    document.querySelector("h2.pageheader")?.parentElement?.insertAdjacentHTML("beforeend", `
    <div style="float: left;">
      <textarea class="registerkey_input_box_text" rows="1" name="product_key" id="gameSub" placeholder="输入SUB,多个SUB之间用英文逗号连接" style="margin: 3px 0px 0px; width: 400px; height: 15px;background-color:#102634; padding: 6px 18px 6px 18px; font-weight:bold; color:#fff;"></textarea> &nbsp;
    </div>
    <a tabindex="300" class="btnv6_blue_hoverfade btn_medium" style="width: 95px; height: 30px;" id="buttonSUB"><span>激活SUB</span></a>
    <a tabindex="300" class="btnv6_blue_hoverfade btn_medium" style="width: 125px; height: 30px;margin-left:5px" id="changeCountry-account"><span>更改国家/地区</span></a>`);
    document.querySelector("#buttonSUB")?.addEventListener("click", () => redeemSub());
    document.querySelector("#changeCountry-account")?.addEventListener("click", changeStoreCountryFlow);
    if (/https?:\/\/store\.steampowered\.com\/account\/licenses\/\?sub=([\d]+,)+/.test(window.location.href)) {
      window.setTimeout(() => redeemSub(window.location.href), 2e3);
    }
  }
  function bindStoreCountryShortcut() {
    if (!/https?:\/\/store\.steampowered\.com\//.test(window.location.href)) return;
    const accountPulldown = document.querySelector("#account_pulldown");
    if (!accountPulldown || document.querySelector("#changeCountry")) return;
    accountPulldown.insertAdjacentHTML("beforebegin", '<span id="changeCountry" style="cursor:pointer;display:inline-block;padding-left:4px;line-height:25px" class="global_action_link persona_name_text_content">更改国家/地区 |</span>');
    document.querySelector("#changeCountry")?.addEventListener("click", changeStoreCountryFlow);
  }
  function redeemAllPageKeys() {
    const div = document.createElement("div");
    div.id = "keyDiv";
    div.style.cssText = "position:fixed;left:5px;bottom:5px";
    const button = document.createElement("button");
    button.id = "allKey";
    button.className = "btn btn-default";
    button.style.display = "none";
    button.style.zIndex = "9999";
    button.textContent = "激活本页面所有key(共0个)";
    div.append(button);
    document.body.append(div);
    let previousKeyList = "";
    window.setInterval(() => {
      const keys = extractSteamKeys(document.body.textContent || "");
      if (keys.length > 0) {
        const keyList = keys.join(",");
        if (previousKeyList !== keyList) {
          previousKeyList = keyList;
          button.dataset.key = keyList;
          button.textContent = `激活本页面所有key(共${keys.length}个)`;
          button.style.display = "block";
        }
      } else if (button.style.display === "block") {
        previousKeyList = "";
        button.style.display = "none";
        button.textContent = "激活本页面所有key(共0个)";
      }
    }, 1e3);
    button.addEventListener("click", () => registerSteamKeys(button.dataset.key || ""));
  }

  // src/shared/menu.ts
  function registerMenus(handlers) {
    if (handlers.onOpenSettings) {
      GM_registerMenuCommand("⚙设置", handlers.onOpenSettings);
    }
    if (handlers.onSteamASF) {
      GM_registerMenuCommand("执行ASF指令", handlers.onSteamASF);
    }
    if (handlers.onIGBatch) {
      GM_registerMenuCommand("入库所有", handlers.onIGBatch);
    }
    if (handlers.onItchExtract) {
      GM_registerMenuCommand("提取所有链接", handlers.onItchExtract);
    }
  }

  // src/main.ts
  function bootstrap() {
    initSteam();
    initIG();
    initItch();
    registerMenus({
      onOpenSettings: openSteamSettings,
      onSteamASF: runSteamASF,
      onIGBatch: runIGBatch,
      onItchExtract: runItchExtract
    });
  }
  bootstrap();
})();
