// ==UserScript==
// @name         Manifest DO 自填 快速自动设置（自动更新版）
// @namespace    https://netchb.com/
// @version      1.0.2
// @description  等页面加载完毕后再“瞬时”执行：设置柜型/箱型、展开 CMQ、勾选复选框并加载 B/L。
// @author       Tommy Helper
// @match        https://www.netchb.com/app/entry/processHeader.do*
// @run-at       document-end
// @grant        none
// @updateURL    https://raw.githubusercontent.com/th5221079-ops/netchb-userscripts/main/manifest_do_autoset.user.js
// @downloadURL  https://raw.githubusercontent.com/th5221079-ops/netchb-userscripts/main/manifest_do_autoset.user.js
// ==/UserScript==

(function() {
  'use strict';

  // —— 配置 ——
  const actions = [
    { type: 'selectByText', xpath: "//select[@name='containerWrappers[0].containerSize'][@id='cs0']", text: "40 ft HC" },
    { type: 'selectByText', xpath: "//select[@name='containerWrappers[0].containerType'][@id='ct0']", text: "Dry" },
    { type: 'click', xpath: "//*[@id='showCmqLink']" },
    { type: 'check', xpath: "//input[@id='cmqCheck1']" },
    { type: 'click', xpath: "//input[@value='Load Selected B/L into this entry']" },
    { type: 'noop',  xpath: "//input[@value='Save Changes']" }
  ];

  // —— 基础工具 ——
  const $x = (xp, root = document) => {
    try {
      const r = document.evaluate(xp, root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const out = [];
      for (let i = 0; i < r.snapshotLength; i++) out.push(r.snapshotItem(i));
      return out;
    } catch (e) {
      return [];
    }
  };

  function waitForXPath(xpath, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      (function loop() {
        const nodes = $x(xpath);
        if (nodes && nodes[0]) return resolve(nodes[0]);
        if (performance.now() - t0 > timeoutMs) return reject(new Error('timeout: ' + xpath));
        requestAnimationFrame(loop);
      })();
    });
  }

  function setSelectByText(selectEl, text) {
    if (!(selectEl instanceof HTMLSelectElement)) return;
    const i = Array.from(selectEl.options).findIndex(o => (o.text || '').trim() === text.trim());
    if (i >= 0) {
      selectEl.selectedIndex = i;
      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function instantClick(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    el.click();
  }

  async function runActions() {
    for (const act of actions) {
      try {
        if (act.type === 'noop') continue;
        const el = await waitForXPath(act.xpath, 10000);
        switch (act.type) {
          case 'selectByText':
            setSelectByText(el, act.text);
            break;
          case 'check':
            if (el instanceof HTMLInputElement && el.type === 'checkbox') {
              if (!el.checked) {
                el.checked = true;
                el.dispatchEvent(new Event('input',  { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
            break;
          case 'click':
            instantClick(el);
            break;
        }
      } catch (e) {
        // 单步失败不阻断
      }
    }
  }

  function onLoaded() {
    // 仅在完全加载后执行一次；如页面为 SPA，可按需手动刷新或再次触发。
    runActions();
  }

  if (document.readyState === 'complete') {
    onLoaded();
  } else {
    // 等到整个页面（含资源）加载完毕
    window.addEventListener('load', onLoaded, { once: true });
  }
})();
