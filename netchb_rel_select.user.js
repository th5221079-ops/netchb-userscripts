// ==UserScript==
// @name         NETCHB 选择party related NO（自动更新版）
// @namespace    http://tampermonkey.net/
// @version      1.1.1
// @description  在发票上传与编辑页面自动选择 #rel 的第二个选项（option[2]），增强异步/迟加载兼容与事件触发稳健性。
// @match        https://www.netchb.com/app/entry/invoice/processInvoiceUpload.do*
// @match        https://www.netchb.com/app/entry/invoice/editInvoice.do*
// @updateURL    https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/netchb_rel_select.user.js
// @downloadURL  https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/netchb_rel_select.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const TARGET_ID = "rel";           // XPath: //*[@id="rel"]
  const TARGET_OPT_INDEX = 1;        // option[2] -> index 1 (0-based)
  const MAX_TRIES = 80;              // 适配慢页面
  const INTERVAL_MS = 80;            // 快速“瞬时触发”
  const OBSERVE_TIMEOUT_MS = 12000;  // 停止观察的上限

  function fireAll(el) {
    ["input", "change", "blur"].forEach((type) =>
      el.dispatchEvent(new Event(type, { bubbles: true }))
    );
  }

  function pickSecondOption(selectEl) {
    if (!selectEl || selectEl.tagName !== "SELECT") return false;
    if (selectEl.options.length <= TARGET_OPT_INDEX) return false;
    if (selectEl.selectedIndex === TARGET_OPT_INDEX) return true;

    const wasDisabled = selectEl.disabled;
    if (wasDisabled) selectEl.disabled = false;

    const targetOpt = selectEl.options[TARGET_OPT_INDEX];
    if (!targetOpt) return false;

    // 首选 value 赋值，兜底 selectedIndex
    selectEl.value = targetOpt.value;
    if (selectEl.selectedIndex !== TARGET_OPT_INDEX) {
      selectEl.selectedIndex = TARGET_OPT_INDEX;
    }
    fireAll(selectEl);

    if (wasDisabled) selectEl.disabled = true;
    return true;
  }

  function getById() {
    return document.getElementById(TARGET_ID);
  }

  function getByXPath(xp) {
    return document
      .evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      .singleNodeValue;
  }

  function tryOnce() {
    // 先 id，后 XPath（精确匹配 //*[@id="rel"]/option[2]）
    const sel = getById() || getByXPath('//*[@id="rel"]');
    if (!sel) return false;

    const xpOpt = getByXPath('//*[@id="rel"]/option[2]');
    if (xpOpt && sel.tagName === "SELECT") {
      sel.value = xpOpt.value;
      sel.selectedIndex = TARGET_OPT_INDEX;
      fireAll(sel);
      return true;
    }
    return pickSecondOption(sel);
  }

  function armedSelect(maxTries, intervalMs) {
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (tryOnce()) clearInterval(timer);
      else if (tries >= maxTries) clearInterval(timer);
    }, intervalMs);
  }

  function observe() {
    const obs = new MutationObserver((_muts, observer) => {
      if (tryOnce()) observer.disconnect();
    });
    obs.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
    setTimeout(() => obs.disconnect(), OBSERVE_TIMEOUT_MS);
  }

  // 页面加载不同阶段均尝试，提高命中率
  if (document.readyState === "loading") {
    armedSelect(MAX_TRIES, INTERVAL_MS);
    observe();
    document.addEventListener("DOMContentLoaded", tryOnce, { once: true });
  } else {
    tryOnce() || armedSelect(Math.floor(MAX_TRIES / 2), INTERVAL_MS);
  }
})();

