// ==UserScript==
// @name         NETCHB 行项目工具（顺序开TAB + 快速兜底）
// @namespace    http://tampermonkey.net/
// @version      0.11
// @description  发票页按 LIGHT/DARK 顺序依次在后台新标签打开；明细页检测第2行第2列；新TAB 尽量开在当前TAB右侧
// @match        https://www.netchb.com/app/entry/line/processLineItemValue.do*
// @match        https://www.netchb.com/app/entry/invoice/editInvoice.do?method=viewInvoice&invoiceId*
// @run-at       document-end
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(function () {
    'use strict';

    const href = location.href;
    const FALLBACK_TIMEOUT_MS = 1200; // 超时兜底：1.2 秒

    // ---------- 通用 ----------
    function getElementByXPath(xpath) {
        return document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;
    }

    function showToast(message) {
        const old = document.getElementById('tm-netchb-toast');
        if (old) old.remove();

        const toast = document.createElement('div');
        toast.id = 'tm-netchb-toast';
        toast.textContent = message;

        Object.assign(toast.style, {
            position: 'fixed',
            right: '24px',
            bottom: '24px',
            maxWidth: '380px',
            padding: '12px 18px',
            background: '#FFC107',
            color: '#000',
            fontSize: '14px',
            lineHeight: '1.4',
            borderRadius: '999px',
            fontFamily: 'system-ui, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: '99999',
            pointerEvents: 'none',
            opacity: '0',
            transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
            transform: 'translateY(10px)'
        });

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 400);
        }, 2000);
    }

    // ---------- ① 明细页逻辑 ----------
    let lineWatcherStarted = false;

    function watchLineItemPage() {
        if (lineWatcherStarted) return;
        lineWatcherStarted = true;

        const targetXPath = '//*[@id="linesBdy"]/tr[2]/td[2]';

        let tries = 0;
        const maxTries = 20;
        const intervalMs = 300;

        const timer = setInterval(() => {
            tries++;
            const el = getElementByXPath(targetXPath);

            if (el) {
                clearInterval(timer);
                showToast('✅ 已检测到：linesBdy 第 2 行第 2 列（明细页）');
            }

            if (tries >= maxTries) {
                clearInterval(timer);
                showToast('⚠️ 未在限定次数内检测到指定单元格');
            }
        }, intervalMs);
    }

    // 明细页加载完成向父TAB发信号
    if (href.includes('processLineItemValue.do')) {
        GM_setValue('netchb_child_loaded', Date.now());
    }

    // ---------- ② 发票页顺序开 TAB ----------
    let queue = [];
    let queueIndex = 0;
    let sequenceRunning = false;
    let waitingForChild = false;
    let childTimeout = null;

    function clearChildTimeout() {
        if (childTimeout !== null) {
            clearTimeout(childTimeout);
            childTimeout = null;
        }
    }

    function buildQueueFromTable() {
        const tbody = document.getElementById('linesBdy');
        if (!tbody) {
            showToast('⚠️ 未找到 linesBdy 表格');
            return [];
        }

        const rows = tbody.querySelectorAll('tr.light, tr.dark');
        const urls = [];

        rows.forEach((row, idx) => {
            const link = row.querySelector('td:nth-of-type(2) a');
            if (link && link.href) {
                urls.push({
                    href: link.href,
                    index: idx + 1,
                    className: row.classList.contains('dark') ? 'dark' : 'light'
                });
            }
        });

        return urls;
    }

    function openNextInQueue() {
        clearChildTimeout();

        if (queueIndex >= queue.length) {
            sequenceRunning = false;
            waitingForChild = false;
            showToast('✅ 所有 LIGHT/DARK 行链接已按顺序在后台打开完成');
            return;
        }

        const item = queue[queueIndex];
        queueIndex += 1;
        waitingForChild = true;

        // ★ 关键：active:false 后台打开；insert:true 要求在当前 TAB 右侧；setParent:true 关闭子TAB后回到父TAB
        GM_openInTab(item.href, {
            active: false,
            insert: true,
            setParent: true
        });

        showToast(
            `✅ 已打开第 ${queueIndex}/${queue.length} 个链接（行 ${item.index}，${item.className.toUpperCase()}），等待该 TAB…`
        );

        // 兜底：1.2 秒后没收到“加载完成”也继续
        childTimeout = setTimeout(() => {
            if (!sequenceRunning || !waitingForChild) return;
            waitingForChild = false;
            showToast('⏱ 超时，自动打开下一个链接');
            openNextInQueue();
        }, FALLBACK_TIMEOUT_MS);
    }

    function startInvoiceSequence() {
        if (sequenceRunning) {
            showToast('脚本已在运行中，请稍候…');
            return;
        }

        queue = buildQueueFromTable();
        if (!queue.length) {
            showToast('⚠️ 未找到任何可用的 LIGHT/DARK 行链接');
            return;
        }

        sequenceRunning = true;
        queueIndex = 0;
        openNextInQueue();
    }

    // 只在发票页监听子 TAB 的“加载完成”信号
    if (href.includes('editInvoice.do?method=viewInvoice')) {
        GM_addValueChangeListener('netchb_child_loaded', function (name, oldValue, newValue, remote) {
            if (!remote) return;
            if (!sequenceRunning || !waitingForChild) return;

            waitingForChild = false;
            clearChildTimeout();
            setTimeout(openNextInQueue, 100);
        });
    }

    // ---------- ③ 右上角按钮 ----------
    function createStartButton() {
        if (document.getElementById('tm-netchb-start-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'tm-netchb-start-btn';
        btn.textContent = '运行脚本';

        Object.assign(btn.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            padding: '6px 14px',
            background: '#1976D2',
            color: '#fff',
            border: 'none',
            borderRadius: '16px',
            fontSize: '13px',
            cursor: 'pointer',
            zIndex: '99999',
            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            opacity: '0.85',
            fontFamily: 'system-ui, sans-serif'
        });

        btn.addEventListener('mouseenter', () => (btn.style.opacity = '1'));
        btn.addEventListener('mouseleave', () => (btn.style.opacity = '0.85'));

        btn.addEventListener('click', () => {
            if (href.includes('processLineItemValue.do')) {
                watchLineItemPage();
                showToast('▶️ 已启动：明细页 XPATH 检测');
            } else if (href.includes('editInvoice.do?method=viewInvoice')) {
                startInvoiceSequence();
            } else {
                showToast('当前页面不在脚本支持的 URL 列表中');
            }
        });

        document.body.appendChild(btn);
    }

    createStartButton();
})();
