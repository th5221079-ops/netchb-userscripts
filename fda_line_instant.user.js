// ==UserScript==
// @name         NETCHB LINE FDA 值瞬时填入（自动更新版）
// @namespace    https://netchb.com/
// @version      1.0.1
// @description  在指定页面瞬间填入：#arH 为空则=23；#arM=59；#cmes0="PCS"
// @match        https://www.netchb.com/app/entry/line/processLineItemValue.do*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/th5221079-ops/netchb-userscripts/main/fda_line_instant.user.js
// @downloadURL  https://raw.githubusercontent.com/th5221079-ops/netchb-userscripts/main/fda_line_instant.user.js
// ==/UserScript==

(function () {
  'use strict';

  // 触发常见框架监听
  const fireAll = (el) => {
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
  };

  const setValueFast = (el, val) => {
    if (!el) return false;
    const v = String(val ?? '');
    if ('value' in el) {
      if (el.value === v) return true; // 已是目标值
      el.value = v;
      fireAll(el);
      return true;
    } else {
      if (el.textContent === v) return true;
      el.textContent = v;
      fireAll(el);
      return true;
    }
  };

  // #arH 仅在“空白”时写入 23（空白：去除空格后长度为 0）
  const setIfBlank = (el, val) => {
    if (!el) return false;
    const cur = ('value' in el) ? String(el.value ?? '') : String(el.textContent ?? '');
    if (cur.trim().length === 0) {
      return setValueFast(el, val);
    }
    return true; // 已有值则视为完成
  };

  // 单次尝试：瞬间填入
  const tryFill = () => {
    const arH   = document.querySelector('#arH');
    const arM   = document.querySelector('#arM');
    const cmes0 = document.querySelector('#cmes0');

    const okH   = setIfBlank(arH, 23);
    const okM   = setValueFast(arM, 59);
    const okMsg = setValueFast(cmes0, 'PCS');

    return okH && okM && okMsg;
  };

  // 1) 现有 DOM 立即执行一次
  let allDone = false;
  const runInstant = () => {
    if (allDone) return;
    allDone = tryFill();
  };
  runInstant();

  // 2) 若元素稍后渲染/被刷新：出现即执行；全部完成后关闭观察
  const obs = new MutationObserver(() => {
    if (allDone) { obs.disconnect(); return; }
    allDone = tryFill();
    if (allDone) obs.disconnect();
  });
  obs.observe(document.documentElement || document.body, { childList: true, subtree: true });

})();
