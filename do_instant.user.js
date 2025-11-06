// ==UserScript==
// @name         下载 DO 处理+保存（瞬时触发版）
// @namespace    https://netchb.com/
// @version      1.2.2
// @description  进入编辑DO页面即刻执行：点击/填值；若元素稍后出现则一出现立即执行
// @match        https://www.netchb.com/app/entry/editDeliveryOrder.do*
// @updateURL    https://raw.githubusercontent.com/th5221079-ops/netchb-userscripts/main/do_instant.user.js
// @downloadURL  https://raw.githubusercontent.com/th5221079-ops/netchb-userscripts/main/do_instant.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ACTIONS = [
    { finder: "//input[@name='collect_prepaid'][@value='Collect'][@id='collect']", type: "click" },
    { finder: "//*[@id='doForm']/div[1]/div[2]/table[1]/tbody/tr[1]/td/input", type: "input", value: " " },
    { finder: "//*[@id='doForm']/div[1]/div[2]/table[1]/tbody/tr[2]/td/input", type: "input", value: " " },
    { finder: "//textarea[@name='doNote'][@cols='70'][@rows='5'][@id='nte']", type: "input", value: " " },
    { finder: "//*[@id='svch']", type: "click" }
  ];

  const $x = (xpath, ctx = document) =>
    document.evaluate(xpath, ctx, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue || null;

  const fireAll = (el) => {
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
  };

  const clickFast = (el) => el.click();

  const setValueFast = (el, val) => {
    const v = String(val ?? '');
    if ('value' in el) {
      el.value = v;
      fireAll(el);
    } else {
      el.textContent = v;
    }
  };

  const executed = new WeakSet();
  const doneByFinder = new Set();

  function execIfFound(act, root = document) {
    if (doneByFinder.has(act.finder)) return true;
    const el = $x(act.finder, root);
    if (!el || executed.has(el)) return false;

    try {
      if (act.type === 'click') clickFast(el);
      else if (act.type === 'input') setValueFast(el, act.value);
      executed.add(el);
      doneByFinder.add(act.finder);
      return true;
    } catch (e) {
      console.warn('[DO 瞬时脚本] 执行失败：', act.finder, e);
      return false;
    }
  }

  function runInstant() {
    for (const act of ACTIONS) execIfFound(act);
    const pending = ACTIONS.filter(a => !doneByFinder.has(a.finder));
    if (pending.length === 0) return;

    const obs = new MutationObserver(() => {
      for (const act of pending) if (!doneByFinder.has(act.finder)) execIfFound(act);
      if (ACTIONS.every(a => doneByFinder.has(a.finder))) obs.disconnect();
    });
    obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }

  let armed = false;
  function arm() {
    if (armed) return;
    armed = true;
    runInstant();

    let last = 0;
    const obs = new MutationObserver(() => {
      const now = Date.now();
      if (now - last < 800) return;
      last = now;
      runInstant();
    });
    obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }

  arm();
})();
