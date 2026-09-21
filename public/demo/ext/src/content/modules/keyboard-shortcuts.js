/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
function removeStaleInjectedNodes() {
    document.querySelectorAll('.datx-cs-actions, .datx-inline-group, .datx-send, .datx-tpl-more, .datx-tpl-menu, .datx-map-float-outside, .datx-toast, .datx-copy-phone')
        .forEach((n) => n.remove());

    document.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src') || '';
        if (src.startsWith('chrome-extension://invalid/')) {
            img.remove();
        }
    });
}

function processCompanyCell(cell, row) {
    const found = findEmailAnchorInContainer(cell);
    if (found?.email) {
        injectButton(found.anchor || cell, row, found.email);
        return true;
    }

    const fallback = findEmailForRow(row);
    if (fallback?.email) {
        injectButton(fallback.anchor || cell || row, row, fallback.email);
        return true;
    }

    return false;
}

// =========================
// Trip selector + map injection
// =========================
var TRIP_CELL_SEL_RESOLVED = null;

function getTripCellSelector() {
    if (TRIP_CELL_SEL_RESOLVED) return TRIP_CELL_SEL_RESOLVED;

    const headers = Array.from(document.querySelectorAll('th, .mat-header-cell, [role="columnheader"]'));
    const tripHeader = headers.find(h => (h.textContent || '').trim().toLowerCase() === 'trip');

    if (tripHeader) {
        const cls = Array.from(tripHeader.classList).find(c => c.startsWith('mat-column-'));
        if (cls) {
            TRIP_CELL_SEL_RESOLVED = '.' + cls.replace(/\s+/g, '.').trim();
            return TRIP_CELL_SEL_RESOLVED;
        }
        const idx = tripHeader.getAttribute('aria-colindex');
        if (idx) {
            TRIP_CELL_SEL_RESOLVED = `td[aria-colindex="${idx}"], [role="gridcell"][aria-colindex="${idx}"]`;
            return TRIP_CELL_SEL_RESOLVED;
        }
    }

    TRIP_CELL_SEL_RESOLVED = [
        '[data-test="load-trip-cell"]',
        'td.mat-cell.mat-column-trip',
        'td.mat-cell.mat-column-trip-length',
        '.mat-column-trip-length',
        '.mat-column-trip',
        '[class*=" mat-column-trip"]',
        '[class*="trip-length"]',
        '[data-col*="trip"]'
    ].join(',');
    return TRIP_CELL_SEL_RESOLVED;
}

function injectTripMapIcon(row, ctx) {
    const tripCellSel = getTripCellSelector();
    const tripCell = row.querySelector(tripCellSel) || row.querySelector(LENGTH_CELL_SEL);
    if (!tripCell) return;
    if (tripCell.querySelector('.datx-map-float-outside')) return;

    tripCell.classList.add('datx-trip-outside');

    const wrap = document.createElement('div');
    wrap.className = 'datx-map-float-outside';
    wrap.setAttribute(INJECT_ATTR, '1');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'datx-map-btn';
    btn.title = 'Open route in Google Maps';
    btn.setAttribute(INJECT_ATTR, '1');
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 22s7-7.29 7-12a7 7 0 1 0-14 0c0 4.71 7 12 7 12Z"
    stroke="#10b981" stroke-width="2" fill="#ffffff"/>
  <circle cx="12" cy="10" r="4" fill="#10b981"/>
</svg>`;

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const resp = await safeSendMessage({type: 'datx_map_click', platform: typeof tbActivePlatform === 'function' ? tbActivePlatform() : 'DAT'});

        if (resp?.needLogin) {
            showLoginBanner();
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

        const url = buildMapsLink(ctx.start, ctx.waypoint, ctx.dest);
        window.open(url, '_blank', 'noopener');
    });

    wrap.appendChild(btn);
    tripCell.appendChild(wrap);
}

// =========================
// Trip miles filter
// =========================
function getTripMiles(row) {
    const sel = getTripCellSelector();
    const cell = row.querySelector(sel) || row.querySelector(LENGTH_CELL_SEL);
    if (!cell) return null;
    const t = (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim();
    const m = t.match(/(\d{1,4}(?:,\d{3})*)(?:\s*(?:mi|miles))?\b/i);
    if (!m) return null;
    const num = parseInt(m[1].replace(/,/g, ''), 10);
    return Number.isFinite(num) ? num : null;
}

var __tripFilter = {enabled: false, min: 0};
var __dupFilter = {enabled: true}; // default ON

function rowPassesTripFilter(row) {
    if (!__tripFilter.enabled) return true;
    const miles = getTripMiles(row);
    if (miles == null) return false;
    return miles >= __tripFilter.min;
}

function applyFilterToRow(row) {
    row.classList.toggle('datx-hidden', !rowPassesTripFilter(row));
}

// Identity key for a load row, built from its parsed fields. Two rows with the
// same origin/destination/pickup/rate/broker/equipment are treated as the same
// load. Returns null when we can't identify it (never flagged as a dup).
function loadDupKey(row) {
    let c;
    try {
        c = buildContext(row, '');
    } catch {
        return null;
    }
    if (!c || !c.origin || !c.destination) return null;
    return [c.origin, c.destination, c.pickupDate, c.rate, c.brokerName, c.equipment, c.length]
        .map((x) => (x || '').toString().trim().toLowerCase())
        .join('|');
}

// Greys out duplicate loads, keeping the first occurrence visible.
function applyDupFilter(rows) {
    rows = rows || document.querySelectorAll(ROW_SEL);
    const seen = new Set();
    rows.forEach((row) => {
        let isDup = false;
        if (__dupFilter.enabled) {
            const key = loadDupKey(row);
            if (key) {
                if (seen.has(key)) isDup = true;
                else seen.add(key);
            }
        }
        row.classList.toggle('datx-dup', isDup);
    });
}

function applyFilterToAll() {
    const rows = document.querySelectorAll(ROW_SEL);
    rows.forEach(applyFilterToRow);
    applyDupFilter(rows);
}

if (isExtensionAlive()) {
    try {
        chrome.storage.local.get(['tripFilterEnabled', 'tripMinMiles', 'dupFilterEnabled'], (d) => {
            if (!isExtensionAlive()) return;
            __tripFilter.enabled = !!d.tripFilterEnabled;
            __tripFilter.min = Math.max(0, parseInt(d.tripMinMiles || 0, 10) || 0);
            __dupFilter.enabled = d.dupFilterEnabled !== false; // default ON
            applyFilterToAll();
        });
    } catch {
    }

    try {
        chrome.storage.onChanged.addListener((ch) => {
            if (!isExtensionAlive()) return;

            let changed = false;
            if (ch.tripFilterEnabled) {
                __tripFilter.enabled = !!ch.tripFilterEnabled.newValue;
                changed = true;
            }
            if (ch.tripMinMiles) {
                __tripFilter.min = Math.max(0, parseInt(ch.tripMinMiles.newValue || 0, 10) || 0);
                changed = true;
            }
            if (ch.dupFilterEnabled) {
                __dupFilter.enabled = ch.dupFilterEnabled.newValue !== false;
                changed = true;
            }
            if (changed) applyFilterToAll();
        });
    } catch {
    }

    try {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg?.type === 'trip_filter_apply') applyFilterToAll();
        });
    } catch {
    }

    // DAT's virtualized table recycles rows on sort/scroll without always
    // emitting mutations our observer flags, which left stale filtering.
    // Re-apply on column-sort clicks and while scrolling to keep it correct.
    try {
        const SORT_HEADER_SEL =
            '[mat-sort-header],.mat-sort-header,th[aria-sort],.mat-header-cell,[data-test*="sort"],[class*="header-cell"]';
        document.addEventListener(
            'click',
            (e) => {
                if (!isExtensionAlive() || !__tripFilter.enabled) return;
                const t = e.target;
                if (t && t.closest && t.closest(SORT_HEADER_SEL)) {
                    [150, 450, 900].forEach((d) =>
                        setTimeout(() => {
                            if (isExtensionAlive()) applyFilterToAll();
                        }, d)
                    );
                }
            },
            true
        );
    } catch {
    }

    try {
        let scrollRaf = 0;
        // Capture phase so we also catch scrolling inside DAT's inner viewport
        // (scroll does not bubble, but capturing listeners still receive it).
        window.addEventListener(
            'scroll',
            () => {
                if (scrollRaf) return;
                scrollRaf = requestAnimationFrame(() => {
                    scrollRaf = 0;
                    if (isExtensionAlive() && __tripFilter.enabled) applyFilterToAll();
                });
            },
            true
        );
    } catch {
    }
}

// =========================
// CLICK-TO-CALL (the number itself is the tel: link — no extra buttons)
// =========================

// Click-to-call analytics: ONE delegated listener on the document instead of a
// per-anchor listener. The boards recycle/clone row nodes (cloneNode keeps
// data-* markers but drops listeners), so per-anchor binding silently stopped
// counting on recycled rows; delegation also catches tel: links rendered
// outside the results root (detail popovers). Capture phase so a site
// stopPropagation() can't swallow the click. Does NOT preventDefault — the
// native tel: still opens the dialer.
let telCallTrackingBound = false;

function ensureTelCallTracking() {
    if (telCallTrackingBound) return;
    telCallTrackingBound = true;
    document.addEventListener(
        'click',
        (e) => {
            try {
                if (!isExtensionAlive()) return;
                const a = e.target?.closest?.('a[href^="tel:" i]');
                if (!a) return;
                trackPhoneCall();
                // Keep the click away from the board's own handlers when they
                // misbehave: on Truckstop clicking a phone collapses the load
                // details panel (its handler also cancels the tel: navigation),
                // so we shield ALL tel anchors there. On DAT its native anchors
                // behave correctly, so only OUR linkified numbers are shielded —
                // never preventDefault, the dialer must proceed natively.
                if (shieldTelAnchor(a)) {
                    e.stopPropagation();
                }
            } catch {
            }
        },
        true
    );

    // The boards also react to pointer events (row selection / panel toggles
    // fire before click — Angular Material often acts on pointerup). Shield the
    // full pointer sequence for the same anchors.
    const shieldRowEvents = (e) => {
        try {
            if (!isExtensionAlive()) return;
            const a = e.target?.closest?.('a[href^="tel:" i]');
            if (a && shieldTelAnchor(a)) e.stopPropagation();
        } catch {
        }
    };
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup'].forEach((t) =>
        document.addEventListener(t, shieldRowEvents, true)
    );
}

// Which tel anchors get isolated from the host page's handlers (see above).
function shieldTelAnchor(a) {
    if (a.hasAttribute(INJECT_ATTR)) return true; // our linkified numbers, any board
    return !!(window.TB_ADAPTER && window.TB_ADAPTER.id === 'truckstop');
}

function trackPhoneCall() {
    try {
        safeSendMessage({ type: 'datx_phone_call', platform: typeof tbActivePlatform === 'function' ? tbActivePlatform() : 'DAT' });
    } catch {
    }
}

function normalizePhoneFromText(txt) {
    if (!txt) return null;
    const m = String(txt).match(/(\+?1)?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (!m) return null;

    const digitsOnly = m[0].replace(/[^\d]/g, '');
    if (digitsOnly.length === 10) return `+1${digitsOnly}`;
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) return `+${digitsOnly}`;
    return null;
}

function ensureClickToCallInRow(row) {
    if (!row) return;
    // Self-heals on recycle: no "already processed" flag — the boards reuse row
    // nodes and re-render their content, so a flag would survive while our
    // injected tel link does not (the number then silently stops being
    // clickable). Presence of a tel link IS the processed marker.
    if (row.querySelector('a[href^="tel:"]')) return;

    const rowText = (row.innerText || row.textContent || '').replace(/\s+/g, ' ');
    const tel = normalizePhoneFromText(rowText);
    if (!tel) return;

    const candidates = Array.from(row.querySelectorAll('td, div, span')).slice(0, 120);
    const phoneEl = candidates.find((el) => {
        const t = (el.innerText || el.textContent || '').trim();
        return t && normalizePhoneFromText(t);
    });
    if (!phoneEl) return;
    if (phoneEl.querySelector('a, button, input, textarea, select')) return;

    const pretty = (phoneEl.innerText || phoneEl.textContent || '').trim();
    if (!pretty) return;

    const a = document.createElement('a');
    a.href = `tel:${tel}`;
    // Same trick the boards use on their own tel: anchors: the UI can run in a
    // frame, and Chrome silently drops external-protocol launches from
    // subframes — target=_top hands the navigation to the top window.
    a.target = '_top';
    a.textContent = pretty;
    a.style.cssText = 'color:inherit;text-decoration:underline;cursor:pointer;';
    a.setAttribute(INJECT_ATTR, '1');

    phoneEl.textContent = '';
    phoneEl.appendChild(a);
}

// Generic plain-text phone -> tel: link converter. Unlike ensureClickToCallInRow
// (which only walks ROW_SEL rows and so never reaches Truckstop, whose ROW_SEL is
// a no-match stub and whose phone lives in the detail side panel), this walks any
// leaf element under the results root. Guards keep it surgical: leaf nodes only,
// short text that IS a phone number, never inside links/controls or our injects.
function scanPlainPhones(root) {
    if (!root) return;
    let converted = 0;
    const leaves = root.querySelectorAll('td, div, span, p');
    for (const el of leaves) {
        if (converted >= 20) break; // per-scan cap; the next scan picks up the rest
        if (el.childElementCount !== 0) continue;
        const text = (el.textContent || '').trim();
        if (!text || text.length > 26) continue;
        const tel = normalizePhoneFromText(text);
        if (!tel) continue;
        if (el.closest('a, button, input, textarea, select, [contenteditable="true"]')) continue;
        if (el.closest('[' + INJECT_ATTR + ']')) continue;

        const a = document.createElement('a');
        a.href = `tel:${tel}`;
        a.target = '_top'; // subframe-safe tel: launch (see ensureClickToCallInRow)
        a.textContent = text;
        a.style.cssText = 'color:inherit;text-decoration:underline;cursor:pointer;';
        a.setAttribute(INJECT_ATTR, '1');
        el.textContent = '';
        el.appendChild(a);
        converted++;
    }
}

// =========================
// Main scanning
// =========================
function scanOnce() {
    if (!isExtensionAlive()) {
        teardown();
        return;
    }
    if (!onDatLoadsPage()) return;

    ensureTelCallTracking();

    // Run first: on Truckstop the email lives in the detail side panel, not the
    // rows, and this must fire even if the row loop below throws on a site whose
    // cell selectors aren't wired yet. No-ops where EMAIL_ICON_SEL is unset.
    ensureEmailIconButtons();

    document.querySelectorAll(ROW_SEL).forEach((row) => {
        applyFilterToRow(row);

        // Row-cell email button: present only when THIS load actually has an
        // email (in the row, or in its open details). Self-heals on recycle.
        reconcileRowEmailButton(row);

        ensureEmailButtonForDetails(row);
        ensureClickToCallInRow(row);

        const posted = getTopPostedOrigin();
        const rowOrigin = extractCityStateSmart(row.querySelector(ORIGIN_CELL_SEL), row);
        const rowDest = extractCityStateSmart(row.querySelector(DEST_CELL_SEL), row);

        const ctx = {
            start: posted || rowOrigin || null,
            waypoint: posted && rowOrigin && rowDest ? rowOrigin : null,
            dest: rowDest || null
        };

        if ((ctx.start && ctx.dest) || (rowOrigin && rowDest)) {
            injectTripMapIcon(row, ctx);
        }
    });

    applyDupFilter();

    const root = getResultsRoot();

    // (The old root-wide mailto -> row-button scan was removed: it attached
    // buttons by a[href] proximity, which mis-targeted rows on recycle. Row
    // buttons now come solely from reconcileRowEmailButton(), which binds each
    // button to its own load's email.)

    scanPlainPhones(root);
    ensureEmailButtonsInDetails();
    ensureEmailButtonsInComments();
    reconcileInlineEmailButtons();
    injectMiniMapsInDetails();
    if (typeof injectTruckstopRouteButton === 'function') injectTruckstopRouteButton();
    if (typeof injectTruckstopDarkToggle === 'function') injectTruckstopDarkToggle();
    if (typeof injectTruckstopRateBoard === 'function') injectTruckstopRateBoard();
    if (typeof injectTruckstopRtsCheck === 'function') injectTruckstopRtsCheck();
    if (typeof injectLaneAnalyticsInDetails === 'function') injectLaneAnalyticsInDetails();
    injectRefreshButton();

    //navi
    highlightActiveRow(false);

}

// =========================
// Tabs navigation (A / D)
// =========================

