// ==UserScript==
// @name         SAM 客人LACEY ACT 快速录入
// @namespace    https://bestwo.com/
// @version      1.1.0
// @description  在指定页面自动选择下拉框并填写联系人信息与国家代码
// @match        https://www.netchb.com/app/entry/line/processLineItemValue.do*
// @updateURL    https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/sam_lacey_quick.user.js
// @downloadURL  https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/sam_lacey_quick.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // ===== 工具函数 =====
  function $x(xpath, root = document) {
    return document.evaluate(xpath, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  }

  function dispatchAll(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function selectByIndex(selectEl, oneBasedIndex) {
    if (!selectEl) return false;
    const idx = Math.max(0, oneBasedIndex - 1);
    if (idx >= 0 && idx < selectEl.options.length) {
      selectEl.selectedIndex = idx;
      dispatchAll(selectEl);
      return true;
    }
    return false;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function fill() {
    try {
      // 1) 点击 #ent0 并选择 option[3]
      const ent0 = $x('//*[@id="ent0"]');
      if (ent0) {
        ent0.click();
        selectByIndex(ent0, 3);
      }

      // 2) 录入联系人姓名/电话/邮箱
      const nameEl = $x('//*[@id="oen0_nm0"]');
      if (nameEl) {
        nameEl.value = "TINA";
        dispatchAll(nameEl);
      }

      const phoneEl = $x('//*[@id="oen0_ph0"]');
      if (phoneEl) {
        phoneEl.value = "1352278756";
        dispatchAll(phoneEl);
      }

      const emailEl = $x('//*[@id="oen0_em0"]');
      if (emailEl) {
        emailEl.value = "aj-wuliu@bestwo.com";
        dispatchAll(emailEl);
      }

      // 给页面一点反应时间（若有联动校验）
      await sleep(50);

      // 3) 点击 #cenU0 并选择 option[4]
      const cenU0 = $x('//*[@id="cenU0"]');
      if (cenU0) {
        cenU0.click();
        selectByIndex(cenU0, 4);
      }

      // 4) 在 #cprod0-0 录入 "CN"
      const countryEl = $x('//*[@id="cprod0-0"]');
      if (countryEl) {
        countryEl.value = "CN";
        dispatchAll(countryEl);
      }
    } catch (e) {
      console.error("[NETCHB 快速录入] 发生错误：", e);
    }
  }

  // 直接运行一次；若页面有动态加载，可再用 MutationObserver 兜底
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fill);
  } else {
    fill();
  }

  // 兜底：监听节点变化，元素迟到也能填
  const mo = new MutationObserver(() => {
    const mustHave = [
      '//*[@id="ent0"]',
      '//*[@id="oen0_nm0"]',
      '//*[@id="oen0_ph0"]',
      '//*[@id="oen0_em0"]',
      '//*[@id="cenU0"]',
      '//*[@id="cprod0-0"]',
    ];
    const allReady = mustHave.every((xp) => !!$x(xp));
    if (allReady) {
      fill();
      try { mo.disconnect(); } catch (_) {} // 填过就停止监听
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
