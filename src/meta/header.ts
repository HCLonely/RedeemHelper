export const USER_SCRIPT_HEADER = `// ==UserScript==
// @name            RedeemHelper
// @namespace       https://github.com/HCLonely/RedeemHelper
// @author          HCLonely
// @description     统一的游戏 Key 提取与领取辅助脚本，聚合了 Steam / IndieGala / itch.io。
// @description:en  Unified helper for extracting and redeeming game keys.
// @version         4.0.4
// @supportURL      https://github.com/HCLonely/RedeemHelper/issues
// @homepageURL     https://github.com/HCLonely/RedeemHelper
// @updateURL       https://github.com/HCLonely/RedeemHelper/blob/main/RedeemHelper.user.js?raw=true
// @downloadURL     https://github.com/HCLonely/RedeemHelper/blob/main/RedeemHelper.user.js?raw=true
// @icon            https://github.com/HCLonely/RedeemHelper/blob/main/icon.ico?raw=true
// @tag             games

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
// @connect         www.gog.com
// @connect         www.indiegala.com
// @connect         itch.io
// @connect         store.steampowered.com
// @connect         login.steampowered.com
// @connect         *
// ==/UserScript==`;
