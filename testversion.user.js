// ==UserScript==
// @name         GitHub 自动更新测试脚本
// @namespace    http://tampermonkey.net/
// @version      1.0.1  // <-- 每次更新时必须增大这个版本号！
// @description  测试油猴脚本的自动更新功能
// @author       Gemini Helper
// @match        https://www.google.com/*
// @grant        none
//
// ** 以下是根据您的 GitHub 路径设置的原始文件链接，用于自动更新检查 **
// @updateURL    https://raw.githubusercontent.com/th5221079-ops/netchb-userscripts/main/testversion
// @downloadURL  https://raw.githubusercontent.com/th5221079-ops/netchb-userscripts/main/testversion
//
// ==/UserScript==

(function() {
    'use strict';
    
    // 确保DOM准备就绪再执行
    setTimeout(function() {
        console.log("--- 油猴脚本执行 ---");
        
        // ** 这个日志和显示的版本号需要与 @version 一致，便于测试 **
        const currentVersion = '1.0.0'; 
        console.log(`当前脚本版本: ${currentVersion}`); 
        
        // 在页面左上角显示一条消息
        const div = document.createElement('div');
        div.textContent = `【Gemini自动更新测试】V${currentVersion} 脚本已成功加载！`;
        div.style.cssText = 'position: fixed; top: 10px; left: 10px; background: green; color: white; padding: 5px; z-index: 9999;';
        document.body.appendChild(div);

    }, 1000); 

})();
