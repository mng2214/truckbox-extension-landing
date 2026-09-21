/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
function getSearchTabs(){return Array.from(document.querySelectorAll('[data-test="search-tab-group"] [role="tab"]')).filter(e=>e.getAttribute("aria-disabled")!=="true")}function getActiveTabIndex(e){return e.findIndex(t=>t.getAttribute("aria-selected")==="true")}function moveSearchTab(e){const t=getSearchTabs();if(!t.length){showToast("No tabs found","info");return}const n=getActiveTabIndex(t);if(n<0)return;const r=n+e;if(r<0||r>=t.length)return;const o=t[r];o instanceof HTMLElement&&(o.click(),setTimeout(()=>{datxActiveRowIndex=-1,clearActiveRowHighlight(),scheduleScan(200)},200))}var datxActiveRowIndex=-1,datxActiveRow=null,datxLastNavAt=0,DATX_NAV_INTERVAL_MS=80;function rowHasContactAction(e){if(!(e instanceof Element))return!1;if(e.querySelector(".datx-send")||e.querySelector('a[href^="tel:"]')||e.querySelector('a[href^="mailto:"]'))return!0;const t=getRowDetailsElement(e);if(t){if(t.querySelector(".datx-send")||t.querySelector('a[href^="mailto:"]')||t.querySelector('a[href^="tel:"]'))return!0;const n=(t.innerText||t.textContent||"").trim();if(EMAIL_RE.test(n)||normalizePhoneFromText(n))return!0}return!1}function getVisibleRows(){return Array.from(document.querySelectorAll(ROW_SEL)).filter(e=>!(e instanceof HTMLElement)||e.classList.contains("datx-hidden")||e.offsetParent===null?!1:rowHasContactAction(e))}function isTypingTarget(e){if(!e)return!1;const t=(e.tagName||"").toLowerCase();return t==="input"||t==="textarea"||t==="select"||e.isContentEditable||!!e.closest?.('input, textarea, select, [contenteditable="true"]')}function clearActiveRowHighlight(){document.querySelectorAll(".datx-row-active").forEach(e=>{e.classList.remove("datx-row-active")})}function clampActiveRowIndex(){const e=getVisibleRows();if(!e.length)return datxActiveRowIndex=-1,e;if(datxActiveRow){const t=e.indexOf(datxActiveRow);if(t>=0)return datxActiveRowIndex=t,e}return datxActiveRowIndex<0&&(datxActiveRowIndex=0),datxActiveRowIndex>=e.length&&(datxActiveRowIndex=e.length-1),e}function datxNavActive(){return onDatLoadsPage()&&!!window.TB_ADAPTER&&window.TB_ADAPTER.id==="dat"}function highlightActiveRow(e=!0){if(!datxNavActive())return;clearActiveRowHighlight();const t=getVisibleRows();if(!t.length){datxActiveRowIndex=-1;return}if(datxActiveRow){const r=t.indexOf(datxActiveRow);if(r>=0){datxActiveRowIndex=r,datxActiveRow.classList.add("datx-row-active"),e&&datxActiveRow.scrollIntoView({block:"nearest",behavior:"smooth"});return}if(!e)return}datxActiveRowIndex<0&&(datxActiveRowIndex=0),datxActiveRowIndex>=t.length&&(datxActiveRowIndex=t.length-1);const n=t[datxActiveRowIndex];datxActiveRow=n,n.classList.add("datx-row-active"),e&&n.scrollIntoView({block:"nearest",behavior:"smooth"})}function moveActiveRow(e){const t=clampActiveRowIndex();t.length&&(datxActiveRowIndex===-1?datxActiveRowIndex=0:datxActiveRowIndex+=e,datxActiveRowIndex<0&&(datxActiveRowIndex=0),datxActiveRowIndex>=t.length&&(datxActiveRowIndex=t.length-1,e>0&&window.scrollBy({top:500,behavior:"smooth"})),datxActiveRow=t[datxActiveRowIndex]||null,highlightActiveRow(!0))}function getActiveRow(){const e=clampActiveRowIndex();if(!e.length||datxActiveRowIndex<0)return null;const t=e[datxActiveRowIndex]||null;return datxActiveRow=t,t}function triggerActiveRowSend(){const e=getActiveRow();if(!e)return;const t=getRowDetailsElement(e),n=e.querySelector(".datx-send")||t?.querySelector(".datx-send");if(!n||n.disabled){showToast("No send button available on selected row","info");return}n.click()}function triggerActiveRowMap(){const e=getActiveRow();if(!e)return;const t=getRowDetailsElement(e),n=e.querySelector(".datx-map-btn")||t?.querySelector(".datx-map-btn");if(!n||n.disabled){showToast("No map button available on selected row","info");return}n.click()}function toggleActiveRowDetails(){const e=getActiveRow();if(!e)return;const t=e.querySelector('[data-test="load-pick-up-cell"]')||e.querySelector(".timing-container")||e.querySelector(".table-cell.cell-timing")||e.querySelector('[data-test="load-trip-cell"]')||e.querySelector(".row-cells")||e;t instanceof HTMLElement&&(t.click(),setTimeout(()=>{highlightActiveRow(!1)},80))}(function(){if(document.getElementById("datx-keyboard-nav-style"))return;const t=document.createElement("style");t.id="datx-keyboard-nav-style",t.textContent=`
  .datx-row-active {
    outline: 2px solid #3b82f6 !important;
    outline-offset: -2px !important;
    background: rgba(59,130,246,.06) !important;
    border-radius: 0 !important;
  }
`,document.head.appendChild(t)})();function triggerActiveRowCopy(){const e=document.querySelector(".tb-copy-btn");if(e){e.click();return}datxActiveRowIndex===-1&&(datxActiveRowIndex=0,highlightActiveRow(!0)),toggleActiveRowDetails(),setTimeout(()=>{const t=document.querySelector(".tb-copy-btn");t&&t.click()},650)}function triggerRefreshLoads(){const e=document.querySelector(".tb-refresh-btn");e&&!e.disabled&&e.click()}function clickInActiveDetails(e){const t=document.querySelector(e);if(t){t.click();return}datxActiveRowIndex===-1&&(datxActiveRowIndex=0,highlightActiveRow(!0)),toggleActiveRowDetails();let n=0;const r=()=>{const o=document.querySelector(e);if(o){o.click();return}++n<10&&setTimeout(r,300)};setTimeout(r,400)}function triggerActiveRowRts(){clickInActiveDetails(".tb-rts-holder button")}function triggerActiveRowFmcsa(){clickInActiveDetails(".tb-fmcsa-report")}document.addEventListener("keydown",e=>{if(!datxNavActive()||typeof tbTplMenuOwnsKey=="function"&&tbTplMenuOwnsKey(e))return;const t=(e.target.tagName||"").toLowerCase();if(t==="input"||t==="textarea"||t==="select"||e.target.isContentEditable)return;const n=Date.now(),r=e.code;if(r==="ArrowDown"||r==="ArrowUp"||r==="KeyW"||r==="KeyS"){if(n-datxLastNavAt<DATX_NAV_INTERVAL_MS){e.preventDefault();return}datxLastNavAt=n}if(r==="ArrowDown"||r==="KeyS"){e.preventDefault(),moveActiveRow(1);return}if(r==="ArrowUp"||r==="KeyW"){e.preventDefault(),moveActiveRow(-1);return}if(r==="KeyD"||r==="ArrowRight"){e.preventDefault(),e.stopPropagation(),moveSearchTab(1);return}if(r==="KeyA"||r==="ArrowLeft"){e.preventDefault(),e.stopPropagation(),moveSearchTab(-1);return}if(r==="Space"){e.preventDefault(),datxActiveRowIndex===-1&&(datxActiveRowIndex=0,highlightActiveRow(!0)),toggleActiveRowDetails();return}if(r==="KeyQ"){e.preventDefault(),datxActiveRowIndex===-1&&(datxActiveRowIndex=0,highlightActiveRow(!0)),triggerActiveRowMap();return}if(r==="KeyE"){e.preventDefault(),datxActiveRowIndex===-1&&(datxActiveRowIndex=0,highlightActiveRow(!0)),triggerActiveRowSend();return}if(r==="KeyC"&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault(),triggerActiveRowCopy();return}if(r==="KeyR"&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault(),triggerRefreshLoads();return}if(r==="KeyF"&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault(),triggerActiveRowRts();return}if(r==="KeyI"&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault(),triggerActiveRowFmcsa();return}},!0),document.addEventListener("click",e=>{if(!datxNavActive())return;const t=e.target?.closest?.(ROW_SEL);if(!t)return;const r=getVisibleRows().indexOf(t);r>=0&&(datxActiveRowIndex=r,datxActiveRow=t,highlightActiveRow(!1))},!0);var tsNavRow=null,tsNavLastAt=0,TS_NAV_INTERVAL_MS=180,TS_NAV_ENABLED=!1;function tsNavActive(){return TS_NAV_ENABLED&&onDatLoadsPage()&&!!window.TB_ADAPTER&&window.TB_ADAPTER.id==="truckstop"}function tsNavRows(){var e=typeof tbDeepQueryShadow=="function"?tbDeepQueryShadow(".ts-grid-row"):Array.prototype.slice.call(document.querySelectorAll(".ts-grid-row"));return e.sort(function(t,n){return(parseInt(t.getAttribute("row-index"),10)||0)-(parseInt(n.getAttribute("row-index"),10)||0)}),e}function tsClearNavHighlight(){tsNavRow&&(tsNavRow.style.outline="",tsNavRow.style.outlineOffset="",tsNavRow.style.background="")}function tsHighlightRow(e){tsClearNavHighlight(),tsNavRow=e,e.style.outline="2px solid #b60207",e.style.outlineOffset="-2px",e.style.background="rgba(182,2,7,.06)";try{e.scrollIntoView({block:"nearest"})}catch{}}function tsOpenRowDetails(e){var t=e.querySelector('[col-id="originCity"]')||e.querySelector(".ag-cell:not(.action-cell)")||e;try{t.click()}catch{try{e.click()}catch{}}}function tsMoveActiveRow(e){var t=tsNavRows();if(t.length){var n=tsNavRow?t.indexOf(tsNavRow):-1;n=n<0?e>0?0:t.length-1:n+e,n<0&&(n=0),n>=t.length&&(n=t.length-1);var r=t[n];r&&(tsHighlightRow(r),tsOpenRowDetails(r))}}function tsClickInPanel(e){var t=typeof tbDeepQueryShadow=="function"?tbDeepQueryShadow(e):[];if(t&&t.length)try{return t[0].click(),!0}catch{}return!1}document.addEventListener("keydown",e=>{if(!tsNavActive()||typeof tbTplMenuOwnsKey=="function"&&tbTplMenuOwnsKey(e))return;const t=(e.target.tagName||"").toLowerCase();if(t==="input"||t==="textarea"||t==="select"||e.target.isContentEditable)return;const n=e.code;if(n==="ArrowDown"||n==="ArrowUp"||n==="KeyW"||n==="KeyS"){const o=Date.now();if(o-tsNavLastAt<TS_NAV_INTERVAL_MS){e.preventDefault();return}tsNavLastAt=o}if(n==="ArrowDown"||n==="KeyS"){e.preventDefault(),tsMoveActiveRow(1);return}if(n==="ArrowUp"||n==="KeyW"){e.preventDefault(),tsMoveActiveRow(-1);return}if(n==="KeyE"){e.preventDefault(),tsClickInPanel(".datx-send");return}if(n==="KeyQ"){e.preventDefault(),tsClickInPanel(".tb-mini-map-link");return}},!0);function createNavToggleButton(){if(window.TB_ADAPTER&&window.TB_ADAPTER.id==="truckstop"||document.getElementById("datx-nav-toggle-wrap"))return;const e=document.createElement("div");e.id="datx-nav-toggle-wrap",e.style.cssText=`
    position: fixed;
    top: 24px;
    left: 87px;
    z-index: 2147483647;
    width: 118px;
    display: flex;
    flex-direction: column;
    border-radius: 0;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.03);
    font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
`;const t="transparent",n="rgba(255,255,255,.08)",r=document.createElement("button");r.id="datx-tb-launcher",r.type="button",r.setAttribute("aria-label","TruckBox settings"),r.innerHTML='<span style="font-weight:800;letter-spacing:-.01em;">Truck<span style="color:#8ab4ff;">Box</span></span>',r.style.cssText=`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 7px 10px;
    border: none;
    background: ${t};
    color: #e2e8f0;
    font-size: 12px;
    cursor: pointer;
    transition: background-color .15s ease, color .15s ease;
`,r.addEventListener("mouseenter",()=>{r.style.background=n,r.style.color="#fff"}),r.addEventListener("mouseleave",()=>{r.style.background=t,r.style.color="#e2e8f0"}),r.addEventListener("click",()=>{openTruckBoxModal()});const o=document.createElement("button");o.id="datx-nav-toggle",o.type="button",o.setAttribute("aria-label","Keyboard navigation"),o.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:0 0 auto;opacity:.8;"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg><span>Navigation</span>',o.style.cssText=`
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-top: 1px solid rgba(255,255,255,.08);
    background: ${t};
    color: #94a3b8;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: .02em;
    cursor: pointer;
    transition: background-color .15s ease, color .15s ease;
`,o.addEventListener("mouseenter",()=>{o.style.background=n,o.style.color="#fff"}),o.addEventListener("mouseleave",()=>{o.style.background=t,o.style.color="#94a3b8"}),o.addEventListener("click",()=>{let a=document.getElementById("datx-nav-dock");a||(createDockPanel(),a=document.getElementById("datx-nav-dock")),a.dataset.hidden==="1"?openDock():closeDock()}),e.appendChild(r),e.appendChild(o),document.body.appendChild(e)}function createDockPanel(){if(document.getElementById("datx-nav-dock"))return;const e=document.createElement("div");e.id="datx-nav-dock",e.dataset.hidden="1",e.innerHTML=`
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;">
        <div>
            <div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:6px;">
                TruckBox Navigation
            </div>
            <div style="font-size:13px;line-height:1.5;color:#cbd5e1;">
                You can now navigate loads much easier using your keyboard.
            </div>
        </div>

        <button id="datx-nav-close" type="button" style="
            border:none;
            background:transparent;
            color:#cbd5e1;
            font-size:18px;
            font-weight:700;
            cursor:pointer;
            padding:0;
            line-height:1;
            flex:0 0 auto;
        ">\xD7</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;font-size:14px;color:#e2e8f0;">
        <div><b>W / S <b>or</b> Arrow Up / Down</b> \u2014 results table navigation</div>
        <div><b>A / D <b>or</b> Arrow Left / Right</b> \u2014 search tabs navigation</div>
        <div><b>Space</b> \u2014 open / close row</div>
        <div><b>E</b> \u2014 send email</div>
        <div><b>Q</b> \u2014 open map</div>
        <div><b>C</b> \u2014 copy load info</div>
        <div><b>R</b> \u2014 refresh loads</div>
        <div><b>F</b> \u2014 RTS Credit check</div>
        <div><b>I</b> \u2014 FMCSA report</div>
    </div>

    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        <button id="datx-open-popup" type="button" style="
            border:none;
            background: rgba(59,130,246,.95);
            color:#fff;
            font-size:13px;
            font-weight:700;
            padding:10px 14px;
            border-radius:0;
            cursor:pointer;
        ">
            Open TruckBox
        </button>
    </div>
`,e.style.cssText=`
    position: fixed;
    top: 20px;
    left: 220px;
    z-index: 2147483647;
    min-width: 300px;
    max-width: 380px;
    background: rgba(15, 23, 42, 0.65);
    color: #fff;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 0;
    padding: 14px 16px;
    box-shadow: 0 16px 40px rgba(0,0,0,.25);
    backdrop-filter: blur(8px);
    opacity: 0;
    transform: translateX(-8px) scale(.97);
    transition: opacity .25s ease, transform .25s ease;
    font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
    pointer-events: none;
    display: none;
`,document.body.appendChild(e),e.querySelector("#datx-nav-close")?.addEventListener("click",()=>{closeDock()}),e.querySelector("#datx-open-popup")?.addEventListener("click",()=>{closeDock(),openTruckBoxModal()})}function createTruckBoxModal(){if(document.getElementById("datx-tb-modal"))return;const e=document.createElement("div");e.id="datx-tb-modal",e.style.cssText=`
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(10, 18, 35, 0.45);
        backdrop-filter: blur(3px);
        opacity: 0;
        transition: opacity .2s ease;
        pointer-events: none;
    `;const t=document.createElement("div");t.style.cssText=`
        position: relative;
        width: 560px;
        max-width: calc(100vw - 32px);
        max-height: 90vh;
        border-radius: 0;
        overflow: hidden;
        background: #f4f7fc;
        box-shadow: 0 24px 60px rgba(0,0,0,.35);
        transform: translateY(8px) scale(.98);
        transition: transform .2s ease;
    `;const n=document.createElement("button");n.type="button",n.setAttribute("aria-label","Close"),n.textContent="\xD7",n.style.cssText=`
        position: absolute;
        top: 10px;
        right: 12px;
        z-index: 2;
        border: none;
        background: rgba(16,32,58,.08);
        color: #10203a;
        width: 28px;
        height: 28px;
        border-radius: 0;
        font-size: 18px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
    `,n.addEventListener("click",closeTruckBoxModal);const r=document.createElement("iframe");r.id="datx-tb-frame",r.allow="clipboard-write",r.src=chrome.runtime.getURL("src/popup/popup.html"),r.style.cssText=`
        width: 100%;
        height: 480px;
        border: none;
        display: block;
        transition: height .2s ease;
    `,window.addEventListener("message",o=>{if(o.source!==r.contentWindow)return;const a=o.data;if(!a||a.source!=="truckbox-popup"||a.type!=="height")return;const i=Math.floor(window.innerHeight*.9),c=Math.max(120,Math.min(Math.ceil(a.height),i));r.style.height=c+"px"}),t.appendChild(n),t.appendChild(r),e.appendChild(t),e.addEventListener("click",o=>{o.target===e&&closeTruckBoxModal()}),document.body.appendChild(e)}function openTruckBoxModal(){createTruckBoxModal();const e=document.getElementById("datx-tb-modal");e&&(e.style.display="flex",e.style.pointerEvents="auto",requestAnimationFrame(()=>{e.style.opacity="1";const t=e.firstElementChild;t&&(t.style.transform="translateY(0) scale(1)")}),document.addEventListener("keydown",onTruckBoxModalKey))}function closeTruckBoxModal(){const e=document.getElementById("datx-tb-modal");if(!e)return;e.style.opacity="0",e.style.pointerEvents="none";const t=e.firstElementChild;t&&(t.style.transform="translateY(8px) scale(.98)"),setTimeout(()=>{e.style.display="none"},200),document.removeEventListener("keydown",onTruckBoxModalKey)}function onTruckBoxModalKey(e){e.key==="Escape"&&closeTruckBoxModal()}function openDock(){const e=document.getElementById("datx-nav-dock");e&&(e.dataset.hidden="0",e.style.display="block",e.style.pointerEvents="auto",requestAnimationFrame(()=>{e.style.opacity="1",e.style.transform="translateY(0) scale(1)"}))}function closeDock(){const e=document.getElementById("datx-nav-dock");e&&(e.dataset.hidden="1",e.style.opacity="0",e.style.transform="translateX(-8px) scale(.97)",e.style.pointerEvents="none",setTimeout(()=>{e.dataset.hidden==="1"&&(e.style.display="none")},250))}let fastInjectTimer=null;function fastInjectDetails(){fastInjectTimer||(fastInjectTimer=setTimeout(()=>{if(fastInjectTimer=null,!!isExtensionAlive()){try{injectMiniMapsInDetails()}catch{}try{injectRefreshButton()}catch{}}},30))}function activate(){if(!onDatLoadsPage()||!isExtensionAlive())return;try{mo&&mo.disconnect()}catch{}mo=null,clearTimeout(scanTimeout),scanTimeout=null,periodicScanId&&(clearInterval(periodicScanId),periodicScanId=null);const e=getResultsRoot(),t=getTripCellSelector();mo=new MutationObserver(n=>{if(!isExtensionAlive())return;let r=!1,o=!1;for(const a of n){if(a.addedNodes&&a.addedNodes.length){let i=!0;for(const c of a.addedNodes)if(!isInjected(c)){i=!1;break}if(i)continue}if(a.type==="childList"&&a.addedNodes.length>0){for(const i of a.addedNodes)if(i.nodeType===Node.ELEMENT_NODE&&((i.matches?.("dat-load-details, .table-row-detail")||i.querySelector?.("dat-load-details, .table-row-detail"))&&(o=!0),i.matches?.(ROW_SEL)||i.querySelector?.(ROW_SEL)||i.matches?.('a[href^="mailto:"]')||i.querySelector?.('a[href^="mailto:"]')||i.matches?.('a[href^="tel:"]')||i.querySelector?.('a[href^="tel:"]')||i.matches?.(t)||i.querySelector?.(t))){r=!0;break}}if(a.type==="characterData"){const i=a.target?.parentElement;(i?.closest?.(COMPANY_CELL_SEL)||i?.closest?.(t))&&(r=!0)}if(a.type==="attributes"){const i=a.target;if(isInjected(i))continue;(i?.closest?.(ROW_SEL)||i?.closest?.(t))&&(r=!0)}if(r)break}o&&fastInjectDetails(),r&&scheduleScan(120)});try{mo.observe(e,{childList:!0,subtree:!0,characterData:!0,attributes:!0,attributeFilter:["href","class","data-test","style","aria-colindex"]})}catch{mo.observe(document.body,{childList:!0,subtree:!0,characterData:!0,attributes:!0,attributeFilter:["href","class","data-test","style","aria-colindex"]})}periodicScanId=setInterval(()=>{if(!isExtensionAlive()){clearInterval(periodicScanId),periodicScanId=null;return}if(!onDatLoadsPage()){clearInterval(periodicScanId),periodicScanId=null;return}scheduleScan(300)},5e3),scanOnce(),createNavToggleButton(),safeDelayedScan(800),safeDelayedScan(2e3),setTimeout(()=>createNavToggleButton(),1e3)}function teardown(){const e=document.getElementById("datx-nav-toggle-wrap");e&&e.remove();const t=document.getElementById("datx-nav-dock");t&&t.remove();try{mo&&mo.disconnect()}catch{}mo=null,clearTimeout(scanTimeout),scanTimeout=null,periodicScanId&&(clearInterval(periodicScanId),periodicScanId=null),idleHandle&&(window.cancelIdleCallback?cancelIdleCallback(idleHandle):clearTimeout(idleHandle),idleHandle=null),document.querySelectorAll(`[${INJECT_ATTR}="1"]`).forEach(n=>n.remove()),document.querySelectorAll(".datx-cs-actions, .datx-inline-group, .datx-send, .datx-tpl-more, .datx-tpl-menu, .datx-map-float-outside, .datx-toast, .datx-copy-phone").forEach(n=>n.remove()),document.querySelectorAll(".datx-hidden").forEach(n=>n.classList.remove("datx-hidden")),document.querySelectorAll(".datx-dup").forEach(n=>n.classList.remove("datx-dup")),document.querySelectorAll(".datx-trip-outside").forEach(n=>n.classList.remove("datx-trip-outside")),processedRows=new WeakSet,TRIP_CELL_SEL_RESOLVED=null,clearActiveRowHighlight(),datxActiveRowIndex=-1}removeStaleInjectedNodes();function checkRoute(){onDatLoadsPage()?activate():teardown()}(function(){const t=history.pushState,n=history.replaceState;history.pushState=function(...r){const o=t.apply(this,r);return setTimeout(checkRoute,0),o},history.replaceState=function(...r){const o=n.apply(this,r);return setTimeout(checkRoute,0),o},window.addEventListener("popstate",checkRoute),window.addEventListener("hashchange",checkRoute)})(),document.addEventListener("click",()=>{scheduleScan(200),setTimeout(()=>scheduleScan(400),400),setTimeout(()=>scheduleScan(800),800)},!0),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",checkRoute):checkRoute();
