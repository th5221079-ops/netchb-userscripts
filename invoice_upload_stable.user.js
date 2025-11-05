// ==UserScript==
// @name         Invoice Upload 秒选+防反勾（稳态强制版）
// @namespace    https://netchb.com/
// @version      1.3.5
// @description  进入页面即刻选择下拉并强制保持勾选状态，避免页面后续脚本把勾选“弹回”
// @match        https://www.netchb.com/app/entry/invoice/editInvoiceUpload.do*
// @updateURL    https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/invoice_upload_stable.user.js
// @downloadURL  https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/invoice_upload_stable.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ACTIONS = [
    { finder: "//input[@name='disclaimFda'][@value='on'][@id='disF']",              type: "check",  checked: true },
    { finder: "//input[@name='disclaimEpa'][@value='on'][@id='disE']",              type: "check",  checked: true },
    { finder: "//input[@name='disclaimAphis'][@value='on'][@id='disA']",            type: "check",  checked: true },
    { finder: "//input[@name='disclaimNhtsa'][@value='on'][@id='disN']",            type: "check",  checked: true },
    { finder: "//input[@name='disclaimAmsOrganic'][@value='on'][@id='disAmsOrg']",  type: "check",  checked: true },

    { finder: "//select[@name='disclaimEpaReason'][@id='disEpaR']",
      type: "select", value: "A - Product is not regulated by this agency" },
    { finder: "//select[@name='disclaimAphisReason'][@id='disAphisR']",
      type: "select", value: "A - Product is not regulated by this agency" },
    { finder: "//select[@name='disclaimEpaProgramCode'][@id='disEpaPC']",
      type: "select", value: "PS2 - Pesticides - Devices" },
    { finder: "//select[@name='disclaimAphisProgramCode'][@id='disAphisPC']",
      type: "select", value: "APQ - Plant Protection/Quarantine" },
    { finder: "//select[@name='disclaimAmsOrganicProgramCode'][@id='disAmsOrgPC']",
      type: "select", value: "OR1 - Identify Certified Organic Products" }
  ];

  const $x = (xp, ctx = document) =>
    document.evaluate(xp, ctx, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue || null;

  const norm = (s) => String(s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  const token = (s) => { const n = norm(s); const i = n.indexOf(" - "); return i>0 ? n.slice(0,i) : n; };

  const fireChange = (el) => {
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
  };

  function ensureChecked(el, desired) {
    const isToggle = el && el.tagName === 'INPUT' && /checkbox|radio/i.test(el.type || '');
    if (!isToggle) return false;
    if (el.checked !== desired) {
      el.checked = desired;
      fireChange(el);
    } else {
      fireChange(el);
    }
    return true;
  }

  function setSelectSmart(selectEl, targetRaw) {
    const t = norm(targetRaw);
    const tTok = token(t);
    const opts = Array.from(selectEl.options).map(o => ({
      el:o, text:norm(o.text), val:norm(o.value), tok:token(norm(o.text))
    }));
    let hit = opts.find(o => o.text === t)
           ||  opts.find(o => o.val  === t)
           ||  (tTok && (opts.find(o => o.tok === tTok) || opts.find(o => o.val === tTok)))
           ||  opts.find(o => o.text.includes(t) || o.val.includes(t));
    if (!hit) return false;
    selectEl.value = hit.el.value;
    hit.el.selected = true;
    fireChange(selectEl);
    return true;
  }

  function selectWhenReady(selectEl, value, timeoutMs = 15000) {
    const ready = () => !selectEl.disabled && selectEl.options && selectEl.options.length > 0;
    return new Promise(resolve => {
      if (ready()) { resolve(setSelectSmart(selectEl, value)); return; }
      const obs = new MutationObserver(() => {
        if (ready()) { const ok = setSelectSmart(selectEl, value); obs.disconnect(); resolve(ok); }
      });
      obs.observe(selectEl, { attributes: true, childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(setSelectSmart(selectEl, value)); }, timeoutMs);
    });
  }

  function applyOnce() {
    for (const a of ACTIONS.filter(z => z.type === 'check')) {
      const el = $x(a.finder);
      if (el) ensureChecked(el, !!a.checked);
    }
    for (const a of ACTIONS.filter(z => z.type === 'select')) {
      const el = $x(a.finder);
      if (el) selectWhenReady(el, a.value);
      else {
        const obs = new MutationObserver(() => {
          const found = $x(a.finder);
          if (found) { obs.disconnect(); selectWhenReady(found, a.value); }
        });
        obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
        setTimeout(() => obs.disconnect(), 15000);
      }
    }
  }

  function enforceFor(durationMs = 3000) {
    const start = Date.now();
    const obs = new MutationObserver(() => {
      for (const a of ACTIONS.filter(z => z.type === 'check')) {
        const el = $x(a.finder);
        if (el) ensureChecked(el, !!a.checked);
      }
      if (Date.now() - start > durationMs) obs.disconnect();
    });
    obs.observe(document.documentElement || document.body, { attributes: true, childList: true, subtree: true });
    const t = setInterval(() => {
      for (const a of ACTIONS.filter(z => z.type === 'check')) {
        const el = $x(a.finder);
        if (el) ensureChecked(el, !!a.checked);
      }
      if (Date.now() - start > durationMs) clearInterval(t);
    }, 200);
  }

  applyOnce();
  enforceFor(3000);

  let last = 0;
  const obsPage = new MutationObserver(() => {
    const now = Date.now();
    if (now - last < 600) return;
    last = now;
    applyOnce();
  });
  obsPage.observe(document.documentElement || document.body, { childList: true, subtree: true });

})();
