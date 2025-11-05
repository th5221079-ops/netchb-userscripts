// ==UserScript==
// @name         下载 DO 处理+保存（瞬时触发版）
// @namespace    https://netchb.com/
// @version      1.2.0
// @description  进入编辑DO页面即刻执行：点击/填值；若元素稍后出现则一出现立即执行
// @match        https://www.netchb.com/app/entry/editDeliveryOrder.do*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // —— 来自 JSON 的动作映射（保持你的 XPath 与值）——
  const ACTIONS = [
    { finder: "//input[@name='collect_prepaid'][@value='Collect'][@id='collect']", type: "click" }, // MouseEvents::click
    { finder: "//*[@id='doForm']/div[1]/div[2]/table[1]/tbody/tr[1]/td/input",type: "input", value: " " },
    { finder: "//*[@id='doForm']/div[1]/div[2]/table[1]/tbody/tr[2]/td/input",type: "input", value: " " },
    { finder: "//textarea[@name='doNote'][@cols='70'][@rows='5'][@id='nte']",type: "input", value: " " },
    { finder: "//*[@id='svch']",type: "click" }// MouseEvents::click
  ];

  // —— XPath & 事件工具 ——
  const $x = (xpath, ctx = document) =>
    document.evaluate(xpath, ctx, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue || null;

  const fireAll = (el) => {
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
  };

  const clickFast = (el) => {
    // 追求速度：直接 click 即可（多数站点足够）
    el.click();
  };

  const setValueFast = (el, val) => {
    const v = String(val ?? '');
    if ('value' in el) {
      el.value = v;
      fireAll(el); // 触发框架监听
    } else {
      el.textContent = v;
    }
  };

  // —— 核心：立即执行 + 出现即执行 ——
  const executed = new WeakSet();  // 防重复同元素
  const doneByFinder = new Set();  // 防重复同动作

  function execIfFound(act, root = document) {
    if (doneByFinder.has(act.finder)) return true;
    const el = $x(act.finder, root);
    if (!el || executed.has(el)) return false;

    try {
      if (act.type === 'click') {
        clickFast(el);
      } else if (act.type === 'input') {
        setValueFast(el, act.value);
      }
      executed.add(el);
      doneByFinder.add(act.finder);
      return true;
    } catch (e) {
      console.warn('[DO 瞬时脚本] 执行失败：', act.finder, e);
      return false;
    }
  }

  function runInstant() {
    // 1) 先对现有 DOM 立即执行一遍（尽可能瞬时完成）
    for (const act of ACTIONS) execIfFound(act);

    // 2) 对尚未完成的动作，挂观察器：目标一出现立即执行，然后自动停止
    const pending = ACTIONS.filter(a => !doneByFinder.has(a.finder));
    if (pending.length === 0) return; // 全部已就绪

    const obs = new MutationObserver((muts) => {
      // 小幅防抖：有大量变更时也只尝试一次扫描
      let any = false;
      for (const act of pending) {
        if (!doneByFinder.has(act.finder)) {
          any = execIfFound(act) || any;
        }
      }
      // 若都完成了就撤销观察
      if (ACTIONS.every(a => doneByFinder.has(a.finder))) {
        obs.disconnect();
      }
    });

    // 监听整个文档，确保子树变化能捕获到目标节点生成
    obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }

  // 首次与 SPA 变更（极简防抖）
  let armed = false;
  function arm() {
    if (armed) return;
    armed = true;
    runInstant();

    // 继续监听整体 DOM，若有大变更（例如路由或模块重渲染）则再“瞬时执行”一次
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
