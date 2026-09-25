/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
function getSearchTabs(){return Array.from(document.querySelectorAll('[data-test="search-tab-group"] [role="tab"]')).filter(e=>e.getAttribute("aria-disabled")!=="true")}function getActiveTabIndex(e){return e.findIndex(t=>t.getAttribute("aria-selected")==="true")}function moveSearchTab(e){const t=getSearchTabs();if(!t.length){showToast("No tabs found","info");return}const r=getActiveTabIndex(t);if(r<0)return;const n=r+e;if(n<0||n>=t.length)return;const o=t[n];o instanceof HTMLElement&&(o.click(),setTimeout(()=>{datxActiveRowIndex=-1,clearActiveRowHighlight(),scheduleScan(200)},200))}var datxActiveRowIndex=-1,datxActiveRow=null,datxLastNavAt=0,DATX_NAV_INTERVAL_MS=80;function rowHasContactAction(e){if(!(e instanceof Element))return!1;if(e.querySelector(".datx-send")||e.querySelector('a[href^="tel:"]')||e.querySelector('a[href^="mailto:"]'))return!0;const t=getRowDetailsElement(e);if(t){if(t.querySelector(".datx-send")||t.querySelector('a[href^="mailto:"]')||t.querySelector('a[href^="tel:"]'))return!0;const r=(t.innerText||t.textContent||"").trim();if(EMAIL_RE.test(r)||normalizePhoneFromText(r))return!0}return!1}function getVisibleRows(){return Array.from(document.querySelectorAll(ROW_SEL)).filter(e=>!(e instanceof HTMLElement)||e.classList.contains("datx-hidden")||e.offsetParent===null?!1:rowHasContactAction(e))}function isTypingTarget(e){if(!e)return!1;const t=(e.tagName||"").toLowerCase();return t==="input"||t==="textarea"||t==="select"||e.isContentEditable||!!e.closest?.('input, textarea, select, [contenteditable="true"]')}function clearActiveRowHighlight(){document.querySelectorAll(".datx-row-active").forEach(e=>{e.classList.remove("datx-row-active")})}function clampActiveRowIndex(){const e=getVisibleRows();if(!e.length)return datxActiveRowIndex=-1,e;if(datxActiveRow){const t=e.indexOf(datxActiveRow);if(t>=0)return datxActiveRowIndex=t,e}return datxActiveRowIndex<0&&(datxActiveRowIndex=0),datxActiveRowIndex>=e.length&&(datxActiveRowIndex=e.length-1),e}function datxNavActive(){return onDatLoadsPage()&&!!window.TB_ADAPTER&&window.TB_ADAPTER.id==="dat"}function highlightActiveRow(e=!0){if(!datxNavActive())return;clearActiveRowHighlight();const t=getVisibleRows();if(!t.length){datxActiveRowIndex=-1;return}if(datxActiveRow){const n=t.indexOf(datxActiveRow);if(n>=0){datxActiveRowIndex=n,datxActiveRow.classList.add("datx-row-active"),e&&datxActiveRow.scrollIntoView({block:"nearest",behavior:"smooth"});return}if(!e)return}datxActiveRowIndex<0&&(datxActiveRowIndex=0),datxActiveRowIndex>=t.length&&(datxActiveRowIndex=t.length-1);const r=t[datxActiveRowIndex];datxActiveRow=r,r.classList.add("datx-row-active"),e&&r.scrollIntoView({block:"nearest",behavior:"smooth"})}function moveActiveRow(e){const t=clampActiveRowIndex();t.length&&(datxActiveRowIndex===-1?datxActiveRowIndex=0:datxActiveRowIndex+=e,datxActiveRowIndex<0&&(datxActiveRowIndex=0),datxActiveRowIndex>=t.length&&(datxActiveRowIndex=t.length-1,e>0&&window.scrollBy({top:500,behavior:"smooth"})),datxActiveRow=t[datxActiveRowIndex]||null,highlightActiveRow(!0))}function getActiveRow(){const e=clampActiveRowIndex();if(!e.length||datxActiveRowIndex<0)return null;const t=e[datxActiveRowIndex]||null;return datxActiveRow=t,t}function triggerActiveRowSend(){const e=getActiveRow();if(!e)return;const t=getRowDetailsElement(e),r=e.querySelector(".datx-send")||t?.querySelector(".datx-send");if(!r||r.disabled){showToast("No send button available on selected row","info");return}r.click()}function triggerActiveRowMap(){const e=getActiveRow();if(!e)return;const t=getRowDetailsElement(e),r=e.querySelector(".datx-map-btn")||t?.querySelector(".datx-map-btn");if(!r||r.disabled){showToast("No map button available on selected row","info");return}r.click()}function toggleActiveRowDetails(){const e=getActiveRow();if(!e)return;const t=e.querySelector('[data-test="load-pick-up-cell"]')||e.querySelector(".timing-container")||e.querySelector(".table-cell.cell-timing")||e.querySelector('[data-test="load-trip-cell"]')||e.querySelector(".row-cells")||e;t instanceof HTMLElement&&(t.click(),setTimeout(()=>{highlightActiveRow(!1)},80))}(function(){if(document.getElementById("datx-keyboard-nav-style"))return;const t=document.createElement("style");t.id="datx-keyboard-nav-style",t.textContent=`
  .datx-row-active {
    outline: 2px solid #3b82f6 !important;
    outline-offset: -2px !important;
    background: rgba(59,130,246,.06) !important;
    border-radius: 0 !important;
  }
`,document.head.appendChild(t)})();function triggerActiveRowCopy(){const e=document.querySelector(".tb-copy-btn");if(e){e.click();return}datxActiveRowIndex===-1&&(datxActiveRowIndex=0,highlightActiveRow(!0)),toggleActiveRowDetails(),setTimeout(()=>{const t=document.querySelector(".tb-copy-btn");t&&t.click()},650)}function triggerRefreshLoads(){const e=document.querySelector(".tb-refresh-btn");e&&!e.disabled&&e.click()}function clickInActiveDetails(e){const t=document.querySelector(e);if(t){t.click();return}datxActiveRowIndex===-1&&(datxActiveRowIndex=0,highlightActiveRow(!0)),toggleActiveRowDetails();let r=0;const n=()=>{const o=document.querySelector(e);if(o){o.click();return}++r<10&&setTimeout(n,300)};setTimeout(n,400)}function triggerActiveRowRts(){clickInActiveDetails(".tb-rts-holder button")}function triggerActiveRowFmcsa(){clickInActiveDetails(".tb-fmcsa-report")}document.addEventListener("keydown",e=>{if(!datxNavActive()||typeof tbTplMenuOwnsKey=="function"&&tbTplMenuOwnsKey(e))return;const t=(e.target.tagName||"").toLowerCase();if(t==="input"||t==="textarea"||t==="select"||e.target.isContentEditable)return;const r=Date.now(),n=e.code;if(n==="ArrowDown"||n==="ArrowUp"||n==="KeyW"||n==="KeyS"){if(r-datxLastNavAt<DATX_NAV_INTERVAL_MS){e.preventDefault();return}datxLastNavAt=r}if(n==="ArrowDown"||n==="KeyS"){e.preventDefault(),moveActiveRow(1);return}if(n==="ArrowUp"||n==="KeyW"){e.preventDefault(),moveActiveRow(-1);return}if(n==="KeyD"||n==="ArrowRight"){e.preventDefault(),e.stopPropagation(),moveSearchTab(1);return}if(n==="KeyA"||n==="ArrowLeft"){e.preventDefault(),e.stopPropagation(),moveSearchTab(-1);return}if(n==="Space"){e.preventDefault(),datxActiveRowIndex===-1&&(datxActiveRowIndex=0,highlightActiveRow(!0)),toggleActiveRowDetails();return}if(n==="KeyQ"){e.preventDefault(),datxActiveRowIndex===-1&&(datxActiveRowIndex=0,highlightActiveRow(!0)),triggerActiveRowMap();return}if(n==="KeyE"){e.preventDefault(),datxActiveRowIndex===-1&&(datxActiveRowIndex=0,highlightActiveRow(!0)),triggerActiveRowSend();return}if(n==="KeyC"&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault(),triggerActiveRowCopy();return}if(n==="KeyR"&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault(),triggerRefreshLoads();return}if(n==="KeyF"&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault(),triggerActiveRowRts();return}if(n==="KeyI"&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault(),triggerActiveRowFmcsa();return}},!0),document.addEventListener("click",e=>{if(!datxNavActive())return;const t=e.target?.closest?.(ROW_SEL);if(!t)return;const n=getVisibleRows().indexOf(t);n>=0&&(datxActiveRowIndex=n,datxActiveRow=t,highlightActiveRow(!1))},!0);var tsNavRow=null,tsNavLastAt=0,TS_NAV_INTERVAL_MS=180,TS_NAV_ENABLED=!1;function tsNavActive(){return TS_NAV_ENABLED&&onDatLoadsPage()&&!!window.TB_ADAPTER&&window.TB_ADAPTER.id==="truckstop"}function tsNavRows(){var e=typeof tbDeepQueryShadow=="function"?tbDeepQueryShadow(".ts-grid-row"):Array.prototype.slice.call(document.querySelectorAll(".ts-grid-row"));return e.sort(function(t,r){return(parseInt(t.getAttribute("row-index"),10)||0)-(parseInt(r.getAttribute("row-index"),10)||0)}),e}function tsClearNavHighlight(){tsNavRow&&(tsNavRow.style.outline="",tsNavRow.style.outlineOffset="",tsNavRow.style.background="")}function tsHighlightRow(e){tsClearNavHighlight(),tsNavRow=e,e.style.outline="2px solid #b60207",e.style.outlineOffset="-2px",e.style.background="rgba(182,2,7,.06)";try{e.scrollIntoView({block:"nearest"})}catch{}}function tsOpenRowDetails(e){var t=e.querySelector('[col-id="originCity"]')||e.querySelector(".ag-cell:not(.action-cell)")||e;try{t.click()}catch{try{e.click()}catch{}}}function tsMoveActiveRow(e){var t=tsNavRows();if(t.length){var r=tsNavRow?t.indexOf(tsNavRow):-1;r=r<0?e>0?0:t.length-1:r+e,r<0&&(r=0),r>=t.length&&(r=t.length-1);var n=t[r];n&&(tsHighlightRow(n),tsOpenRowDetails(n))}}function tsClickInPanel(e){var t=typeof tbDeepQueryShadow=="function"?tbDeepQueryShadow(e):[];if(t&&t.length)try{return t[0].click(),!0}catch{}return!1}document.addEventListener("keydown",e=>{if(!tsNavActive()||typeof tbTplMenuOwnsKey=="function"&&tbTplMenuOwnsKey(e))return;const t=(e.target.tagName||"").toLowerCase();if(t==="input"||t==="textarea"||t==="select"||e.target.isContentEditable)return;const r=e.code;if(r==="ArrowDown"||r==="ArrowUp"||r==="KeyW"||r==="KeyS"){const o=Date.now();if(o-tsNavLastAt<TS_NAV_INTERVAL_MS){e.preventDefault();return}tsNavLastAt=o}if(r==="ArrowDown"||r==="KeyS"){e.preventDefault(),tsMoveActiveRow(1);return}if(r==="ArrowUp"||r==="KeyW"){e.preventDefault(),tsMoveActiveRow(-1);return}if(r==="KeyE"){e.preventDefault(),tsClickInPanel(".datx-send");return}if(r==="KeyQ"){e.preventDefault(),tsClickInPanel(".tb-mini-map-link");return}},!0);const TB_SIDEBAR_KEY="tbDatSidebarCollapsed";let tbSidebarCollapsed=!1;const TB_SIDEBAR_CANDIDATES="mat-sidenav, mat-drawer, .mat-drawer, .mat-sidenav",TB_SIDEBAR_CONTENT="mat-sidenav-content, mat-drawer-content, .mat-drawer-content";function tbSidebarStyleOnce(){if(document.getElementById("datx-sidebar-css"))return;const e=document.createElement("style");e.id="datx-sidebar-css",e.textContent='[data-tb-sidebar-hidden="1"]{display:none!important;}[data-tb-sidebar-shifted="1"]{margin-left:0!important;}',document.head.appendChild(e)}const TB_NAV_LABELS=["Search Loads","Search Trucks","My Trucks","My Loads","Dashboard"];function tbLooksLikeRail(e){if(!e||e===document.body||e===document.documentElement)return!1;const t=e.getBoundingClientRect();return t.left<=8&&t.width>=40&&t.width<=360&&t.height>=window.innerHeight*.55}function findDatSidebar(){const e=document.querySelector('[data-tb-sidebar-hidden="1"]');if(e)return e;for(const t of document.querySelectorAll(TB_SIDEBAR_CANDIDATES))if(tbLooksLikeRail(t))return t;for(const t of TB_NAV_LABELS){const r=[...document.querySelectorAll("a, span, div")].find(n=>n.children.length===0&&n.textContent.trim()===t);if(r){for(let n=r.parentElement;n;n=n.parentElement)if(tbLooksLikeRail(n))return n}}return null}function applySidebarCollapsed(e){tbSidebarStyleOnce();const t=findDatSidebar();if(t){e&&!t.dataset.tbSidebarWidth&&(t.dataset.tbSidebarWidth=String(Math.round(t.getBoundingClientRect().width))),t.dataset.tbSidebarHidden=e?"1":"0";const o=t.parentElement,i=o&&o.querySelector(TB_SIDEBAR_CONTENT);i&&(i.dataset.tbSidebarShifted=e?"1":"0")}const r=document.getElementById("datx-nav-toggle-wrap");r&&(r.style.display=e?"none":"flex");const n=document.getElementById("datx-sidebar-reopen");n&&(n.style.display=e?"flex":"none")}function trackSidebarCollapse(){let e=40;const t=setInterval(()=>{if(!tbSidebarCollapsed){clearInterval(t);return}applySidebarCollapsed(!0),(document.querySelector('[data-tb-sidebar-hidden="1"]')||--e<=0)&&clearInterval(t)},500)}function setSidebarCollapsed(e){tbSidebarCollapsed=!!e,applySidebarCollapsed(tbSidebarCollapsed),tbSidebarCollapsed&&trackSidebarCollapse();try{chrome.storage.local.set({[TB_SIDEBAR_KEY]:tbSidebarCollapsed})}catch{}}const TB_REOPEN_TOP=86;function createSidebarReopenButton(){if(window.TB_ADAPTER&&window.TB_ADAPTER.id==="truckstop"||document.getElementById("datx-sidebar-reopen"))return;const e=document.createElement("button");e.id="datx-sidebar-reopen",e.type="button",e.title="Show the DAT sidebar and TruckBox",e.setAttribute("aria-label","Show the DAT sidebar and TruckBox"),e.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',e.style.cssText=`
    position: fixed;
    top: ${TB_REOPEN_TOP}px;
    left: 0;
    z-index: 2147483647;
    display: none;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 58px;
    padding: 0;
    border: 1px solid rgba(255,255,255,.28);
    border-left: none;
    border-radius: 0 7px 7px 0;
    background: #2f7be0;
    color: #fff;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,.4);
    transition: background-color .15s ease, width .15s ease;
`,e.addEventListener("mouseenter",()=>{e.style.width="22px",e.style.background="#1f66c7"}),e.addEventListener("mouseleave",()=>{e.style.width="15px",e.style.background="#2f7be0"}),e.addEventListener("click",()=>setSidebarCollapsed(!1)),document.body.appendChild(e)}(function(){try{chrome.storage.local.get([TB_SIDEBAR_KEY],t=>{tbSidebarCollapsed=!!(t&&t[TB_SIDEBAR_KEY]),tbSidebarCollapsed&&(applySidebarCollapsed(!0),trackSidebarCollapse())}),chrome.storage.onChanged.addListener((t,r)=>{r!=="local"||!t[TB_SIDEBAR_KEY]||(tbSidebarCollapsed=!!t[TB_SIDEBAR_KEY].newValue,applySidebarCollapsed(tbSidebarCollapsed))})}catch{}})();const TB_NUDGE_RIGHT=25,TB_RAIL_INSET=10,TB_LOGO_SHARE=.45;function positionNavToggle(e){if(!e)return!1;const t=findDatSidebar();if(!t)return!1;const r=t.getBoundingClientRect();if(r.width<40)return!1;let n=r.left+r.width*TB_LOGO_SHARE;t.querySelectorAll("img, svg").forEach(c=>{const d=c.getBoundingClientRect();d.top>r.top+100||d.width<20||d.width>r.width*.8||(n=Math.max(n,d.right))});const o=e.getBoundingClientRect().width||80,i=r.right-n;if(i<o+4)return!1;const a=n+(i-o)/2+TB_NUDGE_RIGHT,s=r.right-o-TB_RAIL_INSET;return e.style.left=`${Math.round(Math.min(a,s))}px`,!0}function trackNavTogglePosition(){let e=40;const t=()=>{const n=document.getElementById("datx-nav-toggle-wrap");n&&(positionNavToggle(n)||--e<=0)&&(clearInterval(r),window.addEventListener("resize",()=>positionNavToggle(document.getElementById("datx-nav-toggle-wrap"))))},r=setInterval(t,500);t()}function createNavToggleButton(){if(window.TB_ADAPTER&&window.TB_ADAPTER.id==="truckstop")return;if(document.getElementById("datx-nav-toggle-wrap")){tbSidebarCollapsed?applySidebarCollapsed(!0):positionNavToggle(document.getElementById("datx-nav-toggle-wrap"));return}const e=document.createElement("div");e.id="datx-nav-toggle-wrap",e.style.cssText=`
    position: fixed;
    top: 22px;
    left: 87px;
    z-index: 2147483647;
    width: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: 'Inter',ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
`;const t="transparent",r="rgba(255,255,255,.08)",n=document.createElement("button");n.id="datx-tb-launcher",n.type="button",n.setAttribute("aria-label","TruckBox settings"),n.innerHTML='<span style="font-weight:800;letter-spacing:-.015em;">Truck<span style="color:#2f7be0;">Box</span></span>',n.style.cssText=`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 6px 4px;
    border: none;
    border-radius: 5px;
    background: ${t};
    color: #e2e8f0;
    font-size: 12.5px;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color .15s ease, color .15s ease;
`,n.addEventListener("mouseenter",()=>{n.style.background=r,n.style.color="#fff"}),n.addEventListener("mouseleave",()=>{n.style.background=t,n.style.color="#e2e8f0"}),n.addEventListener("click",()=>{openTruckBoxModal()});const o=document.createElement("button");o.id="datx-nav-toggle",o.type="button",o.setAttribute("aria-label","Keyboard navigation"),o.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:0 0 auto;opacity:.8;"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg><span>Navi</span>',o.style.cssText=`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 5px;
    background: ${t};
    color: #94a3b8;
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: .01em;
    cursor: pointer;
    transition: background-color .15s ease, color .15s ease;
`,o.addEventListener("mouseenter",()=>{o.style.background=r,o.style.color="#fff"}),o.addEventListener("mouseleave",()=>{o.style.background=t,o.style.color="#94a3b8"}),o.addEventListener("click",()=>{let s=document.getElementById("datx-nav-dock");s||(createDockPanel(),s=document.getElementById("datx-nav-dock")),s.dataset.hidden==="1"?openDock():closeDock()});const i=document.createElement("button");i.id="datx-sidebar-hide",i.type="button",i.title="Hide the DAT sidebar and TruckBox",i.setAttribute("aria-label","Hide the DAT sidebar and TruckBox"),i.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:0 0 auto;opacity:.8;"><path d="M15 18l-6-6 6-6"/></svg><span>Hide</span>',i.style.cssText=`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 5px;
    background: ${t};
    color: #94a3b8;
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: .01em;
    cursor: pointer;
    transition: background-color .15s ease, color .15s ease;
`,i.addEventListener("mouseenter",()=>{i.style.background=r,i.style.color="#fff"}),i.addEventListener("mouseleave",()=>{i.style.background=t,i.style.color="#94a3b8"}),i.addEventListener("click",()=>setSidebarCollapsed(!0));const a=document.createElement("div");a.style.cssText=`
    width: 80px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 2px;
    padding-top: 4px;
    border-top: 1px solid rgba(255,255,255,.09);
`,a.appendChild(o),a.appendChild(i),e.appendChild(n),e.appendChild(a),document.body.appendChild(e),trackNavTogglePosition(),createSidebarReopenButton(),applySidebarCollapsed(tbSidebarCollapsed)}function createDockPanel(){if(document.getElementById("datx-nav-dock"))return;const e=document.createElement("div");e.id="datx-nav-dock",e.dataset.hidden="1",e.innerHTML=`
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
    `;const r=document.createElement("button");r.type="button",r.setAttribute("aria-label","Close"),r.textContent="\xD7",r.style.cssText=`
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
    `,r.addEventListener("click",closeTruckBoxModal);const n=document.createElement("iframe");n.id="datx-tb-frame",n.allow="clipboard-write",n.src=chrome.runtime.getURL("src/popup/popup.html"),n.style.cssText=`
        width: 100%;
        height: 480px;
        border: none;
        display: block;
        transition: height .2s ease;
    `,window.addEventListener("message",o=>{if(o.source!==n.contentWindow)return;const i=o.data;if(!i||i.source!=="truckbox-popup"||i.type!=="height")return;const a=Math.floor(window.innerHeight*.9),s=Math.max(120,Math.min(Math.ceil(i.height),a));n.style.height=s+"px"}),t.appendChild(r),t.appendChild(n),e.appendChild(t),e.addEventListener("click",o=>{o.target===e&&closeTruckBoxModal()}),document.body.appendChild(e)}function openTruckBoxModal(){createTruckBoxModal();const e=document.getElementById("datx-tb-modal");e&&(e.style.display="flex",e.style.pointerEvents="auto",requestAnimationFrame(()=>{e.style.opacity="1";const t=e.firstElementChild;t&&(t.style.transform="translateY(0) scale(1)")}),document.addEventListener("keydown",onTruckBoxModalKey))}function closeTruckBoxModal(){const e=document.getElementById("datx-tb-modal");if(!e)return;e.style.opacity="0",e.style.pointerEvents="none";const t=e.firstElementChild;t&&(t.style.transform="translateY(8px) scale(.98)"),setTimeout(()=>{e.style.display="none"},200),document.removeEventListener("keydown",onTruckBoxModalKey)}function onTruckBoxModalKey(e){e.key==="Escape"&&closeTruckBoxModal()}function openDock(){const e=document.getElementById("datx-nav-dock");e&&(e.dataset.hidden="0",e.style.display="block",e.style.pointerEvents="auto",requestAnimationFrame(()=>{e.style.opacity="1",e.style.transform="translateY(0) scale(1)"}))}function closeDock(){const e=document.getElementById("datx-nav-dock");e&&(e.dataset.hidden="1",e.style.opacity="0",e.style.transform="translateX(-8px) scale(.97)",e.style.pointerEvents="none",setTimeout(()=>{e.dataset.hidden==="1"&&(e.style.display="none")},250))}let fastInjectTimer=null;function fastInjectDetails(){fastInjectTimer||(fastInjectTimer=setTimeout(()=>{if(fastInjectTimer=null,!!isExtensionAlive()){try{injectMiniMapsInDetails()}catch{}try{injectRefreshButton()}catch{}}},30))}function activate(){if(!onDatLoadsPage()||!isExtensionAlive())return;try{mo&&mo.disconnect()}catch{}mo=null,clearTimeout(scanTimeout),scanTimeout=null,periodicScanId&&(clearInterval(periodicScanId),periodicScanId=null);const e=getResultsRoot(),t=getTripCellSelector();mo=new MutationObserver(r=>{if(!isExtensionAlive())return;let n=!1,o=!1;for(const i of r){if(i.addedNodes&&i.addedNodes.length){let a=!0;for(const s of i.addedNodes)if(!isInjected(s)){a=!1;break}if(a)continue}if(i.type==="childList"&&i.addedNodes.length>0){for(const a of i.addedNodes)if(a.nodeType===Node.ELEMENT_NODE&&((a.matches?.("dat-load-details, .table-row-detail")||a.querySelector?.("dat-load-details, .table-row-detail"))&&(o=!0),a.matches?.(ROW_SEL)||a.querySelector?.(ROW_SEL)||a.matches?.('a[href^="mailto:"]')||a.querySelector?.('a[href^="mailto:"]')||a.matches?.('a[href^="tel:"]')||a.querySelector?.('a[href^="tel:"]')||a.matches?.(t)||a.querySelector?.(t))){n=!0;break}}if(i.type==="characterData"){const a=i.target?.parentElement;(a?.closest?.(COMPANY_CELL_SEL)||a?.closest?.(t))&&(n=!0)}if(i.type==="attributes"){const a=i.target;if(isInjected(a))continue;(a?.closest?.(ROW_SEL)||a?.closest?.(t))&&(n=!0)}if(n)break}o&&fastInjectDetails(),n&&scheduleScan(120)});try{mo.observe(e,{childList:!0,subtree:!0,characterData:!0,attributes:!0,attributeFilter:["href","class","data-test","style","aria-colindex"]})}catch{mo.observe(document.body,{childList:!0,subtree:!0,characterData:!0,attributes:!0,attributeFilter:["href","class","data-test","style","aria-colindex"]})}periodicScanId=setInterval(()=>{if(!isExtensionAlive()){clearInterval(periodicScanId),periodicScanId=null;return}if(!onDatLoadsPage()){clearInterval(periodicScanId),periodicScanId=null;return}scheduleScan(300)},5e3),scanOnce(),createNavToggleButton(),safeDelayedScan(800),safeDelayedScan(2e3),setTimeout(()=>createNavToggleButton(),1e3)}function teardown(){applySidebarCollapsed(!1);const e=document.getElementById("datx-sidebar-reopen");e&&e.remove();const t=document.getElementById("datx-nav-toggle-wrap");t&&t.remove();const r=document.getElementById("datx-nav-dock");r&&r.remove();try{mo&&mo.disconnect()}catch{}mo=null,clearTimeout(scanTimeout),scanTimeout=null,periodicScanId&&(clearInterval(periodicScanId),periodicScanId=null),idleHandle&&(window.cancelIdleCallback?cancelIdleCallback(idleHandle):clearTimeout(idleHandle),idleHandle=null),document.querySelectorAll(`[${INJECT_ATTR}="1"]`).forEach(n=>n.remove()),document.querySelectorAll(".datx-cs-actions, .datx-inline-group, .datx-send, .datx-tpl-more, .datx-tpl-menu, .datx-map-float-outside, .datx-toast, .datx-copy-phone").forEach(n=>n.remove()),document.querySelectorAll(".datx-hidden").forEach(n=>n.classList.remove("datx-hidden")),document.querySelectorAll(".datx-dup").forEach(n=>n.classList.remove("datx-dup")),document.querySelectorAll(".datx-trip-outside").forEach(n=>n.classList.remove("datx-trip-outside")),processedRows=new WeakSet,TRIP_CELL_SEL_RESOLVED=null,clearActiveRowHighlight(),datxActiveRowIndex=-1}removeStaleInjectedNodes();function checkRoute(){onDatLoadsPage()?activate():teardown()}(function(){const t=history.pushState,r=history.replaceState;history.pushState=function(...n){const o=t.apply(this,n);return setTimeout(checkRoute,0),o},history.replaceState=function(...n){const o=r.apply(this,n);return setTimeout(checkRoute,0),o},window.addEventListener("popstate",checkRoute),window.addEventListener("hashchange",checkRoute)})(),document.addEventListener("click",()=>{scheduleScan(200),setTimeout(()=>scheduleScan(400),400),setTimeout(()=>scheduleScan(800),800)},!0),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",checkRoute):checkRoute();
