export const USER_SCRIPT_HEADER = `// ==UserScript==
// @name            RedeemHelper
// @namespace       HCLonely
// @author          HCLonely
// @description     Unified helper for extracting and redeeming game keys.
// @description:en  Unified helper for extracting and redeeming game keys.
// @version         0.1.0
// @supportURL      https://github.com/HCLonely/user.js/issues
// @homepageURL     https://github.com/HCLonely/user.js
// @icon            https://github.com/HCLonely/RedeemHelper/raw/main/icon.ico
// @match           *://*/*
// @exclude         *://store.steampowered.com/widget/*
// @exclude         *://*googleads*
// @grant           GM_setClipboard
// @grant           GM_addStyle
// @grant           GM_registerMenuCommand
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_xmlhttpRequest
// @grant           GM_cookie
// @run-at          document-idle
// @require         https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.min.js
// @connect         *
// ==/UserScript==`;
