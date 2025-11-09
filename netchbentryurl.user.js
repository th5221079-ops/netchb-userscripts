// ==UserScript==
// @name         NETCHB 显示末7位（复制为超链接）
// @namespace    https://netchb-helper.local
// @version      1.4.0
// @description  右上角显示“7位数字”（外观数字=链接）；复制时把剪贴板写成富格式超链接（显示7位数字、目标为URL）
// @match        https://www.netchb.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // 信息提取URL模板：{ENTRY_NO} 为占位符
  const LINK_TEMPLATE =
    'https://www.netchb.com/app/entry/isf.do?filerCode=EMF&entryNo={ENTRY_NO}';

  if (window.__netchb_last7_inited__) return;
  window.__netchb_last7_inited__ = true;

  const url = new URL(location.href);
  if (!url.pathname.includes('/app/entry/viewEntry.do')) return;

  // 提取 URL 中的末7位数字（优先 entryNo 参数）
  const entryNo = (url.searchParams.get('entryNo') || '').trim();
  let last7 = '';
  if (entryNo) last7 = entryNo.replace(/\D+/g, '').slice(-7);
  if (!last7) {
    const m = location.href.match(/(\d{7})(?!.*\d)/);
    last7 = m ? m[1] : '';
  }
  if (!last7) return;

  const infoUrl = LINK_TEMPLATE.replace('{ENTRY_NO}', last7);

  // UI：右上角悬浮框
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '999999',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '14px',
    padding: '8px 10px',
    background: 'rgba(0,0,0,0.78)',
    color: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const label = document.createElement('span');
  label.textContent = 'URL末7位：';

  // 看起来是数字，实际上是链接
  const link = document.createElement('a');
  link.textContent = last7;
  link.href = infoUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  Object.assign(link.style, {
    color: '#4FC3F7',
    textDecoration: 'underline',
    fontWeight: 'bold',
    cursor: 'pointer',
    userSelect: 'text',
  });
  link.title = infoUrl;

  // ——复制为“富格式超链接”：显示文本=7位数字，目标=URL——
  // 1) 选择该数字后按 Ctrl/Cmd+C
  link.addEventListener('copy', (e) => {
    writeClipboardAsRichLink(e, last7, infoUrl);
  });
  // 2) 某些浏览器不触发 <a> 的 copy，兜底到文档级
  document.addEventListener('copy', (e) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const node = sel.getRangeAt(0).commonAncestorContainer;
    if (link.contains(node instanceof Node ? node : document.body)) {
      writeClipboardAsRichLink(e, last7, infoUrl);
    }
  });

  // 复制按钮：直接把剪贴板写成“富格式超链接”
  const copyBtn = document.createElement('button');
  copyBtn.textContent = '复制(超链接)';
  styleBtn(copyBtn);
  copyBtn.title = '复制为富格式：显示7位数字，实际为URL';
  copyBtn.addEventListener('click', async () => {
    const ok = await copyRichLink(last7, infoUrl);
    flash(copyBtn, ok ? '已复制' : '复制失败');
  });

  // 关闭
  const closeBtn = document.createElement('span');
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, {
    marginLeft: '4px',
    opacity: '0.8',
    fontWeight: 'bold',
    cursor: 'pointer',
  });
  closeBtn.title = '关闭';
  closeBtn.addEventListener('click', () => box.remove());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F10') box.remove();
  });

  box.appendChild(label);
  box.appendChild(link);
  box.appendChild(copyBtn);
  box.appendChild(closeBtn);
  document.documentElement.appendChild(box);

  // ========= 工具函数 =========
  function styleBtn(btn) {
    Object.assign(btn.style, {
      background: 'transparent',
      color: '#ddd',
      border: '1px solid rgba(255,255,255,0.25)',
      borderRadius: '6px',
      padding: '2px 6px',
      cursor: 'pointer',
    });
  }

  function flash(btn, text) {
    const old = btn.textContent;
    btn.textContent = text;
    setTimeout(() => (btn.textContent = old), 1200);
  }

  // 将 copy 事件写为富格式链接
  function writeClipboardAsRichLink(e, displayText, urlText) {
    try {
      const html = `<a href="${urlText}">${escapeHtml(displayText)}</a>`;
      e.clipboardData.setData('text/html', html);   // 富格式（适配多数字处理器/邮件/文档）
      e.clipboardData.setData('text/plain', displayText); // 回退：只显示文本
      // 可选：也放入 URI（有的应用会识别成可点击链接）
      e.clipboardData.setData('text/uri-list', urlText);
      e.preventDefault();
    } catch { /* ignore */ }
  }

  // 主动复制为富格式（按钮使用）
  async function copyRichLink(displayText, urlText) {
    const html = `<a href="${urlText}">${escapeHtml(displayText)}</a>`;
    const plain = displayText;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/uri-list': new Blob([urlText], { type: 'text/uri-list' }),
        });
        await navigator.clipboard.write([item]);
        return true;
      }
    } catch { /* fallthrough */ }

    // 兼容回退：使用隐藏的 contenteditable + execCommand
    try {
      const helper = document.createElement('div');
      helper.contentEditable = 'true';
      helper.style.position = 'fixed';
      helper.style.left = '-99999px';
      helper.innerHTML = html;
      document.body.appendChild(helper);
      const range = document.createRange();
      range.selectNodeContents(helper);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      const ok = document.execCommand('copy');
      document.body.removeChild(helper);
      sel.removeAllRanges();
      return ok;
    } catch {
      return false;
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
})();
