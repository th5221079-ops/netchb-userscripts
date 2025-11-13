// ==UserScript==
// @name         NETCHB Invoice Empty Checker (Row2 Col5 & Row5 Col3)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Check if Row 2 Col 5 and Row 5 Col 3 are empty on NETCHB invoice page; highlight red if empty, no highlight if not empty.
// @author       ChatGPT
// @match        https://www.netchb.com/app/entry/invoice*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const XPATH_ROW2_COL5 = '//*[@id="bodyDiv"]/div[4]/div[2]/table/tbody/tr[2]/td[5]';
    const XPATH_ROW5_COL3 = '//*[@id="bodyDiv"]/div[4]/div[2]/table/tbody/tr[5]/td[3]';

    function getNodeByXPath(xpath) {
        const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        );
        return result.singleNodeValue;
    }

    function highlightCell(cell, bgColor, outline) {
        if (!cell) return;
        cell.style.outline = outline;
        cell.style.backgroundColor = bgColor;
        cell.style.transition = 'background-color 0.3s ease, outline 0.3s ease';
    }

    function checkEmptyAndHighlight(xpath, logLabel) {
        const cell = getNodeByXPath(xpath);
        if (cell) {
            const text = (cell.textContent || '').trim();
            if (text === '') {
                // 没有数据，高亮红色提醒
                highlightCell(cell, 'lightcoral', '3px solid red');
                cell.title = logLabel + ' is EMPTY';
                console.log('[Tampermonkey]', logLabel, 'is empty, highlighted in red.');
            } else {
                // 有数据则不做任何高亮
                console.log('[Tampermonkey]', logLabel, 'has value:', text);
            }
        }
        return !!cell;
    }

    function run() {
        let foundAny = false;

        // 检测第二行第 5 列：空则高亮红色，有内容则不高亮
        if (checkEmptyAndHighlight(XPATH_ROW2_COL5, 'Row2 Col5')) {
            foundAny = true;
        }

        // 检测第五行第 3 列：空则高亮红色，有内容则不高亮
        if (checkEmptyAndHighlight(XPATH_ROW5_COL3, 'Row5 Col3')) {
            foundAny = true;
        }

        return foundAny;
    }

    // 先尝试执行一次
    if (run()) {
        return;
    }

    // 页面可能是动态加载的，监听 DOM 变化
    const observer = new MutationObserver(() => {
        if (run()) {
            observer.disconnect();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
