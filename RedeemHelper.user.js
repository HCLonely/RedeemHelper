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

  // src/modules/steam/index.ts
  function initSteam() {
  }
  function openSteamSettings() {
  }
  function runSteamASF() {
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
