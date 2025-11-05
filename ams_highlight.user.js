// ==UserScript==
// @name         Netchb AMS query 数据高亮
// @name:zh-CN   Netchb AMS query 数据高亮
// @namespace    http://tampermonkey.net/
// @version      2.9
// @description  在 netchb.com 或 descartes.com 框架的 viewTransmission 页面上高亮显示您指定的关键词（支持动态内容）。
// @description:zh-CN 在 netchb.com 或 descartes.com 框架的 viewTransmission 页面上高亮显示您指定的关键词（支持动态内容）。
// @author       Your Name
// @match        https://www.netchb.com/app/transmissions/*
// @match        *://*.descartes.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/ams_highlight.user.js
// @downloadURL  https://raw.githubusercontent.com/th5221079-ops/th5221079-ops/main/ams_highlight.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 用户配置 ---
    const keywordsToHighlight = [
        "2H - CBPA MISC HOLD PLACED", // 新增关键词
        "ISF on File: NO", // 新增关键词
        "4A - OVERRIDE TO INTENSIVE",
        "1H - CBP HOLD PLACED AT PORT OF DISCHARGE",
        "5H - ENTRY PROCESSING HOLD",
        "7H - NON-INTRUSIVE INSPECTION HOLD",
    ];
    // --- 配置结束 ---

    // --- 调试日志标记 (v2.5) ---
    let debugLoopFired = false;
    let debugTextNodeFound = false;
    let debugShadowDomFound = false;
    // --- 调试标记结束 ---


    console.warn(`Netchb 高亮脚本 (v2.9) 启动... 运行在: ${window.location.href}`);
    console.warn("Netchb 高亮脚本 (v2.9): 运行在 @grant none 模式 (行内样式)。");


    // 将关键词编译为正则表达式
    if (keywordsToHighlight.length === 0) return;
    const escapedKeywords = keywordsToHighlight
        .filter(kw => kw.trim() !== "")
        .map(kw => kw.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1"));
    if (escapedKeywords.length === 0) return;
    const combinedRegex = new RegExp(escapedKeywords.join('|'), 'gi');


    /**
     * 递归遍历DOM节点，查找并高亮文本
     * @param {Node} node - 当前节点
     * @param {RegExp} regex - 要匹配的正则表达式
     */
    function walkAndHighlight(node, regex) {
        // 排除的标签名
        const excludeTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'IFRAME'];

        if (node.nodeType === Node.TEXT_NODE) { // 3 = 文本节点
            const text = node.nodeValue;

            // --- 调试日志 (v2.5) ---
            if (!debugTextNodeFound && text.trim().length > 0) {
                // console.warn(`Netchb 高亮脚本 (v2.9): 正在检查第一个文本节点: "${text.substring(0, 100).trim()}..."`);
                debugTextNodeFound = true;
            }
            // --- 调试日志结束 ---

            regex.lastIndex = 0; // 重置正则表达式的 lastIndex
            if (regex.test(text)) {

                // --- 调试日志 (v2.5) ---
                // console.warn(`Netchb 高亮脚本 (v2.9): 找到匹配文本！在: "${text.substring(0, 100).trim()}..."`);
                // --- 调试日志结束 ---

                const parent = node.parentNode;

                // 使用自定义属性检查是否已高亮，而不是 CSS class
                if (parent && parent.getAttribute('data-gm-highlighted') === 'true') {
                    return; // 防止在已高亮的节点内重复高亮
                }

                // --- 关键修正 v2.6: 修复拼写错误 ---
                const fragment = document.createDocumentFragment();
                // --- 修正结束 ---

                let lastIndex = 0;
                text.replace(regex, (match, offset) => {
                    const beforeText = text.substring(lastIndex, offset);
                    if (beforeText) {
                        fragment.appendChild(document.createTextNode(beforeText));
                    }
                    const highlightSpan = document.createElement('span');

                    // 直接应用行内样式
                    highlightSpan.style.backgroundColor = '#FFFF00';
                    highlightSpan.style.color = '#000000';
                    highlightSpan.style.fontWeight = 'bold';
                    highlightSpan.style.padding = '1px 3px';
                    highlightSpan.style.borderRadius = '3px';
                    highlightSpan.style.boxShadow = '0 0 5px rgba(255, 255, 0, 0.7)';
                    highlightSpan.setAttribute('data-gm-highlighted', 'true'); // 设置标记

                    highlightSpan.textContent = match;
                    fragment.appendChild(highlightSpan);
                    lastIndex = offset + match.length;
                });
                const afterText = text.substring(lastIndex);
                if (afterText) {
                    fragment.appendChild(document.createTextNode(afterText));
                }

                if (parent) {
                    parent.replaceChild(fragment, node);
                }
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) { // 1 = 元素节点
            if (excludeTags.includes(node.tagName.toUpperCase())) {
                return; // 不搜索特定标签
            }

            // 检查并遍历 Shadow DOM
            if (node.shadowRoot) {
                // --- 调试日志 (v2.5) ---
                if (!debugShadowDomFound) {
                    console.warn(`Netchb 高亮脚本 (v2.9): 发现 Shadow DOM (在 <${node.tagName.toLowerCase()}>)，进入遍历...`);
                    debugShadowDomFound = true;
                }
                // --- 调试日志结束 ---
                walkAndHighlight(node.shadowRoot, regex);
            }

            const children = Array.from(node.childNodes);
            for (const child of children) {
                walkAndHighlight(child, regex);
            }
        }
    }

    // --- 脚本主程序 ---

    if (!document.body) {
        console.error("Netchb 高亮脚本 (v2.9)：document-idle 触发时 document.body 不存在！脚本停止。");
        return;
    }

    // --- 关键改动 v2.7: 立即执行第一次扫描 ---
    // 1. 立即执行一次扫描，以便“及时显示”
    console.warn("Netchb 高亮脚本 (v2.9): 'document-idle' 触发。立即执行第一次扫描...");
    walkAndHighlight(document.body, combinedRegex);

    // 2. 启动 'setInterval' 轮询器，以捕捉后续的动态内容
    console.warn("Netchb 高亮脚本 (v2.9): 启动 'setInterval' 轮询器...");

    setInterval(() => {
        // --- 调试日志 (v2.5) ---
        if (!debugLoopFired) {
            console.warn("Netchb 高亮脚本 (v2.9): 轮询器 (setInterval) 正在运行...");
            debugLoopFired = true; // 只打印一次
        }
        // --- 调试日志结束 ---
        walkAndHighlight(document.body, combinedRegex);
    }, 1500); // 每 1.5 秒扫描一次
    // --- 改动结束 ---

})();
