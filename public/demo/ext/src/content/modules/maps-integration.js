function getSearchTabs() {
    return Array.from(
        document.querySelectorAll('[data-test="search-tab-group"] [role="tab"]')
    ).filter(el => el.getAttribute('aria-disabled') !== 'true');
}

function getActiveTabIndex(tabs) {
    return tabs.findIndex(el => el.getAttribute('aria-selected') === 'true');
}

function moveSearchTab(delta) {
    const tabs = getSearchTabs();
    if (!tabs.length) {
        showToast('No tabs found', 'info');
        return;
    }

    const current = getActiveTabIndex(tabs);
    if (current < 0) return;

    const next = current + delta;

    if (next < 0 || next >= tabs.length) {
        return;
    }

    const target = tabs[next];

    if (!(target instanceof HTMLElement)) return;

    // real clic k
    target.click();

    setTimeout(() => {
        datxActiveRowIndex = -1;
        clearActiveRowHighlight();
        scheduleScan(200);
    }, 200);
}

// getRowDetailsElement() now lives in ui-injector.js (shared by the row-button
// reconcile in load-parser.js).

// =========================
// Keyboard navigation
// W / S / ArrowUp / ArrowDown = move
// Space = open / collapse row details
// E = send email on active row
// =========================
var datxActiveRowIndex = -1;
// The actual selected row element. We anchor the selection to this node, not to
// datxActiveRowIndex, because DAT's virtualized table recycles/reorders rows on
// scroll — a bare index would then point at a different load (the "selection
// jumps a few rows down after scrolling" bug). The index is kept in sync for
// arrow-key movement only.
var datxActiveRow = null;
var datxLastNavAt = 0;
var DATX_NAV_INTERVAL_MS = 80;

function rowHasContactAction(row) {
    if (!(row instanceof Element)) return false;

    if (row.querySelector('.datx-send')) return true;
    if (row.querySelector('a[href^="tel:"]')) return true;
    if (row.querySelector('a[href^="mailto:"]')) return true;

    const details = getRowDetailsElement(row);
    if (details) {
        if (details.querySelector('.datx-send')) return true;
        if (details.querySelector('a[href^="mailto:"]')) return true;
        if (details.querySelector('a[href^="tel:"]')) return true;

        const txt = (details.innerText || details.textContent || '').trim();
        if (EMAIL_RE.test(txt)) return true;
        if (normalizePhoneFromText(txt)) return true;
    }

    return false;
}

function getVisibleRows() {
    return Array.from(document.querySelectorAll(ROW_SEL)).filter((row) => {
        if (!(row instanceof HTMLElement)) return false;
        if (row.classList.contains('datx-hidden')) return false;
        if (row.offsetParent === null) return false;

        return rowHasContactAction(row);
    });
}

function isTypingTarget(el) {
    if (!el) return false;

    const tag = (el.tagName || '').toLowerCase();

    return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        el.isContentEditable ||
        !!el.closest?.('input, textarea, select, [contenteditable="true"]')
    );
}

function clearActiveRowHighlight() {
    document.querySelectorAll('.datx-row-active').forEach((el) => {
        el.classList.remove('datx-row-active');
    });
}

// Returns the current visible-row list and syncs datxActiveRowIndex. When the
// anchored element (datxActiveRow) is still present, the index follows it — so
// a recycle/reorder can't drift the selection. Otherwise we fall back to the
// last index (clamped).
function clampActiveRowIndex() {
    const rows = getVisibleRows();

    if (!rows.length) {
        datxActiveRowIndex = -1;
        return rows;
    }

    if (datxActiveRow) {
        const idx = rows.indexOf(datxActiveRow);
        if (idx >= 0) {
            datxActiveRowIndex = idx;
            return rows;
        }
    }

    if (datxActiveRowIndex < 0) datxActiveRowIndex = 0;
    if (datxActiveRowIndex >= rows.length) datxActiveRowIndex = rows.length - 1;

    return rows;
}

// Keyboard row-navigation (active-row highlight + W/S/arrows/Space shortcuts) is
// DAT-only for now. Other platforms (Truckstop) will get their own nav logic, so
// every nav entry point is gated on this — capture handlers stay registered but
// no-op elsewhere, and no .datx-row-active styling leaks onto other boards.
function datxNavActive() {
    return onDatLoadsPage() && !!window.TB_ADAPTER && window.TB_ADAPTER.id === 'dat';
}

function highlightActiveRow(scrollIntoView = true) {
    if (!datxNavActive()) return;
    clearActiveRowHighlight();

    const rows = getVisibleRows();
    if (!rows.length) {
        datxActiveRowIndex = -1;
        return;
    }

    // Prefer the anchored element so re-scans/recycles keep the SAME load.
    if (datxActiveRow) {
        const idx = rows.indexOf(datxActiveRow);
        if (idx >= 0) {
            datxActiveRowIndex = idx;
            datxActiveRow.classList.add('datx-row-active');
            if (scrollIntoView) {
                datxActiveRow.scrollIntoView({block: 'nearest', behavior: 'smooth'});
            }
            return;
        }
        // Anchored row isn't rendered right now (virtual scroll recycled it).
        // On a passive repaint (from scanOnce) don't hijack the selection onto
        // some other load — leave it unhighlighted until the row scrolls back.
        if (!scrollIntoView) return;
    }

    // No anchor yet, or explicit navigation: select by index and re-anchor.
    if (datxActiveRowIndex < 0) datxActiveRowIndex = 0;
    if (datxActiveRowIndex >= rows.length) datxActiveRowIndex = rows.length - 1;

    const row = rows[datxActiveRowIndex];
    datxActiveRow = row;
    row.classList.add('datx-row-active');

    if (scrollIntoView) {
        row.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth'
        });
    }
}

function moveActiveRow(delta) {
    // Sync the index to the anchored element first, so the step is relative to
    // the load the user actually sees selected (not a stale index).
    const rows = clampActiveRowIndex();
    if (!rows.length) return;

    if (datxActiveRowIndex === -1) {
        datxActiveRowIndex = 0;
    } else {
        datxActiveRowIndex += delta;
    }

    if (datxActiveRowIndex < 0) datxActiveRowIndex = 0;

    if (datxActiveRowIndex >= rows.length) {
        datxActiveRowIndex = rows.length - 1;

        // nudge page down to help infinite scroll load more listings
        if (delta > 0) {
            window.scrollBy({top: 500, behavior: 'smooth'});
        }
    }

    datxActiveRow = rows[datxActiveRowIndex] || null;
    highlightActiveRow(true);
}

function getActiveRow() {
    const rows = clampActiveRowIndex();
    if (!rows.length || datxActiveRowIndex < 0) return null;
    const row = rows[datxActiveRowIndex] || null;
    datxActiveRow = row;
    return row;
}

function triggerActiveRowSend() {
    const row = getActiveRow();
    if (!row) return;

    const details = getRowDetailsElement(row);

    const btn =
        row.querySelector('.datx-send') ||
        details?.querySelector('.datx-send');

    if (!btn || btn.disabled) {
        showToast('No send button available on selected row', 'info');
        return;
    }

    btn.click();
}


function triggerActiveRowMap() {
    const row = getActiveRow();
    if (!row) return;

    const details = getRowDetailsElement(row);

    const btn =
        row.querySelector('.datx-map-btn') ||
        details?.querySelector('.datx-map-btn');

    if (!btn || btn.disabled) {
        showToast('No map button available on selected row', 'info');
        return;
    }

    btn.click();
}

function toggleActiveRowDetails() {
    const row = getActiveRow();
    if (!row) return;

    const clickable =
        row.querySelector('[data-test="load-pick-up-cell"]') ||
        row.querySelector('.timing-container') ||
        row.querySelector('.table-cell.cell-timing') ||
        row.querySelector('[data-test="load-trip-cell"]') ||
        row.querySelector('.row-cells') ||
        row;

    if (!(clickable instanceof HTMLElement)) return;

    clickable.click();

    setTimeout(() => {
        highlightActiveRow(false);
    }, 80);
}

(function ensureKeyboardNavStyle() {
    if (document.getElementById('datx-keyboard-nav-style')) return;

    const s = document.createElement('style');
    s.id = 'datx-keyboard-nav-style';
    s.textContent = `
  .datx-row-active {
    outline: 2px solid #3b82f6 !important;
    outline-offset: -2px !important;
    background: rgba(59,130,246,.06) !important;
    border-radius: 0 !important;
  }
`;
    document.head.appendChild(s);
})();

// 'C' — copy load info for the open load (clicks the injected Copy button).
// If no details are open, open the active row's details first, then copy.
function triggerActiveRowCopy() {
    const btn = document.querySelector('.tb-copy-btn');
    if (btn) {
        btn.click();
        return;
    }
    if (datxActiveRowIndex === -1) {
        datxActiveRowIndex = 0;
        highlightActiveRow(true);
    }
    toggleActiveRowDetails();
    setTimeout(() => {
        const b = document.querySelector('.tb-copy-btn');
        if (b) b.click();
    }, 650);
}

// 'R' — refresh the loads list (clicks the injected Refresh button, which
// respects its own 5s cooldown). Only present when logged in.
function triggerRefreshLoads() {
    const btn = document.querySelector('.tb-refresh-btn');
    if (btn && !btn.disabled) btn.click();
}

// Clicks an injected button in the open load details, opening the details first
// (and retrying briefly while our broker buttons mount) if nothing is open yet.
function clickInActiveDetails(selector) {
    const btn = document.querySelector(selector);
    if (btn) {
        btn.click();
        return;
    }
    if (datxActiveRowIndex === -1) {
        datxActiveRowIndex = 0;
        highlightActiveRow(true);
    }
    toggleActiveRowDetails();
    let tries = 0;
    const tryClick = () => {
        const b = document.querySelector(selector);
        if (b) {
            b.click();
            return;
        }
        if (++tries < 10) setTimeout(tryClick, 300); // broker buttons mount async
    };
    setTimeout(tryClick, 400);
}

// 'F' — run the RTS factoring credit check in the open load details.
function triggerActiveRowRts() {
    clickInActiveDetails('.tb-rts-holder button');
}

// 'I' — open the broker's FMCSA SAFER report from the open load details.
function triggerActiveRowFmcsa() {
    clickInActiveDetails('.tb-fmcsa-report');
}

document.addEventListener('keydown', (e) => {
    if (!datxNavActive()) return; // DAT-only; Truckstop nav comes later
    // Arrow / Enter / Escape drive the in-page template menu while it (or its chevron) has focus.
    if (typeof tbTplMenuOwnsKey === 'function' && tbTplMenuOwnsKey(e)) return;

    const tag = (e.target.tagName || '').toLowerCase();
    if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        e.target.isContentEditable
    ) {
        return;
    }

    const now = Date.now();
    const code = e.code;

    const isNavKey =
        code === 'ArrowDown' ||
        code === 'ArrowUp' ||
        code === 'KeyW' ||
        code === 'KeyS';

    if (isNavKey) {
        if (now - datxLastNavAt < DATX_NAV_INTERVAL_MS) {
            e.preventDefault();
            return;
        }
        datxLastNavAt = now;
    }

    if (code === 'ArrowDown' || code === 'KeyS') {
        e.preventDefault();
        moveActiveRow(1);
        return;
    }

    if (code === 'ArrowUp' || code === 'KeyW') {
        e.preventDefault();
        moveActiveRow(-1);
        return;
    }

    if (code === 'KeyD' || code === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();

        moveSearchTab(1);
        return;
    }

    if (code === 'KeyA' || code === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();

        moveSearchTab(-1);
        return;
    }

    if (code === 'Space') {
        e.preventDefault();

        if (datxActiveRowIndex === -1) {
            datxActiveRowIndex = 0;
            highlightActiveRow(true);
        }

        toggleActiveRowDetails();
        return;
    }


    if (code === 'KeyQ') {
        e.preventDefault();

        if (datxActiveRowIndex === -1) {
            datxActiveRowIndex = 0;
            highlightActiveRow(true);
        }

        triggerActiveRowMap();
        return;
    }

    if (code === 'KeyE') {
        e.preventDefault();

        if (datxActiveRowIndex === -1) {
            datxActiveRowIndex = 0;
            highlightActiveRow(true);
        }

        triggerActiveRowSend();
        return;
    }

    // 'C' = copy load info. Let Cmd/Ctrl+C (real copy) pass through.
    if (code === 'KeyC' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        triggerActiveRowCopy();
        return;
    }

    // 'R' = refresh loads. Let Cmd/Ctrl+R (page reload) pass through.
    if (code === 'KeyR' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        triggerRefreshLoads();
        return;
    }

    // 'F' = RTS factoring credit check.
    if (code === 'KeyF' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        triggerActiveRowRts();
        return;
    }

    // 'I' = FMCSA broker report.
    if (code === 'KeyI' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        triggerActiveRowFmcsa();
        return;
    }
}, true);

document.addEventListener('click', (e) => {
    if (!datxNavActive()) return; // DAT-only row activation

    const row = e.target?.closest?.(ROW_SEL);
    if (!row) return;

    const rows = getVisibleRows();
    const idx = rows.indexOf(row);

    if (idx >= 0) {
        datxActiveRowIndex = idx;
        datxActiveRow = row;
        highlightActiveRow(false);
    }
}, true);

// =========================================================================
// Truckstop keyboard navigation (self-contained; DAT has its own above).
// W/S/↑/↓ move through the grid (and open the row's detail panel so the email /
// map actions have something to act on); E sends the email, Q opens the map.
// The grid + panel live in a Shadow DOM, so rows/controls are reached via
// tbDeepQueryShadow and the active row is highlighted with inline styles (our
// document.head CSS can't cross the boundary).
// =========================================================================
var tsNavRow = null;
var tsNavLastAt = 0;
var TS_NAV_INTERVAL_MS = 180;

// Temporarily disabled: Truckstop's new-posting form uses custom (non-<input>)
// city fields, so the W/S/Q/E shortcuts were swallowing typed keys. Flip this
// back to the adapter check once we scope the handler to the results grid only.
var TS_NAV_ENABLED = false;

function tsNavActive() {
    return TS_NAV_ENABLED
        && onDatLoadsPage() && !!window.TB_ADAPTER && window.TB_ADAPTER.id === 'truckstop';
}

function tsNavRows() {
    var rows = (typeof tbDeepQueryShadow === 'function')
        ? tbDeepQueryShadow('.ts-grid-row')
        : Array.prototype.slice.call(document.querySelectorAll('.ts-grid-row'));
    rows.sort(function (a, b) {
        return (parseInt(a.getAttribute('row-index'), 10) || 0)
            - (parseInt(b.getAttribute('row-index'), 10) || 0);
    });
    return rows;
}

function tsClearNavHighlight() {
    if (tsNavRow) {
        tsNavRow.style.outline = '';
        tsNavRow.style.outlineOffset = '';
        tsNavRow.style.background = '';
    }
}

function tsHighlightRow(row) {
    tsClearNavHighlight();
    tsNavRow = row;
    row.style.outline = '2px solid #b60207';
    row.style.outlineOffset = '-2px';
    row.style.background = 'rgba(182,2,7,.06)';
    try { row.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
}

// Open a row's detail panel — click a value cell (the actions cell has its own
// buttons), falling back to the row itself.
function tsOpenRowDetails(row) {
    var cell = row.querySelector('[col-id="originCity"]')
        || row.querySelector('.ag-cell:not(.action-cell)')
        || row;
    try { cell.click(); } catch (e) { try { row.click(); } catch (e2) { /* ignore */ } }
}

function tsMoveActiveRow(delta) {
    var rows = tsNavRows();
    if (!rows.length) return;
    var idx = tsNavRow ? rows.indexOf(tsNavRow) : -1;
    idx = idx < 0 ? (delta > 0 ? 0 : rows.length - 1) : idx + delta;
    if (idx < 0) idx = 0;
    if (idx >= rows.length) idx = rows.length - 1;
    var row = rows[idx];
    if (!row) return;
    tsHighlightRow(row);
    tsOpenRowDetails(row);
}

// Click the first matching control inside the open detail panel (shadow-pierced).
function tsClickInPanel(selector) {
    var els = (typeof tbDeepQueryShadow === 'function') ? tbDeepQueryShadow(selector) : [];
    if (els && els.length) {
        try { els[0].click(); return true; } catch (e) { /* ignore */ }
    }
    return false;
}

document.addEventListener('keydown', (e) => {
    if (!tsNavActive()) return;
    if (typeof tbTplMenuOwnsKey === 'function' && tbTplMenuOwnsKey(e)) return;

    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return;
    }

    const code = e.code;
    const isMove = code === 'ArrowDown' || code === 'ArrowUp' || code === 'KeyW' || code === 'KeyS';
    if (isMove) {
        const now = Date.now();
        if (now - tsNavLastAt < TS_NAV_INTERVAL_MS) { e.preventDefault(); return; }
        tsNavLastAt = now;
    }

    if (code === 'ArrowDown' || code === 'KeyS') { e.preventDefault(); tsMoveActiveRow(1); return; }
    if (code === 'ArrowUp' || code === 'KeyW') { e.preventDefault(); tsMoveActiveRow(-1); return; }
    if (code === 'KeyE') { e.preventDefault(); tsClickInPanel('.datx-send'); return; }
    if (code === 'KeyQ') { e.preventDefault(); tsClickInPanel('.tb-mini-map-link'); return; }
}, true);

function createNavToggleButton() {
    // The Settings/Navigation dock is a DAT-only control (keyboard nav + in-page
    // popup). Truckstop doesn't use it, so don't render it there.
    if (window.TB_ADAPTER && window.TB_ADAPTER.id === 'truckstop') return;
    if (document.getElementById('datx-nav-toggle-wrap')) return;

    // Combined control: one rounded container holding two stacked rectangles —
    // Settings (top) opens the in-page TruckBox popup, Navigation (bottom)
    // toggles the keyboard-shortcuts dock.
    const wrap = document.createElement('div');
    wrap.id = 'datx-nav-toggle-wrap';
    wrap.style.cssText = `
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
`;
    // Quiet by design: it sits in DAT's dark sidebar and shouldn't compete with DAT's own nav.
    const REST_BG = 'transparent';
    const HOVER_BG = 'rgba(255,255,255,.08)';

    // Top rectangle — Settings (opens the TruckBox popup)
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'datx-tb-launcher';
    settingsBtn.type = 'button';
    settingsBtn.setAttribute('aria-label', 'TruckBox settings');
    settingsBtn.innerHTML =
        `<span style="font-weight:800;letter-spacing:-.01em;">Truck<span style="color:#8ab4ff;">Box</span></span>`;
    settingsBtn.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 7px 10px;
    border: none;
    background: ${REST_BG};
    color: #e2e8f0;
    font-size: 12px;
    cursor: pointer;
    transition: background-color .15s ease, color .15s ease;
`;
    settingsBtn.addEventListener('mouseenter', () => { settingsBtn.style.background = HOVER_BG; settingsBtn.style.color = '#fff'; });
    settingsBtn.addEventListener('mouseleave', () => { settingsBtn.style.background = REST_BG; settingsBtn.style.color = '#e2e8f0'; });
    settingsBtn.addEventListener('click', () => {
        openTruckBoxModal();
    });

    // Bottom rectangle — Navigation (opens the keyboard-shortcuts dock)
    const navBtn = document.createElement('button');
    navBtn.id = 'datx-nav-toggle';
    navBtn.type = 'button';
    navBtn.setAttribute('aria-label', 'Keyboard navigation');
    navBtn.innerHTML =
        `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" `
        + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:0 0 auto;opacity:.8;">`
        + `<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>`
        + `<span>Navigation</span>`;
    navBtn.style.cssText = `
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-top: 1px solid rgba(255,255,255,.08);
    background: ${REST_BG};
    color: #94a3b8;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: .02em;
    cursor: pointer;
    transition: background-color .15s ease, color .15s ease;
`;
    navBtn.addEventListener('mouseenter', () => { navBtn.style.background = HOVER_BG; navBtn.style.color = '#fff'; });
    navBtn.addEventListener('mouseleave', () => { navBtn.style.background = REST_BG; navBtn.style.color = '#94a3b8'; });
    navBtn.addEventListener('click', () => {
        let dock = document.getElementById('datx-nav-dock');

        if (!dock) {
            createDockPanel();   // создаём ТОЛЬКО при первом клике
            dock = document.getElementById('datx-nav-dock');
        }

        const isHidden = dock.dataset.hidden === '1';

        if (isHidden) openDock();
        else closeDock();
    });

    wrap.appendChild(settingsBtn);
    wrap.appendChild(navBtn);
    document.body.appendChild(wrap);
}

function createDockPanel() {
    if (document.getElementById('datx-nav-dock')) return;

    const dock = document.createElement('div');
    dock.id = 'datx-nav-dock';
    dock.dataset.hidden = '1';

    dock.innerHTML = `
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
        ">×</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;font-size:14px;color:#e2e8f0;">
        <div><b>W / S <b>or</b> Arrow Up / Down</b> — results table navigation</div>
        <div><b>A / D <b>or</b> Arrow Left / Right</b> — search tabs navigation</div>
        <div><b>Space</b> — open / close row</div>
        <div><b>E</b> — send email</div>
        <div><b>Q</b> — open map</div>
        <div><b>C</b> — copy load info</div>
        <div><b>R</b> — refresh loads</div>
        <div><b>F</b> — RTS Credit check</div>
        <div><b>I</b> — FMCSA report</div>
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
`;

    dock.style.cssText = `
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
`;

    document.body.appendChild(dock);

    dock.querySelector('#datx-nav-close')?.addEventListener('click', () => {
        closeDock();
    });

    dock.querySelector('#datx-open-popup')?.addEventListener('click', () => {
        closeDock();
        openTruckBoxModal();
    });
}

// In-page TruckBox panel: renders the real extension popup (popup.html) inside
// an iframe so users never have to hunt for the toolbar icon. The iframe runs
// in the extension origin, so login (chrome.identity), storage and messaging
// behave exactly as in the toolbar popup — same code, no duplication.
function createTruckBoxModal() {
    if (document.getElementById('datx-tb-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'datx-tb-modal';
    overlay.style.cssText = `
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
    `;

    const card = document.createElement('div');
    card.style.cssText = `
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
    `;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
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
    `;
    closeBtn.addEventListener('click', closeTruckBoxModal);

    const iframe = document.createElement('iframe');
    iframe.id = 'datx-tb-frame';
    // Grant the (cross-origin) popup clipboard access, or "Copy Session ID"
    // fails inside the iframe even though it works in the toolbar popup.
    iframe.allow = 'clipboard-write';
    iframe.src = chrome.runtime.getURL('src/popup/popup.html');
    // Fallback height until the popup reports its real content height. The card
    // (max 90vh) follows the iframe, so the window shrinks to just the login
    // button or grows for the tall Email Template tab.
    iframe.style.cssText = `
        width: 100%;
        height: 480px;
        border: none;
        display: block;
        transition: height .2s ease;
    `;

    // The popup (embed-autosize.js) postMessages its content height out; resize
    // the iframe to match, clamped so it never exceeds 90% of the viewport.
    window.addEventListener('message', (e) => {
        if (!String(e.origin).startsWith('chrome-extension://')) return;
        const d = e.data;
        if (!d || d.source !== 'truckbox-popup' || d.type !== 'height') return;

        const max = Math.floor(window.innerHeight * 0.9);
        const h = Math.max(120, Math.min(Math.ceil(d.height), max));
        iframe.style.height = h + 'px';
    });

    card.appendChild(closeBtn);
    card.appendChild(iframe);
    overlay.appendChild(card);

    // Click the dim backdrop (outside the card) to close.
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeTruckBoxModal();
    });

    document.body.appendChild(overlay);
}

function openTruckBoxModal() {
    createTruckBoxModal();
    const overlay = document.getElementById('datx-tb-modal');
    if (!overlay) return;

    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        const card = overlay.firstElementChild;
        if (card) card.style.transform = 'translateY(0) scale(1)';
    });

    document.addEventListener('keydown', onTruckBoxModalKey);
}

function closeTruckBoxModal() {
    const overlay = document.getElementById('datx-tb-modal');
    if (!overlay) return;

    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    const card = overlay.firstElementChild;
    if (card) card.style.transform = 'translateY(8px) scale(.98)';

    setTimeout(() => { overlay.style.display = 'none'; }, 200);
    document.removeEventListener('keydown', onTruckBoxModalKey);
}

function onTruckBoxModalKey(e) {
    if (e.key === 'Escape') closeTruckBoxModal();
}

function openDock() {
    const dock = document.getElementById('datx-nav-dock');
    if (!dock) return;

    dock.dataset.hidden = '0';
    dock.style.display = 'block';
    dock.style.pointerEvents = 'auto';

    requestAnimationFrame(() => {
        dock.style.opacity = '1';
        dock.style.transform = 'translateY(0) scale(1)';
    });
}

function closeDock() {
    const dock = document.getElementById('datx-nav-dock');
    if (!dock) return;

    dock.dataset.hidden = '1';
    dock.style.opacity = '0';
    dock.style.transform = 'translateX(-8px) scale(.97)';
    dock.style.pointerEvents = 'none';

    setTimeout(() => {
        if (dock.dataset.hidden === '1') {
            dock.style.display = 'none';
        }
    }, 250);
}

// Fast-path: inject the Route section the instant a details panel opens,
// instead of waiting for the debounced idle-callback full-list scan. Uses a
// single coalesced timer (at most one pending) so a long-lived session never
// accumulates timers, and the injectors themselves are idempotent.
let fastInjectTimer = null;
function fastInjectDetails() {
    if (fastInjectTimer) return; // already queued — coalesce
    fastInjectTimer = setTimeout(() => {
        fastInjectTimer = null;
        if (!isExtensionAlive()) return;
        try { injectMiniMapsInDetails(); } catch {}
        try { injectRefreshButton(); } catch {}
    }, 30);
}

// =========================
// Activate / teardown
// =========================
function activate() {
    if (!onDatLoadsPage()) return;
    if (!isExtensionAlive()) return;

    try {
        mo && mo.disconnect();
    } catch {
    }
    mo = null;

    clearTimeout(scanTimeout);
    scanTimeout = null;

    if (periodicScanId) {
        clearInterval(periodicScanId);
        periodicScanId = null;
    }

    const root = getResultsRoot();
    const tripSel = getTripCellSelector();

    mo = new MutationObserver((mutations) => {
        if (!isExtensionAlive()) return;

        let shouldScan = false;
        let detailsOpened = false;

        for (const mutation of mutations) {
            if (mutation.addedNodes && mutation.addedNodes.length) {
                let onlyInjected = true;
                for (const node of mutation.addedNodes) {
                    if (!isInjected(node)) {
                        onlyInjected = false;
                        break;
                    }
                }
                if (onlyInjected) continue;
            }

            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    // A load's details panel just appeared — fast-path the Route
                    // section so it shows immediately instead of waiting behind
                    // the idle-callback full-list scan.
                    if (
                        node.matches?.('dat-load-details, .table-row-detail') ||
                        node.querySelector?.('dat-load-details, .table-row-detail')
                    ) {
                        detailsOpened = true;
                    }

                    if (
                        node.matches?.(ROW_SEL) ||
                        node.querySelector?.(ROW_SEL) ||
                        node.matches?.('a[href^="mailto:"]') ||
                        node.querySelector?.('a[href^="mailto:"]') ||
                        node.matches?.('a[href^="tel:"]') ||
                        node.querySelector?.('a[href^="tel:"]') ||
                        node.matches?.(tripSel) ||
                        node.querySelector?.(tripSel)
                    ) {
                        shouldScan = true;
                        break;
                    }
                }
            }

            if (mutation.type === 'characterData') {
                const parent = mutation.target?.parentElement;
                if (parent?.closest?.(COMPANY_CELL_SEL) || parent?.closest?.(tripSel)) {
                    shouldScan = true;
                }
            }

            if (mutation.type === 'attributes') {
                const el = mutation.target;
                if (isInjected(el)) continue;
                if (el?.closest?.(ROW_SEL) || el?.closest?.(tripSel)) {
                    shouldScan = true;
                }
            }

            if (shouldScan) break;
        }

        if (detailsOpened) fastInjectDetails();
        if (shouldScan) scheduleScan(120);
    });

    try {
        mo.observe(root, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['href', 'class', 'data-test', 'style', 'aria-colindex']
        });
    } catch {
        mo.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['href', 'class', 'data-test', 'style', 'aria-colindex']
        });
    }

    periodicScanId = setInterval(() => {
        if (!isExtensionAlive()) {
            clearInterval(periodicScanId);
            periodicScanId = null;
            return;
        }

        if (!onDatLoadsPage()) {
            clearInterval(periodicScanId);
            periodicScanId = null;
            return;
        }

        scheduleScan(300);
    }, 5000);

    scanOnce();
    createNavToggleButton();

    safeDelayedScan(800);
    safeDelayedScan(2000);
    setTimeout(() => createNavToggleButton(), 1000);
}

function teardown() {
    const wrap = document.getElementById('datx-nav-toggle-wrap');
    if (wrap) wrap.remove();

    const dock = document.getElementById('datx-nav-dock');
    if (dock) dock.remove();

    try {
        mo && mo.disconnect();
    } catch {
    }
    mo = null;

    clearTimeout(scanTimeout);
    scanTimeout = null;

    if (periodicScanId) {
        clearInterval(periodicScanId);
        periodicScanId = null;
    }

    if (idleHandle) {
        if (window.cancelIdleCallback) cancelIdleCallback(idleHandle);
        else clearTimeout(idleHandle);
        idleHandle = null;
    }

    document.querySelectorAll(`[${INJECT_ATTR}="1"]`).forEach((n) => n.remove());
    document.querySelectorAll('.datx-cs-actions, .datx-inline-group, .datx-send, .datx-tpl-more, .datx-tpl-menu, .datx-map-float-outside, .datx-toast, .datx-copy-phone')
        .forEach((n) => n.remove());

    document.querySelectorAll('.datx-hidden').forEach((el) => el.classList.remove('datx-hidden'));
    document.querySelectorAll('.datx-dup').forEach((el) => el.classList.remove('datx-dup'));
    document.querySelectorAll('.datx-trip-outside').forEach((el) => el.classList.remove('datx-trip-outside'));

    processedRows = new WeakSet();
    TRIP_CELL_SEL_RESOLVED = null;

    // navi
    clearActiveRowHighlight();
    datxActiveRowIndex = -1;
}

removeStaleInjectedNodes();

function checkRoute() {
    if (onDatLoadsPage()) activate();
    else teardown();
}

// =========================
// History hooks
// =========================
(function hookHistory() {
    const _ps = history.pushState;
    const _rs = history.replaceState;

    history.pushState = function (...a) {
        const r = _ps.apply(this, a);
        setTimeout(checkRoute, 0);
        return r;
    };

    history.replaceState = function (...a) {
        const r = _rs.apply(this, a);
        setTimeout(checkRoute, 0);
        return r;
    };

    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
})();

document.addEventListener('click', () => {
    scheduleScan(200);
    setTimeout(() => scheduleScan(400), 400);
    setTimeout(() => scheduleScan(800), 800);
}, true);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkRoute);
} else {
    checkRoute();
}
