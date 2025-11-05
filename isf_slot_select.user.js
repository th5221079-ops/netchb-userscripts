// ==UserScript==
// @name         NETCHB ISF import SLOT 选中（自动更新版）
// @namespace    https://netchb.com/
// @version      1.0.1
// @description  On ISF page, instantly click #cfrm1 and select the SLOT option (ignore entryNo digits).
// @author       you
// @match        https://www.netchb.com/app/entry/isf.do*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/isf_slot_select.user.js
// @downloadURL  https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/isf_slot_select.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Utility: wait for an element to appear
  function waitForSelector(selector, {timeout = 15000, root = document} = {
    timeout: 15000,
    root: document
  }) {
    return new Promise((resolve, reject) => {
      const el = root.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el2 = root.querySelector(selector);
        if (el2) {
          observer.disconnect();
          resolve(el2);
        }
      });

      observer.observe(root, {childList: true, subtree: true});

      if (timeout) {
        setTimeout(() => {
          observer.disconnect();
          reject(new Error('Timeout waiting for selector: ' + selector));
        }, timeout);
      }
    });
  }

  function fire(el, type) {
    el.dispatchEvent(new MouseEvent(type, {bubbles: true, cancelable: true, view: window}));
  }

  function triggerChange(el) {
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
  }

  async function instantSelectSlot() {
    try {
      const select = await waitForSelector('#cfrm1', {timeout: 10000});

      // “瞬间点击”：模拟一次快速点击/聚焦
      select.focus();
      fire(select, 'mousedown');
      fire(select, 'mouseup');
      fire(select, 'click');

      // 优先按可见文本匹配 SLOT（忽略大小写与空白）
      let option = Array.from(select.options).find(opt => (opt.text || '').trim().toUpperCase() === 'SLOT');

      // 兜底：第 7 个 <option>（XPath: //*[@id="cfrm1"]/option[7]）=> index 6
      if (!option && select.options.length >= 7) {
        option = select.options[6];
      }

      if (!option) {
        console.warn('[NETCHB ISF] SLOT option not found.');
        return;
      }

      // 赋值并触发事件
      select.value = option.value;
      triggerChange(select);

      console.log('[NETCHB ISF] Selected:', option.text, 'value=', option.value);
    } catch (err) {
      console.warn('[NETCHB ISF] Failed to select SLOT:', err);
    }
  }

  // 页面加载执行一次
  instantSelectSlot();

  // 监听可能的 SPA/动态重渲染
  const reRunObserver = new MutationObserver((mutList) => {
    for (const m of mutList) {
      if (m.type === 'childList') {
        const select = document.querySelector('#cfrm1');
        if (select && (select.dataset._slotApplied !== '1')) {
          select.dataset._slotApplied = '1';
          setTimeout(instantSelectSlot, 0);
        }
      }
    }
  });
  reRunObserver.observe(document.documentElement, {childList: true, subtree: true});
})();
