// ==UserScript==
// @name         NETCHB Lacey Act Auto Disclaim 点击（自动更新版）
// @namespace    tommy.tools
// @version      1.4.0
// @description  Detect 'PGA: Lacey Act' row and auto-click (Un)Disclaim; then auto-select related <select id="odr<ID>"> option[2].
// @match        https://www.netchb.com/app/entry/line/processLineItemValue.do*
// @match        https://www.netchb.com/app/entry/line/processLineItem.do*
// @run-at       document-idle
// @grant        GM_log
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/lacey_act_auto_disclaim.user.js
// @downloadURL  https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/lacey_act_auto_disclaim.user.js
// ==/UserScript==

(function () {
  'use strict';

  const AUTO_CLICK = true;
  const CLICK_DELAY_MS = 80;
  const USE_XPATH_FALLBACK = true;
  const XPATH_FALLBACK = '//*[@id="livF"]/table[3]/tbody/tr[7]/td/table/tbody/tr[1]/td[2]/input';
  const AFTER_CLICK_DELAY_MS = 120;

  const LOG_TAG = '[LaceyActDetector]';
  let reported = false;
  let clicked = false;

  const log = (...args) => { try { GM_log?.(args.join(' ')); } catch (_) {} console.log(...args); };

  function banner(message, ok = true) {
    const id = 'lacey-act-detector-banner';
    const existed = document.getElementById(id);
    const el = existed || document.createElement('div');
    el.id = id;
    el.textContent = (ok ? '✅ ' : '⚠️ ') + message;
    el.setAttribute('role', 'status');
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '2147483647',
      right: '16px',
      bottom: '16px',
      padding: '10px 12px',
      background: ok ? 'rgba(22,163,74,0.95)' : 'rgba(234,179,8,0.95)',
      color: '#fff',
      fontSize: '14px',
      borderRadius: '10px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
      maxWidth: '520px',
      lineHeight: '1.4',
      cursor: 'default'
    });
    if (!existed) document.documentElement.appendChild(el);
    clearTimeout(el.__tm);
    el.__tm = setTimeout(() => el.remove(), 6000);
  }

  const textNormalize = (s) => (s || '').replace(/\s+/g, ' ').trim();

  function matchTargetRow(tr) {
    if (!(tr instanceof HTMLElement)) return false;
    if (!tr.matches('tr.ogaTitle')) return false;

    const style = (tr.getAttribute('style') || '').toLowerCase().replace(/\s/g, '');
    if (!style.includes('vertical-align:top')) return false;

    const tds = tr.querySelectorAll('td');
    if (tds.length < 2) return false;

    const td1 = tds[0];
    const td1Style = (td1.getAttribute('style') || '').toLowerCase().replace(/\s/g, '');
    const td1Text = textNormalize(td1.textContent);
    if (!td1Text.startsWith('PGA: Lacey Act')) return false;
    if (!td1Style.includes('width:250px')) return false;

    const td2 = tds[1];
    const btn = td2.querySelector('input[type="button"][value="Disclaim"], input[type="button"][value="Undisclaim"]');
    if (!btn) return false;

    return true;
  }

  function findTargetRow(root = document) {
    const candidates = root.querySelectorAll('tr.ogaTitle');
    for (const tr of candidates) if (matchTargetRow(tr)) return tr;

    const textHits = Array.from(root.querySelectorAll('tr')).filter(tr => /PGA:\s*Lacey\s*Act/i.test(textNormalize(tr.textContent)));
    for (const tr of textHits) if (matchTargetRow(tr)) return tr;

    return null;
  }

  function xpathFindFirst(xpath, context = document) {
    try {
      const r = document.evaluate(xpath, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return r.singleNodeValue || null;
    } catch (e) {
      console.warn(LOG_TAG, 'XPath error:', e);
      return null;
    }
  }

  function selectReasonByIdStr(idStr) {
    if (!idStr) return false;
    const sel = document.getElementById('odr' + idStr);
    if (!(sel instanceof HTMLSelectElement)) return false;
    if (sel.options.length >= 2) {
      sel.selectedIndex = 1; // option[2]
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      log(LOG_TAG, '已选择 odr' + idStr + ' 的 option[2]');
      banner('已选择下拉：#odr' + idStr + ' → 第2项', true);
      return true;
    }
    return false;
  }

  function waitAndSelectReason(idStr, timeoutMs = 8000) {
    if (selectReasonByIdStr(idStr)) return;
    const t0 = Date.now();
    const obs = new MutationObserver(() => {
      if (selectReasonByIdStr(idStr) || (Date.now() - t0) > timeoutMs) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), timeoutMs + 200);
  }

  function activateDisclaim(btn) {
    if (!btn) return { ok: false, idStr: null, mode: null };

    let idStr = null, mode = null;
    try {
      const attr = btn.getAttribute('onclick') || '';
      const m = attr.match(/disclaim\((\d+)\s*,\s*(0|1)\)/i);
      if (m) { idStr = m[1]; mode = m[2]; }
    } catch (_) {}

    try {
      ['mouseover','mousedown','mouseup','click'].forEach(type => {
        btn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      });
      if (typeof btn.click === 'function') btn.click();
      clicked = true;
      return { ok: true, idStr, mode };
    } catch (_) {}

    try {
      if (typeof btn.onclick === 'function') {
        btn.onclick.call(btn, new MouseEvent('click', { bubbles: true, cancelable: true }));
        clicked = true;
        return { ok: true, idStr, mode };
      }
    } catch (_) {}

    try {
      if (idStr) {
        const x = Number(mode ?? 1);
        if (typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.disclaim === 'function') {
          unsafeWindow.disclaim(Number(idStr), x);
          clicked = true;
          return { ok: true, idStr, mode };
        }
        const s = document.createElement('script');
        s.textContent = "(function(){try{ if(typeof window.disclaim==='function'){ window.disclaim(" + idStr + "," + x + "); } }catch(e){ console.error('[LaceyActDetector]','inject-call error',e); }})();";
        (document.head || document.documentElement).appendChild(s);
        s.remove();
        clicked = true;
        return { ok: true, idStr, mode };
      }
    } catch (e) {
      console.error(LOG_TAG, 'direct-call error:', e);
    }

    return { ok: false, idStr, mode };
  }

  function handleFoundRow(tr) {
    if (reported) return;
    reported = true;

    tr.style.outline = '2px solid #16a34a';
    tr.style.outlineOffset = '2px';
    setTimeout(() => { tr.style.outline = ''; tr.style.outlineOffset = ''; }, 8000);

    log(LOG_TAG, '已找到：PGA: Lacey Act 行', tr);
    banner('已找到：PGA: Lacey Act 行', true);

    if (!AUTO_CLICK || clicked) return;

    const insideBtn = tr.querySelector('input[type="button"][value="Disclaim"], input[type="button"][value="Undisclaim"]');

    const doClick = () => {
      let res = activateDisclaim(insideBtn);
      if (!res.ok && USE_XPATH_FALLBACK) {
        const xpBtn = xpathFindFirst(XPATH_FALLBACK);
        res = activateDisclaim(xpBtn);
      }
      if (res.ok) {
        const { idStr, mode } = res;
        log(LOG_TAG, '已自动点击', insideBtn?.value || '(XPath 按钮)', 'id=', idStr, 'mode=', mode);
        banner('已自动点击 ' + (insideBtn?.value || 'Disclaim') + (idStr ? (' (id=' + idStr + ')') : ''), true);

        // 新增：点击( Un )Disclaim 后，自动选择 #odr<ID> 的第二项
        if (idStr) setTimeout(() => waitAndSelectReason(idStr), AFTER_CLICK_DELAY_MS);
      } else {
        log(LOG_TAG, '未能点击 Disclaim/Undisclaim（可能 isTrusted/沙箱或未找到）');
        banner('未能点击 Disclaim/Undisclaim（可能 isTrusted/沙箱或未找到）', false);
      }
    };

    if (CLICK_DELAY_MS > 0) setTimeout(doClick, CLICK_DELAY_MS);
    else queueMicrotask(doClick);
  }

  function scan(root) {
    if (reported) return;
    const tr = findTargetRow(root);
    if (tr) handleFoundRow(tr);
  }

  function observe() {
    const obs = new MutationObserver(muts => {
      if (reported) return;
      for (const m of muts) {
        if (m.type === 'childList') {
          for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
        } else if (m.type === 'attributes') {
          scan(document);
        }
      }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    const stop = () => { if (reported) obs.disconnect(); else requestAnimationFrame(stop); };
    requestAnimationFrame(stop);
  }

  log(LOG_TAG, '脚本已加载，URL:', location.href);
  scan(document);
  observe();

  window._LaceyActDetector = {
    forceScan: () => scan(document),
    forceClick: () => {
      const tr = findTargetRow(document);
      if (tr) handleFoundRow(tr);
    }
  };
})();
