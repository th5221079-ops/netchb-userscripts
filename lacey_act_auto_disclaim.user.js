// ==UserScript==
// @name         NETCHB Lacey Act Auto Disclaim（未完成可重复尝试，选A后停止）
// @namespace    tommy.tools
// @version      1.4.3
// @description  仅当“未完成”（未按 Disclaim 或未选 A）时才执行一次流程；完成后（选到 A）在当前页面停止后续动作并拦截任何再次切换。
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

  const LOG = (...a)=>{ try{GM_log?.(a.join(' '))}catch{} console.log('[LaceyAct]', ...a)};
  const banner=(m,ok=true)=>{ const id='lacey-banner'; let el=document.getElementById(id);
    if(!el){ el=document.createElement('div'); el.id=id; document.documentElement.appendChild(el); }
    el.textContent=(ok?'✅ ':'⚠️ ')+m; Object.assign(el.style,{position:'fixed',right:'16px',bottom:'16px',background:ok?'#16a34a':'#eab308',color:'#fff',padding:'10px 12px',borderRadius:'10px',zIndex:2147483647,boxShadow:'0 4px 12px rgba(0,0,0,.25)'});
    clearTimeout(el.__tm); el.__tm=setTimeout(()=>el.remove(),5000);
  };
  const norm = s=>String(s||'').replace(/\s+/g,' ').trim();

  function isTargetTr(tr){
    if(!(tr instanceof HTMLElement)) return false;
    if(!tr.matches('tr.ogaTitle')) return false;
    const tds = tr.querySelectorAll('td'); if(tds.length<2) return false;
    const leftText = norm(tds[0]?.textContent);
    const leftStyle = norm((tds[0]?.getAttribute('style')||'').toLowerCase().replace(/\s/g,''));
    if(!leftText.startsWith('PGA: Lacey Act')) return false;
    if(!leftStyle.includes('width:250px')) return false;
    const btn = tr.querySelector('input[type="button"][value="Disclaim"], input[type="button"][value="Undisclaim"]');
    return !!btn;
  }

  function findTargetTr(){
    for(const tr of document.querySelectorAll('tr.ogaTitle')) if(isTargetTr(tr)) return tr;
    for(const tr of document.querySelectorAll('tr')) if(/PGA:\s*Lacey\s*Act/i.test(norm(tr.textContent)) && isTargetTr(tr)) return tr;
    return null;
  }

  // 完成标记：一旦选择到 A，则在当前页面会话内阻止后续动作
  function completedKey(idStr){
    return 'lacey_complete:'+location.pathname+location.search+':'+idStr;
  }
  function isCompleted(idStr){
    try{ return sessionStorage.getItem(completedKey(idStr))==='1'; }catch{ return false; }
  }
  function markCompleted(idStr){
    try{ sessionStorage.setItem(completedKey(idStr), '1'); }catch{}
  }

  // 拦截后续切换（防止点回 Undisclaim/再次 Disclaim）
  function installHardStop(idStr){
    const clickBlocker = (e)=>{
      const t = e.target;
      if(!(t instanceof HTMLElement)) return;
      if(t.matches('input[type="button"][value="Undisclaim"], input[type="button"][value="Disclaim"]')){
        const attr = t.getAttribute('onclick')||'';
        if(new RegExp(`disclaim\\(${idStr}\\s*,`).test(attr)){
          e.stopImmediatePropagation(); e.preventDefault();
          LOG('Blocked toggle for id', idStr);
        }
      }
    };
    document.addEventListener('click', clickBlocker, true);

    try{
      if(typeof unsafeWindow!=='undefined' && typeof unsafeWindow.disclaim==='function'){
        if(!unsafeWindow.__lacey_wrap_installed){
          const orig = unsafeWindow.disclaim;
          unsafeWindow.__lacey_block_ids = new Set();
          unsafeWindow.disclaim = function(a,b){
            if(unsafeWindow.__lacey_block_ids && unsafeWindow.__lacey_block_ids.has(String(a))){
              LOG('Swallow window.disclaim for id', a, 'mode', b);
              return;
            }
            return orig.apply(this, arguments);
          };
          unsafeWindow.__lacey_wrap_installed = true;
        }
        unsafeWindow.__lacey_block_ids.add(String(idStr));
      }
    }catch(e){ LOG('wrap disclaim err', e); }
  }

  function getBtnIdMode(btn){
    const oc = btn?.getAttribute('onclick')||'';
    const m = oc.match(/disclaim\((\d+)\s*,\s*(0|1)\)/i);
    return { idStr: m?.[1]||null, mode: m?.[2]||null, value: btn?.value||'' };
  }

  function selectA(idStr){
    const sel = document.getElementById('odr'+idStr);
    if(sel instanceof HTMLSelectElement && sel.options.length>=2){
      if(sel.selectedIndex !== 1){
        sel.selectedIndex = 1; // 第二项（A）
        sel.dispatchEvent(new Event('input',{bubbles:true}));
        sel.dispatchEvent(new Event('change',{bubbles:true}));
      }
      banner('已确保 #odr'+idStr+' 为第2项(A)', true);
      installHardStop(idStr);
      markCompleted(idStr);
      return true;
    }
    return false;
  }

  function waitAndSelectA(idStr, timeoutMs=8000){
    if(selectA(idStr)) return;
    const t0=Date.now();
    const obs=new MutationObserver(()=>{
      if(selectA(idStr) || (Date.now()-t0)>timeoutMs) obs.disconnect();
    });
    obs.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>obs.disconnect(), timeoutMs+200);
  }

  function clickDisclaimIfNeeded(btn){
    const {idStr, value} = getBtnIdMode(btn);
    if(!idStr) return {ok:false,idStr:null};
    // 如果已经是 Undisclaim（代表已 Disclaim），不再点按钮，直接选 A
    if(value==='Undisclaim'){
      LOG('Already Disclaimed for id', idStr, '→ only select A');
      return {ok:true,idStr,skipped:true};
    }
    // value==='Disclaim' 时点击一次
    try{
      btn.click();
      return {ok:true,idStr,skipped:false};
    }catch{}
    try{
      if(typeof unsafeWindow!=='undefined' && typeof unsafeWindow.disclaim==='function'){
        unsafeWindow.disclaim(Number(idStr), 1);
        return {ok:true,idStr,skipped:false};
      }
    }catch(e){ LOG('direct call err',e); }
    try{
      if(typeof btn.onclick==='function'){
        btn.onclick.call(btn, new MouseEvent('click',{bubbles:true,cancelable:true}));
        return {ok:true,idStr,skipped:false};
      }
    }catch{}
    return {ok:false,idStr:null};
  }

  // ===== 主流程 =====
  const tr = findTargetTr();
  if(!tr){ banner('未找到 “PGA: Lacey Act” 行（仅当未完成时才执行）', false); return; }
  tr.style.outline='2px solid #16a34a'; setTimeout(()=>{tr.style.outline=''},3000);

  const btn = tr.querySelector('input[type="button"][value="Disclaim"], input[type="button"][value="Undisclaim"]');
  const info = getBtnIdMode(btn);
  if(!info.idStr){ banner('未能解析行 ID，退出', false); return; }

  // 1) 若已完成（#odr<ID> 已是 A），直接阻止后续任何切换并退出
  const selNow = document.getElementById('odr'+info.idStr);
  if(selNow instanceof HTMLSelectElement && selNow.options.length>=2 && selNow.selectedIndex===1){
    banner('检测到已完成（A 已选择）；停止后续动作', true);
    installHardStop(info.idStr);
    markCompleted(info.idStr);
    return;
  }
  // 若此前已标记完成，也直接退出
  if(isCompleted(info.idStr)){
    banner('本页该项已完成；不再重复', true);
    installHardStop(info.idStr);
    return;
  }

  // 2) 未完成：本次执行一次流程（即使之前已尝试过，只要未完成仍会尝试一次）
  banner('未完成 → 执行一次流程', true);
  const res = clickDisclaimIfNeeded(btn);
  if(!res.ok){ banner('未能触发 Disclaim（将继续尝试选择 A）', false); }

  // 无论是否点击成功，都尝试把 #odr<ID> 选为 A；若下拉稍后出现则等待
  setTimeout(()=> waitAndSelectA(info.idStr), 150);
})();
