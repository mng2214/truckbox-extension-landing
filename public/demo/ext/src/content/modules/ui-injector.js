// =========================
// Selectors / constants
// =========================
// All site-specific selectors (EMAIL_RE, INJECT_ATTR, RESULTS_ROOT_SELECTORS,
// ROW_SEL, *_CELL_SEL, ...) now live in the active site adapter and are
// republished as globals by src/content/adapters/adapter-loader.js. See
// src/content/adapters/site-adapter.js for the interface.

// =========================
// Performance helpers
// =========================
var processedRows = new WeakSet();

var idleHandle = null;
var mo = null;
var scanTimeout = null;
var periodicScanId = null;
var sendInFlight = false;

// =========================
// Route gating
// =========================
// onDatLoadsPage() is published by adapter-loader.js as an alias of the active
// adapter's isLoadsPage(), so existing call sites keep working unchanged.

function getResultsRoot() {
    const r = document.querySelector(RESULTS_ROOT_SELECTORS);
    return r || document.body;
}

function isInjected(node) {
    try {
        return !!(node && node.nodeType === 1 && node.hasAttribute && node.hasAttribute(INJECT_ATTR));
    } catch {
        return false;
    }
}

function isExtensionAlive() {
    try {
        return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch {
        return false;
    }
}

function safeGetRuntimeUrl(path) {
    try {
        if (!isExtensionAlive()) return '';
        return chrome.runtime.getURL(path);
    } catch (e) {
        console.warn('Extension context invalidated while getting URL', e);
        return '';
    }
}

// In-page "Log in" buttons sign in with the provider the user last used (stored by the background
// on every sign-in): a Microsoft user must never be pushed into Google sign-in. Same background
// handlers as the popup buttons.
async function loginWithStoredProvider() {
    let provider = null;
    try {
        if (isExtensionAlive()) {
            const d = await chrome.storage.local.get(['loginProvider']);
            provider = d && d.loginProvider;
        }
    } catch { /* storage unavailable — default to Google */ }
    return safeSendMessage({ type: provider === 'MICROSOFT' ? 'auth_login_microsoft' : 'auth_login' });
}

function safeSendMessage(message) {
    return new Promise((resolve) => {
        try {
            if (!isExtensionAlive()) {
                resolve({ok: false, error: 'Extension context invalidated'});
                return;
            }

            chrome.runtime.sendMessage(message, (response) => {
                const lastError = chrome.runtime?.lastError;
                if (lastError) {
                    resolve({ok: false, error: lastError.message});
                    return;
                }
                resolve(response || {ok: false, error: 'no_response'});
            });
        } catch (e) {
            resolve({ok: false, error: 'Extension context invalidated'});
        }
    });
}

function scheduleScan(delay = 120) {
    if (idleHandle) {
        if (window.cancelIdleCallback) cancelIdleCallback(idleHandle);
        else clearTimeout(idleHandle);
        idleHandle = null;
    }

    if ('requestIdleCallback' in window) {
        idleHandle = requestIdleCallback(() => {
            removeFactoringIcons();
            scanOnce();
            idleHandle = null;
        }, {timeout: 250});
    } else {
        idleHandle = setTimeout(() => {
            removeFactoringIcons();
            scanOnce();
            idleHandle = null;
        }, delay);
    }
}

function safeDelayedScan(delay) {
    setTimeout(() => {
        if (!isExtensionAlive()) {
            teardown();
            return;
        }
        if (!onDatLoadsPage()) return;
        scanOnce();
    }, delay);
}

// =========================
// Ensure filtered-row style
// =========================
// Miles Filter dims loads below the required trip distance instead of hiding
// them. DAT renders a virtualized list, so removing rows (display:none) leaves
// blank gaps and breaks on sort/scroll. Dimming keeps the layout intact.
(function ensureHiddenStyle() {
    if (document.getElementById('datx-hidden-style')) return;
    const s = document.createElement('style');
    s.id = 'datx-hidden-style';
    s.textContent =
        `.datx-hidden{opacity:.25!important;filter:grayscale(.6)!important;transition:opacity .15s ease!important;}` +
        `.datx-dup{opacity:.4!important;filter:grayscale(.85)!important;transition:opacity .15s ease!important;}` +
        `.tb-mini-map{width:100%;max-width:100%;height:320px;overflow:hidden;` +
        `background:#f5f5f5;position:relative;}` +
        `.tb-mini-map iframe{width:100%;height:100%;border:0;display:block;}` +
        // Google's embed parks a dark satellite-preview tile in the bottom-left corner. It is
        // the one piece of that frame we can neither style nor use, so our own shortcut to the
        // full route sits over it. Google's logo and the data attribution stay untouched.
        `.tb-map-corner{position:absolute;left:0;bottom:0;z-index:5;display:inline-flex;` +
        `align-items:center;gap:7px;padding:9px 12px;background:#fff;border-radius:0 10px 0 0;` +
        `box-shadow:0 6px 18px -10px rgba(16,32,58,.55);color:#2f7be0;text-decoration:none;` +
        `font:700 11.5px/1 'Inter',ui-sans-serif,system-ui,sans-serif;letter-spacing:.02em;}` +
        `.tb-map-corner:hover{color:#10203a;}` +
        `.tb-map-corner svg{width:15px;height:15px;flex:0 0 auto;}` +
        // Vertical-only resize: a labelled pill along the bottom edge that tells
        // users the map can be dragged taller/shorter.
        `.tb-map-resize{position:absolute;left:0;right:0;bottom:0;height:26px;cursor:ns-resize;` +
        `z-index:6;display:flex;align-items:center;justify-content:center;padding-bottom:2px;}` +
        `.tb-map-resize-hint{display:inline-flex;align-items:center;gap:5px;` +
        `font:700 10px/1 Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.4px;` +
        `color:#0046E0;background:rgba(255,255,255,.92);border:1px solid #cdddff;` +
        `border-radius:999px;padding:4px 10px;box-shadow:0 1px 4px rgba(0,0,0,.14);` +
        `transition:background .15s,color .15s,border-color .15s;}` +
        `.tb-map-resize-hint svg{width:11px;height:11px;flex:0 0 auto;}` +
        `.tb-map-resize:hover .tb-map-resize-hint{background:#0046E0;color:#fff;border-color:#0046E0;}` +
        `.tb-mini-map-link{display:inline-flex;align-items:center;gap:7px;margin-top:8px;cursor:pointer;` +
        `font:700 12px/1 Arial,Helvetica,sans-serif;color:#0046E0;text-decoration:none;` +
        `background:#eef3ff;border:1px solid #cdddff;border-radius:999px;padding:7px 13px;` +
        `transition:background .18s,border-color .18s,box-shadow .18s,color .18s,transform .12s;}` +
        `.tb-mini-map-link:hover{background:#0046E0;color:#fff;border-color:#0046E0;text-decoration:none;` +
        `box-shadow:0 4px 12px rgba(0,70,224,.28);transform:translateY(-1px);}` +
        `.tb-mini-map-link:active{transform:translateY(0) scale(.97);}` +
        `.tb-mini-map-link svg{width:14px;height:14px;flex:0 0 auto;}` +
        `.tb-mini-map-link .tb-map-arrow{transition:transform .18s ease;}` +
        `.tb-mini-map-link:hover .tb-map-arrow{transform:translate(2px,-2px);}` +
        // Truckstop: route button overlaid on top of the native map (the map
        // container is position:relative), centred along its top edge.
        `.tb-ts-maplink-wrap{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:900;}` +
        `.tb-ts-maplink-wrap .tb-mini-map-link{box-shadow:0 1px 5px rgba(0,0,0,.22);}` +
        `.tb-ts-maplink-wrap .tb-mini-map-link:hover{box-shadow:0 4px 12px rgba(0,70,224,.32);}` +
        // Footer row under the map: bug-report link (left) + Google Maps (right).
        `.tb-map-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;}` +
        `.tb-map-footer .tb-mini-map-link{margin-top:0;}` +
        `.tb-bug-link{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;` +
        `font-size:12px;font-weight:600;color:#64748b;text-decoration:none;}` +
        `.tb-bug-link:hover{color:#0046E0;text-decoration:underline;}` +
        // "Need a custom soft?" pill + click-popover (center of the map footer).
        `.tb-soft-wrap{position:relative;display:inline-flex;}` +
        `.tb-soft-btn{display:inline-flex;align-items:center;white-space:nowrap;cursor:pointer;` +
        `font:600 11px/1 Arial,Helvetica,sans-serif;color:#94a3b8;background:transparent;` +
        `border:0;border-radius:999px;padding:2px 4px;transition:color .15s;}` +
        `.tb-soft-btn:hover{color:#0046E0;text-decoration:underline;}` +
        `.tb-soft-pop{display:none;position:absolute;bottom:calc(100% + 7px);left:50%;` +
        `transform:translateX(-50%);width:232px;background:#fff;border:1px solid #e2e8f0;` +
        `border-radius:12px;box-shadow:0 12px 30px rgba(15,23,42,.22);padding:14px 14px 13px;` +
        `z-index:2147483646;text-align:left;}` +
        `.tb-soft-wrap.tb-open .tb-soft-pop{display:block;}` +
        `.tb-soft-pop::after{content:'';position:absolute;top:100%;left:50%;` +
        `transform:translateX(-50%);border:7px solid transparent;border-top-color:#fff;}` +
        `.tb-soft-close{position:absolute;top:6px;right:7px;width:20px;height:20px;` +
        `display:flex;align-items:center;justify-content:center;border:0;background:transparent;` +
        `color:#94a3b8;font:400 18px/1 Arial,Helvetica,sans-serif;cursor:pointer;padding:0;border-radius:6px;}` +
        `.tb-soft-close:hover{color:#0f172a;background:#f1f5f9;}` +
        `.tb-soft-title{font:800 12.5px/1.35 Arial,Helvetica,sans-serif;color:#0f172a;margin:0 16px 9px 0;}` +
        `.tb-soft-list{list-style:none;margin:0 0 11px;padding:0;display:flex;flex-direction:column;gap:5px;}` +
        `.tb-soft-list li{position:relative;padding-left:16px;` +
        `font:600 11.5px/1.3 Arial,Helvetica,sans-serif;color:#475569;}` +
        `.tb-soft-list li::before{content:'';position:absolute;left:3px;top:5px;width:5px;height:5px;` +
        `border-radius:50%;background:#0046E0;}` +
        `.tb-soft-cta,.tb-soft-cta:link,.tb-soft-cta:visited,.tb-soft-cta:hover{` +
        `display:flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box;` +
        `text-decoration:none!important;font:700 12px/1 Arial,Helvetica,sans-serif;` +
        `color:#fff!important;border-radius:8px;padding:9px 10px;background:#0046E0!important;}` +
        `.tb-soft-cta:hover{background:#0037b3!important;}` +
        // Map gets its own real column (flex sibling of Trip/Rate/Company).
        // flex-basis keeps it a sensible width; min-width + the container's
        // flex-wrap make it drop to a new line on narrow screens (no overlap).
        `.tb-map-col{flex:1 1.5 440px;min-width:300px;max-width:640px;box-sizing:border-box;` +
        `align-self:flex-start;margin-right:24px;}` +
        // ----- Responsive shrink priority on narrow windows -----
        // Rate & Company (generic DAT columns) give up width first; the Route
        // column (ours) shrinks a little after them; the Trip column — the one
        // holding dat-route — is protected by a low shrink factor + wide min.
        `.details-column{flex-shrink:4!important;min-width:130px;}` +
        `.details-column:has(dat-route){flex-shrink:.35!important;min-width:320px;}` +
        `.tb-map-col .tb-mini-map{margin-top:0;}` +
        // Spacing under the cloned native header so the stats/map don't crowd it.
        // flex so the "Review" link can sit on the right edge of the grey bar.
        `.tb-map-header{display:flex;align-items:center;margin-bottom:14px;}` +
        // "Like it? Review pls" link — right-aligned inside the grey header bar.
        `.tb-review-link{margin-left:auto;flex:0 0 auto;text-decoration:none;white-space:nowrap;` +
        `font:700 12px/1 Arial,Helvetica,sans-serif;color:#0046E0;padding-left:12px;}` +
        `.tb-review-link:hover{text-decoration:underline;}` +
        `.tb-review-star{color:#f59e0b;}` +
        // Fallback header bar (used only if no native DAT header exists to clone)
        // — mimics DAT's grey "Trip"/"Rate" header strip.
        `.tb-map-col-label{font:600 13px/1 Arial,Helvetica,sans-serif;color:#636d78;` +
        `background:#f3f4f6;padding:9px 12px;border-radius:4px;margin-bottom:14px;}` +
        // "Powered by TruckBox" brand pill that follows the "Route" header word.
        `.tb-pb{display:inline-flex;align-items:center;gap:5px;margin-left:9px;vertical-align:middle;` +
        `font:700 10px/1 Arial,Helvetica,sans-serif;text-transform:none;letter-spacing:.2px;` +
        `color:#0046E0;background:#eef3ff;border:1px solid #cdddff;border-radius:999px;padding:3px 9px 3px 7px;}` +
        `.tb-pb b{font-weight:800;}` +
        `.tb-pb svg{width:11px;height:11px;flex:0 0 auto;}` +
        // ----- Ordered route board: stats strip · tools strip · map -----
        // overflow:visible so button tooltips can extend past the card edge
        // without being clipped; the map rounds its OWN corners (see below).
        `.tb-board{border:0;border-radius:12px;background:#fff;overflow:visible;` +
        `box-shadow:0 1px 3px rgba(16,24,40,.07),0 1px 2px rgba(16,24,40,.04);}` +
        // Row 1 — miles + RPM cells (no hairline dividers).
        `.tb-board-stats{display:flex;flex-wrap:wrap;align-items:stretch;}` +
        `.tb-board-stats .tb-stat{flex:1 1 0;min-width:72px;display:flex;flex-direction:column;gap:4px;` +
        `padding:9px 11px;}` +
        `.tb-board-stats .tb-stat .k{font:600 9px/1 Arial,Helvetica,sans-serif;` +
        `letter-spacing:.4px;text-transform:uppercase;color:#64748b;}` +
        `.tb-board-stats .tb-stat .v{font:700 14px/1 Arial,Helvetica,sans-serif;color:#192129;}` +
        `.tb-board-stats .tb-stat.total .v{color:#0046E0;}` +
        `.tb-board-stats .tb-stat.rate .v{color:#047857;}` +
        `.tb-board-copy{flex:0 0 auto;border:0;border-radius:0;` +
        `background:#fff;padding:9px 13px;white-space:nowrap;box-shadow:none;}` +
        `.tb-board-copy:hover{box-shadow:none;background:#f8fafc;}` +
        // Row 2 — three tool cells: calculator | FMCSA | RTS (no dividers).
        `.tb-board-tools{display:flex;flex-wrap:nowrap;align-items:stretch;}` +
        `.tb-board-tools:last-child{border-radius:0 0 11px 11px;}` +
        `.tb-board-cell{display:flex;align-items:center;padding:9px 12px;}` +
        `.tb-board-calc{flex:0 0 auto;}` +
        `.tb-board-fmcsa{flex:0 0 auto;}` +
        `.tb-board-rts{flex:1 1 auto;min-width:0;}` +
        // Calculator drops its own frame inside the celled board.
        `.tb-board-calc .tb-rate-calc{border:0;background:transparent;padding:0;margin:0;}` +
        // FMCSA button wraps to compact lines instead of one long line.
        `.tb-board-fmcsa .tb-fmcsa-btn{white-space:normal;text-align:center;line-height:1.2;max-width:88px;` +
        `gap:0;padding-left:8px;padding-right:8px;}` +
        // RTS control fills its cell; button & result badge keep one height.
        `.tb-board-rts .tb-rts-holder{width:100%;}` +
        `.tb-board-rts .tb-rts-holder>button{width:100%;box-sizing:border-box;justify-content:center;}` +
        `.tb-board-rts .datx-rts-badge{max-width:none;box-sizing:border-box;}` +
        // Triumph stacks under RTS in the same cell and must size identically —
        // without these it would render as a shrink-to-fit button next to a
        // full-width one.
        `.tb-board-rts .tb-factoring-cta{width:100%;}` +
        `.tb-board-rts .tb-factoring-cta>button{width:100%;box-sizing:border-box;justify-content:center;}` +
        `.tb-board-rts .tb-triumph-holder,.tb-board-rts .tb-apex-holder{width:100%;}` +
        `.tb-board-rts .tb-triumph-holder>button,.tb-board-rts .tb-apex-holder>button` +
        `{width:100%;box-sizing:border-box;justify-content:center;}` +
        // Map fills the bottom of the card. It rounds its OWN bottom corners
        // (board is overflow:visible now, so it can't clip them for us).
        `.tb-board .tb-mini-map{margin:0;border:0;border-radius:0 0 11px 11px;width:100%;}` +
        `.tb-mini-map-link{margin-top:8px;}` +
        // Logged-out teaser (greyed map placeholder + login CTA)
        `.tb-route-locked{position:relative;height:300px;border-radius:14px;overflow:hidden;` +
        `border:1px solid #ddd;}` +
        `.tb-route-locked-bg{position:absolute;inset:0;` +
        `background:linear-gradient(135deg,#e7edf5,#f4f6fa 60%,#eef1f6);` +
        `background-size:cover;}` +
        `.tb-route-locked-overlay{position:absolute;inset:0;display:flex;flex-direction:column;` +
        `align-items:center;justify-content:center;text-align:center;gap:8px;padding:18px;` +
        `background:rgba(255,255,255,.5);backdrop-filter:blur(2px);}` +
        `.tb-route-locked-icon{font-size:26px;line-height:1;}` +
        `.tb-route-locked-title{font:700 14px/1.2 Arial,Helvetica,sans-serif;color:#192129;}` +
        `.tb-route-locked-sub{font:400 12px/1.45 Arial,Helvetica,sans-serif;color:#64748b;max-width:240px;}` +
        `.tb-route-login{margin-top:6px;cursor:pointer;font:700 13px/1 Arial,Helvetica,sans-serif;` +
        `color:#fff;background:#0046E0;border:0;border-radius:9px;padding:10px 16px;` +
        `transition:background .2s,transform .15s,box-shadow .2s;}` +
        `.tb-route-login:hover{background:#0037b3;transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,70,224,.3);}` +
        `.tb-route-login:disabled{opacity:.7;cursor:default;transform:none;box-shadow:none;}` +
        // Tools row (copy button + rate calculator + RTS badge)
        `.tb-tools{display:flex;flex-direction:row;flex-wrap:wrap;align-items:flex-start;gap:12px;margin-top:14px;}` +
        `.tb-copy-btn{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;` +
        `font:600 12px/1 Arial,Helvetica,sans-serif;color:#0a6cb8;background:#fff;` +
        `border:1.5px solid #bcdcf3;border-radius:9px;padding:8px;` +
        `transition:border-color .2s,box-shadow .2s,background .2s,color .2s;}` +
        `.tb-copy-btn:hover{border-color:#0a6cb8;box-shadow:0 0 0 3px rgba(10,108,184,.15);}` +
        `.tb-copy-btn.copied{color:#16a34a;border-color:#16a34a;background:#f0fdf4;box-shadow:none;}` +
        `.tb-fmcsa-btn{display:inline-flex;align-items:center;gap:7px;cursor:pointer;align-self:flex-start;` +
        `flex:0 0 auto;white-space:nowrap;` +
        `font:600 12px/1 Arial,Helvetica,sans-serif;color:#0a6cb8;background:#fff;` +
        `border:1.5px solid #bcdcf3;border-radius:9px;padding:8px 12px;` +
        `transition:border-color .2s,box-shadow .2s,background .2s,color .2s;}` +
        `.tb-fmcsa-btn:hover{border-color:#0a6cb8;box-shadow:0 0 0 3px rgba(10,108,184,.15);}` +
        `.tb-rate-calc{width:fit-content;max-width:100%;box-sizing:border-box;padding:7px 10px;` +
        `margin-top:10px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc;}` +
        `.tb-calc-title{display:flex;align-items:center;gap:8px;` +
        `font:800 10px/1.2 Arial,Helvetica,sans-serif;text-transform:uppercase;` +
        `letter-spacing:.3px;text-align:left;margin-bottom:5px;}` +
        `.tb-calc-title .tb-ct-grey{color:#94a3b8;margin-left:auto;}` +
        `.tb-calc-title .tb-ct-blue{color:#0046E0;}` +
        // Mode switch pill — flips the calc between Rate→RPM and RPM→Rate.
        `.tb-calc-switch{display:inline-flex;align-items:center;gap:3px;cursor:pointer;` +
        `font:800 9px/1 Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.3px;` +
        `color:#0046E0;background:#eef3ff;border:1px solid #cdddff;border-radius:999px;` +
        `padding:3px 7px;white-space:nowrap;}` +
        `.tb-calc-switch:hover{background:#e0eaff;border-color:#0046E0;}` +
        `.tb-calc-switch svg{width:10px;height:10px;flex:0 0 auto;}` +
        `.tb-calc-body{display:flex;align-items:center;gap:12px;flex-wrap:nowrap;}` +
        `.tb-calc-row{display:flex;align-items:center;gap:4px;background:#fff;flex:0 0 auto;width:84px;` +
        `border:1.5px solid #d1d5db;border-radius:7px;padding:5px 8px;}` +
        `.tb-calc-row:focus-within{border-color:#0046E0;box-shadow:0 0 0 2px rgba(0,70,224,.12);}` +
        `.tb-calc-dollar{font:700 12px/1 Arial,Helvetica,sans-serif;color:#64748b;}` +
        `.tb-calc-input{flex:1;min-width:0;border:0;outline:0;background:transparent;` +
        `font:700 13px/1 Arial,Helvetica,sans-serif;color:#192129;}` +
        // Spinners on a rate field are useless — nobody nudges a freight rate by one dollar —
        // and they eat the width the number needs.
        `.tb-calc-input::-webkit-outer-spin-button,` +
        `.tb-calc-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}` +
        `.tb-calc-input{-moz-appearance:textfield;appearance:textfield;}` +
        `.tb-calc-out{display:flex;flex-direction:column;gap:3px;flex:0 0 auto;}` +
        `.tb-calc-stat{display:flex;flex-direction:row;align-items:baseline;gap:6px;}` +
        `.tb-calc-stat .k{font:600 9px/1 Arial,Helvetica,sans-serif;text-transform:uppercase;` +
        `letter-spacing:.3px;color:#64748b;}` +
        `.tb-calc-stat .v{font:700 13px/1 Arial,Helvetica,sans-serif;color:#192129;min-width:46px;}` +
        `.tb-calc-stat.total .v{color:#0046E0;}` +
        `.tb-tools .datx-rts-badge{margin-top:0;}` +
        // Refresh Loads button (results header) — filled & prominent
        `.tb-refresh-btn{display:inline-flex;align-items:center;gap:6px;cursor:pointer;vertical-align:middle;` +
        `font:700 11.5px/1 Arial,Helvetica,sans-serif;color:#fff;background:#0046E0;` +
        `border:1.5px solid #0046E0;border-radius:8px;padding:8px 14px;margin-left:24px;` +
        `box-shadow:0 2px 7px rgba(0,70,224,.32);` +
        `transition:background .2s,box-shadow .2s,transform .15s;}` +
        `.tb-refresh-btn:hover:not(:disabled){background:#0037b3;border-color:#0037b3;` +
        `box-shadow:0 5px 14px rgba(0,70,224,.42);transform:translateY(-1px);}` +
        `.tb-refresh-btn:active:not(:disabled){transform:translateY(0) scale(.98);}` +
        `.tb-refresh-btn:disabled{cursor:default;color:#fff;background:#9aa7c2;border-color:#9aa7c2;box-shadow:none;}` +
        `.tb-refresh-btn.cooling .tb-refresh-ic{animation:tb-spin 1s linear infinite;transform-origin:center;}` +
        `@keyframes tb-spin{to{transform:rotate(360deg);}}` +
        // Instant hover tooltip (shared)
        `.tb-tip{position:relative;}` +
        `.tb-tip::after{content:attr(data-tip);position:absolute;top:calc(100% + 8px);left:50%;` +
        `transform:translateX(-50%) translateY(-3px);width:max-content;max-width:220px;text-align:center;` +
        `text-transform:none;letter-spacing:normal;white-space:normal;` +
        `background:#0f172a;color:#fff;font:600 11px/1.35 Arial,Helvetica,sans-serif;padding:7px 10px;` +
        `border-radius:8px;box-shadow:0 8px 22px rgba(0,0,0,.28);opacity:0;pointer-events:none;` +
        `transition:opacity .15s ease,transform .15s ease;z-index:2147483647;}` +
        `.tb-tip:hover::after{opacity:1;transform:translateX(-50%) translateY(0);}` +
        `.datx-rts-badge{display:inline-flex;flex-direction:column;gap:7px;` +
        `padding:9px 12px;border-radius:10px;border:1px solid #bcdcf3;background:#eef6fd;}` +
        `.datx-rts-badge .rts-top{display:flex;align-items:center;gap:8px;}` +
        `.datx-rts-badge .rts-logo{font:800 15px/1 Arial,Helvetica,sans-serif;letter-spacing:.5px;color:#0a6cb8;}` +
        `.datx-rts-badge .rts-cap{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.3px;}` +
        `.datx-rts-badge .rts-soon{font-size:10px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:.4px;}` +
        `.datx-rts-badge .rts-row{display:flex;align-items:center;gap:9px;}` +
        `.datx-rts-badge .rts-grade{display:inline-flex;align-items:center;justify-content:center;` +
        `width:26px;height:26px;border-radius:999px;font:800 14px/1 Arial,Helvetica,sans-serif;color:#fff;background:#94a3b8;}` +
        `.datx-rts-badge .rts-grade.a{background:#16a34a;}.datx-rts-badge .rts-grade.b{background:#65a30d;}.datx-rts-badge .rts-grade.c{background:#f59e0b;}` +
        `.datx-rts-badge .rts-grade.d{background:#ea580c;}.datx-rts-badge .rts-grade.f{background:#dc2626;}` +
        // Triumph reuses the RTS badge shell but reports a status, not a letter
        // grade, so its pill is wider and colour-coded by GREEN/RED/NOBUY.
        `.datx-rts-badge .tri-status{display:inline-flex;align-items:center;justify-content:center;` +
        `padding:5px 10px;border-radius:999px;font:800 11px/1 Arial,Helvetica,sans-serif;` +
        `text-transform:uppercase;letter-spacing:.4px;color:#fff;background:#94a3b8;white-space:nowrap;}` +
        `.datx-rts-badge .tri-status.green{background:#16a34a;}.datx-rts-badge .tri-status.red{background:#dc2626;}` +
        `.datx-rts-badge .tri-status.nobuy{background:#dc2626;}` +
        // Triumph's status pill is far wider than RTS's round letter, so in a
        // narrow details panel it would squeeze the figures beside it down to a
        // word per line. Let the row wrap: below ~130px of room the numbers drop
        // onto their own full-width line instead of being crushed.
        `.datx-rts-badge .rts-row.tri-row{flex-wrap:wrap;}` +
        `.datx-rts-badge .tri-meta{flex:1 1 130px;min-width:0;}` +
        `.datx-rts-badge .rts-report{cursor:pointer;font:600 11px/1 Arial,Helvetica,sans-serif;color:#0a6cb8;` +
        `background:#fff;border:1px solid #bcdcf3;border-radius:8px;padding:6px 10px;` +
        `transition:border-color .2s,box-shadow .2s,transform .15s;}` +
        `.datx-rts-badge .rts-report:hover{border-color:#0a6cb8;box-shadow:0 0 0 3px rgba(10,108,184,.18);transform:translateY(-1px);}` +
        `.datx-rts-badge .rts-report:disabled{opacity:.6;cursor:default;box-shadow:none;transform:none;}` +
        // ----- Dark mode (whole-page filter invert) -----
        // Toggling `tb-dark` on <html> inverts the entire DAT page AND our
        // injected UI; media is re-inverted below so photos/logos/maps look
        // normal (double invert = original).
        // invert(.9) (not 1) so white surfaces land on soft charcoal (~#1a1a1a)
        // instead of harsh pure black, and text softens to light grey.
        `html.tb-dark{filter:invert(.9) hue-rotate(180deg)!important;background:#fff!important;}` +
        `html.tb-dark img,html.tb-dark picture,html.tb-dark video,html.tb-dark canvas,` +
        `html.tb-dark iframe{filter:invert(1) hue-rotate(180deg)!important;}` +
        // Keep DAT's left sidebar (Angular Material drawer) in its ORIGINAL
        // colors: re-invert the whole drawer so the page filter cancels out.
        `html.tb-dark .mat-drawer{filter:invert(1) hue-rotate(180deg)!important;}` +
        // Our TruckBox / Navigation block sits on that sidebar, so it keeps its colors the same way
        // (otherwise its light text inverts to dark-on-dark).
        `html.tb-dark #datx-nav-toggle-wrap{filter:invert(1) hue-rotate(180deg)!important;}` +
        // ----- Tame DAT's blue link text in dark mode -----
        // DAT paints its clickable text (Trip, Origin, Destination, Company,
        // Contact email/phone) in a saturated brand blue. Under invert(.9)+
        // hue-rotate that blue survives as a harsh bright blue that hits the eye,
        // while neutral text softens to a pleasant light grey. We neutralize just
        // those link cells to a near-black SOURCE color (~#1a1a1a) so the page
        // filter renders them as the same soft light grey as the rest of the row.
        // Scoped to DAT result rows + the load-detail contact block so we never
        // touch our own injected UI or semantically-colored elements.
        `html.tb-dark [data-test="load-trip-cell"],html.tb-dark [data-test="load-trip-cell"] a,html.tb-dark [data-test="load-trip-cell"] span,` +
        `html.tb-dark [data-test="load-origin-cell"],html.tb-dark [data-test="load-origin-cell"] a,html.tb-dark [data-test="load-origin-cell"] span,` +
        `html.tb-dark [data-test="load-destination-cell"],html.tb-dark [data-test="load-destination-cell"] a,html.tb-dark [data-test="load-destination-cell"] span,` +
        `html.tb-dark [class*="mat-column-company"],html.tb-dark [class*="cell-company"] a,html.tb-dark [class*="mat-column-company"] a,html.tb-dark [class*="mat-column-company"] span,` +
        `html.tb-dark [data-test="load-contact-cell"],html.tb-dark [data-test="load-contact-cell"] a,html.tb-dark [data-test="load-contact-cell"] span,` +
        `html.tb-dark .row-container a[href^="mailto:"],html.tb-dark .row-container a[href^="tel:"],` +
        `html.tb-dark dat-load-details a[href^="mailto:"],html.tb-dark dat-load-details a[href^="tel:"],` +
        `html.tb-dark .table-row-detail a[href^="mailto:"],html.tb-dark .table-row-detail a[href^="tel:"],` +
        `html.tb-dark .contacts a,html.tb-dark .contact-methods a,html.tb-dark dat-contacts a` +
        `{color:#1a1a1a!important;}` +
        // Dark-mode toggle button — neutral icon button next to Refresh.
        `.tb-dark-toggle{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;` +
        `vertical-align:middle;margin-left:8px;width:34px;height:34px;color:#0046E0;background:#fff;` +
        `border:1.5px solid #cdddff;border-radius:8px;box-shadow:0 2px 7px rgba(0,70,224,.12);` +
        `transition:background .2s,box-shadow .2s,color .2s,border-color .2s;}` +
        `.tb-dark-toggle:hover{background:#eef3ff;border-color:#0046E0;}` +
        `.tb-dark-toggle svg{width:16px;height:16px;}` +
        // Truckstop: docked next to the logo in the (dark) top header.
        `.tb-dark-toggle--ts{margin:0 0 0 16px;vertical-align:middle;width:36px;height:36px;}` +
        // Floating fallback if the header isn't present yet.
        `.tb-dark-toggle--float{position:fixed;left:16px;bottom:16px;z-index:2147483647;` +
        `margin:0;width:42px;height:42px;box-shadow:0 4px 14px rgba(0,0,0,.22);}` +
        `.tb-dark-toggle--float svg{width:20px;height:20px;}` +
        // One-time "look here" pulse for the Refresh + dark-mode buttons on load.
        `@keyframes tb-attn-pulse{0%{box-shadow:0 0 0 0 rgba(0,70,224,.55);}` +
        `60%{box-shadow:0 0 0 13px rgba(0,70,224,0);}100%{box-shadow:0 0 0 0 rgba(0,70,224,0);}}` +
        `.tb-attn{animation:tb-attn-pulse 1.3s ease-out 3;position:relative;z-index:5;}`;

    document.head.appendChild(s);
})();

// Brand "Powered by TruckBox" pill appended after the "Route" header word.
const TB_PB_BADGE =
    '<span class="tb-pb">Powered by ' +
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M3 14h9l-1.5 7L21 9h-9l1.5-7L3 14Z" fill="currentColor"/></svg>' +
    '<b>TruckBox</b></span>';

// =========================
// Text helpers
// =========================
var text = (el) =>
    el && (el.innerText || el.textContent)
        ? (el.innerText || el.textContent).trim()
        : '';

function showToast(msg, type = 'info', ms = 3000) {
    const el = document.createElement('div');
    el.className = `datx-toast ${type}`;
    el.textContent = msg;
    el.setAttribute(INJECT_ATTR, '1');
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 400);
    }, ms);
}

// One device per account: when this computer was signed out because the account signed in
// elsewhere (see background/modules/device-session.js), say so right on the load board.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.signedOutReason) return;
    if (changes.signedOutReason.newValue !== 'other_device') return;
    showToast(
        'TruckBox signed you out: your account was signed in on another computer. ' +
        'One subscription works on one computer at a time.',
        'error',
        9000
    );
});

function normalizePlace(raw) {
    if (!raw) return '';
    let t = String(raw).replace(/\s+/g, ' ').replace(/[–—]/g, '-').trim();

    const mCitySt = t.match(/([A-Za-z .'-]+?),\s*([A-Z]{2})(?![A-Za-z])/);
    if (mCitySt) {
        const city = cap(mCitySt[1]);
        const state = mCitySt[2];
        return `${city}, ${state}`;
    }
    const mCitySpSt = t.match(/([A-Za-z .'-]+)\s+([A-Z]{2})(?![A-Za-z])/);
    if (mCitySpSt) return `${cap(mCitySpSt[1])}, ${mCitySpSt[2]}`;

    const mOnlyState = t.match(/^\s*([A-Z]{2})\s*$/);
    if (mOnlyState) return mOnlyState[1];

    return t;
}

function isOnlyState(s) {
    return /^[A-Z]{2}$/.test(s || '');
}

function cap(s) {
    return s.toLowerCase()
        .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
        .replace(/\bMc([a-z])/g, (_, c) => 'Mc' + c.toUpperCase());
}

function findCityStatePairs(txt) {
    const out = [];
    if (!txt) return out;
    const t = String(txt).replace(/\s+/g, ' ').trim();
    const re = /([A-Za-z.'\- ]+?),\s*([A-Z]{2})(?![A-Za-z])/g;
    let m;
    while ((m = re.exec(t))) out.push(`${m[1].trim()}, ${m[2]}`);
    return out;
}

function routeCityStateFallback(routeTxt) {
    const pairs = findCityStatePairs(routeTxt);
    if (pairs.length >= 2) return {origin: pairs[0], destination: pairs[pairs.length - 1]};
    if (pairs.length === 1) return {origin: pairs[0], destination: null};
    return {origin: null, destination: null};
}

function parseRoute(routeText) {
    if (!routeText) return {origin: null, destination: null};
    const parts = routeText.split(/→|->|›|➔|⇒/);
    if (parts.length >= 2) return {origin: parts[0].trim(), destination: parts.slice(1).join(' → ').trim()};
    return {origin: null, destination: routeText.trim()};
}

function normalizePickup(txt) {
    if (!txt) return null;
    const t = txt.replace(/\s+/g, ' ').trim();
    const m = t.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
    return m ? m[1] : null;
}

function extractEquipShort(txt) {
    if (!txt) return '';
    const firstLine = String(txt).split(/\n|,|;/)[0].trim();
    const m = firstLine.match(/[A-Za-z]{1,3}/);
    return m ? m[0].toUpperCase() : firstLine;
}

function extractLenWtCapFromEquip(txt) {
    const out = {};
    const t = String(txt || '').replace(/\s+/g, ' ');
    const mL = t.match(/(\d{1,3})\s*ft\b/i);
    const mW = t.match(/([\d,]{2,})\s*lbs\b/i);
    const mC = t.match(/\b(full|partial)\b/i);
    if (mL) out.length = `${mL[1]} ft`;
    if (mW) out.weight = `${mW[1]} lbs`;
    if (mC) out.capacity = mC[1][0].toUpperCase() + mC[1].slice(1).toLowerCase();
    return out;
}

function extractCityStateSmart(cellEl, rowEl) {
    if (!cellEl) return null;

    const pickText = (el) => {
        const prefer = el.querySelector('a, span, div, strong, b');
        let t = (prefer ? (prefer.innerText || prefer.textContent) : (el.innerText || el.textContent)) || '';
        return t.replace(/\u00a0/g, ' ').replace(/\s{2,}/g, ' ').trim();
    };

    const CLEAN = pickText(cellEl);

    let m = CLEAN.match(/([A-Za-z][A-Za-z .'\-]+),\s*([A-Z]{2})\b/);
    if (m) return `${m[1]}, ${m[2]}`;

    const cityOnly = (CLEAN.match(/([A-Za-z][A-Za-z .'\-]+)/) || [null, null])[1];
    if (!cityOnly) return null;

    const ROW = ((rowEl?.innerText || rowEl?.textContent) || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s{2,}/g, ' ');

    const idx = ROW.indexOf(cityOnly);
    if (idx >= 0) {
        const right = ROW.slice(idx, idx + 80);
        const mRight = right.match(/,\s*([A-Z]{2})\b/);
        if (mRight) return `${cityOnly}, ${mRight[1]}`;
    }

    const ST_RE_GLOBAL =
        /\b(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/g;

    let best = null, bestDist = Infinity;
    let g;
    while ((g = ST_RE_GLOBAL.exec(ROW))) {
        const st = g[1];
        const pos = g.index;
        let dist = Math.abs(pos - idx);
        if (pos < idx) dist += 50;
        if (dist < bestDist) {
            bestDist = dist;
            best = st;
        }
    }
    return best ? `${cityOnly}, ${best}` : null;
}

// =========================
// Top origin + Maps link
// =========================

function ensureEmailButtonForDetails(row) {
    if (!row) return false;

    const next = row.nextElementSibling;
    if (!next) return false;

    // Only scan when the row is expanded: its sibling must be a details panel,
    // not the next (collapsed) list row — otherwise we'd inject into that row.
    if (next.matches?.(ROW_SEL)) return false;

    // Inject a button inline next to EVERY mailto email in this load's details.
    let any = false;
    next.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
        const email = normalizeEmail(a.getAttribute('href') || a.textContent || '');
        if (!email) return;
        injectInlineEmailButton(a, row, email);
        any = true;
    });

    return any;
}

// Free-text emails in the COMMENTS block ("or email loads@x.com for load
// details") also get a Send button now — see ensureEmailButtonsInComments().
// They still do NOT count as a row's *contact* email (findContactEmail() keeps
// ignoring them), so the row-cell button and contact-info logic are unchanged.

function findRowFromDetails(el) {
    if (!el) return null;

    const detail = el.closest('.table-row-detail');
    if (!detail) return el.closest(ROW_SEL) || null;

    let node = detail.previousElementSibling;
    while (node) {
        if (node.matches?.(ROW_SEL)) return node;
        node = node.previousElementSibling;
    }

    return null;
}

function ensureEmailButtonsInDetails() {
    const anchors = document.querySelectorAll(DETAILS_EMAIL_SEL);

    anchors.forEach((a) => {
        if (!(a instanceof Element)) return;

        const email = emailOfElement(a);
        if (!email) return;

        const row =
            findRowFromDetails(a) ||
            a.closest(ROW_SEL) ||
            document.body;

        injectInlineEmailButton(a, row, email);
    });
}

// COMMENTS block: brokers often drop a free-text address in the note ("or email
// loads@x.com for load details"). We inject a Send button right after the
// comment text (a sibling — never splitting Angular's text node) for the first
// email found. This is additive: it reuses injectInlineEmailButton(), whose
// dedupe guard, liveEmailForTarget() and reconcileInlineEmailButtons() already
// handle free-text targets, so cleanup-on-recycle works with no extra code.
function ensureEmailButtonsInComments() {
    document.querySelectorAll(DETAILS_COMMENT_SEL).forEach((container) => {
        if (!(container instanceof Element)) return;

        // Prefer the actual note text element so the button hugs the comment;
        // fall back to the container when that variant has no .notes-contents.
        const target = container.matches?.('.notes-contents')
            ? container
            : (container.querySelector?.('.notes-contents') || container);

        // A mailto: link inside comments is already covered by the generic
        // details scan — don't double up.
        if (target.querySelector?.('a[href^="mailto:"]')) return;

        const m = String(target.textContent || '').match(EMAIL_RE);
        if (!m) return;

        const email = normalizeEmail(m[0]);
        if (!email) return;

        const row =
            findRowFromDetails(target) ||
            target.closest(ROW_SEL) ||
            document.body;

        injectInlineEmailButton(target, row, email);
    });
}

// Deep querySelectorAll that descends into open shadow roots. Truckstop renders
// the broker detail panel inside a Shadow DOM, so a plain
// document.querySelectorAll can't reach the email icon — confirmed by probe
// (plain=0, shadow-piercing=1). Returns a flat array of matches.
function tbDeepQueryShadow(selector, root) {
    var out = [];
    root = root || document;
    var nodes;
    try { nodes = root.querySelectorAll(selector); } catch (e) { return out; }
    for (var i = 0; i < nodes.length; i++) out.push(nodes[i]);

    var all;
    try { all = root.querySelectorAll('*'); } catch (e) { return out; }
    for (var j = 0; j < all.length; j++) {
        if (all[j].shadowRoot) {
            var inner = tbDeepQueryShadow(selector, all[j].shadowRoot);
            for (var k = 0; k < inner.length; k++) out.push(inner[k]);
        }
    }
    return out;
}

// Truckstop: the broker email anchor sits inside an overflow:hidden .truncate
// wrapper AND inside a Shadow DOM. We mount the Send button in the email-row
// ICON slot (not truncated), hiding the original envelope icon. Reaches the
// shadow tree via tbDeepQueryShadow. Driven by EMAIL_ICON_SEL: undefined on
// sites that don't set it (e.g. DAT), so this whole function no-ops there.
function ensureEmailIconButtons() {
    if (!EMAIL_ICON_SEL) return;

    var icons;
    try {
        icons = tbDeepQueryShadow(EMAIL_ICON_SEL);
    } catch {
        return;
    }

    icons.forEach((icon) => {
        if (!(icon instanceof Element)) return;

        const slot = icon.parentElement;                 // .contact-row__icon
        const row = icon.closest('.contact-row') || slot;
        if (!slot || !row) return;

        const a = row.querySelector('a[href^="mailto:"], a[data-testid="contact-email"]');
        const email = a ? normalizeEmail(a.getAttribute('href') || a.textContent || '') : '';

        const existing = slot.querySelector('.datx-send[data-datx-icon-btn]');

        // Not logged in (gate) or no email for this load (node recycled) — undo
        // our injection and restore the native envelope icon.
        if (!tbLoggedIn || !email) {
            if (existing) {
                if (typeof removeSendButton === 'function') removeSendButton(existing);
                else existing.remove();
            }
            icon.style.removeProperty('display');
            return;
        }

        // Already mounted — just keep it pointed at the live email.
        if (existing) {
            if (existing.dataset.datxEmail !== email) existing.dataset.datxEmail = email;
            icon.style.display = 'none';
            return;
        }

        const btn = buildSendButton(email, document.body, { envelopeOnly: true });
        btn.setAttribute('data-datx-icon-btn', '1');
        btn.style.margin = '0';
        icon.style.display = 'none';                      // replace the envelope icon
        slot.appendChild(btn);
        if (typeof attachTemplateMoreButton === 'function') attachTemplateMoreButton(btn);
        // The slot lives in Truckstop's Shadow DOM; the button's stylesheet sits
        // in document.head and can't cross that boundary, so mirror it into the
        // shadow root the button now belongs to (no-op if already present).
        ensureDatxButtonStyle(slot.getRootNode());
    });
}

// Email shown by an element: DAT's web components (connected-email-*) keep it in
// `recipient-email` with the visible text in a shadow root; everything else is a
// mailto: href or plain text. A contact-link whose href-value is tel: is a phone
// (it still carries recipient-email), so it yields ''.
function emailOfElement(el) {
    if (!(el instanceof Element)) return '';
    if (el.hasAttribute('recipient-email')) {
        const hv = el.getAttribute('href-value');
        if (hv && !/^mailto:/i.test(hv)) return '';
        return normalizeEmail(el.getAttribute('recipient-email'));
    }
    return normalizeEmail(el.getAttribute('href') || el.textContent || '');
}

function normalizeEmail(raw) {
    return String(raw || '')
        .replace(/^mailto:/i, '')
        .trim()
        .replace(/[),;]+$/, '')
        .toLowerCase();
}

// =========================
// Mini-map inside load details (only when details are open)
// =========================
// Set a Google Maps Embed API key to render the real 3-point route
// (truck -> pickup -> destination). Left empty, we fall back to a no-key
// 2-point preview (origin -> destination) via output=embed.
var MAPS_EMBED_KEY = '';

function cleanCity(t) {
    return String(t || '')
        .replace(/\(\s*\d+\s*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function readDetailsRoute(detailsEl) {
    const tripDivs = detailsEl.querySelectorAll('.trip-place > div');
    const origin =
        cleanCity(detailsEl.querySelector('.route-origin .city')?.textContent) ||
        cleanCity(tripDivs[0]?.textContent);
    const dest =
        cleanCity(detailsEl.querySelector('.route-destination .city')?.textContent) ||
        cleanCity(tripDivs[tripDivs.length - 1]?.textContent);
    return { origin: origin || null, dest: dest || null };
}

// Loaded miles = the trip distance DAT shows in the route subheader ("708 mi").
function readLoadedMiles(detailsEl) {
    const el =
        detailsEl.querySelector('.details-subheader-mileage .trip-miles') ||
        detailsEl.querySelector('.trip-miles');
    const m = String(el?.textContent || '').match(/([\d,]+)\s*mi/i);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
}

// Deadhead = the number DAT puts in parentheses after the origin city
// ("Manteno, IL (79)") — miles from the posted truck to the load origin.
function readDeadheadMiles(detailsEl) {
    const txt =
        detailsEl.querySelector('.route-origin .city')?.textContent ||
        detailsEl.querySelector('.origin .city')?.textContent ||
        '';
    const m = String(txt).match(/\((\d+)\)/);
    return m ? parseInt(m[1], 10) : null;
}

// Total posted rate ("$3,000") from the Rate column.
function readRateTotal(detailsEl) {
    const el = detailsEl.querySelector('.data-item-total');
    const m = String(el?.textContent || '').match(/([\d,]+(?:\.\d+)?)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}

// Pickup date shown under the origin in the Trip column ("Jun 2").
function readPickupDate(detailsEl) {
    const el =
        detailsEl.querySelector('.route-origin .date') ||
        detailsEl.querySelector('.date');
    const t = el ? el.textContent.trim() : '';
    return t || null;
}

// Weight from the Equipment block — match the "Weight" label to its value so we
// don't depend on a fixed column order.
function readWeight(detailsEl) {
    const labels = detailsEl.querySelectorAll('dat-equipment .data-label');
    const values = detailsEl.querySelectorAll('dat-equipment .data-item');
    for (let i = 0; i < labels.length; i++) {
        if (/weight/i.test(labels[i].textContent || '')) {
            return values[i] ? values[i].textContent.trim() : null;
        }
    }
    return null;
}

function readMcNumber(detailsEl) {
    const re = /\bMC\s*#?\s*:?\s*(\d{4,9})(?!\d)/i;

    const fromScope = (root) => {
        if (!root) return null;
        if (root.querySelectorAll) {
            for (const cell of root.querySelectorAll('.city-spacing')) {
                const m = String(cell.textContent || '').match(re);
                if (m) return m[1];
            }
        }
        const m = String(root.textContent || '').match(re);
        return m ? m[1] : null;
    };

    let node = detailsEl;
    for (let i = 0; i < 6 && node; i++) {
        const mc = fromScope(node);
        if (mc) return mc;
        node = node.parentElement;
    }
    return null;
}

// Broker's city/state, read from the same `.city-spacing` cells that carry the
// MC#. Only Apex needs it: one MC# can list several branch records there, and
// without a location we'd return whichever branch happened to come first.
// Returns {city:'', state:''} when the panel doesn't show it — Apex then falls
// back to the first record, which is the same behaviour as before.
function readBrokerCityState(detailsEl) {
    const re = /^([A-Za-z .'-]+),\s*([A-Z]{2})\b/;

    const fromScope = (root) => {
        if (!root || !root.querySelectorAll) return null;
        for (const cell of root.querySelectorAll('.city-spacing')) {
            const m = String(cell.textContent || '').replace(/\s+/g, ' ').trim().match(re);
            if (m) return { city: m[1].trim(), state: m[2] };
        }
        return null;
    };

    let node = detailsEl;
    for (let i = 0; i < 6 && node; i++) {
        const hit = fromScope(node);
        if (hit) return hit;
        node = node.parentElement;
    }
    return { city: '', state: '' };
}

function buildMiniMapSrc(truck, origin, dest) {
    if (MAPS_EMBED_KEY) {
        const p = new URLSearchParams({ key: MAPS_EMBED_KEY, mode: 'driving' });
        p.set('origin', truck || origin);
        if (truck && origin) p.set('waypoints', origin);
        p.set('destination', dest);
        return 'https://www.google.com/maps/embed/v1/directions?' + p.toString();
    }
    const q = encodeURIComponent(`${origin} to ${dest}`);
    return `https://www.google.com/maps?q=${q}&output=embed`;
}

// =========================
// Route section login gating
// =========================
// The route map + miles + RTS credit are a logged-in-only feature. We cache the
// login flag (presence of backendToken) so the synchronous injector can read it,
// and re-render any open panels live when the user logs in/out.
let tbLoggedIn = false;
// Map on/off toggle (popup). Default ON; when OFF we skip the map graphic but
// keep the rest of the route panel (stats, copy, calculator, FMCSA).
let tbMapEnabled = true;

function tbRerenderRouteCols() {
    try {
        document.querySelectorAll('.tb-map-col').forEach((el) => el.remove());
    } catch {}
    try {
        document.querySelectorAll('.tb-lane-col').forEach((el) => el.remove());
    } catch {}
    try {
        injectMiniMapsInDetails();
    } catch {}
    try {
        injectLaneAnalyticsInDetails();
    } catch {}
    try {
        injectRefreshButton();
    } catch {}
}

// Tear down Truckstop-injected UI on logout (the injectors are login-gated, so
// once logged in the next scan re-adds them). Shadow-pierces the detail panel /
// grid; the send buttons restore their native icon via ensureEmailIconButtons.
function tbRemoveTruckstopUi() {
    const sels = ['.tb-ts-board', '.tb-ts-rts', '.tb-ts-maplink-wrap', '#tb-ts-dark'];
    sels.forEach((sel) => {
        const els = (typeof tbDeepQueryShadow === 'function')
            ? tbDeepQueryShadow(sel)
            : Array.prototype.slice.call(document.querySelectorAll(sel));
        els.forEach((el) => { try { el.remove(); } catch {} });
    });
    try { ensureEmailIconButtons(); } catch {} // restores native envelope icons
}

(function initRouteLoginState() {
    try {
        chrome.storage.local.get(['backendToken'], (d) => {
            tbLoggedIn = !!(d && d.backendToken);
            tbRerenderRouteCols();
        });
        chrome.storage.onChanged.addListener((ch, area) => {
            if (area !== 'local' || !ch.backendToken) return;
            tbLoggedIn = !!ch.backendToken.newValue;
            tbRerenderRouteCols();
            // Logout → strip Truckstop UI now; login → next scan re-injects it.
            if (!tbLoggedIn) tbRemoveTruckstopUi();
        });
    } catch {}
})();

// =========================
// Resizable map size (persisted, shared across all maps)
// =========================
let tbMapSize = null; // { w, h } in px

function applyMapSize(box) {
    // Height only — the map always spans the full column width and never resizes
    // sideways.
    if (!box || !tbMapSize || !tbMapSize.h) return;
    box.style.height = tbMapSize.h + 'px';
}

function saveMapSize(h) {
    // skip no-op writes so applying a size to many maps can't loop
    if (tbMapSize && Math.abs((tbMapSize.h || 0) - h) <= 1) return;
    tbMapSize = { h };
    try {
        chrome.storage.local.set({ tbMapSize });
    } catch {}
}

(function initMapSize() {
    try {
        chrome.storage.local.get(['tbMapSize', 'mapEnabled'], (d) => {
            if (d && d.tbMapSize) {
                tbMapSize = d.tbMapSize;
                document.querySelectorAll('.tb-mini-map').forEach(applyMapSize);
            }
            // default ON unless explicitly disabled
            tbMapEnabled = !(d && d.mapEnabled === false);
            if (!tbMapEnabled) tbRerenderRouteCols();
        });
        chrome.storage.onChanged.addListener((ch, area) => {
            if (area !== 'local') return;
            if (ch.tbMapSize) {
                tbMapSize = ch.tbMapSize.newValue || null;
                document.querySelectorAll('.tb-mini-map').forEach(applyMapSize);
            }
            if (ch.mapEnabled) {
                tbMapEnabled = ch.mapEnabled.newValue !== false;
                tbRerenderRouteCols();
            }
        });
    } catch {}
})();

// Adds a bottom-edge grip that resizes the map vertically only (height clamped;
// width always fills the column). The chosen height is saved and applied to all
// maps.
function attachMapResize(box) {
    applyMapSize(box);

    const handle = document.createElement('div');
    handle.className = 'tb-map-resize';
    handle.title = 'Drag to resize the map';
    handle.setAttribute(INJECT_ATTR, '1');
    handle.innerHTML =
        '<span class="tb-map-resize-hint">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 4 8 8h8l-4-4z"/><path d="M12 20l-4-4h8l-4 4z"/></svg>' +
        'Drag to resize</span>';
    box.appendChild(handle);

    const iframe = box.querySelector('iframe');
    let dragging = false;
    let startY = 0;
    let startH = 0;

    const onMove = (e) => {
        if (!dragging) return;
        // Vertical only — height changes, width stays at 100% of the column.
        let h = startH + (e.clientY - startY);
        h = Math.max(180, Math.min(h, 640));
        box.style.height = h + 'px';
    };

    const onUp = () => {
        if (!dragging) return;
        dragging = false;
        if (iframe) iframe.style.pointerEvents = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveMapSize(Math.round(box.offsetHeight));
    };

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        startY = e.clientY;
        startH = box.offsetHeight;
        // stop the cross-origin iframe from hijacking the drag
        if (iframe) iframe.style.pointerEvents = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// Greyed teaser shown to logged-out users in place of the real route section.
function buildLockedRoute() {
    const locked = document.createElement('div');
    locked.className = 'tb-route-locked';
    locked.setAttribute(INJECT_ATTR, '1');
    locked.innerHTML =
        '<div class="tb-route-locked-bg"></div>' +
        '<div class="tb-route-locked-overlay">' +
        '<div class="tb-route-locked-title">Route, miles &amp; broker credit</div>' +
        '<div class="tb-route-locked-sub">Log in to unlock the map, ' +
        'deadhead-adjusted RPM and RTS broker credit.</div>' +
        '<button type="button" class="tb-route-login">Log in to unlock</button>' +
        '</div>';

    const btn = locked.querySelector('.tb-route-login');
    if (btn) {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.disabled = true;
            btn.textContent = 'Logging in…';
            try {
                const res = await loginWithStoredProvider();
                // On success, saveBackendAuth writes backendToken ->
                // chrome.storage.onChanged re-renders this panel automatically.
                if (!res || res.ok === false) {
                    btn.disabled = false;
                    btn.textContent = 'Log in to unlock';
                    if (typeof showToast === 'function') {
                        showToast('Login failed. Please try again.', 'error');
                    }
                }
            } catch {
                btn.disabled = false;
                btn.textContent = 'Log in to unlock';
            }
        });
    }

    return locked;
}

function injectMiniMapsInDetails() {
    document.querySelectorAll('dat-load-details, .table-row-detail').forEach((detailsEl) => {
        if (!(detailsEl instanceof Element)) return;
        // Runs on the same pass: the calculator lives in the Rate column of this same panel.
        if (window.tbProfit) { try { window.tbProfit.mount(detailsEl); } catch {} }
        if (detailsEl.querySelector('.tb-map-col')) return; // already injected

        const { origin, dest } = readDetailsRoute(detailsEl);
        if (!origin || !dest) return;

        const truck = typeof getTopPostedOrigin === 'function' ? getTopPostedOrigin() : null;

        // Place the map high in the left column: right after the Trip/route
        // block (above Equipment). Fall back to equipment, then first column.
        const anchorEl =
            detailsEl.querySelector('dat-route') ||
            detailsEl.querySelector('[data-test="route-details"]') ||
            detailsEl.querySelector('dat-equipment');
        const host = anchorEl
            ? anchorEl.closest('.row-spacing') || anchorEl
            : detailsEl.querySelector('.details-column');
        if (!host) return;

        const wrap = document.createElement('div');
        wrap.setAttribute(INJECT_ATTR, '1');

        // Header: clone one of DAT's native column headers (Trip/Rate) so our
        // grey header bar matches theirs exactly — the clone keeps Angular's
        // _ngcontent attribute, so DAT's own scoped CSS styles it for free.
        // Fall back to our own styled bar if no native header is found.
        const refHeader =
            detailsEl.querySelector('dat-rate .details-header') ||
            detailsEl.querySelector('dat-route .details-header') ||
            detailsEl.querySelector('.details-column .details-header');
        let mapLabel;
        if (refHeader) {
            mapLabel = refHeader.cloneNode(true);
            mapLabel.querySelectorAll('a').forEach((a) => a.remove());
            const lbl = mapLabel.querySelector('.label') || mapLabel;
            lbl.innerHTML = 'Route' + TB_PB_BADGE;
        } else {
            mapLabel = document.createElement('div');
            mapLabel.className = 'tb-map-col-label';
            mapLabel.innerHTML = 'Route' + TB_PB_BADGE;
        }
        mapLabel.classList.add('tb-map-header');
        mapLabel.setAttribute(INJECT_ATTR, '1');

        // Right side of the grey header bar: a quick link to review the extension.
        const reviewLink = document.createElement('a');
        reviewLink.className = 'tb-review-link';
        reviewLink.setAttribute(INJECT_ATTR, '1');
        reviewLink.target = '_blank';
        reviewLink.rel = 'noopener';
        reviewLink.href =
            'https://chromewebstore.google.com/detail/truck-box/pbnichodfccghlpfonecdlcbjkipmmhd/reviews';
        reviewLink.innerHTML =
            'Saved you time? Spare 5 seconds <span class="tb-review-star">★</span>';
        mapLabel.appendChild(reviewLink);

        wrap.appendChild(mapLabel);

        if (!tbLoggedIn) {
            // Logged out: render a greyed teaser with a login CTA instead of the
            // real map/stats/credit. Flips to the full version live on login via
            // the chrome.storage.onChanged listener below.
            wrap.appendChild(buildLockedRoute());
        } else {
            const box = document.createElement('div');
            box.className = 'tb-mini-map';
            box.setAttribute(INJECT_ATTR, '1');

            const iframe = document.createElement('iframe');
            iframe.loading = 'lazy';
            iframe.setAttribute('allowfullscreen', '');
            iframe.referrerPolicy = 'no-referrer-when-downgrade';
            iframe.src = buildMiniMapSrc(truck, origin, dest);
            box.appendChild(iframe);
            attachMapResize(box);

            const mapsHref =
                typeof buildMapsLink === 'function'
                    ? buildMapsLink(truck, origin, dest)
                    : `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                          truck || origin
                      )}&destination=${encodeURIComponent(dest)}`;

            // Covers the embed's dark corner tile with something that actually does a job:
            // the same route, opened in the real Google Maps.
            const corner = document.createElement('a');
            corner.className = 'tb-map-corner';
            corner.setAttribute(INJECT_ATTR, '1');
            corner.target = '_blank';
            corner.rel = 'noopener';
            corner.href = mapsHref;
            corner.title = 'Open this route in Google Maps';
            corner.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
                '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" ' +
                'stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
                '<circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="2"/></svg>' +
                '<span>Route</span>';
            box.appendChild(corner);

            const link = document.createElement('a');
            link.className = 'tb-mini-map-link';
            link.setAttribute(INJECT_ATTR, '1');
            link.target = '_blank';
            link.rel = 'noopener';
            link.href =
                typeof buildMapsLink === 'function'
                    ? buildMapsLink(truck, origin, dest)
                    : `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                          truck || origin
                      )}&destination=${encodeURIComponent(dest)}`;
            link.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
                '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" ' +
                'stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
                '<circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="2"/></svg>' +
                '<span>Open in Google Maps</span>' +
                '<svg class="tb-map-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
                '<path d="M7 17L17 7M9 7h8v8" stroke="currentColor" stroke-width="2" ' +
                'stroke-linecap="round" stroke-linejoin="round"/></svg>';

            // Track the click (and run the same login/subscription gate as the
            // row's map-pin button) before opening Google Maps.
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const resp = await safeSendMessage({ type: 'datx_map_click', platform: tbActivePlatform() });

                if (resp?.needLogin) {
                    if (typeof showLoginBanner === 'function') showLoginBanner();
                    return;
                }
                if (resp?.accessDenied) {
                    showToast('Your subscription is not active. Please subscribe', 'error');
                    return;
                }
                if (!resp?.ok) {
                    showToast('Access check failed', 'error');
                    return;
                }

                window.open(link.href, '_blank', 'noopener');
            });

            // Miles breakdown: Loaded + Deadhead = Total.
            const loadedMi = readLoadedMiles(detailsEl);
            const deadheadMi = readDeadheadMiles(detailsEl);
            const fmtMi = (n) =>
                n == null ? '–' : n.toLocaleString('en-US') + ' mi';

            const stats = document.createElement('div');
            stats.className = 'tb-board-stats';
            stats.setAttribute(INJECT_ATTR, '1');
            const addStat = (k, v, extra) => {
                const s = document.createElement('div');
                s.className = 'tb-stat' + (extra ? ' ' + extra : '');
                const kk = document.createElement('span');
                kk.className = 'k';
                kk.textContent = k;
                const vv = document.createElement('span');
                vv.className = 'v';
                vv.textContent = v;
                s.appendChild(kk);
                s.appendChild(vv);
                stats.appendChild(s);
            };
            const rate = readRateTotal(detailsEl);
            addStat('Loaded', fmtMi(loadedMi));
            if (deadheadMi != null) {
                const totalMi = (loadedMi || 0) + deadheadMi;
                addStat('Deadhead', fmtMi(deadheadMi));
                addStat('Total', fmtMi(totalMi), 'total');

                // Rate/mile on loaded miles, then the true rate once the empty
                // deadhead miles to pickup are counted in.
                if (rate != null && loadedMi > 0) {
                    addStat('RPM', '$' + (rate / loadedMi).toFixed(2));
                }
                if (rate != null && totalMi > 0) {
                    addStat(
                        'RPM (w/DH)',
                        '$' + (rate / totalMi).toFixed(2),
                        'total'
                    );
                }
            } else if (rate != null && loadedMi > 0) {
                addStat('RPM', '$' + (rate / loadedMi).toFixed(2));
            }
            // The broker's posted total (DAT's Rate section), last before Copy.
            if (rate != null) {
                addStat('Rate', '$' + rate.toLocaleString('en-US', {maximumFractionDigits: 0}), 'rate');
            }

            const totalMiVal =
                loadedMi != null && deadheadMi != null
                    ? loadedMi + deadheadMi
                    : loadedMi != null
                    ? loadedMi
                    : null;

            // Copy load info is placed at the TOP of the right column below, so it
            // stacks evenly with FMCSA + the calculator (same width, aligned edges).
            const copyBtn = buildCopyButton(detailsEl, {
                origin,
                dest,
                loadedMi,
                deadheadMi,
                totalMi: totalMiVal,
                mapsHref: link.href,
            });

            // One ordered card: a stats strip on top, a tools strip
            // (calculator | FMCSA | RTS) under it, then the map filling the rest.
            // Everything is full width so the map — the priority element — only
            // ever grows vertically, never sideways.
            const board = document.createElement('div');
            board.className = 'tb-board';
            board.setAttribute(INJECT_ATTR, '1');

            // Row 1 — miles + RPM cells, with Copy load info as the last cell.
            copyBtn.classList.add('tb-board-copy');
            stats.appendChild(copyBtn);
            board.appendChild(stats);

            // Row 2 — tools: calculator | FMCSA report | RTS credit.
            const tools = document.createElement('div');
            tools.className = 'tb-board-tools';
            tools.setAttribute(INJECT_ATTR, '1');

            const calcCell = document.createElement('div');
            calcCell.className = 'tb-board-cell tb-board-calc';
            calcCell.setAttribute(INJECT_ATTR, '1');
            calcCell.appendChild(
                buildRateCalculator(
                    loadedMi,
                    totalMiVal,
                    deadheadMi,
                    readRateTotal(detailsEl)
                )
            );

            const fmcsaCell = document.createElement('div');
            fmcsaCell.className = 'tb-board-cell tb-board-fmcsa';
            fmcsaCell.setAttribute(INJECT_ATTR, '1');
            const fmcsaSlot = document.createElement('div');
            fmcsaSlot.setAttribute(INJECT_ATTR, '1');
            fmcsaSlot.style.cssText = 'display:flex;width:100%;';
            fmcsaCell.appendChild(fmcsaSlot);

            const rtsCell = document.createElement('div');
            rtsCell.className = 'tb-board-cell tb-board-rts';
            rtsCell.setAttribute(INJECT_ATTR, '1');
            const rtsSlot = document.createElement('div');
            rtsSlot.setAttribute(INJECT_ATTR, '1');
            // Column, because RTS and Triumph stack here. The gap only shows
            // when both are actually rendered — a provider that isn't connected
            // sets itself display:none, so it contributes no gap either.
            rtsSlot.style.cssText =
                'display:flex;flex-direction:column;gap:8px;width:100%;';
            rtsCell.appendChild(rtsSlot);

            tools.appendChild(calcCell);
            tools.appendChild(fmcsaCell);
            tools.appendChild(rtsCell);
            board.appendChild(tools);

            wrap.appendChild(board);
            mountBrokerButtons(detailsEl, fmcsaSlot, rtsSlot);

            // Row 3 — the map (gated by the popup toggle). It fills the bottom of
            // the card and resizes vertically only. (`link.href` is still used by
            // the Copy button even when the map is hidden.)
            if (tbMapEnabled) {
                board.appendChild(box);

                // Footer line: "Found bug/issue?" (Telegram) on the left,
                // "Open in Google Maps" on the right.
                const footer = document.createElement('div');
                footer.className = 'tb-map-footer';
                footer.setAttribute(INJECT_ATTR, '1');

                const bugLink = document.createElement('a');
                bugLink.className = 'tb-bug-link';
                bugLink.setAttribute(INJECT_ATTR, '1');
                bugLink.target = '_blank';
                bugLink.rel = 'noopener';
                bugLink.href = 'https://t.me/mngartur';
                bugLink.textContent = 'Found bug/issue?';

                footer.appendChild(bugLink);
                footer.appendChild(buildCustomSoftButton());
                footer.appendChild(link);
                wrap.appendChild(footer);
            }
        }

        // Option A: give the map its OWN real column instead of floating it on
        // top of the left column. We insert it as a flex sibling right after the
        // Trip column (order: Trip | Map | Rate | Company) and force the columns
        // row to wrap. That way the map always *takes* space (never overlaps),
        // and on a narrow screen it drops onto a new line below the other
        // columns instead of covering the Trip details.
        wrap.className = 'tb-map-col';
        const leftCol = (anchorEl && anchorEl.closest('.details-column')) || host;
        const columnsHost =
            leftCol.parentElement || detailsEl.querySelector('.details-container');

        try {
            if (
                columnsHost &&
                getComputedStyle(columnsHost).display.indexOf('flex') !== -1
            ) {
                // let the columns reflow onto a new line instead of overflowing
                columnsHost.style.flexWrap = 'wrap';
            }
            leftCol.insertAdjacentElement('afterend', wrap);
        } catch {
            host.insertAdjacentElement('afterend', wrap);
        }
    });
}

// =========================
// "Need a custom soft?" — a small click-popover offering custom dev services.
// =========================
// Opens on click; closes via the × button, an outside click, Escape, or when
// the pointer moves away (a short grace period bridges the gap to the popover).
function buildCustomSoftButton() {
    const wrap = document.createElement('div');
    wrap.className = 'tb-soft-wrap';
    wrap.setAttribute(INJECT_ATTR, '1');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-soft-btn';
    btn.setAttribute(INJECT_ATTR, '1');
    btn.textContent = 'Need a custom soft?';

    const pop = document.createElement('div');
    pop.className = 'tb-soft-pop';
    pop.setAttribute(INJECT_ATTR, '1');
    pop.innerHTML =
        '<button type="button" class="tb-soft-close" aria-label="Close">×</button>' +
        '<div class="tb-soft-title">Need software tailored to your business?</div>' +
        '<ul class="tb-soft-list">' +
        '<li>Custom Web Applications</li>' +
        '<li>AI Integrations &amp; Agents</li>' +
        '<li>Process Automation</li>' +
        '<li>Cloud &amp; AWS Solutions</li>' +
        '<li>Internal Tools &amp; Portals</li>' +
        '<li>API &amp; System Integrations</li>' +
        '</ul>' +
        '<a class="tb-soft-cta" target="_blank" rel="noopener" ' +
        'href="https://t.me/mngartur">Contact me on Telegram</a>';

    wrap.appendChild(btn);
    wrap.appendChild(pop);

    let closeTimer = null;
    const cancelClose = () => {
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
    };
    const scheduleClose = () => {
        cancelClose();
        closeTimer = setTimeout(close, 300);
    };

    const onDocClick = (e) => {
        if (!wrap.contains(e.target)) close();
    };
    const onKey = (e) => {
        if (e.key === 'Escape') close();
    };

    function open() {
        if (wrap.classList.contains('tb-open')) return;
        wrap.classList.add('tb-open');
        // Defer so the opening click itself doesn't trigger the outside-click close.
        setTimeout(() => {
            document.addEventListener('click', onDocClick, true);
            document.addEventListener('keydown', onKey, true);
        }, 0);
    }
    function close() {
        cancelClose();
        wrap.classList.remove('tb-open');
        document.removeEventListener('click', onDocClick, true);
        document.removeEventListener('keydown', onKey, true);
    }

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (wrap.classList.contains('tb-open')) close();
        else open();
    });
    pop.querySelector('.tb-soft-close').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
    });
    // Keep clicks inside the popover from bubbling to the load row.
    pop.addEventListener('click', (e) => e.stopPropagation());

    // "Move away" closes it; re-entering the wrap (button or popover) cancels.
    wrap.addEventListener('mouseleave', scheduleClose);
    wrap.addEventListener('mouseenter', cancelClose);

    return wrap;
}

// =========================
// Copy load info (for texting the driver)
// =========================
// Builds a "Copy load info" button. On click it copies a clean, line-by-line
// summary of the load (pickup, origin, destination, miles, weight, maps link)
// to the clipboard, formatted for pasting into a text/email to a driver.
function buildCopyButton(detailsEl, data) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-copy-btn tb-tip';
    btn.setAttribute('data-tip', 'Copy details to share with a driver');
    btn.setAttribute(INJECT_ATTR, '1');
    btn.setAttribute('aria-label', 'Copy load info');
    const copyIcon =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" stroke-width="2"/>' +
        '<path d="M5 15V5a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
        '</svg>';
    const checkIcon =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';
    btn.innerHTML = copyIcon;

    const fmt = (n) => (n == null ? null : n.toLocaleString('en-US') + ' mi');

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const pickup = readPickupDate(detailsEl);
        const weight = readWeight(detailsEl);

        const lines = [
            `${data.origin} -> ${data.dest}`,
            '',
            pickup ? `Pickup: ${pickup}` : null,
            `Origin: ${data.origin}`,
            `Destination: ${data.dest}`,
            data.deadheadMi != null ? `Deadhead: ${fmt(data.deadheadMi)}` : null,
            data.loadedMi != null ? `Loaded: ${fmt(data.loadedMi)}` : null,
            data.totalMi != null ? `Total: ${fmt(data.totalMi)}` : null,
            weight ? `Weight: ${weight}` : null,
            '',
            data.mapsHref ? `Route: ${data.mapsHref}` : null,
        ].filter((l) => l !== null);

        const text = lines.join('\n');
        const done = () => {
            btn.classList.add('copied');
            btn.innerHTML = checkIcon;
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = copyIcon;
            }, 1600);
        };

        try {
            await navigator.clipboard.writeText(text);
            done();
        } catch {
            // fallback for clipboard API failures
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                done();
            } catch {
                if (typeof showToast === 'function') {
                    showToast('Could not copy to clipboard', 'error');
                }
            }
        }
    });

    return btn;
}

// =========================
// Rate calculator (live RPM with / without deadhead)
// =========================
// For phone negotiations: the dispatcher types a rate and instantly sees the
// rate-per-mile on loaded miles and on total miles (including deadhead).
function buildRateCalculator(loadedMi, totalMi, deadheadMi, defaultRate) {
    const calc = document.createElement('div');
    calc.className = 'tb-rate-calc';
    calc.setAttribute(INJECT_ATTR, '1');
    const showDh = deadheadMi != null && totalMi != null;
    const SWAP_ICON =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/>' +
        '<path d="M17 20l4-4-4-4"/><path d="M21 16H7"/></svg>';
    calc.innerHTML =
        '<div class="tb-calc-title">' +
        '<button type="button" class="tb-calc-switch tb-tip" ' +
        'data-tip="RPM <-> Rate Switch">' +
        SWAP_ICON + '<span class="tb-calc-switch-lbl">Rate→RPM</span></button>' +
        '<span class="tb-ct-grey">Calculator</span>' +
        '</div>' +
        '<div class="tb-calc-body">' +
        '<div class="tb-calc-row">' +
        '<span class="tb-calc-dollar">$</span>' +
        '<input type="number" class="tb-calc-input" inputmode="decimal" ' +
        'min="0" step="any" placeholder="Rate" />' +
        '</div>' +
        '<div class="tb-calc-out">' +
        '<div class="tb-calc-stat"><span class="v" data-out-1>–</span>' +
        '<span class="k" data-k-1>RPM</span></div>' +
        (showDh
            ? '<div class="tb-calc-stat total"><span class="v" data-out-2>–</span>' +
              '<span class="k" data-k-2>RPM w/DH</span></div>'
            : '') +
        '</div>' +
        '</div>';

    const input = calc.querySelector('.tb-calc-input');
    const out1 = calc.querySelector('[data-out-1]');
    const out2 = calc.querySelector('[data-out-2]');
    const k1 = calc.querySelector('[data-k-1]');
    const k2 = calc.querySelector('[data-k-2]');
    const switchLbl = calc.querySelector('.tb-calc-switch-lbl');
    const switchBtn = calc.querySelector('.tb-calc-switch');

    // 'rate'  → enter a dollar rate, show RPM (rate ÷ miles).
    // 'rpm'   → enter a target RPM, show the rate to ask (RPM × miles).
    let mode = 'rate';

    const fmtRate = (n) =>
        '$' + Math.round(n).toLocaleString('en-US');

    const recompute = () => {
        const val = parseFloat(input.value);
        const valid = isFinite(val) && val > 0;
        if (mode === 'rate') {
            out1.textContent =
                valid && loadedMi ? '$' + (val / loadedMi).toFixed(2) : '–';
            if (out2) {
                out2.textContent =
                    valid && totalMi ? '$' + (val / totalMi).toFixed(2) : '–';
            }
        } else {
            out1.textContent = valid && loadedMi ? fmtRate(val * loadedMi) : '–';
            if (out2) {
                out2.textContent =
                    valid && totalMi ? fmtRate(val * totalMi) : '–';
            }
        }
    };

    const applyMode = () => {
        if (mode === 'rate') {
            input.placeholder = 'Rate';
            switchLbl.textContent = 'Rate→RPM';
            k1.textContent = 'RPM';
            if (k2) k2.textContent = 'RPM w/DH';
        } else {
            input.placeholder = 'RPM';
            switchLbl.textContent = 'RPM→Rate';
            k1.textContent = 'Rate';
            if (k2) k2.textContent = 'Rate w/DH';
        }
    };

    switchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        mode = mode === 'rate' ? 'rpm' : 'rate';
        // The entered number means something different in each mode, so clear
        // it on switch to avoid a stale rate being read as an RPM (or vice versa).
        input.value = '';
        applyMode();
        recompute();
        input.focus();
    });

    input.addEventListener('input', recompute);
    // keep clicks/keys inside the field from bubbling to the row
    ['click', 'keydown', 'keyup'].forEach((evt) =>
        input.addEventListener(evt, (e) => e.stopPropagation())
    );

    // Pre-fill with the load's posted rate when DAT shows one, so the RPMs
    // populate immediately (the dispatcher can then type their own offer).
    if (defaultRate != null && isFinite(defaultRate) && defaultRate > 0) {
        input.value = String(defaultRate);
    }
    applyMode();
    recompute();

    return calc;
}

// =========================
// Broker buttons (FMCSA + RTS) — mounted once the MC# is readable
// =========================
// The broker MC# is sometimes injected by DAT a moment after the details panel
// opens, so a single synchronous read misses it (buttons absent until the user
// reopens the load). We retry for ~2.5s and mount the buttons the instant the MC
// becomes readable. FMCSA and RTS go into separate slots (right/left columns).
// If the load genuinely has no MC#, nothing is mounted.
function mountBrokerButtons(detailsEl, fmcsaSlot, rtsSlot) {
    let tries = 0;
    const attempt = () => {
        // Panel closed before the MC loaded — stop retrying. (Gate on detailsEl,
        // which is in the DOM whenever the panel is open; the slots may still be
        // detached on the first synchronous attempt, before wrap is inserted.)
        if (!detailsEl.isConnected) return;
        // Already mounted (defensive against double-scheduling).
        if (fmcsaSlot.childElementCount || rtsSlot.querySelector('.tb-rts-holder')) {
            return;
        }

        // Gate on the MC# being present now; the buttons themselves re-read the
        // MC# from this same panel at click time (so a reused/stale panel can
        // never act on a previously-opened broker's MC — fixes wrong-result bug).
        const mc = readMcNumber(detailsEl);
        if (mc) {
            fmcsaSlot.appendChild(buildFmcsaButton(detailsEl));
            rtsSlot.appendChild(buildFactoringPrompt());
            rtsSlot.appendChild(buildRtsCheck(detailsEl));
            // All providers stack in the same slot. Triumph and Apex hide
            // themselves unless the user has connected them, so the panel is
            // unchanged for everyone who only uses RTS.
            rtsSlot.appendChild(buildTriumphCheck(detailsEl));
            rtsSlot.appendChild(buildApexCheck(detailsEl));
            return;
        }

        if (++tries < 10) setTimeout(attempt, 250);
    };
    attempt();
}

// =========================
// FMCSA Broker Report button
// =========================
// Opens the broker's official FMCSA SAFER Company Snapshot (by MC docket) in a
// new tab. The MC# is read FRESH from the panel at click time, so the button is
// always correct for whatever broker is currently shown.
function buildFmcsaButton(detailsEl) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-fmcsa-btn tb-fmcsa-report tb-tip';
    btn.setAttribute('data-tip', "Open this broker's FMCSA SAFER report in a new tab");
    btn.setAttribute(INJECT_ATTR, '1');
    btn.innerHTML = '<span>FMCSA Report</span>';

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mc = readMcNumber(detailsEl);
        if (!mc) {
            showToast('No MC# found on this load', 'info');
            return;
        }
        const url =
            'https://safer.fmcsa.dot.gov/query.asp?query_type=queryCarrierSnapshot' +
            '&query_param=MC_MX&query_string=' +
            encodeURIComponent(mc);
        window.open(url, '_blank', 'noopener');
    });

    return btn;
}

// =========================
// RTS Factoring credit check
// =========================
// Manual button in the Route tools row. On click it asks the background to look
// up the broker's RTS factoring credit (using the user's captured RTS session)
// and swaps itself for a result badge. Returns null when no MC is on the load.
var RTS_ICON =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M12 8v4m0 3h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// Reads the RTS connection state straight from extension storage (the background
// captures the token there). { token: a token exists, valid: present & unexpired }.
function rtsConnInfo(cb) {
    try {
        chrome.storage.local.get(['rtsToken', 'rtsTokenExp', 'rtsEnabled', 'rtsShow'], (d) => {
            const token = !!(d && d.rtsToken);
            const exp = d && d.rtsTokenExp;
            const valid = token && (!exp || exp * 1000 > Date.now());
            // `enabled` folds in the display switch: a connected provider the
            // user has hidden behaves here exactly like one that isn't
            // connected, so every render path stays a single check.
            const shown = !d || d.rtsShow !== false;
            cb({ token, valid, enabled: !!(d && d.rtsEnabled) && shown });
        });
    } catch {
        cb({ token: false, valid: false, enabled: false });
    }
}

// Login button (filled blue) — opens RTS Pro to (re)connect.
function buildRtsLoginButton(label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tb-tip';
    b.setAttribute('data-tip', 'Open RTS Pro to log in');
    b.setAttribute(INJECT_ATTR, '1');
    b.style.cssText =
        'display:inline-flex;align-items:center;gap:7px;cursor:pointer;flex:0 0 auto;white-space:nowrap;' +
        'font:700 12px/1 Arial,Helvetica,sans-serif;color:#fff;background:#0046E0;border:0;border-radius:9px;' +
        'padding:8px 12px;transition:background .2s;';
    b.innerHTML = RTS_ICON + '<span>' + (label || 'Login to RTS') + '</span>';
    b.addEventListener('mouseenter', () => (b.style.background = '#0037b3'));
    b.addEventListener('mouseleave', () => (b.style.background = '#0046E0'));
    b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeSendMessage({ type: 'rts_open_login' });
    });
    return b;
}

// The clickable "RTS Credit Check" button (used only when connected). Reads the
// broker MC# FRESH from the panel at click time, so a reused/stale panel can
// never run a check against a previously-opened broker.
function rtsActiveButton(holder, detailsEl) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-fmcsa-btn tb-tip';
    btn.setAttribute('data-tip', "Check this broker's RTS factoring credit rating");
    btn.setAttribute(INJECT_ATTR, '1');
    btn.innerHTML = RTS_ICON + '<span>RTS Credit Check</span>';

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const mc = readMcNumber(detailsEl);
        if (!mc) {
            holder.dataset.state = 'result';
            holder.replaceChildren(buildRtsNotice('No MC# found on this load.', btn));
            return;
        }

        btn.disabled = true;
        holder.dataset.state = 'loading';

        const resp = await safeSendMessage({ type: 'rts_check', mc });

        if (resp && resp.ok && resp.data) {
            holder.dataset.state = 'result';
            holder.replaceChildren(buildRtsBadge(resp.data, mc));
            tbTrackEvent('RTS_CREDIT_CHECK'); // got a result back from RTS
            return;
        }

        const reason = resp && resp.reason;
        // Token gone/expired mid-session → fall back to the disconnected view.
        if (reason === 'expired' || reason === 'no_token') {
            renderRts(holder, detailsEl, { token: reason === 'expired', valid: false });
            return;
        }

        const msg =
            reason === 'not_found'
                ? 'Broker not set up with RTS.'
                : reason === 'no_mc'
                ? 'No MC# on this load.'
                : 'RTS check failed — try again.';
        holder.dataset.state = 'result';
        holder.replaceChildren(buildRtsNotice(msg, btn));
    });

    return btn;
}

// Renders the holder for the current connection state: a live check button when
// connected, or a SINGLE "Login to RTS" button when not (one button, not two —
// the login replaces the RTS check button in place).
function renderRts(holder, detailsEl, info) {
    holder.replaceChildren();

    // Not opted in — stay out of the panel entirely. Showing "Login to RTS" to
    // someone who factors with Apex advertises the wrong provider; the neutral
    // prompt below covers the "no factoring connected yet" case instead.
    if (!info || !info.enabled) {
        holder.dataset.state = 'hidden';
        holder.style.display = 'none';
        return;
    }
    holder.style.display = 'flex';

    const connected = info.valid;
    holder.dataset.state = connected ? 'connected' : 'disconnected';

    if (connected) {
        holder.appendChild(rtsActiveButton(holder, detailsEl));
        return;
    }

    holder.appendChild(
        buildRtsLoginButton(
            info && info.token ? 'Log in to RTS again' : 'Login to RTS'
        )
    );
}

function buildRtsCheck(detailsEl) {
    const holder = document.createElement('div');
    holder.className = 'tb-rts-holder';
    holder.setAttribute(INJECT_ATTR, '1');
    holder.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    // Keep a live reference to the panel so the click/storage paths always read
    // the MC# of the broker currently shown (not one captured at mount time).
    holder.__detailsEl = detailsEl;

    rtsConnInfo((info) => renderRts(holder, detailsEl, info));
    return holder;
}

// Flip every open RTS control live when the token is captured or disconnected
// (e.g. the user logs in on the rtspro.com tab, or hits Disconnect). Holders that
// are mid-check or already showing a result are left alone.
try {
    chrome.storage.onChanged.addListener((ch, area) => {
        if (area !== 'local' || (!ch.rtsToken && !ch.rtsEnabled && !ch.rtsShow)) return;
        document.querySelectorAll('.tb-rts-holder').forEach((h) => {
            const st = h.dataset.state;
            if (st === 'result' || st === 'loading') return;
            if (h.__detailsEl) rtsConnInfo((info) => renderRts(h, h.__detailsEl, info));
        });
    });
} catch {}

function buildRtsBadge(data, mc) {
    const badge = document.createElement('div');
    badge.className = 'datx-rts-badge';
    badge.setAttribute(INJECT_ATTR, '1');
    // Compact result: rating LETTER + days-to-pay + domain only (no header, no
    // broker name). Stretches to the column width; long HOLD text wraps.
    badge.style.cssText = 'box-sizing:border-box;';

    const row = document.createElement('div');
    row.className = 'rts-row';

    const gradeChar = String(data.grade || '?')
        .charAt(0)
        .toUpperCase();
    const grade = document.createElement('span');
    grade.className =
        'rts-grade' + (/[A-F]/.test(gradeChar) ? ' ' + gradeChar.toLowerCase() : '');
    grade.textContent = gradeChar;
    row.appendChild(grade);

    const meta = document.createElement('div');
    meta.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
    const pay = document.createElement('span');
    pay.style.cssText =
        'font:600 11px/1 Arial,Helvetica,sans-serif;color:#64748b;';
    pay.textContent =
        data.avgDaysToPay != null
            ? 'Days to pay: ~' + data.avgDaysToPay
            : 'Days to pay: N/A';
    meta.appendChild(pay);
    if (data.emailDomain) {
        const dom = document.createElement('span');
        dom.style.cssText =
            'font:600 11px/1 Arial,Helvetica,sans-serif;color:#64748b;word-break:break-all;';
        dom.title = 'Broker registered email domain';
        dom.textContent = 'Domain: ' + data.emailDomain;
        meta.appendChild(dom);
    }
    row.appendChild(meta);
    badge.appendChild(row);

    if (data.noBuy) {
        const warn = document.createElement('div');
        warn.style.cssText =
            'font:700 11px/1.35 Arial,Helvetica,sans-serif;word-break:break-word;' +
            'color:#fff;background:#dc2626;border-radius:7px;padding:6px 9px;';
        warn.textContent =
            '⚠ NO-BUY / ' +
            data.noBuy.flag +
            (data.noBuy.desc ? ' — ' + data.noBuy.desc : '');
        badge.appendChild(warn);
    }

    return badge;
}

function buildRtsNotice(msg, retryBtn) {
    const note = document.createElement('div');
    note.className = 'datx-rts-badge';
    note.setAttribute(INJECT_ATTR, '1');
    note.style.cssText = 'background:#fff7ed;border-color:#fed7aa;';

    const t = document.createElement('span');
    t.style.cssText =
        'font:600 11.5px/1.4 Arial,Helvetica,sans-serif;color:#9a3412;';
    t.textContent = msg;
    note.appendChild(t);

    if (retryBtn) {
        retryBtn.disabled = false;
        retryBtn.innerHTML = RTS_ICON + '<span>Retry RTS Check</span>';
        retryBtn.style.marginTop = '8px';
        note.appendChild(retryBtn);
    }
    return note;
}

// =========================
// Triumph factoring credit check
// =========================
// Mirrors the RTS control above: a manual button that swaps itself for a result
// badge. Mounted only once the user has connected Triumph — a dispatcher who
// doesn't use it should never see a second login button in the panel.
var TRIUMPH_ICON =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M4 19h16M6 19V9l6-4 6 4v10" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M10 19v-5h4v5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

// Connection state straight from storage, same contract as rtsConnInfo, plus
// `enabled` — whether the user has connected Triumph at all.
function triumphConnInfo(cb) {
    try {
        chrome.storage.local.get(
            ['triumphToken', 'triumphTokenExp', 'triumphEnabled', 'triumphShow'],
            (d) => {
                const token = !!(d && d.triumphToken);
                const exp = d && d.triumphTokenExp;
                const valid = token && (!exp || exp * 1000 > Date.now());
                const shown = !d || d.triumphShow !== false;
                const enabled = !!(d && d.triumphEnabled) && shown;

                if (valid || !token || !enabled) {
                    cb({ token, valid, enabled });
                    return;
                }

                // Token aged out (Okta issues ~1h ones). Before demoting the
                // control to a login button, ask the background whether a
                // Triumph tab is open — if it is, the next check silently pulls
                // a fresh token from it and nothing is actually broken. Only
                // this rare branch costs a round trip; the healthy path stays
                // on storage alone.
                safeSendMessage({ type: 'triumph_status' }).then((r) => {
                    const canRecover = !!(r && r.ok && r.data && r.data.canRecover);
                    cb({ token, valid: canRecover, enabled });
                }).catch(() => cb({ token, valid: false, enabled }));
            }
        );
    } catch {
        cb({ token: false, valid: false, enabled: false });
    }
}

function buildTriumphLoginButton(label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tb-tip';
    b.setAttribute('data-tip', 'Open Triumph to log in');
    b.setAttribute(INJECT_ATTR, '1');
    b.style.cssText =
        'display:inline-flex;align-items:center;gap:7px;cursor:pointer;flex:0 0 auto;white-space:nowrap;' +
        'font:700 12px/1 Arial,Helvetica,sans-serif;color:#fff;background:#0046E0;border:0;border-radius:9px;' +
        'padding:8px 12px;transition:background .2s;';
    b.innerHTML = TRIUMPH_ICON + '<span>' + (label || 'Login to Triumph') + '</span>';
    b.addEventListener('mouseenter', () => (b.style.background = '#0037b3'));
    b.addEventListener('mouseleave', () => (b.style.background = '#0046E0'));
    b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeSendMessage({ type: 'triumph_open_login' });
    });
    return b;
}

// Reads the MC# fresh at click time — same reasoning as the RTS button: DAT
// reuses panels, so an MC captured at mount time can belong to another broker.
function triumphActiveButton(holder, detailsEl) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-fmcsa-btn tb-tip';
    btn.setAttribute('data-tip', "Check this broker's Triumph credit status");
    btn.setAttribute(INJECT_ATTR, '1');
    btn.innerHTML = TRIUMPH_ICON + '<span>Triumph Credit Check</span>';

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const mc = readMcNumber(detailsEl);
        if (!mc) {
            holder.dataset.state = 'result';
            holder.replaceChildren(buildTriumphNotice('No MC# found on this load.', btn));
            return;
        }

        btn.disabled = true;
        holder.dataset.state = 'loading';

        const resp = await safeSendMessage({ type: 'triumph_check', mc });

        if (resp && resp.ok && resp.data) {
            holder.dataset.state = 'result';
            holder.replaceChildren(buildTriumphBadge(resp.data));
            tbTrackEvent('TRIUMPH_CREDIT_CHECK');
            return;
        }

        const reason = resp && resp.reason;
        // Token died mid-session (and silent re-auth couldn't save it) → back to
        // the login view rather than a dead-end error.
        if (reason === 'expired' || reason === 'no_token') {
            renderTriumph(holder, detailsEl, {
                token: reason === 'expired',
                valid: false,
                enabled: true
            });
            return;
        }

        const msg =
            reason === 'not_found'
                ? 'Broker not found in Triumph.'
                : reason === 'no_mc'
                ? 'No MC# on this load.'
                : 'Triumph check failed — try again.';
        holder.dataset.state = 'result';
        holder.replaceChildren(buildTriumphNotice(msg, btn));
    });

    return btn;
}

function renderTriumph(holder, detailsEl, info) {
    holder.replaceChildren();

    // Never connected — stay out of the way entirely rather than adding a second
    // login button beside RTS. Connecting happens in the extension popup.
    // display:none rather than an empty box: an empty flex item still earns the
    // column's gap, which would leave dead space under the RTS button.
    if (!info || !info.enabled) {
        holder.dataset.state = 'hidden';
        holder.style.display = 'none';
        return;
    }

    holder.style.display = 'flex';

    if (info.valid) {
        holder.dataset.state = 'connected';
        holder.appendChild(triumphActiveButton(holder, detailsEl));
        return;
    }

    holder.dataset.state = 'disconnected';
    holder.appendChild(
        buildTriumphLoginButton(info.token ? 'Log in to Triumph again' : 'Login to Triumph')
    );
}

function buildTriumphCheck(detailsEl) {
    const holder = document.createElement('div');
    holder.className = 'tb-triumph-holder';
    holder.setAttribute(INJECT_ATTR, '1');
    holder.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    holder.__detailsEl = detailsEl;

    triumphConnInfo((info) => renderTriumph(holder, detailsEl, info));
    return holder;
}

// Flip open Triumph controls live when the token is captured on the portal tab
// or cleared from the popup. Mid-check and finished panels are left alone.
try {
    chrome.storage.onChanged.addListener((ch, area) => {
        if (area !== 'local' || (!ch.triumphToken && !ch.triumphEnabled && !ch.triumphShow)) return;
        document.querySelectorAll('.tb-triumph-holder').forEach((h) => {
            const st = h.dataset.state;
            if (st === 'result' || st === 'loading') return;
            if (h.__detailsEl) triumphConnInfo((info) => renderTriumph(h, h.__detailsEl, info));
        });
    });
} catch {}

// Triumph reports a status plus limits, where RTS reports a letter grade — the
// two are deliberately NOT merged into one badge, so a dispatcher can see when
// the providers disagree about a broker.
function buildTriumphBadge(data) {
    const badge = document.createElement('div');
    badge.className = 'datx-rts-badge';
    badge.setAttribute(INJECT_ATTR, '1');
    badge.style.cssText = 'box-sizing:border-box;';

    const row = document.createElement('div');
    row.className = 'rts-row tri-row';

    const status = String(data.status || '').toUpperCase();
    const pill = document.createElement('span');
    pill.className =
        'tri-status' +
        (status === 'GREEN'
            ? ' green'
            : status === 'RED'
            ? ' red'
            : status === 'NOBUY'
            ? ' nobuy'
            : '');
    pill.textContent =
        status === 'GREEN'
            ? 'Approved'
            : status === 'RED'
            ? 'Denied'
            : status === 'NOBUY'
            ? 'No Buy'
            : 'Unknown';
    row.appendChild(pill);

    const meta = document.createElement('div');
    meta.className = 'tri-meta';
    meta.style.cssText = 'display:flex;flex-direction:column;gap:3px;';

    const line = (text, title) => {
        const s = document.createElement('span');
        s.style.cssText = 'font:600 11px/1 Arial,Helvetica,sans-serif;color:#64748b;';
        if (title) s.title = title;
        s.textContent = text;
        meta.appendChild(s);
    };

    line(data.avgDaysToPay != null ? 'Days to pay: ~' + data.avgDaysToPay : 'Days to pay: N/A');

    // Recourse is the limit that applies to most carriers; the non-recourse one
    // is appended only when it actually differs, not as a second near-identical
    // number the reader has to compare.
    const limit = data.recourseCreditLimit;
    if (limit != null) {
        const alt = data.nonRecourseCreditLimit;
        line(
            'Credit limit: ' +
                fmtTriumphMoney(limit) +
                (alt != null && alt !== limit ? ' / ' + fmtTriumphMoney(alt) + ' non-rec.' : ''),
            'Recourse credit limit'
        );
    }

    if (data.purchasedInvoiceCount != null) {
        line('Invoices purchased: ' + data.purchasedInvoiceCount);
    }

    row.appendChild(meta);
    badge.appendChild(row);

    if (data.legalName) {
        const name = document.createElement('div');
        name.style.cssText =
            'font:600 11px/1.35 Arial,Helvetica,sans-serif;color:#475569;word-break:break-word;';
        name.title = 'Legal name on file with Triumph';
        name.textContent = data.legalName;
        badge.appendChild(name);
    }

    if (status === 'NOBUY') {
        const warn = document.createElement('div');
        warn.style.cssText =
            'font:700 11px/1.35 Arial,Helvetica,sans-serif;word-break:break-word;' +
            'color:#fff;background:#dc2626;border-radius:7px;padding:6px 9px;';
        warn.textContent = '⚠ NO-BUY — Triumph will not purchase invoices for this broker';
        badge.appendChild(warn);
    }

    return badge;
}

function fmtTriumphMoney(n) {
    if (n == null) return 'N/A';
    return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function buildTriumphNotice(msg, retryBtn) {
    const note = document.createElement('div');
    note.className = 'datx-rts-badge';
    note.setAttribute(INJECT_ATTR, '1');
    note.style.cssText = 'background:#fff7ed;border-color:#fed7aa;';

    const t = document.createElement('span');
    t.style.cssText = 'font:600 11.5px/1.4 Arial,Helvetica,sans-serif;color:#9a3412;';
    t.textContent = msg;
    note.appendChild(t);

    if (retryBtn) {
        retryBtn.disabled = false;
        retryBtn.innerHTML = TRIUMPH_ICON + '<span>Retry Triumph Check</span>';
        retryBtn.style.marginTop = '8px';
        note.appendChild(retryBtn);
    }
    return note;
}

// =========================
// "Choose your factoring" prompt
// =========================
// Shown in place of the provider controls when the user hasn't connected any
// factoring yet. Deliberately names no provider: a dispatcher who factors with
// Apex shouldn't be shown an RTS login button, which is what a per-provider
// login CTA would do. It sends them to the popup's Factoring tab to pick.
//
// Disappears the moment any provider is opted into, and comes back if they all
// get disconnected — the three flags are plain storage keys, so this needs no
// round trip to the background.
function factoringNoneConnected(cb) {
    try {
        chrome.storage.local.get(['rtsEnabled', 'triumphEnabled', 'apexEnabled'], (d) => {
            cb(!(d && (d.rtsEnabled || d.triumphEnabled || d.apexEnabled)));
        });
    } catch {
        cb(false); // can't tell — say nothing rather than nag
    }
}

function buildFactoringPrompt() {
    const holder = document.createElement('div');
    holder.className = 'tb-factoring-cta';
    holder.setAttribute(INJECT_ATTR, '1');
    holder.style.cssText = 'display:none;flex-direction:column;gap:6px;';

    const text = document.createElement('div');
    text.style.cssText =
        'font:600 11.5px/1.4 Arial,Helvetica,sans-serif;color:#64748b;';
    holder.appendChild(text);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-fmcsa-btn tb-tip';
    btn.setAttribute(INJECT_ATTR, '1');
    holder.appendChild(btn);

    // Generic wording by default. When a portal tab betrays which provider the
    // user actually has, the prompt names it and connects that one directly —
    // one click instead of "go find it in the popup". RTS needs none of this: it
    // connects itself the moment the user touches rtspro.com.
    const asGeneric = () => {
        text.textContent = 'Check broker credit with your own factoring account.';
        btn.textContent = 'Connect your factoring';
        btn.setAttribute('data-tip', 'Pick your factoring company in the Truck Box popup');
        btn.__connect = null;
    };

    const asDetected = (label, message) => {
        text.textContent = 'Looks like you use ' + label + '.';
        btn.textContent = 'Connect ' + label;
        btn.setAttribute('data-tip', 'Connect ' + label + ' to check broker credit here');
        btn.__connect = message;
    };

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (btn.__connect) {
            safeSendMessage({ type: btn.__connect });
            return;
        }

        const res = await safeSendMessage({ type: 'open_factoring_settings' });
        // openPopup isn't available on every Chrome build, and it can only run
        // off a fresh gesture — tell the user where to click instead of failing
        // silently.
        if (!res || res.ok === false) {
            if (typeof showToast === 'function') {
                showToast('Open the Truck Box icon → Factoring to connect', 'info');
            }
        }
    });

    const apply = () => factoringNoneConnected((none) => {
        holder.style.display = none ? 'flex' : 'none';
        if (!none) return;
        asGeneric();
        safeSendMessage({ type: 'factoring_detect' }).then((r) => {
            const seen = r && r.ok && r.data;
            if (!seen) return;
            // Apex first: it's the one whose open tab is a hard requirement
            // anyway, so an open tab is the strongest signal of the two.
            if (seen.apex) asDetected('Apex', 'apex_open_login');
            else if (seen.triumph) asDetected('Triumph', 'triumph_open_login');
            // RTS last: it connects itself as soon as its portal makes a request,
            // so this is only for the case where the tab is sitting idle.
            else if (seen.rts) asDetected('RTS', 'rts_open_login');
        });
    });
    apply();

    try {
        chrome.storage.onChanged.addListener((ch, area) => {
            if (area !== 'local') return;
            if (ch.rtsEnabled || ch.triumphEnabled || ch.apexEnabled) apply();
        });
    } catch {}

    return holder;
}

// =========================
// Apex Capital credit check
// =========================
// Third provider, third connection model. RTS and Triumph hold a token, so once
// connected they work with nothing else open. Apex has no token at all — the
// lookup runs inside the user's own portal tab, so that tab must be OPEN. The
// control therefore has a state the other two lack: connected, but no tab.
var APEX_ICON =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M12 4l8 14H4l8-14Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M12 10v3m0 2.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// Needs the background to answer, because "is a tab open" isn't visible from a
// content script — so unlike rtsConnInfo/triumphConnInfo this is a round trip.
function apexConnInfo(cb) {
    safeSendMessage({ type: 'apex_status' }).then((r) => {
        const d = r && r.ok && r.data ? r.data : null;
        if (!d) {
            cb({ enabled: false, tabOpen: false });
            return;
        }
        // Fold the display switch into `enabled`, same as the other two, so the
        // render paths below only ever ask one question.
        cb({ enabled: d.enabled && d.shown !== false, tabOpen: d.tabOpen });
    });
}

function buildApexOpenButton(label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tb-tip';
    b.setAttribute('data-tip', 'Apex checks run in your Apex tab — it has to stay open');
    b.setAttribute(INJECT_ATTR, '1');
    b.style.cssText =
        'display:inline-flex;align-items:center;gap:7px;cursor:pointer;flex:0 0 auto;white-space:nowrap;' +
        'font:700 12px/1 Arial,Helvetica,sans-serif;color:#fff;background:#0046E0;border:0;border-radius:9px;' +
        'padding:8px 12px;transition:background .2s;';
    b.innerHTML = APEX_ICON + '<span>' + (label || 'Open Apex') + '</span>';
    b.addEventListener('mouseenter', () => (b.style.background = '#0037b3'));
    b.addEventListener('mouseleave', () => (b.style.background = '#0046E0'));
    b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeSendMessage({ type: 'apex_open_login' });
    });
    return b;
}

function apexActiveButton(holder, detailsEl) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-fmcsa-btn tb-tip';
    btn.setAttribute('data-tip', "Check this broker's Apex credit status");
    btn.setAttribute(INJECT_ATTR, '1');
    btn.innerHTML = APEX_ICON + '<span>Apex Credit Check</span>';

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const mc = readMcNumber(detailsEl);
        if (!mc) {
            holder.dataset.state = 'result';
            holder.replaceChildren(buildApexNotice('No MC# found on this load.', btn));
            return;
        }

        btn.disabled = true;
        holder.dataset.state = 'loading';

        // City/state disambiguate multi-branch brokers — see readBrokerCityState.
        const where = readBrokerCityState(detailsEl);
        const resp = await safeSendMessage({
            type: 'apex_check',
            mc,
            city: where.city,
            state: where.state
        });

        if (resp && resp.ok && resp.data) {
            holder.dataset.state = 'result';
            holder.replaceChildren(buildApexBadge(resp.data));
            tbTrackEvent('APEX_CREDIT_CHECK');
            return;
        }

        const reason = resp && resp.reason;
        // The tab was closed (or the session died) between render and click —
        // fall back to the state that tells the user what to do about it.
        if (reason === 'no_tab' || reason === 'expired' || reason === 'no_token') {
            renderApex(holder, detailsEl, {
                enabled: reason !== 'no_token',
                tabOpen: false,
                expired: reason === 'expired'
            });
            return;
        }

        const msg =
            reason === 'not_found'
                ? 'Broker not set up with Apex.'
                : reason === 'no_mc'
                ? 'No MC# on this load.'
                : 'Apex check failed — try again.';
        holder.dataset.state = 'result';
        holder.replaceChildren(buildApexNotice(msg, btn));
    });

    return btn;
}

function renderApex(holder, detailsEl, info) {
    holder.replaceChildren();

    if (!info || !info.enabled) {
        holder.dataset.state = 'hidden';
        holder.style.display = 'none';
        return;
    }

    holder.style.display = 'flex';

    if (info.tabOpen) {
        holder.dataset.state = 'connected';
        holder.appendChild(apexActiveButton(holder, detailsEl));
        return;
    }

    holder.dataset.state = 'disconnected';
    holder.appendChild(
        buildApexOpenButton(info.expired ? 'Log in to Apex again' : 'Open Apex tab')
    );
}

function buildApexCheck(detailsEl) {
    const holder = document.createElement('div');
    holder.className = 'tb-apex-holder';
    holder.setAttribute(INJECT_ATTR, '1');
    holder.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    holder.__detailsEl = detailsEl;

    apexConnInfo((info) => renderApex(holder, detailsEl, info));
    return holder;
}

// Apex has no token in storage to watch, so the opt-in flag is the only signal
// storage can give us. Tab open/close is picked up on the next render or on the
// click itself, which is where it actually matters.
try {
    chrome.storage.onChanged.addListener((ch, area) => {
        if (area !== 'local' || (!ch.apexEnabled && !ch.apexShow)) return;
        document.querySelectorAll('.tb-apex-holder').forEach((h) => {
            const st = h.dataset.state;
            if (st === 'result' || st === 'loading') return;
            if (h.__detailsEl) apexConnInfo((info) => renderApex(h, h.__detailsEl, info));
        });
    });
} catch {}

// Apex reports an approval plus a limit and how much of it is left — a shape
// neither of the others has, so again its own badge rather than a merged one.
function buildApexBadge(data) {
    const badge = document.createElement('div');
    badge.className = 'datx-rts-badge';
    badge.setAttribute(INJECT_ATTR, '1');
    badge.style.cssText = 'box-sizing:border-box;';

    const row = document.createElement('div');
    row.className = 'rts-row tri-row';

    const pill = document.createElement('span');
    pill.className = 'tri-status' + (data.approved === true ? ' green' : data.status ? ' red' : '');
    pill.textContent = data.status || 'Unknown';
    row.appendChild(pill);

    const meta = document.createElement('div');
    meta.className = 'tri-meta';
    meta.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
    const line = (text, title) => {
        const s = document.createElement('span');
        s.style.cssText = 'font:600 11px/1 Arial,Helvetica,sans-serif;color:#64748b;';
        if (title) s.title = title;
        s.textContent = text;
        meta.appendChild(s);
    };

    if (data.creditLimit) line('Credit limit: ' + data.creditLimit);
    // "Remaining" is the number that actually decides whether to take the load,
    // so it is always shown — as N/A when Apex didn't return it.
    line('Remaining: ' + (data.remaining || 'N/A'), 'Credit remaining at time of request');
    if (data.proofOfDelivery) line('POD: ' + data.proofOfDelivery);
    if (data.businessStartDate) line('In business since: ' + data.businessStartDate);
    row.appendChild(meta);
    badge.appendChild(row);

    if (data.verifiedEmail) {
        const em = document.createElement('div');
        em.style.cssText =
            'font:600 11px/1.35 Arial,Helvetica,sans-serif;color:#475569;word-break:break-all;';
        em.title = 'Billing e-mail on file with Apex';
        em.textContent = data.verifiedEmail;
        badge.appendChild(em);
    }

    if (data.hasAlert) {
        const warn = document.createElement('div');
        warn.style.cssText =
            'font:700 11px/1.35 Arial,Helvetica,sans-serif;word-break:break-word;' +
            'color:#fff;background:#dc2626;border-radius:7px;padding:6px 9px;';
        warn.textContent = '⚠ ' + data.alertText;
        badge.appendChild(warn);
    }

    return badge;
}

function buildApexNotice(msg, retryBtn) {
    const note = document.createElement('div');
    note.className = 'datx-rts-badge';
    note.setAttribute(INJECT_ATTR, '1');
    note.style.cssText = 'background:#fff7ed;border-color:#fed7aa;';

    const t = document.createElement('span');
    t.style.cssText = 'font:600 11.5px/1.4 Arial,Helvetica,sans-serif;color:#9a3412;';
    t.textContent = msg;
    note.appendChild(t);

    if (retryBtn) {
        retryBtn.disabled = false;
        retryBtn.innerHTML = APEX_ICON + '<span>Retry Apex Check</span>';
        retryBtn.style.marginTop = '8px';
        note.appendChild(retryBtn);
    }
    return note;
}

// =========================
// Refresh Loads button (table-only refresh via DAT's own search)
// =========================
// Shared cooldown end time so the cooldown survives DAT re-rendering (and
// re-injecting) the button mid-countdown.
let tbRefreshCooldownUntil = 0;

// Re-run DAT's own search by clicking its "SEARCH" button. That refreshes the
// results table only — no full page reload.
function triggerDatSearch() {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
        const t = (b.textContent || '').replace(/\s+/g, ' ').trim();
        if (/^search$/i.test(t)) {
            b.click();
            return true;
        }
    }
    return false;
}

function applyRefreshCooldown(btn) {
    const label = btn.querySelector('.tb-refresh-label');
    const update = () => {
        const remainingMs = tbRefreshCooldownUntil - Date.now();
        if (remainingMs <= 0) {
            clearInterval(id);
            btn.disabled = false;
            btn.classList.remove('cooling');
            if (label) label.textContent = 'Refresh Loads';
            return;
        }
        btn.disabled = true;
        btn.classList.add('cooling');
        if (label) label.textContent = 'Refresh (' + Math.ceil(remainingMs / 1000) + 's)';
    };
    update();
    const id = setInterval(update, 250);
}

function injectRefreshButton() {
    const existing = document.querySelector('.tb-refresh-btn');

    if (!tbLoggedIn) {
        if (existing) existing.remove();
        const dt = document.querySelector('.tb-dark-toggle');
        if (dt) dt.remove();
        return;
    }
    if (existing) return; // already injected

    // Anchor on the "Sort by ..." control in the results header.
    let anchor = null;
    const candidates = document.querySelectorAll('span, div, button, a');
    for (const el of candidates) {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (/^sort by\b/i.test(t) && t.length < 40) {
            anchor = el;
            break;
        }
    }
    if (!anchor) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-refresh-btn tb-tip';
    btn.setAttribute('data-tip', 'Refreshes only the loads list, not the whole page');
    btn.setAttribute(INJECT_ATTR, '1');
    btn.innerHTML =
        '<svg class="tb-refresh-ic" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg><span class="tb-refresh-label">Refresh Loads</span>';

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled || Date.now() < tbRefreshCooldownUntil) return;

        const ok = triggerDatSearch();
        if (!ok) {
            if (typeof showToast === 'function') {
                showToast('Could not find DAT search to refresh', 'error');
            }
            return;
        }
        tbRefreshCooldownUntil = Date.now() + 5000;
        applyRefreshCooldown(btn);
    });

    // Place it to the RIGHT of the whole sort control: the "Sort by" label's
    // next sibling is the sort-value dropdown (e.g. "Age - Newest"), so insert
    // after that.
    const target = anchor.nextElementSibling || anchor;
    target.insertAdjacentElement('afterend', btn);

    // Dark-mode toggle sits immediately to the right of Refresh.
    const darkBtn = injectDarkToggleButton(btn);

    // First time the toolbar appears this page-load, pulse both buttons once
    // to draw the user's eye to them.
    playAttentionOnce(btn, darkBtn);

    // If a cooldown is still running (e.g. DAT re-rendered the header), reflect it.
    if (Date.now() < tbRefreshCooldownUntil) applyRefreshCooldown(btn);
}

// Pulse the given buttons exactly once per page load. The "done" flag is only
// set after the animation finishes, so if DAT wipes the toolbar mid-animation
// (before the user could notice), the pulse replays on the next re-inject.
let tbAttnDone = false;
function playAttentionOnce(...btns) {
    if (tbAttnDone) return;
    const targets = btns.filter(Boolean);
    if (!targets.length) return;
    let pending = targets.length;
    targets.forEach((el) => {
        el.classList.add('tb-attn');
        const done = () => {
            el.removeEventListener('animationend', done);
            el.classList.remove('tb-attn');
            if (--pending === 0) tbAttnDone = true;
        };
        el.addEventListener('animationend', done);
    });
}

// =========================
// Dark mode (whole-DAT filter invert) — toggle button + persisted state
// =========================
let tbDarkMode = false;

const TB_SUN_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2' +
    'M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const TB_MOON_ICON =
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

function applyDarkMode(on) {
    try {
        document.documentElement.classList.toggle('tb-dark', !!on);
    } catch {}
}

// Reflect the current mode on whatever toggle button is in the DOM.
function syncDarkToggle() {
    const btn = document.querySelector('.tb-dark-toggle');
    if (!btn) return;
    btn.innerHTML = tbDarkMode ? TB_SUN_ICON : TB_MOON_ICON;
    btn.setAttribute(
        'data-tip',
        tbDarkMode ? 'Switch to light mode' : 'Switch to dark mode'
    );
}

function setDarkMode(on) {
    tbDarkMode = !!on;
    applyDarkMode(tbDarkMode);
    syncDarkToggle();
    try {
        chrome.storage.local.set({ tbDarkMode });
    } catch {}
}

function injectDarkToggleButton(refreshBtn) {
    const already = document.querySelector('.tb-dark-toggle');
    if (already) return already; // already injected
    const anchor = refreshBtn || document.querySelector('.tb-refresh-btn');
    if (!anchor) return null;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-dark-toggle tb-tip';
    btn.setAttribute(INJECT_ATTR, '1');
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDarkMode(!tbDarkMode);
    });
    anchor.insertAdjacentElement('afterend', btn);
    syncDarkToggle();
}

// Mount the dark toggle next to the Truckstop logo in the top header (the nav is
// light DOM — Angular emulated — so document.querySelector finds it, and so does
// syncDarkToggle). Falls back to a floating button if the header isn't there yet.
// Reuses the shared setDarkMode/tbDarkMode state → stays in sync with the popup
// toggle and DAT's in-toolbar toggle.
let tbTsDarkListener = false;

function tbPaintDark(btn) {
    if (!btn) return;
    btn.innerHTML = tbDarkMode ? TB_SUN_ICON : TB_MOON_ICON;
    // Size the icon inline — the shared .tb-dark-toggle svg CSS can't reach a
    // button mounted inside the nav's Shadow DOM.
    const svg = btn.querySelector('svg');
    if (svg) { svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); }
    btn.setAttribute('data-tip', tbDarkMode ? 'Switch to light mode' : 'Switch to dark mode');
}

// Inline styling so the button looks right even inside the nav Shadow DOM (our
// document.head CSS won't apply there). `docked` = next to the profile button.
function tsStyleDark(btn, docked) {
    const base =
        'display:inline-flex;align-items:center;justify-content:center;cursor:pointer;' +
        'box-sizing:border-box;color:#0046E0;background:#fff;border:1.5px solid #cdddff;' +
        'border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.18);';
    btn.style.cssText = base + (docked
        ? 'width:34px;height:34px;margin:0 0 0 10px;vertical-align:middle;'
        : 'position:fixed;left:16px;bottom:16px;z-index:2147483647;width:42px;height:42px;');
}

function tbFindTsDark() {
    return document.getElementById('tb-ts-dark') ||
        (typeof tbDeepQueryShadow === 'function' ? tbDeepQueryShadow('#tb-ts-dark')[0] : null);
}

// The profile BUTTON in the Truckstop top-right nav. We dock the toggle right
// after it, inside the same container, and force that container to lay out
// horizontally so the toggle hugs the name instead of dropping below / centering.
// The nav is a remote micro-frontend that mounts after our first scan.
function tsDarkAnchor() {
    const q = (sel) => (typeof tbDeepQueryShadow === 'function'
        ? tbDeepQueryShadow(sel)[0] : document.querySelector(sel));
    return q('fm-profile-menu [data-cy="user-account-button"]')
        || q('fm-profile-menu button')
        || q('fm-profile-menu')
        || null;
}

// Place the toggle immediately after the profile button (tight to the name).
function tsPlaceDark(btn, anchor) {
    if (anchor && anchor.parentElement) {
        const c = anchor.parentElement;
        // The container stacks block children → make it a centered row so the
        // toggle sits beside the button, not under it.
        try { c.style.display = 'inline-flex'; c.style.alignItems = 'center'; } catch { /* ignore */ }
        c.insertBefore(btn, anchor.nextSibling);
    } else if (document.body) {
        document.body.appendChild(btn);
    }
}

function tsDarkParent(anchor) {
    return anchor ? anchor.parentElement : null;
}

function injectTruckstopDarkToggle() {
    try {
        const a = window.TB_ADAPTER;
        if (!a || a.id !== 'truckstop') return;
        if (!tbLoggedIn) return; // login-gated, like DAT

        const anchor = tsDarkAnchor();
        const want = tsDarkParent(anchor);

        let btn = tbFindTsDark();
        if (btn) {
            // Created floating before the nav existed → relocate once it appears.
            if (want && btn.parentElement !== want) {
                tsPlaceDark(btn, anchor);
                tsStyleDark(btn, true);
                tbPaintDark(btn);
            }
            return;
        }

        if (!anchor && !document.body) return;

        btn = document.createElement('button');
        btn.id = 'tb-ts-dark';
        btn.type = 'button';
        btn.setAttribute(INJECT_ATTR, '1');
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setDarkMode(!tbDarkMode);
            tbPaintDark(btn);
        });
        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#eef3ff';
            btn.style.borderColor = '#0046E0';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = '#fff';
            btn.style.borderColor = '#cdddff';
        });
        tsPlaceDark(btn, anchor);
        tsStyleDark(btn, !!anchor);
        tbPaintDark(btn); // paint directly (don't rely on a document-scoped query)

        // Keep this button in sync with the popup / DAT toggle even if it lives in
        // a shadow tree the generic syncDarkToggle() can't reach.
        if (!tbTsDarkListener) {
            tbTsDarkListener = true;
            try {
                chrome.storage.onChanged.addListener((ch, area) => {
                    if (area === 'local' && ch.tbDarkMode) tbPaintDark(tbFindTsDark());
                });
            } catch { /* ignore */ }
        }
    } catch { /* never disturb the page */ }
}

(function initDarkMode() {
    try {
        chrome.storage.local.get(['tbDarkMode'], (d) => {
            tbDarkMode = !!(d && d.tbDarkMode);
            applyDarkMode(tbDarkMode);
            syncDarkToggle();
        });
        chrome.storage.onChanged.addListener((ch, area) => {
            if (area !== 'local' || !ch.tbDarkMode) return;
            tbDarkMode = !!ch.tbDarkMode.newValue;
            applyDarkMode(tbDarkMode);
            syncDarkToggle();
        });
    } catch {}
})();

// (The old "Soon" placeholder buildRtsBadge() lived here — replaced by the live
// RTS credit check: see buildRtsCheck / buildRtsBadge(data, mc) above.)

function findEmailAnchorInContainer(container) {
    if (!container) return null;

    const mailto = container.querySelector('a[href^="mailto:"]');
    if (mailto) {
        const email = normalizeEmail(mailto.getAttribute('href'));
        if (email && EMAIL_RE.test(email)) {
            return {email, anchor: mailto};
        }
    }

    const elements = Array.from(container.querySelectorAll('a, span, div, td, p, strong, small'));

    for (const el of elements) {
        const t = text(el);
        if (!t) continue;

        const m = t.match(EMAIL_RE);
        if (m) {
            return {
                email: normalizeEmail(m[0]),
                anchor: el
            };
        }
    }

    const wholeText = text(container);
    const m = wholeText.match(EMAIL_RE);
    if (m) {
        return {
            email: normalizeEmail(m[0]),
            anchor: container
        };
    }

    return null;
}

function showLoginBanner() {
    const existing = document.getElementById('datx-login-banner');
    if (existing) return;

    const wrap = document.createElement('div');
    wrap.id = 'datx-login-banner';
    wrap.setAttribute(INJECT_ATTR, '1');
    wrap.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(15,23,42,.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    padding: 20px;
    backdrop-filter: blur(6px);
`;

    const box = document.createElement('div');
    box.style.cssText = `
    max-width: 580px;
    width: 100%;
    background: #ffffff;
    border-radius: 20px;
    padding: 28px 24px;
    box-shadow: 0 25px 60px rgba(15,23,42,.25);
    text-align: center;
    font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
`;

    box.innerHTML = `
    <div style="
        font-size:22px;
        font-weight:900;
        color:#0f172a;
        margin-bottom:12px;
    ">
        Login required
    </div>

<div style="
    font-size:15px;
    line-height:1.6;
    color:#475569;
    margin-bottom:14px;
">
    Need help signing in?
    <a
        href="https://truckbox.app/guide#4"
        target="_blank"
        style="color:#2563eb;font-weight:600;text-decoration:none;"
    >
        View Login Instructions
    </a>
</div>

    <div style="
        font-size:13px;
        line-height:1.6;
        color:#64748b;
        margin-bottom:22px;
        background:#f8fafc;
        border:1px solid #e2e8f0;
        padding:10px 12px;
        border-radius:10px;
    ">
        <b>Note:</b> Don’t forget to create your custom email template in the <b>Template</b> tab.
    </div>

    <button type="button" id="datx-login-banner-close"
        style="
            border:none;
            background:linear-gradient(135deg,#3b82f6,#2563eb);
            color:#fff;
            font-weight:800;
            padding:12px 22px;
            border-radius:12px;
            cursor:pointer;
            box-shadow:0 10px 20px rgba(59,130,246,.3);
            transition:all .2s ease;
        ">
        OK
    </button>
`;

    wrap.appendChild(box);
    document.body.appendChild(wrap);

    // hover effect (clean way, not inline JS)
    const btn = box.querySelector('#datx-login-banner-close');
    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-1px)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
    });

    wrap.addEventListener('click', (e) => {
        if (e.target === wrap || e.target.id === 'datx-login-banner-close') {
            wrap.remove();
        }
    });
}

function findEmailForRow(row) {
    if (!row) return null;

    const companyCell = row.querySelector(COMPANY_CELL_SEL);
    if (companyCell) {
        const found = findEmailAnchorInContainer(companyCell);
        if (found) return found;
    }

    return findEmailAnchorInContainer(row);
}

// Returns a row's expanded details panel, or null when the row is collapsed.
// The next sibling must NOT be another posting (ROW_SEL) — that guard is what
// stops us from reading a neighbouring load's email.
function getRowDetailsElement(row) {
    if (!(row instanceof Element)) return null;

    const next = row.nextElementSibling;
    if (!next) return null;

    // details block must NOT be another real row
    if (next.matches?.(ROW_SEL)) return null;

    // known DAT expanded-details containers
    if (
        next.classList?.contains('table-row-detail') ||
        next.querySelector?.(DETAILS_EMAIL_SEL) ||
        next.querySelector?.(DETAILS_COMMENT_SEL)
    ) {
        return next;
    }

    return null;
}

// Strict email finder. Only a *real contact* email counts: a mailto: link, or
// an email inside the CONTACT INFORMATION block. Free-text emails buried in the
// comments ("or email us@x.com for load details") are deliberately ignored, so
// instruction-style addresses never get a Send button.
function findContactEmail(container) {
    if (!(container instanceof Element)) return null;

    const mailto = container.querySelector('a[href^="mailto:"]');
    if (mailto) {
        const email = normalizeEmail(mailto.getAttribute('href'));
        if (email && EMAIL_RE.test(email)) return { email, anchor: mailto };
    }

    // DAT list rows: no mailto any more — the address is the `recipient-email`
    // attribute of DAT's contact-link / compose web components.
    if (EMAIL_ATTR_SEL) {
        const el = container.querySelector(EMAIL_ATTR_SEL);
        const email = emailOfElement(el);
        if (email && EMAIL_RE.test(email)) return { email, anchor: el };
    }

    const blocks = container.matches?.(CONTACT_BLOCK_SEL)
        ? [container]
        : Array.from(container.querySelectorAll(CONTACT_BLOCK_SEL));

    for (const b of blocks) {
        const m = text(b).match(EMAIL_RE);
        if (m) {
            const email = normalizeEmail(m[0]);
            if (email && EMAIL_RE.test(email)) return { email, anchor: b };
        }
    }

    return null;
}

// remove dat factoring image
function removeFactoringIcons(root = document) {
    const icons = root.querySelectorAll('img.resource-icon.factoring-logo');

    if (!icons.length) return;

    icons.forEach(el => el.remove());
}

// =========================================================================
// Lane analytics in the detail panel
//   B (auto, cheap): how often THIS broker posts THIS lane — a badge that
//      highlights as a "hot lane" (potential contract) past a threshold.
//   A (lazy, on click): this lane's offer-price trend as an inline SVG line.
// Both reuse the parsed load (window.TB_ADAPTER.parseLoad), the detail-panel
// scan (scanOnce -> injectMiniMapsInDetails), the login state (tbLoggedIn) and
// the background RPC (safeSendMessage). Results are cached per lane for the
// session so re-expanding never re-hits the backend; the auto badge is
// debounced so a quick scroll-past does not fire a request.
// =========================================================================
// Master switch for the in-detail lane analytics UI. Kept OFF until enough normalized history has
// accumulated on prod for the badge/chart to be useful — flip to true (and re-release) to enable.
const TB_LANE_ANALYTICS_ENABLED = true;
// Recurrence -> "Potential lane opportunity" button (opens the 30d/7d lane chart).
const TB_LANE_OPP_WEEK = 3;               // active on > this many distinct days this week, OR
const TB_LANE_OPP_MONTH = 10;            // active on > this many distinct days in 30 days
// Today intensity -> "Hot lane" button (opens the today/intraday chart).
const TB_LANE_HOT_TODAY = 3;             // reposted > this many times today
const TB_LANE_INFO_TEXT =
    'Lane analytics — built from loads seen across TruckBox.\n\n'
    + '• Potential lane — how often this broker runs this exact route. Many separate days = a likely '
    + 'recurring/contract lane worth pitching.\n\n'
    + '• Today’s price — today’s offers for this lane plus how many times the broker reposted it today. '
    + 'More reposts = harder to cover = more leverage when you negotiate.';
const TB_LANE_FETCH_DEBOUNCE_MS = 400;
const TB_LANE_PRICE_DAYS = 30;
const tbLaneFreqCache = new Map();        // laneKey|brokerKey -> response.data
const tbLanePriceCache = new Map();       // laneKey -> response.data
const tbLaneIntradayCache = new Map();    // laneKey|brokerKey -> response.data (feature 1, today)

// Leading 16px line-icons for the lane badges (inherit the badge colour via
// currentColor). Keeps each badge legible at a glance: cycle = recurring lane,
// flame = reposted hard today, clock = today's price, line = price history.
const TB_LANE_IC = {
    spin:
        '<span class="tb-lane-ic spin"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-opacity=".25" stroke-width="2.4"/>' +
        '<path d="M20 12a8 8 0 0 0-8-8" stroke="currentColor" stroke-width="2.4" ' +
        'stroke-linecap="round"/></svg></span>',
    opp:
        '<span class="tb-lane-ic"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M4 9a8 8 0 0 1 13.7-4.3L20 7M20 4v3h-3" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M20 15a8 8 0 0 1-13.7 4.3L4 17M4 20v-3h3" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
    flame:
        '<span class="tb-lane-ic"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M12 3c.6 3-2 4.3-2 7a2 2 0 1 0 4 0c0-.6-.2-1.1-.2-1.1 1.9.9 3.2 2.8 3.2 5.1a5 5 0 0 1-10 0c0-3.4 2.5-5.3 5-11Z" ' +
        'stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span>',
    clock:
        '<span class="tb-lane-ic"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2"/>' +
        '<path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
    chart:
        '<span class="tb-lane-ic"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M4 16l4.5-5 3.5 3L20 7M15 7h5v5" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
    dash:
        '<span class="tb-lane-ic"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>'
};
const TB_LANE_CARET = '<span class="tb-lane-caret"><svg width="11" height="11" viewBox="0 0 24 24" ' +
    'fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

function tbLaneNorm(s) {
    return s == null ? '' : String(s).toLowerCase().replace(/\s+/g, '');
}

function tbLaneKey(item) {
    return [
        tbLaneNorm(item.origin),
        tbLaneNorm(item.destination),
        tbLaneNorm(item.equipment),
        item.lengthFt == null ? '' : String(item.lengthFt)
    ].join('|') + '|';
}

function tbBrokerKey(item) {
    return (item.mcNumber || '') + '#' + tbLaneNorm(item.brokerName || item.brokerNameRaw || '');
}

// Backend Platform enum value for the active site adapter (DAT/TRUCKSTOP/...).
function tbActivePlatform() {
    const id = window.TB_ADAPTER && window.TB_ADAPTER.id;
    return id ? String(id).toUpperCase() : 'DAT';
}

// Fire-and-forget analytics event (recorded only for logged-in users, server-side).
function tbTrackEvent(eventType) {
    try {
        safeSendMessage({ type: 'analytics_event', eventType: eventType, platform: tbActivePlatform() });
    } catch {}
}

function ensureLaneAnalyticsStyle() {
    if (document.getElementById('tb-lane-analytics-style')) return;
    const st = document.createElement('style');
    st.id = 'tb-lane-analytics-style';
    st.textContent =
        '.tb-lane-col{flex:1 1 300px;min-width:260px;max-width:520px;box-sizing:border-box;' +
        'padding:0 12px;font-family:Arial,Helvetica,sans-serif;}' +
        '.tb-lane-col--inmap{flex:none;min-width:0;max-width:none;width:100%;padding:0;' +
        'margin:10px 0 6px;}' +
        '.tb-lane-header{display:flex;align-items:center;gap:7px;' +
        'font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:.5px;text-transform:uppercase;' +
        'color:#5b646e;padding:8px 0;margin-bottom:10px;}' +
        '.tb-lane-header::before{content:"";width:7px;height:7px;border-radius:2px;' +
        'background:#0046E0;flex:0 0 auto;}' +
        '.tb-lane-col--inmap .tb-lane-header{border-bottom:0;padding:8px 0 6px 3px;margin-bottom:6px;}' +
        '.tb-lane-info{position:relative;display:inline-flex;align-items:center;' +
        'justify-content:center;width:14px;height:14px;border-radius:50%;border:1px solid #b6bdc6;' +
        'color:#8a929c;font:italic 700 10px/1 Georgia,serif;cursor:help;vertical-align:middle;' +
        'margin-left:2px;}' +
        '.tb-lane-tip{display:none;position:absolute;top:18px;left:-6px;z-index:2147483646;' +
        'width:264px;background:#2b333c;color:#fff;font:400 11px/1.5 Arial,Helvetica,sans-serif;' +
        'white-space:pre-line;text-align:left;padding:9px 11px;border-radius:6px;' +
        'box-shadow:0 6px 18px rgba(0,0,0,.28);cursor:default;font-style:normal;}' +
        '.tb-lane-info:hover .tb-lane-tip{display:block;}' +
        '.tb-lane-badge{display:inline-flex;align-items:center;gap:9px;cursor:pointer;' +
        'border:1px solid #d4dbe4;border-radius:10px;padding:9px 12px;font-size:13px;' +
        'line-height:1.3;text-align:left;background:#f7f9fc;color:#2b333c;width:100%;' +
        'justify-content:flex-start;' +
        'transition:border-color .18s ease,box-shadow .18s ease,background .18s ease,' +
        'transform .12s cubic-bezier(.34,1.4,.64,1);}' +
        '.tb-lane-badge:hover{transform:translateY(-1px);box-shadow:0 3px 11px rgba(16,24,40,.1);}' +
        '.tb-lane-badge:active{transform:translateY(0) scale(.985);}' +
        '.tb-lane-badge b{font-weight:700;}' +
        '.tb-lane-badge--loading,.tb-lane-badge--empty{color:#8a929c;cursor:default;background:#fafbfc;}' +
        '.tb-lane-badge--loading:hover,.tb-lane-badge--empty:hover{transform:none;box-shadow:none;}' +
        '.tb-lane-btnrow{display:flex;flex-direction:column;gap:7px;}' +
        '.tb-lane-badge--opp{background:linear-gradient(180deg,#effaf2,#e6f6ec);' +
        'border-color:#a6dcb9;color:#157347;}' +
        '.tb-lane-badge--opp:hover{box-shadow:0 3px 11px rgba(21,115,71,.18);}' +
        '.tb-lane-badge--hot{background:linear-gradient(180deg,#fff3ec,#ffe9dd);' +
        'border-color:#f4bd97;color:#b5510f;}' +
        '.tb-lane-badge--hot:hover{box-shadow:0 3px 11px rgba(181,81,15,.18);}' +
        '.tb-lane-badge--open{border-color:#2b333c;box-shadow:inset 0 0 0 1px #2b333c;}' +
        '.tb-lane-badge--open:hover{transform:none;box-shadow:inset 0 0 0 1px #2b333c;}' +
        // "Show rate analytics" gate: keep the light badge inside, add a soft blue glow outside
        // so it draws the eye without being loud. Type matches the "Lane analytics" header.
        '.tb-lane-gate{border-color:#bcd2ff;box-shadow:0 0 9px 1px rgba(47,123,255,.28);' +
        'font:700 11px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.5px;' +
        'text-transform:uppercase;color:#5b646e;}' +
        '.tb-lane-gate:hover{transform:translateY(-1px);box-shadow:0 0 13px 2px rgba(47,123,255,.42);}' +
        '.tb-lane-ic{width:16px;height:16px;flex:0 0 auto;display:inline-flex;' +
        'align-items:center;justify-content:center;}' +
        '.tb-lane-ic svg{width:16px;height:16px;display:block;}' +
        '.tb-lane-ic.spin svg{animation:tb-spin .8s linear infinite;transform-origin:center;}' +
        '.tb-lane-dot{width:8px;height:8px;border-radius:50%;display:inline-block;' +
        'flex:0 0 auto;background:#9aa3ad;}' +
        '.tb-lane-caret{margin-left:auto;flex:0 0 auto;opacity:.55;transition:transform .18s ease;}' +
        '.tb-lane-badge--open .tb-lane-caret{transform:rotate(180deg);}' +
        '.tb-lane-chart{margin-top:10px;}' +
        '.tb-lane-toggle{display:flex;gap:6px;margin-bottom:6px;}' +
        '.tb-lane-toggle button{font-size:12px;border:1px solid #cdd4dc;background:#fff;' +
        'border-radius:6px;padding:3px 8px;cursor:pointer;color:#636d78;}' +
        '.tb-lane-toggle button.active{background:#2b333c;color:#fff;border-color:#2b333c;}' +
        '.tb-lane-svg{width:100%;position:relative;}' +
        '.tb-lane-svg svg{width:100%;height:auto;max-height:180px;display:block;}' +
        '.tb-chart-tip{position:absolute;transform:translate(-50%,-130%);background:#2b333c;' +
        'color:#fff;font:600 11px/1.3 Arial,Helvetica,sans-serif;padding:5px 8px;border-radius:5px;' +
        'white-space:nowrap;pointer-events:none;z-index:2147483646;' +
        'box-shadow:0 3px 10px rgba(0,0,0,.25);}' +
        '.tb-lane-meta{font-size:12px;color:#636d78;margin-top:4px;}' +
        '.tb-lane-meta--today{font-size:14px;font-weight:500;color:#5b646e;margin-top:8px;' +
        'background:#f5f7fa;border:1px solid #e3e7ec;border-radius:6px;padding:8px 10px;}' +
        '.tb-lane-meta--today b{font-weight:700;color:#2b333c;}' +
        '.tb-lane-empty,.tb-lane-loading{font-size:12px;color:#8a929c;padding:10px 0;}' +
        '.tb-lane-locked{font-size:12px;color:#8a929c;padding:8px 0;}' +
        '.tb-lane-locked button{margin-top:6px;font-size:12px;border:1px solid #cdd4dc;' +
        'background:#fff;border-radius:6px;padding:5px 10px;cursor:pointer;color:#2b333c;}';
    (document.head || document.documentElement).appendChild(st);
}

// Truckstop: a "route in Google Maps" button under the platform's own detail
// map. Mirrors DAT's map link — a 3-point route (truck → pickup → delivery),
// click-gated by datx_map_click — but mounts beneath <shared-map>. Driven by
// the adapter's buildMapRoute(); DAT has no such hook, so it's untouched there.
function injectTruckstopRouteButton() {
    try {
        const a = window.TB_ADAPTER;
        if (!a || typeof a.buildMapRoute !== 'function') return;
        if (!tbLoggedIn) return; // login-gated, like DAT
        if (typeof buildMapsLink !== 'function') return;

        // Truckstop renders the detail panel inside a Shadow DOM, so a plain
        // document.querySelector can't reach <shared-map> AND document.head CSS
        // can't style anything inside it. So: pierce shadow to find the map, and
        // style the overlay button inline (no dependency on external CSS).
        const maps = (typeof tbDeepQueryShadow === 'function')
            ? tbDeepQueryShadow('shared-map')
            : Array.from(document.querySelectorAll('shared-map'));

        maps.forEach((mapEl) => {
            const container = mapEl.closest('.shared-map') || mapEl;
            // One button per map.
            if (container.querySelector(':scope > .tb-ts-maplink-wrap')) return;

            const route = a.buildMapRoute(container);
            if (!route || !route.origin || !route.dest) return;

            const wrap = document.createElement('div');
            wrap.className = 'tb-ts-maplink-wrap';
            wrap.setAttribute(INJECT_ATTR, '1');
            wrap.style.cssText =
                'position:absolute;bottom:8px;left:50%;transform:translateX(-50%);' +
                'z-index:2147483647;';

            const link = document.createElement('a');
            link.className = 'tb-mini-map-link';
            link.target = '_blank';
            link.rel = 'noopener';
            // 3-point route when the truck (search origin) is known, else just
            // pickup -> delivery. Passing truck as `start` would drop the pickup
            // when truck is null, leaving only the destination — hence this.
            const start = route.truck || route.origin;
            const waypoint = route.truck ? route.origin : null;
            link.href = buildMapsLink(start, waypoint, route.dest);
            // Inline pill styles (shadow DOM can't see our document stylesheet).
            const base =
                'display:inline-flex;align-items:center;gap:6px;cursor:pointer;' +
                'font:700 11px/1 Arial,Helvetica,sans-serif;color:#fff;text-decoration:none;' +
                'background:#0046E0;border:1px solid #0046E0;border-radius:999px;' +
                'padding:5px 10px;box-shadow:0 1px 6px rgba(0,0,0,.35);' +
                'transition:background .18s,box-shadow .18s,transform .12s;';
            link.style.cssText = base;
            link.innerHTML =
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
                '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" ' +
                'stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
                '<circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="2"/></svg>' +
                '<span>Open in Google Maps</span>' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
                '<path d="M7 17L17 7M9 7h8v8" stroke="currentColor" stroke-width="2" ' +
                'stroke-linecap="round" stroke-linejoin="round"/></svg>';
            link.addEventListener('mouseenter', () => {
                link.style.cssText = base +
                    'background:#0037b3;box-shadow:0 4px 12px rgba(0,70,224,.45);transform:translateY(-1px);';
            });
            link.addEventListener('mouseleave', () => { link.style.cssText = base; });

            // Same login/subscription gate as the DAT map link.
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const resp = await safeSendMessage({ type: 'datx_map_click', platform: tbActivePlatform() });
                if (resp?.needLogin) {
                    if (typeof showLoginBanner === 'function') showLoginBanner();
                    return;
                }
                if (resp?.accessDenied) {
                    showToast('Your subscription is not active. Please subscribe', 'error');
                    return;
                }
                if (!resp?.ok) {
                    showToast('Access check failed', 'error');
                    return;
                }
                window.open(link.href, '_blank', 'noopener');
            });

            wrap.appendChild(link);
            // Anchor the absolute overlay (container is usually position:relative).
            try {
                if (getComputedStyle(container).position === 'static') {
                    container.style.position = 'relative';
                }
            } catch { container.style.position = 'relative'; }
            container.appendChild(wrap);
        });
    } catch { /* never disturb the page */ }
}

// =========================================================================
// Truckstop miles/RPM board + rate calculator — mirrors DAT's Route board but
// self-contained with INLINE styles (Shadow DOM) in the Truckstop look. Reads
// loaded miles, deadhead and posted rate from the open panel; sits above the
// FMCSA/RTS buttons, fenced by dividers like the Estimated Fuel row.
// =========================================================================
function tsNumIn(el) {
    const m = el && String(el.textContent || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
}

function tsBoardDivider() {
    const d = document.createElement('div');
    d.setAttribute(INJECT_ATTR, '1');
    d.style.cssText = 'height:1px;background:#e5e6e7;margin:6px 0;';
    return d;
}

function tsStatCell(label, value, accent) {
    const cell = document.createElement('div');
    cell.style.cssText = 'flex:1 1 0;min-width:0;text-align:center;padding:2px 2px;';
    const k = document.createElement('div');
    k.style.cssText = 'font:600 8.5px/1.3 Inter,Arial,sans-serif;letter-spacing:.3px;' +
        'text-transform:uppercase;color:#586166;white-space:nowrap;';
    k.textContent = label;
    const v = document.createElement('div');
    v.style.cssText = 'font:700 13px/1.2 Inter,Arial,sans-serif;color:' +
        (accent ? '#0275df' : '#263238') + ';';
    v.textContent = value;
    cell.appendChild(k);
    cell.appendChild(v);
    return cell;
}

// Compact, inline-styled rate calculator (Rate↔RPM), Truckstop look.
function tsBuildCalc(loaded, total, deadhead, defaultRate) {
    const showDh = deadhead != null && total != null;
    const calc = document.createElement('div');
    calc.setAttribute(INJECT_ATTR, '1');
    calc.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:7px;';

    const SWAP = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/></svg>';

    const switchBtn = document.createElement('button');
    switchBtn.type = 'button';
    switchBtn.setAttribute(INJECT_ATTR, '1');
    switchBtn.style.cssText = 'display:inline-flex;align-items:center;gap:3px;cursor:pointer;' +
        'font:700 9px/1 Inter,Arial,sans-serif;text-transform:uppercase;letter-spacing:.3px;' +
        'color:#b60207;background:#fbeaea;border:1px solid #e7b3b4;border-radius:999px;' +
        'padding:4px 7px;white-space:nowrap;';
    switchBtn.innerHTML = SWAP + '<span class="lbl">Rate→RPM</span>';

    const inRow = document.createElement('div');
    inRow.style.cssText = 'display:flex;align-items:center;gap:4px;background:#fff;width:92px;' +
        'box-sizing:border-box;border:1px solid #c7cacb;border-radius:4px;padding:5px 8px;';
    const dollar = document.createElement('span');
    dollar.style.cssText = 'font:700 12px/1 Inter,Arial,sans-serif;color:#586166;';
    dollar.textContent = '$';
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'decimal';
    input.min = '0';
    input.step = 'any';
    input.placeholder = 'Rate';
    input.className = 'tb-calc-input';
    input.style.cssText = 'flex:1;min-width:0;border:0;outline:0;background:transparent;' +
        'font:700 13px/1 Inter,Arial,sans-serif;color:#263238;';
    inRow.appendChild(dollar);
    inRow.appendChild(input);

    const out = document.createElement('div');
    out.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    const mkStat = (accent) => {
        const s = document.createElement('div');
        s.style.cssText = 'display:flex;align-items:baseline;gap:6px;';
        const v = document.createElement('span');
        v.style.cssText = 'font:700 13px/1 Inter,Arial,sans-serif;min-width:46px;color:' +
            (accent ? '#0275df' : '#263238') + ';';
        v.textContent = '–';
        const k = document.createElement('span');
        k.style.cssText = 'font:600 8.5px/1 Inter,Arial,sans-serif;text-transform:uppercase;' +
            'letter-spacing:.3px;color:#586166;';
        s.appendChild(v);
        s.appendChild(k);
        return { el: s, v: v, k: k };
    };
    const st1 = mkStat(false);
    const st2 = showDh ? mkStat(true) : null;
    out.appendChild(st1.el);
    if (st2) out.appendChild(st2.el);

    calc.appendChild(switchBtn);
    calc.appendChild(inRow);
    calc.appendChild(out);

    let mode = 'rate';
    const fmtRate = (n) => '$' + Math.round(n).toLocaleString('en-US');
    const recompute = () => {
        const val = parseFloat(input.value);
        const ok = isFinite(val) && val > 0;
        if (mode === 'rate') {
            st1.v.textContent = ok && loaded ? '$' + (val / loaded).toFixed(2) : '–';
            if (st2) st2.v.textContent = ok && total ? '$' + (val / total).toFixed(2) : '–';
        } else {
            st1.v.textContent = ok && loaded ? fmtRate(val * loaded) : '–';
            if (st2) st2.v.textContent = ok && total ? fmtRate(val * total) : '–';
        }
    };
    const applyMode = () => {
        const lbl = switchBtn.querySelector('.lbl');
        if (mode === 'rate') {
            input.placeholder = 'Rate';
            if (lbl) lbl.textContent = 'Rate→RPM';
            st1.k.textContent = 'RPM';
            if (st2) st2.k.textContent = 'RPM w/DH';
        } else {
            input.placeholder = 'RPM';
            if (lbl) lbl.textContent = 'RPM→Rate';
            st1.k.textContent = 'Rate';
            if (st2) st2.k.textContent = 'Rate w/DH';
        }
    };
    switchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        mode = mode === 'rate' ? 'rpm' : 'rate';
        input.value = '';
        applyMode();
        recompute();
        input.focus();
    });
    input.addEventListener('input', recompute);
    ['click', 'keydown', 'keyup'].forEach((evt) =>
        input.addEventListener(evt, (e) => e.stopPropagation()));
    if (defaultRate != null && isFinite(defaultRate) && defaultRate > 0) {
        input.value = String(defaultRate);
    }
    applyMode();
    recompute();
    return calc;
}

// Red "Log in to TruckBox" CTA shown in the rate-board slot when logged out, so
// the user knows the panel features unlock after login (Truckstop red style).
function tsLoginCta() {
    const wrap = document.createElement('div');
    wrap.className = 'tb-ts-login';
    wrap.setAttribute(INJECT_ATTR, '1');
    wrap.appendChild(tsBoardDivider());

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(INJECT_ATTR, '1');
    const base =
        'display:flex;align-items:center;justify-content:center;gap:7px;width:100%;' +
        'box-sizing:border-box;cursor:pointer;font:700 12px/1 Inter,Arial,Helvetica,sans-serif;' +
        'color:#fff;background:#b60207;border:1px solid #b60207;border-radius:4px;' +
        'padding:9px 12px;margin:2px 0;transition:background .18s;';
    btn.style.cssText = base;
    btn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' +
        '<span>Log in to TruckBox</span>';
    btn.addEventListener('mouseenter', () => { btn.style.background = '#9b0b0f'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#b60207'; });
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        loginWithStoredProvider();
    });
    wrap.appendChild(btn);

    const cap = document.createElement('div');
    cap.style.cssText =
        'text-align:center;font:600 10px/1.3 Inter,Arial,sans-serif;color:#586166;margin:3px 0 0;';
    cap.textContent = 'Unlock route map, RPM, FMCSA & RTS';
    wrap.appendChild(cap);

    wrap.appendChild(tsBoardDivider());
    return wrap;
}

function injectTruckstopRateBoard() {
    try {
        const a = window.TB_ADAPTER;
        if (!a || a.id !== 'truckstop') return;

        const panels = (typeof tbDeepQueryShadow === 'function')
            ? tbDeepQueryShadow('load-search-load-details-general-details-tab')
            : Array.from(document.querySelectorAll('load-search-load-details-general-details-tab'));

        panels.forEach((gp) => {
            if (!gp) return;

            // Same mount point for both the board and the logged-out CTA.
            const anchor = gp.querySelector('.load-details-general-tab-rates-wrapper')
                || (gp.querySelector('[data-testid="posted-rate"]') &&
                    gp.querySelector('[data-testid="posted-rate"]')
                        .closest('.load-details-general-tab-rates-wrapper, load-search-rates'));
            if (!anchor) return;

            // Logged out → show the login CTA instead of the board.
            if (!tbLoggedIn) {
                const board = gp.querySelector('.tb-ts-board');
                if (board) board.remove();
                if (!gp.querySelector('.tb-ts-login')) {
                    anchor.insertAdjacentElement('afterend', tsLoginCta());
                }
                return;
            }

            // Logged in → drop any CTA, then build/refresh the board.
            const cta = gp.querySelector('.tb-ts-login');
            if (cta) cta.remove();

            const loaded = tsNumIn(gp.querySelector('[data-testid="distance"]'));
            const deadhead = tsNumIn(gp.querySelector('[data-testid="origin-deadhead"]'));
            const rateEl = gp.querySelector('[data-testid="posted-rate"]');
            const rm = rateEl && String(rateEl.textContent || '').match(/\$\s*([\d,]+(?:\.\d+)?)/);
            const rate = rm ? parseFloat(rm[1].replace(/,/g, '')) : null;
            if (loaded == null && rate == null) return; // nothing useful to show

            const total = (loaded != null && deadhead != null) ? loaded + deadhead : loaded;
            const key = [loaded, deadhead, rate].join('|');

            const existing = gp.querySelector('.tb-ts-board');
            if (existing) {
                if (existing.dataset.k === key) return; // same load — keep it
                existing.remove();                      // load changed — rebuild
            }

            const section = document.createElement('div');
            section.className = 'tb-ts-board';
            section.dataset.k = key;
            section.setAttribute(INJECT_ATTR, '1');

            section.appendChild(tsBoardDivider());

            const stats = document.createElement('div');
            stats.style.cssText = 'display:flex;align-items:stretch;gap:2px;';
            const fmtMi = (n) => (n == null ? '–' : n.toLocaleString('en-US') + ' mi');
            const rpm = (rate && loaded) ? '$' + (rate / loaded).toFixed(2) : '–';
            const rpmDh = (rate && total) ? '$' + (rate / total).toFixed(2) : '–';
            stats.appendChild(tsStatCell('Loaded', fmtMi(loaded)));
            stats.appendChild(tsStatCell('Deadhead', fmtMi(deadhead)));
            stats.appendChild(tsStatCell('Total', fmtMi(total), true));
            stats.appendChild(tsStatCell('RPM', rpm));
            stats.appendChild(tsStatCell('RPM w/DH', rpmDh, true));
            section.appendChild(stats);

            section.appendChild(tsBuildCalc(loaded, total, deadhead, rate));
            section.appendChild(tsBoardDivider());

            // Mount directly under the posted-rate / per-mile block (anchor above).
            anchor.insertAdjacentElement('afterend', section);
        });
    } catch { /* never disturb the page */ }
}

// =========================================================================
// Truckstop RTS credit-check — same backend flow as DAT (rts_check /
// rts_open_login / rtsConnInfo), but self-contained with INLINE styles (the
// detail panel is in a Shadow DOM our document.head CSS can't reach) and a
// Truckstop-fitting look (Inter, red accent). Mounts right under the broker's
// CreditStop block. DAT keeps its own Route-tools RTS control untouched.
// =========================================================================
const TS_RTS_GRADE_BG = { A: '#16a34a', B: '#65a30d', C: '#f59e0b', D: '#ea580c', F: '#dc2626' };

// Document/report icon for the FMCSA button (matches RTS_ICON's 15px line style).
const TS_FMCSA_ICON =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" ' +
    'stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M13 3v6h6M9 13h6M9 17h4" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

function tsRtsMc(panel) {
    const el = panel && panel.querySelector('[data-testid="contact-broker-mc"]');
    const m = el && String(el.textContent || '').match(/\d{4,9}/); // ignores "—"
    return m ? m[0] : null;
}

function tsRtsButton(iconSvg, label, filled) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute(INJECT_ATTR, '1');
    const common =
        'display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;' +
        'box-sizing:border-box;cursor:pointer;font:600 12px/1 Inter,Arial,Helvetica,sans-serif;' +
        'border-radius:4px;padding:7px 8px;transition:border-color .18s,box-shadow .18s,background .18s;';
    // filled = red CTA (used for "Login to RTS"); else bordered (FMCSA / Credit Check).
    const idle = common + (filled
        ? 'color:#fff;background:#b60207;border:1px solid #b60207;'
        : 'color:#b60207;background:#fff;border:1px solid #c7cacb;');
    b.style.cssText = idle;
    b.innerHTML = iconSvg + '<span>' + label + '</span>';
    b.addEventListener('mouseenter', () => {
        if (filled) {
            b.style.background = '#9b0b0f';
            b.style.borderColor = '#9b0b0f';
        } else {
            b.style.borderColor = '#b60207';
            b.style.boxShadow = '0 0 0 2px rgba(182,2,7,.12)';
        }
    });
    b.addEventListener('mouseleave', () => {
        if (filled) {
            b.style.background = '#b60207';
            b.style.borderColor = '#b60207';
        } else {
            b.style.borderColor = '#c7cacb';
            b.style.boxShadow = 'none';
        }
    });
    return b;
}

function tsRtsNotice(msg) {
    const d = document.createElement('div');
    d.setAttribute(INJECT_ATTR, '1');
    d.style.cssText =
        'font:600 11px/1.4 Inter,Arial,Helvetica,sans-serif;color:#586166;background:#f4f4f4;' +
        'border:1px solid #e0e0e0;border-radius:4px;padding:7px 9px;';
    d.textContent = msg;
    return d;
}

function tsRtsBadge(data) {
    const wrap = document.createElement('div');
    wrap.setAttribute(INJECT_ATTR, '1');
    wrap.style.cssText =
        'box-sizing:border-box;display:flex;flex-direction:column;gap:6px;background:#fff;' +
        'border:1px solid #e0e0e0;border-radius:4px;padding:8px 9px;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:9px;';
    const g = String(data.grade || '?').charAt(0).toUpperCase();
    const chip = document.createElement('span');
    chip.style.cssText =
        'display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;' +
        'flex:0 0 auto;border-radius:50%;font:800 14px/1 Inter,Arial,sans-serif;color:#fff;' +
        'background:' + (TS_RTS_GRADE_BG[g] || '#94a3b8') + ';';
    chip.textContent = g;
    row.appendChild(chip);

    const meta = document.createElement('div');
    meta.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;';
    const pay = document.createElement('span');
    pay.style.cssText = 'font:600 11px/1.3 Inter,Arial,sans-serif;color:#586166;';
    pay.textContent = data.avgDaysToPay != null
        ? 'Days to pay: ~' + data.avgDaysToPay : 'Days to pay: N/A';
    meta.appendChild(pay);
    if (data.emailDomain) {
        const dom = document.createElement('span');
        dom.style.cssText =
            'font:600 11px/1.3 Inter,Arial,sans-serif;color:#586166;word-break:break-all;';
        dom.textContent = 'Domain: ' + data.emailDomain;
        meta.appendChild(dom);
    }
    row.appendChild(meta);
    wrap.appendChild(row);

    if (data.noBuy) {
        const w = document.createElement('div');
        w.style.cssText =
            'font:700 11px/1.35 Inter,Arial,sans-serif;color:#fff;background:#c81019;' +
            'border-radius:4px;padding:6px 8px;word-break:break-word;';
        w.textContent = '⚠ NO-BUY / ' + data.noBuy.flag +
            (data.noBuy.desc ? ' — ' + data.noBuy.desc : '');
        wrap.appendChild(w);
    }
    return wrap;
}

// Triumph's Truckstop result card. Same shell as tsRtsBadge, different content:
// a status pill and credit limits rather than a letter grade — see the DAT-side
// buildTriumphBadge for why the two providers are never merged into one badge.
function tsTriumphBadge(data) {
    const wrap = document.createElement('div');
    wrap.setAttribute(INJECT_ATTR, '1');
    wrap.style.cssText =
        'box-sizing:border-box;display:flex;flex-direction:column;gap:6px;background:#fff;' +
        'border:1px solid #e0e0e0;border-radius:4px;padding:8px 9px;';

    const row = document.createElement('div');
    // Wraps for the same reason as the DAT badge: the status pill is wide, and
    // the Truckstop panel is the narrower of the two boards.
    row.style.cssText = 'display:flex;align-items:center;gap:9px;flex-wrap:wrap;';

    const status = String(data.status || '').toUpperCase();
    const pill = document.createElement('span');
    pill.style.cssText =
        'display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;' +
        'padding:5px 9px;border-radius:999px;font:800 11px/1 Inter,Arial,sans-serif;' +
        'text-transform:uppercase;letter-spacing:.4px;color:#fff;white-space:nowrap;background:' +
        (status === 'GREEN' ? '#16a34a' : status === 'RED' || status === 'NOBUY' ? '#c81019' : '#94a3b8') +
        ';';
    pill.textContent =
        status === 'GREEN' ? 'Approved'
            : status === 'RED' ? 'Denied'
            : status === 'NOBUY' ? 'No Buy'
            : 'Unknown';
    row.appendChild(pill);

    const meta = document.createElement('div');
    // flex-basis 130px pairs with the row's wrap: given less room than that, the
    // figures take their own full-width line instead of being squeezed beside
    // the pill.
    meta.style.cssText = 'display:flex;flex-direction:column;gap:2px;flex:1 1 130px;min-width:0;';
    // No word-break here on purpose: combined with the column's min-width:0 it
    // lets flexbox shrink this to one character per line when the Truckstop
    // panel is narrow. Wrapping on spaces keeps the numbers readable instead.
    const line = (text) => {
        const s = document.createElement('span');
        s.style.cssText = 'font:600 11px/1.3 Inter,Arial,sans-serif;color:#586166;';
        s.textContent = text;
        meta.appendChild(s);
    };

    line(data.avgDaysToPay != null ? 'Days to pay: ~' + data.avgDaysToPay : 'Days to pay: N/A');
    if (data.recourseCreditLimit != null) {
        const alt = data.nonRecourseCreditLimit;
        line(
            'Credit limit: ' + fmtTriumphMoney(data.recourseCreditLimit) +
                (alt != null && alt !== data.recourseCreditLimit
                    ? ' / ' + fmtTriumphMoney(alt) + ' non-rec.'
                    : '')
        );
    }
    if (data.legalName) line(data.legalName);
    row.appendChild(meta);
    wrap.appendChild(row);

    if (status === 'NOBUY') {
        const w = document.createElement('div');
        w.style.cssText =
            'font:700 11px/1.35 Inter,Arial,sans-serif;color:#fff;background:#c81019;' +
            'border-radius:4px;padding:6px 8px;word-break:break-word;';
        w.textContent = '⚠ NO-BUY — Triumph will not purchase invoices for this broker';
        wrap.appendChild(w);
    }
    return wrap;
}

// Triumph's Truckstop control. Mirrors tsRtsRender, with its own slot/out pair
// and its own `triumphMc` tag so a recycled panel resets each provider on its
// own. Renders nothing at all until the user has connected Triumph, so the
// panel is unchanged for everyone who only uses RTS.
function tsTriumphRender(holder, info) {
    const slot = holder.__triumphSlot;
    const out = holder.__triumphOut;
    const panel = holder.__panel;
    if (!slot || !out) return;

    out.replaceChildren();
    slot.replaceChildren();
    holder.dataset.triumphMc = '';

    // The holder has a 6px gap, so empty rows are not free — collapse them
    // rather than leaving two gaps' worth of dead space under the RTS block.
    const showOut = (show) => {
        out.style.display = show ? '' : 'none';
    };
    showOut(false);

    if (!info || !info.enabled) {
        slot.style.display = 'none';
        return;
    }
    slot.style.display = '';

    if (info.valid) {
        const btn = tsRtsButton(TRIUMPH_ICON, 'Triumph Credit Check');
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const mc = tsRtsMc(panel);
            if (!mc) {
                out.replaceChildren(tsRtsNotice('No broker MC# on this load.'));
                showOut(true);
                return;
            }
            btn.disabled = true;
            btn.style.opacity = '.7';
            const span = btn.querySelector('span');
            const restore = () => {
                btn.disabled = false;
                btn.style.opacity = '1';
                if (span) span.textContent = 'Triumph Credit Check';
            };
            if (span) span.textContent = 'Checking…';

            const resp = await safeSendMessage({ type: 'triumph_check', mc });
            if (resp && resp.ok && resp.data) {
                out.replaceChildren(tsTriumphBadge(resp.data));
                showOut(true);
                holder.dataset.triumphMc = mc; // tag the broker this result is for
                restore();
                tbTrackEvent('TRIUMPH_CREDIT_CHECK');
                return;
            }
            const reason = resp && resp.reason;
            if (reason === 'expired' || reason === 'no_token') {
                tsTriumphRender(holder, {
                    token: reason === 'expired',
                    valid: false,
                    enabled: true
                });
                return;
            }
            out.replaceChildren(tsRtsNotice(
                reason === 'not_found' ? 'Broker not found in Triumph.'
                    : reason === 'no_mc' ? 'No MC# on this load.'
                    : 'Triumph check failed — try again.'
            ));
            showOut(true);
            restore();
        });
        slot.appendChild(btn);
        return;
    }

    const login = tsRtsButton(
        TRIUMPH_ICON,
        info.token ? 'Log in to Triumph again' : 'Login to Triumph',
        true
    );
    login.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeSendMessage({ type: 'triumph_open_login' });
    });
    slot.appendChild(login);
}

// Apex's Truckstop result card — same shell as the other two, Apex's fields.
function tsApexBadge(data) {
    const wrap = document.createElement('div');
    wrap.setAttribute(INJECT_ATTR, '1');
    wrap.style.cssText =
        'box-sizing:border-box;display:flex;flex-direction:column;gap:6px;background:#fff;' +
        'border:1px solid #e0e0e0;border-radius:4px;padding:8px 9px;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:9px;flex-wrap:wrap;';

    const pill = document.createElement('span');
    pill.style.cssText =
        'display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;' +
        'padding:5px 9px;border-radius:999px;font:800 11px/1 Inter,Arial,sans-serif;' +
        'text-transform:uppercase;letter-spacing:.4px;color:#fff;white-space:nowrap;background:' +
        (data.approved === true ? '#16a34a' : data.status ? '#c81019' : '#94a3b8') + ';';
    pill.textContent = data.status || 'Unknown';
    row.appendChild(pill);

    const meta = document.createElement('div');
    meta.style.cssText = 'display:flex;flex-direction:column;gap:2px;flex:1 1 130px;min-width:0;';
    const line = (text) => {
        const s = document.createElement('span');
        s.style.cssText = 'font:600 11px/1.3 Inter,Arial,sans-serif;color:#586166;';
        s.textContent = text;
        meta.appendChild(s);
    };
    if (data.creditLimit) line('Credit limit: ' + data.creditLimit);
    line('Remaining: ' + (data.remaining || 'N/A'));
    if (data.proofOfDelivery) line('POD: ' + data.proofOfDelivery);
    row.appendChild(meta);
    wrap.appendChild(row);

    if (data.hasAlert) {
        const w = document.createElement('div');
        w.style.cssText =
            'font:700 11px/1.35 Inter,Arial,sans-serif;color:#fff;background:#c81019;' +
            'border-radius:4px;padding:6px 8px;word-break:break-word;';
        w.textContent = '⚠ ' + data.alertText;
        wrap.appendChild(w);
    }
    return wrap;
}

// Apex's Truckstop control. Same slot/out pattern as Triumph, plus the
// tab-required state: with no portal tab open there is nothing to check
// against, so the button offers to open one instead of pretending it can.
function tsApexRender(holder, info) {
    const slot = holder.__apexSlot;
    const out = holder.__apexOut;
    const panel = holder.__panel;
    if (!slot || !out) return;

    out.replaceChildren();
    slot.replaceChildren();
    holder.dataset.apexMc = '';

    const showOut = (show) => {
        out.style.display = show ? '' : 'none';
    };
    showOut(false);

    if (!info || !info.enabled) {
        slot.style.display = 'none';
        return;
    }
    slot.style.display = '';

    if (!info.tabOpen) {
        const open = tsRtsButton(
            APEX_ICON,
            info.expired ? 'Log in to Apex again' : 'Open Apex tab',
            true
        );
        open.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            safeSendMessage({ type: 'apex_open_login' });
        });
        slot.appendChild(open);
        return;
    }

    const btn = tsRtsButton(APEX_ICON, 'Apex Credit Check');
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mc = tsRtsMc(panel);
        if (!mc) {
            out.replaceChildren(tsRtsNotice('No broker MC# on this load.'));
            showOut(true);
            return;
        }
        btn.disabled = true;
        btn.style.opacity = '.7';
        const span = btn.querySelector('span');
        const restore = () => {
            btn.disabled = false;
            btn.style.opacity = '1';
            if (span) span.textContent = 'Apex Credit Check';
        };
        if (span) span.textContent = 'Checking…';

        // Truckstop's panel carries no broker city/state, so Apex falls back to
        // the first branch record for a multi-branch MC# here.
        const resp = await safeSendMessage({ type: 'apex_check', mc, city: '', state: '' });
        if (resp && resp.ok && resp.data) {
            out.replaceChildren(tsApexBadge(resp.data));
            showOut(true);
            holder.dataset.apexMc = mc;
            restore();
            tbTrackEvent('APEX_CREDIT_CHECK');
            return;
        }
        const reason = resp && resp.reason;
        if (reason === 'no_tab' || reason === 'expired' || reason === 'no_token') {
            tsApexRender(holder, {
                enabled: reason !== 'no_token',
                tabOpen: false,
                expired: reason === 'expired'
            });
            return;
        }
        out.replaceChildren(tsRtsNotice(
            reason === 'not_found' ? 'Broker not set up with Apex.'
                : reason === 'no_mc' ? 'No MC# on this load.'
                : 'Apex check failed — try again.'
        ));
        showOut(true);
        restore();
    });
    slot.appendChild(btn);
}

// Renders the RTS action button (login / check) into rtsSlot and any result
// into `out` (a full-width row BELOW the FMCSA|RTS button row). holder.dataset.mc
// tags the broker a result belongs to (so a recycled panel resets correctly).
function tsRtsRender(holder, info) {
    const rtsSlot = holder.__rtsSlot;
    const out = holder.__out;
    const panel = holder.__panel;
    out.replaceChildren();
    rtsSlot.replaceChildren();
    holder.dataset.mc = '';

    // Same opt-in gate as DAT — an un-connected RTS shows nothing, and the
    // neutral prompt takes the space instead.
    if (!info || !info.enabled) {
        rtsSlot.style.display = 'none';
        out.style.display = 'none';
        return;
    }
    rtsSlot.style.display = '';
    out.style.display = '';

    if (info.valid) {
        const btn = tsRtsButton(RTS_ICON, 'RTS Credit Check');
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const mc = tsRtsMc(panel);
            if (!mc) {
                out.replaceChildren(tsRtsNotice('No broker MC# on this load.'));
                return;
            }
            btn.disabled = true;
            btn.style.opacity = '.7';
            const span = btn.querySelector('span');
            const restore = () => {
                btn.disabled = false;
                btn.style.opacity = '1';
                if (span) span.textContent = 'RTS Credit Check';
            };
            if (span) span.textContent = 'Checking…';

            const resp = await safeSendMessage({ type: 'rts_check', mc });
            if (resp && resp.ok && resp.data) {
                out.replaceChildren(tsRtsBadge(resp.data));
                holder.dataset.mc = mc; // tag the broker this result is for
                restore();
                tbTrackEvent('RTS_CREDIT_CHECK');
                return;
            }
            const reason = resp && resp.reason;
            if (reason === 'expired' || reason === 'no_token') {
                tsRtsRender(holder, { token: reason === 'expired', valid: false });
                return;
            }
            out.replaceChildren(tsRtsNotice(
                reason === 'not_found' ? 'Broker not set up with RTS.'
                    : reason === 'no_mc' ? 'No MC# on this load.'
                    : 'RTS check failed — try again.'
            ));
            restore();
        });
        rtsSlot.appendChild(btn);
        return;
    }

    const login = tsRtsButton(RTS_ICON, info && info.token ? 'Log in to RTS again' : 'Login to RTS', true);
    login.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeSendMessage({ type: 'rts_open_login' });
    });
    rtsSlot.appendChild(login);
}

function injectTruckstopRtsCheck() {
    try {
        const a = window.TB_ADAPTER;
        if (!a || a.id !== 'truckstop') return;
        if (!tbLoggedIn) return; // login-gated, like DAT

        const els = (typeof tbDeepQueryShadow === 'function')
            ? tbDeepQueryShadow('shared-credit-stop-details')
            : Array.from(document.querySelectorAll('shared-credit-stop-details'));

        els.forEach((creditEl) => {
            const panel = creditEl.closest('shared-broker-details') || creditEl.parentElement;
            if (!panel) return;

            const mcNow = tsRtsMc(panel) || '';
            const existing = panel.querySelector('.tb-ts-rts');
            if (existing) {
                // Panel recycled for a different broker → reset to the action
                // button. Each provider carries its own tag, so a stale Triumph
                // result can't survive on a panel whose RTS side already reset.
                if (existing.dataset.mc && existing.dataset.mc !== mcNow) {
                    rtsConnInfo((info) => tsRtsRender(existing, info));
                }
                if (existing.dataset.triumphMc && existing.dataset.triumphMc !== mcNow) {
                    triumphConnInfo((info) => tsTriumphRender(existing, info));
                }
                if (existing.dataset.apexMc && existing.dataset.apexMc !== mcNow) {
                    apexConnInfo((info) => tsApexRender(existing, info));
                }
                return;
            }

            const holder = document.createElement('div');
            holder.className = 'tb-ts-rts';
            holder.setAttribute(INJECT_ATTR, '1');
            holder.style.cssText = 'margin-top:8px;display:flex;flex-direction:column;gap:6px;';
            holder.__panel = panel;

            // Row 1: FMCSA report (left) + RTS action (right), equal width.
            const actions = document.createElement('div');
            actions.setAttribute(INJECT_ATTR, '1');
            actions.style.cssText = 'display:flex;gap:6px;';

            const fmcsaCell = document.createElement('div');
            fmcsaCell.style.cssText = 'flex:1 1 0;min-width:0;';
            const fmcsaBtn = tsRtsButton(TS_FMCSA_ICON, 'FMCSA Report');
            fmcsaBtn.setAttribute('title', "Open this broker's FMCSA SAFER report in a new tab");
            fmcsaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const mc = tsRtsMc(panel);
                if (!mc) { showToast('No broker MC# on this load', 'info'); return; }
                window.open(
                    'https://safer.fmcsa.dot.gov/query.asp?query_type=queryCarrierSnapshot' +
                    '&query_param=MC_MX&query_string=' + encodeURIComponent(mc),
                    '_blank', 'noopener'
                );
            });
            fmcsaCell.appendChild(fmcsaBtn);

            const rtsSlot = document.createElement('div');
            rtsSlot.style.cssText = 'flex:1 1 0;min-width:0;';

            actions.appendChild(fmcsaCell);
            actions.appendChild(rtsSlot);

            // Same neutral prompt as DAT, on its own row below the buttons so it
            // isn't squeezed into half a narrow panel.
            const ctaRow = buildFactoringPrompt();

            // Row 2: RTS result/notice spans the full width below the buttons.
            const out = document.createElement('div');
            out.setAttribute(INJECT_ATTR, '1');

            // Row 3: Triumph gets its own full-width button + result rows rather
            // than a third column — the Truckstop panel is too narrow for three,
            // and these rows stay empty unless Triumph is actually connected.
            const triumphSlot = document.createElement('div');
            triumphSlot.setAttribute(INJECT_ATTR, '1');
            const triumphOut = document.createElement('div');
            triumphOut.setAttribute(INJECT_ATTR, '1');
            const apexSlot = document.createElement('div');
            apexSlot.setAttribute(INJECT_ATTR, '1');
            const apexOut = document.createElement('div');
            apexOut.setAttribute(INJECT_ATTR, '1');

            holder.appendChild(actions);
            holder.appendChild(ctaRow);
            holder.appendChild(out);
            holder.appendChild(triumphSlot);
            holder.appendChild(triumphOut);
            holder.appendChild(apexSlot);
            holder.appendChild(apexOut);
            holder.__rtsSlot = rtsSlot;
            holder.__out = out;
            holder.__triumphSlot = triumphSlot;
            holder.__triumphOut = triumphOut;
            holder.__apexSlot = apexSlot;
            holder.__apexOut = apexOut;

            // Mount below the miles/RPM board when present, else below the
            // "Authority Requirement" row, else the CreditStop block.
            const anchor = panel.querySelector('.tb-ts-board')
                || panel.querySelector('[data-testid="authority-requirement"]')
                || creditEl.closest('a[data-testid="credit-stop-broker-info"]')
                || creditEl.closest('a') || creditEl;
            anchor.insertAdjacentElement('afterend', holder);

            rtsConnInfo((info) => tsRtsRender(holder, info));
            triumphConnInfo((info) => tsTriumphRender(holder, info));
            apexConnInfo((info) => tsApexRender(holder, info));
        });
    } catch { /* never disturb the page */ }
}

// Flip Truckstop RTS controls live when the token is captured/lost (mirrors the
// DAT .tb-rts-holder listener, but shadow-pierces and skips ones showing a result).
try {
    chrome.storage.onChanged.addListener((ch, area) => {
        if (area !== 'local') return;
        const touchesRts = !!(ch.rtsToken || ch.rtsEnabled || ch.rtsShow);
        const touchesTriumph = !!(ch.triumphToken || ch.triumphEnabled || ch.triumphShow);
        const touchesApex = !!(ch.apexEnabled || ch.apexShow);
        if (!touchesRts && !touchesTriumph && !touchesApex) return;

        const holders = (typeof tbDeepQueryShadow === 'function')
            ? tbDeepQueryShadow('.tb-ts-rts')
            : Array.from(document.querySelectorAll('.tb-ts-rts'));
        holders.forEach((h) => {
            // Each provider is gated on its OWN result tag: connecting Triumph
            // must not wipe an RTS result the user is still reading, or vice versa.
            if (touchesRts && !h.dataset.mc && h.__rtsSlot && h.__out) {
                rtsConnInfo((info) => tsRtsRender(h, info));
            }
            if (touchesTriumph && !h.dataset.triumphMc && h.__triumphSlot && h.__triumphOut) {
                triumphConnInfo((info) => tsTriumphRender(h, info));
            }
            if (touchesApex && !h.dataset.apexMc && h.__apexSlot && h.__apexOut) {
                apexConnInfo((info) => tsApexRender(h, info));
            }
        });
    });
} catch {}

function injectLaneAnalyticsInDetails() {
    if (!TB_LANE_ANALYTICS_ENABLED) return; // dormant until enough prod data has accumulated
    // Logged out → don't show lane analytics at all. The route locked teaser is
    // the single "Log in to unlock" CTA, so there aren't multiple login buttons.
    if (!tbLoggedIn) return;
    try {
        ensureLaneAnalyticsStyle();
        const a = window.TB_ADAPTER;
        if (!a || typeof a.parseLoad !== 'function') return;

        const panelSel = window.DETAILS_PANEL_SEL;
        if (!panelSel) return; // adapter does not define a detail panel -> nothing to do here

        document.querySelectorAll(panelSel).forEach((detailsEl) => {
            if (!(detailsEl instanceof Element)) return;
            if (detailsEl.querySelector('.tb-lane-col')) return; // already injected

            const row = findRowFromDetails(detailsEl) || detailsEl.closest(ROW_SEL);
            if (!row) return;
            let item = null;
            try { item = a.parseLoad(row); } catch { item = null; }
            if (!item || !item.origin || !item.destination) return;

            // Sit right after the route/map column when present, else append into
            // the first details column so we stay inside the open panel.
            // Prefer sitting inside the TruckBox route column, right above the map graphic, so all
            // TruckBox content is one block (and DAT's own Rate column keeps its width). Fall back
            // to a standalone column if the map column isn't present.
            const mapCol = detailsEl.querySelector('.tb-map-col');
            const miniMap = mapCol ? mapCol.querySelector('.tb-mini-map') : null;
            const host =
                mapCol || detailsEl.querySelector(window.DETAILS_COLUMN_SEL || '.details-column');
            if (!host) return;

            const inMap = !!mapCol;
            const col = document.createElement('div');
            col.className = 'tb-lane-col' + (inMap ? ' tb-lane-col--inmap' : '');
            col.setAttribute(INJECT_ATTR, '1');

            const header = document.createElement('div');
            header.className = 'tb-lane-header';
            // The route column already says "Powered by TruckBox" — don't repeat it there.
            header.textContent = (inMap ? 'Lane analytics' : 'Lane analytics · TruckBox') + ' ';
            const info = document.createElement('span');
            info.className = 'tb-lane-info';
            info.textContent = 'i';
            const tip = document.createElement('span');
            tip.className = 'tb-lane-tip';
            tip.textContent = TB_LANE_INFO_TEXT;
            info.appendChild(tip);
            header.appendChild(info);
            col.appendChild(header);

            if (!tbLoggedIn) {
                col.appendChild(buildLaneLocked());
            } else {
                renderLaneGate(col, item);
            }

            if (inMap && miniMap) miniMap.insertAdjacentElement('beforebegin', col);
            else host.appendChild(col);
        });
    } catch { /* never disturb the page */ }
}

function buildLaneLocked() {
    const wrap = document.createElement('div');
    wrap.className = 'tb-lane-locked';
    wrap.setAttribute(INJECT_ATTR, '1');
    wrap.innerHTML =
        'Log in to see how often this broker posts this lane and its price trend.' +
        '<br><button type="button" class="tb-lane-login">Log in to unlock</button>';
    const btn = wrap.querySelector('.tb-lane-login');
    if (btn) {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.disabled = true;
            btn.textContent = 'Logging in…';
            try {
                const res = await loginWithStoredProvider();
                if (!res || res.ok === false) {
                    btn.disabled = false;
                    btn.textContent = 'Log in to unlock';
                }
            } catch {
                btn.disabled = false;
                btn.textContent = 'Log in to unlock';
            }
        });
    }
    return wrap;
}

// Daily-limit gate: analytics is shown only after the user clicks, and each distinct lane
// per Chicago day counts against a per-user quota (backend-enforced). Repeats are free.
function renderLaneGate(col, item) {
    const gate = document.createElement('button');
    gate.type = 'button';
    gate.className = 'tb-lane-badge tb-lane-gate';
    gate.setAttribute(INJECT_ATTR, '1');
    // Count lives inline in the button label so the user knows it means lanes opened today,
    // e.g. "Show load/rate analytics · 3/20 lanes opened today · demo feature".
    const label = (used, limit) =>
        TB_LANE_IC.chart + 'Show load/rate analytics · ' + used + '/' + limit
        + ' lanes opened today · demo feature' + TB_LANE_CARET;
    gate.innerHTML = TB_LANE_IC.chart + 'Show load/rate analytics' + TB_LANE_CARET;
    col.appendChild(gate);

    const setLimitReached = (used, limit) => {
        gate.disabled = true;
        gate.className = 'tb-lane-badge tb-lane-badge--empty';
        gate.innerHTML = 'Daily limit reached (' + used + '/' + limit + ') — resets at midnight (CT)';
    };

    // Forward-compat: a limit that isn't a positive number (≤0, null, missing) means "no cap".
    // Old installs can then handle a future unlimited tier without needing an extension update —
    // they just show ∞ and never block.
    const unlimited = (lim) => !(Number(lim) > 0);

    // Show current usage on open (read-only).
    safeSendMessage({ type: 'lane_view_quota' })
        .then((r) => {
            if (r && r.ok && r.data) {
                if (unlimited(r.data.limit)) gate.innerHTML = label(r.data.used, '∞');
                else if (r.data.used >= r.data.limit) setLimitReached(r.data.used, r.data.limit);
                else gate.innerHTML = label(r.data.used, r.data.limit);
            }
        })
        .catch(() => {});

    gate.addEventListener('click', async () => {
        if (gate.disabled) return;
        gate.disabled = true;
        gate.innerHTML = TB_LANE_IC.spin + 'Loading…';
        let r = null;
        try {
            r = await safeSendMessage({
                type: 'lane_view_record',
                origin: item.origin,
                destination: item.destination,
                equipment: item.equipment
            });
        } catch { r = null; }

        if (r && r.ok && r.data && r.data.allowed === false) {
            setLimitReached(r.data.used, r.data.limit);
            return;
        }
        // allowed, or fail-open on RPC/backend error → reveal analytics
        gate.remove();
        renderLaneAnalytics(col, item);
    });
}

function renderLaneAnalytics(col, item) {
    // Two signals → two buttons over one shared chart area; only one chart open at a time.
    const row = document.createElement('div');
    row.className = 'tb-lane-btnrow';
    row.setAttribute(INJECT_ATTR, '1');

    const oppBtn = document.createElement('button');   // recurrence → 30d/7d lane chart
    oppBtn.type = 'button';
    oppBtn.className = 'tb-lane-badge tb-lane-badge--loading';
    oppBtn.innerHTML = TB_LANE_IC.spin + 'Checking this lane…';

    const todayBtn = document.createElement('button'); // today intensity → intraday chart
    todayBtn.type = 'button';
    todayBtn.className = 'tb-lane-badge tb-lane-badge--cool';
    todayBtn.style.display = 'none';                    // revealed once frequency loads
    todayBtn.innerHTML = TB_LANE_IC.clock + 'Today’s price' + TB_LANE_CARET;

    row.appendChild(oppBtn);
    row.appendChild(todayBtn);
    col.appendChild(row);

    const chart = document.createElement('div');
    chart.className = 'tb-lane-chart';
    chart.style.display = 'none';
    chart.setAttribute(INJECT_ATTR, '1');
    col.appendChild(chart);

    let mode = null; // null | 'lane' | 'today'
    const closeChart = () => {
        chart.style.display = 'none';
        mode = null;
        oppBtn.classList.remove('tb-lane-badge--open');
        todayBtn.classList.remove('tb-lane-badge--open');
    };
    const openChart = (which, btn, render, trackType) => {
        if (mode === which) { closeChart(); return; } // same button → toggle closed
        mode = which;
        chart.style.display = 'block';
        oppBtn.classList.toggle('tb-lane-badge--open', btn === oppBtn);
        todayBtn.classList.toggle('tb-lane-badge--open', btn === todayBtn);
        render(chart, item);
        tbTrackEvent(trackType); // record that the user viewed this chart
    };

    oppBtn.addEventListener('click', () => {
        if (oppBtn.classList.contains('tb-lane-badge--loading')) return;
        openChart('lane', oppBtn, loadLanePrice, 'LANE_ANALYTICS');
    });
    todayBtn.addEventListener('click', () => {
        if (todayBtn.classList.contains('tb-lane-badge--loading')) return;
        openChart('today', todayBtn, renderIntradayInto, 'TODAY_PRICE_ANALYTICS');
    });

    loadLaneFreq(oppBtn, todayBtn, item);
}

function loadLaneFreq(oppBtn, todayBtn, item) {
    const key = tbLaneKey(item) + '|' + tbBrokerKey(item);
    if (tbLaneFreqCache.has(key)) {
        paintLaneButtons(oppBtn, todayBtn, tbLaneFreqCache.get(key));
        return;
    }
    setTimeout(async () => {
        if (!document.contains(oppBtn)) return; // user collapsed before debounce fired
        if (tbLaneFreqCache.has(key)) {
            paintLaneButtons(oppBtn, todayBtn, tbLaneFreqCache.get(key));
            return;
        }
        const resp = await safeSendMessage({
            type: 'lane_posting_frequency',
            payload: {
                origin: item.origin,
                destination: item.destination,
                equipment: item.equipment,
                lengthFt: item.lengthFt,
                mcNumber: item.mcNumber || null,
                brokerName: item.brokerName || item.brokerNameRaw || null,
                platform: tbActivePlatform()
            }
        });
        if (!resp || resp.ok === false || !resp.data) {
            if (document.contains(oppBtn)) {
                oppBtn.className = 'tb-lane-badge tb-lane-badge--empty';
                oppBtn.innerHTML = TB_LANE_IC.dash + 'Lane stats unavailable';
                todayBtn.style.display = 'none';
            }
            return;
        }
        tbLaneFreqCache.set(key, resp.data);
        if (document.contains(oppBtn)) paintLaneButtons(oppBtn, todayBtn, resp.data);
    }, TB_LANE_FETCH_DEBOUNCE_MS);
}

// Number of times this broker posted the lane TODAY (Chicago day), from the per-day breakdown.
// Counts all postings (priced or not) — the intraday chart only plots the priced ones.
function tbTodayCount(freqData) {
    if (!freqData) return 0;
    const chicagoToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    let n = 0;
    (freqData.points || []).forEach((p) => { if (p && p.date === chicagoToday) n = p.count || 0; });
    return n;
}

// Opportunity = recurrence across distinct days (repost-proof). Hot = reposted a lot TODAY.
function paintLaneButtons(oppBtn, todayBtn, data) {
    const dayWord = (n) => (n === 1 ? 'day' : 'days');
    const week = data.activeDaysThisWeek != null ? data.activeDaysThisWeek : 0;
    const month = data.activeDaysThisMonth != null ? data.activeDaysThisMonth : 0;
    const opportunity = week > TB_LANE_OPP_WEEK || month > TB_LANE_OPP_MONTH;

    // --- Button 1 (top): is this a recurring / potential contract lane? Opens 30d/7d price history ---
    if (month === 0) {
        oppBtn.className = 'tb-lane-badge tb-lane-badge--cool';
        oppBtn.innerHTML =
            TB_LANE_IC.chart + 'No repeat postings in 30 days' + TB_LANE_CARET;
    } else if (opportunity) {
        oppBtn.className = 'tb-lane-badge tb-lane-badge--opp';
        oppBtn.innerHTML =
            TB_LANE_IC.opp + '<span><b>Potential lane</b> · this broker runs it <b>' + week +
            '</b> ' + dayWord(week) + '/wk · <b>' + month + '</b> ' + dayWord(month) + '/mo</span>' +
            TB_LANE_CARET;
    } else {
        oppBtn.className = 'tb-lane-badge tb-lane-badge--cool';
        oppBtn.innerHTML =
            TB_LANE_IC.chart + '<span>Lane price history · posted <b>' + week + '</b> ' +
            dayWord(week) + '/wk · <b>' + month + '</b> ' + dayWord(month) + '/mo</span>' +
            TB_LANE_CARET;
    }
    oppBtn.title = opportunity
        ? 'Potential contract lane — this broker runs it on many separate days. Tap to see the 30-day price trend.'
        : 'Distinct days this broker posted this lane (same-day reposts count once). Tap to see the 30-day price trend.';

    // --- Button 2 (bottom): today's price AND how many times the broker reposted today. Opens intraday chart ---
    const today = tbTodayCount(data);
    todayBtn.style.display = '';
    if (today === 0) {
        todayBtn.className = 'tb-lane-badge tb-lane-badge--cool';
        todayBtn.innerHTML =
            TB_LANE_IC.clock + 'Today’s price' + TB_LANE_CARET;
    } else if (today > TB_LANE_HOT_TODAY) {
        todayBtn.className = 'tb-lane-badge tb-lane-badge--hot';
        todayBtn.innerHTML =
            TB_LANE_IC.flame + '<span><b>Today’s price</b> · hot — reposted <b>' + today +
            '×</b> today</span>' + TB_LANE_CARET;
    } else {
        todayBtn.className = 'tb-lane-badge tb-lane-badge--cool';
        todayBtn.innerHTML =
            TB_LANE_IC.clock + '<span><b>Today’s price</b> · posted <b>' + today +
            '×</b> today</span>' + TB_LANE_CARET;
    }
    todayBtn.title =
        'Today’s price for this lane and how many times this broker reposted it today (more reposts = harder to cover = leverage to negotiate). Tap to see today’s chart.';
}

async function loadLanePrice(wrap, item) {
    wrap.innerHTML = '<div class="tb-lane-loading">Loading price trend…</div>';
    const key = tbLaneKey(item);
    let data = tbLanePriceCache.get(key);
    if (!data) {
        const now = new Date();
        const from = new Date(now.getTime() - TB_LANE_PRICE_DAYS * 86400000);
        const fmt = (d) => d.toISOString().slice(0, 10);
        const resp = await safeSendMessage({
            type: 'lane_price_history',
            payload: {
                origin: item.origin,
                destination: item.destination,
                equipment: item.equipment,
                lengthFt: item.lengthFt,
                from: fmt(from),
                to: fmt(now),
                platform: tbActivePlatform()
            }
        });
        if (!resp || resp.ok === false || !resp.data) {
            wrap.innerHTML = '<div class="tb-lane-empty">No price analytics yet</div>';
            return;
        }
        data = resp.data;
        tbLanePriceCache.set(key, data);
    }
    if (document.contains(wrap)) renderPriceChart(wrap, data);
}

function renderPriceChart(wrap, data) {
    const all = (data.points || []).filter((p) => p && p.avg != null);
    if (!all.length) {
        wrap.innerHTML = '<div class="tb-lane-empty">No price analytics yet</div>';
        return;
    }
    wrap.innerHTML = '';

    const toggle = document.createElement('div');
    toggle.className = 'tb-lane-toggle';
    const svgHost = document.createElement('div');
    svgHost.className = 'tb-lane-svg';
    const meta = document.createElement('div');
    meta.className = 'tb-lane-meta';

    // Lane history (cross-broker, daily) for the 30d / 7d modes.
    const drawLane = (days) => {
        const cutoff = days ? Date.now() - days * 86400000 : 0;
        let pts = days ? all.filter((p) => new Date(p.date).getTime() >= cutoff) : all;
        if (!pts.length) pts = all;
        svgHost.innerHTML = buildLineSvg(pts);
        tbAttachChartTooltip(svgHost);
        const last = pts[pts.length - 1];
        meta.textContent =
            'Lane · all brokers · latest $' + (last.last != null ? last.last : last.avg) +
            ' · ' + pts.length + (pts.length === 1 ? ' day' : ' days') + ' with prices';
    };

    [['30d', 30], ['7d', 7]].forEach(([label, days], i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        if (i === 0) b.classList.add('active');
        b.addEventListener('click', () => {
            toggle.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
            b.classList.add('active');
            drawLane(days);
        });
        toggle.appendChild(b);
    });

    wrap.appendChild(toggle);
    wrap.appendChild(svgHost);
    wrap.appendChild(meta);
    drawLane(30);
}

// Hot-lane button target — lazy-fetch & render this broker's intraday price points for today into
// the shared chart container.
async function renderIntradayInto(wrap, item) {
    wrap.innerHTML = '<div class="tb-lane-loading">Loading today…</div>';
    const key = tbLaneKey(item) + '|' + tbBrokerKey(item);
    let data = tbLaneIntradayCache.get(key);
    if (!data) {
        const resp = await safeSendMessage({
            type: 'lane_intraday_price',
            payload: {
                origin: item.origin,
                destination: item.destination,
                equipment: item.equipment,
                lengthFt: item.lengthFt,
                mcNumber: item.mcNumber || null,
                brokerName: item.brokerName || item.brokerNameRaw || null,
                platform: tbActivePlatform()
            }
        });
        if (!document.contains(wrap)) return; // user switched/closed mid-fetch
        if (!resp || resp.ok === false || !resp.data) {
            wrap.innerHTML = '<div class="tb-lane-empty">Intraday data unavailable</div>';
            return;
        }
        data = resp.data;
        tbLaneIntradayCache.set(key, data);
    }
    if (!document.contains(wrap)) return;

    const all = (data.points || []).filter((p) => p && p.time);
    const priced = all.filter((p) => p.price != null);

    if (!all.length) {
        wrap.innerHTML = '<div class="tb-lane-empty">This broker · no postings today</div>';
        return;
    }

    wrap.innerHTML = '';
    const svgHost = document.createElement('div');
    svgHost.className = 'tb-lane-svg';
    const meta = document.createElement('div');
    meta.className = 'tb-lane-meta tb-lane-meta--today';

    // First posting time today + total postings (matches the "reposted N× today" badge).
    const firstTime = tbTimeShort(all[0].time);
    const posts = all.length;
    const repPrefix = posts === 1
        ? 'Posted <b>' + firstTime + '</b>'
        : 'First posted <b>' + firstTime + '</b> · reposted <b>' + posts + '×</b>';

    if (priced.length) {
        // Real price movement today: first → current price, coloured arrow.
        svgHost.innerHTML = buildIntradaySvg(priced);
        tbAttachChartTooltip(svgHost);
        const move = priced.length === 1
            ? '<b>$' + priced[0].price + '</b>'
            : tbPriceMove(priced[0].price, priced[priced.length - 1].price);
        meta.innerHTML = repPrefix + ' · ' + move;
    } else {
        // No price posted today ("call for rate") — show WHEN it was (re)posted instead.
        svgHost.innerHTML = buildPostingTimesSvg(all);
        tbAttachChartTooltip(svgHost);
        meta.innerHTML = repPrefix + ' · no price posted (call for rate)';
    }

    wrap.appendChild(svgHost);
    wrap.appendChild(meta);
}

// Price-change fragment with a bold coloured arrow: green ↑ when up, red ↓ when down; "held $X" flat.
function tbPriceMove(firstP, lastP) {
    if (firstP === lastP) return 'held <b>$' + firstP + '</b>';
    const up = lastP > firstP;
    return '<b>$' + firstP + '</b> <b style="color:' + (up ? '#157347' : '#c0392b') + '">' +
        (up ? '↑' : '↓') + '</b> <b>$' + lastP + '</b>';
}

// Instant styled tooltip with point details on hover (the native <title> has a ~1s delay). Reads
// each hit circle's data-tip and positions a box just above the point.
function tbAttachChartTooltip(host) {
    const tip = document.createElement('div');
    tip.className = 'tb-chart-tip';
    tip.style.display = 'none';
    host.appendChild(tip);
    host.querySelectorAll('circle[data-tip]').forEach((c) => {
        c.addEventListener('mouseenter', () => {
            tip.textContent = c.getAttribute('data-tip');
            const hr = host.getBoundingClientRect();
            const cr = c.getBoundingClientRect();
            tip.style.left = (cr.left + cr.width / 2 - hr.left) + 'px';
            tip.style.top = (cr.top - hr.top) + 'px';
            tip.style.display = 'block';
        });
        c.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    });
}

const TB_MON =
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parse "YYYY-MM-DD" without timezone surprises.
function tbDateShort(d) {
    const p = String(d).split('-');
    return +p[1] + '/' + +p[2];
}
function tbDateLong(d) {
    const p = String(d).split('-');
    return TB_MON[+p[1] - 1] + ' ' + +p[2];
}

// Light-blue translucent area gradient used under the price line (fades to transparent at the
// bottom). Shared id is fine — every chart defines the same gradient.
const TB_LANE_AREA_DEFS =
    '<defs><linearGradient id="tbLaneArea" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#4aa3ff" stop-opacity="0.30"/>' +
    '<stop offset="1" stop-color="#4aa3ff" stop-opacity="0"/></linearGradient></defs>';

// Smooth (Catmull-Rom → cubic Bézier) path through [[x,y],...] points, for a flowing line instead
// of sharp polyline corners. Returns an SVG path 'd' string.
function tbSmoothPath(pts) {
    const n = pts.length;
    if (n < 2) return n === 1 ? 'M' + pts[0][0] + ',' + pts[0][1] : '';
    let d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
    for (let i = 0; i < n - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c1y = p1[1] + (p2[1] - p0[1]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        const c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' +
            c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' +
            p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
}

// Inline SVG line of daily avg price with light-blue area fill, $-axis + date-axis labels (an
// "invisible grid"), and a native date+price tooltip on each point. No deps.
function buildLineSvg(points) {
    const W = 520, H = 150, padL = 42, padR = 12, padT = 12, padB = 22;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const n = points.length;

    const avgs = points.map((p) => p.avg);
    const lows = points.map((p) => (p.min != null ? p.min : p.avg));
    const highs = points.map((p) => (p.max != null ? p.max : p.avg));
    let lo = Math.min.apply(null, lows);
    let hi = Math.max.apply(null, highs);
    if (lo === hi) { lo -= 50; hi += 50; }

    const sx = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const sy = (v) => padT + (1 - (v - lo) / (hi - lo)) * plotH;

    // Y axis: 3 faint gridlines + price labels.
    let grid = '';
    [hi, (hi + lo) / 2, lo].forEach((v) => {
        const y = sy(v);
        grid +=
            '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y +
            '" stroke="#000" opacity="0.06"/>' +
            '<text x="' + (padL - 5) + '" y="' + (y + 3) + '" text-anchor="end" font-size="11" ' +
            'fill="#9aa3ad">$' + Math.round(v) + '</text>';
    });

    // X axis: date labels (ends, plus a middle one when there's room).
    const idxs =
        n === 1 ? [0] : n <= 3 ? points.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
    let xlabels = '';
    idxs.forEach((i) => {
        xlabels +=
            '<text x="' + sx(i) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="11" ' +
            'fill="#9aa3ad">' + tbDateShort(points[i].date) + '</text>';
    });

    let area = '';
    let line = '';
    if (n > 1) {
        const d = tbSmoothPath(points.map((_, i) => [sx(i), sy(avgs[i])]));
        const baseY = padT + plotH;
        area = '<path d="' + d + ' L' + sx(n - 1).toFixed(1) + ',' + baseY +
            ' L' + sx(0).toFixed(1) + ',' + baseY + ' Z" fill="url(#tbLaneArea)"/>';
        line = '<path d="' + d +
            '" fill="none" stroke="#2f7ed8" stroke-width="2" stroke-linejoin="round" ' +
            'stroke-linecap="round"/>';
    }

    // Points: a visible dot + a larger transparent hit circle carrying a detailed native tooltip
    // (date · avg price · min–max range · number of postings that day).
    let dots = '';
    points.forEach((p, i) => {
        const x = sx(i), y = sy(avgs[i]), last = i === n - 1;
        let detail = tbDateLong(p.date) + ' · avg $' + p.avg;
        if (p.min != null && p.max != null && p.min !== p.max) {
            detail += ' · $' + p.min + '–$' + p.max;
        }
        if (p.count != null) detail += ' · ' + p.count + (p.count === 1 ? ' post' : ' posts');
        dots +=
            '<circle cx="' + x + '" cy="' + y + '" r="' + (last ? 4 : 3) + '" fill="' +
            (last ? '#1aa358' : '#2f7ed8') + '"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="9" fill="#000" fill-opacity="0" ' +
            'pointer-events="all" data-tip="' + detail + '"></circle>';
    });

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" ' +
        'role="img" aria-label="Lane price trend">' +
        TB_LANE_AREA_DEFS + grid + area + line + dots + xlabels + '</svg>';
}

// "HH:MM" in local time from an ISO timestamp.
function tbTimeShort(t) {
    const d = new Date(t);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
}

// Feature 1 — inline SVG of one broker's intraday offer-price points (today). X = time-of-day
// (mapped by real timestamp), Y = price, single line + dots, no min/max band. Same axis styling
// as buildLineSvg. Each point carries a native "HH:MM · $price" tooltip.
function buildIntradaySvg(points) {
    const W = 520, H = 150, padL = 42, padR = 12, padT = 12, padB = 22;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const n = points.length;

    const ts = points.map((p) => new Date(p.time).getTime());
    const prices = points.map((p) => p.price);
    let lo = Math.min.apply(null, prices);
    let hi = Math.max.apply(null, prices);
    if (lo === hi) { lo -= 50; hi += 50; }
    let tMin = Math.min.apply(null, ts);
    let tMax = Math.max.apply(null, ts);
    if (tMin === tMax) { tMin -= 1; tMax += 1; }

    const sx = (i) => padL + (n === 1 ? plotW / 2 : ((ts[i] - tMin) / (tMax - tMin)) * plotW);
    const sy = (v) => padT + (1 - (v - lo) / (hi - lo)) * plotH;

    let grid = '';
    [hi, (hi + lo) / 2, lo].forEach((v) => {
        const y = sy(v);
        grid +=
            '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y +
            '" stroke="#000" opacity="0.06"/>' +
            '<text x="' + (padL - 5) + '" y="' + (y + 3) + '" text-anchor="end" font-size="11" ' +
            'fill="#9aa3ad">$' + Math.round(v) + '</text>';
    });

    const idxs =
        n === 1 ? [0] : n <= 3 ? points.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
    let xlabels = '';
    idxs.forEach((i) => {
        xlabels +=
            '<text x="' + sx(i) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="11" ' +
            'fill="#9aa3ad">' + tbTimeShort(points[i].time) + '</text>';
    });

    let area = '';
    let line = '';
    if (n > 1) {
        const d = tbSmoothPath(points.map((_, i) => [sx(i), sy(prices[i])]));
        const baseY = padT + plotH;
        area = '<path d="' + d + ' L' + sx(n - 1).toFixed(1) + ',' + baseY +
            ' L' + sx(0).toFixed(1) + ',' + baseY + ' Z" fill="url(#tbLaneArea)"/>';
        line = '<path d="' + d +
            '" fill="none" stroke="#2f7ed8" stroke-width="2" stroke-linejoin="round" ' +
            'stroke-linecap="round"/>';
    }

    let dots = '';
    points.forEach((p, i) => {
        const x = sx(i), y = sy(prices[i]), last = i === n - 1;
        dots +=
            '<circle cx="' + x + '" cy="' + y + '" r="' + (last ? 4 : 3) + '" fill="' +
            (last ? '#1aa358' : '#2f7ed8') + '"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="9" fill="#000" fill-opacity="0" ' +
            'pointer-events="all" data-tip="Posted ' + tbTimeShort(p.time) + ' · $' + p.price +
            (p.rpm != null ? ' · $' + p.rpm + '/mi' : '') + '"></circle>';
    });

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" ' +
        'role="img" aria-label="Intraday price (this broker, today)">' +
        TB_LANE_AREA_DEFS + grid + area + line + dots + xlabels + '</svg>';
}

// Feature 1 (no-price case) — a timeline of WHEN this broker (re)posted the load today, with no
// price axis (the postings carried no rate). Markers sit on a baseline at their time-of-day; each
// carries a "Posted HH:MM" tooltip.
function buildPostingTimesSvg(points) {
    const W = 520, H = 96, padL = 12, padR = 12, padT = 16, padB = 22;
    const plotW = W - padL - padR;
    const n = points.length;

    const ts = points.map((p) => new Date(p.time).getTime());
    let tMin = Math.min.apply(null, ts);
    let tMax = Math.max.apply(null, ts);
    if (tMin === tMax) { tMin -= 1; tMax += 1; }
    const sx = (i) => padL + (n === 1 ? plotW / 2 : ((ts[i] - tMin) / (tMax - tMin)) * plotW);
    const yMid = padT + (H - padT - padB) / 2;

    const note =
        '<text x="' + padL + '" y="11" font-size="11" fill="#9aa3ad">' +
        'Posting times today (no price posted)</text>';
    const base =
        '<line x1="' + padL + '" y1="' + yMid + '" x2="' + (W - padR) + '" y2="' + yMid +
        '" stroke="#000" opacity="0.10"/>';

    const idxs =
        n === 1 ? [0] : n <= 3 ? points.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
    let xlabels = '';
    idxs.forEach((i) => {
        xlabels +=
            '<text x="' + sx(i) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="11" ' +
            'fill="#9aa3ad">' + tbTimeShort(points[i].time) + '</text>';
    });

    let dots = '';
    points.forEach((p, i) => {
        const x = sx(i), last = i === n - 1;
        dots +=
            '<circle cx="' + x + '" cy="' + yMid + '" r="' + (last ? 4 : 3) + '" fill="' +
            (last ? '#e8730c' : '#8a929c') + '"/>' +
            '<circle cx="' + x + '" cy="' + yMid + '" r="9" fill="#000" fill-opacity="0" ' +
            'pointer-events="all" data-tip="Posted ' + tbTimeShort(p.time) +
            ' · no price (call for rate)"></circle>';
    });

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" ' +
        'role="img" aria-label="Posting times today">' + note + base + dots + xlabels + '</svg>';
}

