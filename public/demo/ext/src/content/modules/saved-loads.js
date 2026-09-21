/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
// Saved loads — a dispatcher stars a row and it stays reachable after the board pulls the posting.
//
// Why it exists: a conversation with a broker runs for days, the posting lives for hours. Without
// this, following up means hunting for a load that is no longer in the results.
//
// Storage is the backend (so the list survives a reinstall and follows the account), with a
// chrome.storage.local mirror that keeps every open board tab in sync and makes the star render
// instantly on page load instead of after a round trip.
//
// Exposes window.tbSaved: { ready, isSaved, toggle, refresh, buildStarButton, openPanel }.

(function () {
    const CACHE_KEY = 'savedLoadsCache';
    const STAR_ATTR = 'data-datx-star';
    const LANE_ATTR = 'data-datx-star-lane';

    /** id → saved load, keyed by our external key so a row can look itself up. */
    let byKey = new Map();
    let loaded = false;
    let panelEl = null;

    // ---- keys ------------------------------------------------------------

    /**
     * A stable id for a row. The board's own reference is best; when it is hidden (DAT shows it
     * only on some accounts) fall back to the load's own facts, which identify the posting well
     * enough that re-saving the same row is a no-op.
     */
    function keyFor(ctx, platform) {
        const ref = (ctx?.referenceId || '').trim();
        if (ref) return platform + ':' + ref;
        const parts = [
            ctx?.origin || '', ctx?.destination || '', ctx?.pickupDate || '',
            ctx?.equipment || '', ctx?.rate || '', ctx?.brokerName || '', ctx?.email || ''
        ].join('|').toLowerCase();
        let h = 0;
        for (let i = 0; i < parts.length; i++) {
            h = ((h << 5) - h + parts.charCodeAt(i)) | 0;
        }
        return platform + ':h' + (h >>> 0).toString(36);
    }

    /**
     * The broker's phone, when the row shows one instead of (or next to) an email. buildContext
     * only carries the email, so read the contact cell directly.
     */
    /**
     * Trip miles straight off the row. The shared context does not carry them — only the adapter's
     * full parse does — so a saved load used to come back without its distance, which is half of
     * what makes an old bookmark worth reading ("$2,600 for how far?").
     */
    function readTripMiles(row) {
        if (!(row instanceof Element)) return null;
        const cell =
            row.querySelector('[data-test="load-trip-cell"]') ||
            row.querySelector('[data-testid="distance"]') ||
            row.querySelector('.cell-trip,[class*="cell-trip"]');
        const m = String(cell?.textContent || '').match(/[\d,]+/);
        if (!m) return null;
        const n = parseInt(m[0].replace(/,/g, ''), 10);
        return Number.isFinite(n) ? n : null;
    }

    function readPhone(row) {
        if (!(row instanceof Element)) return null;
        const cell =
            row.querySelector('[data-test="load-contact-cell"]') ||
            row.querySelector('a[href^="tel:"]');
        if (!cell) return null;
        const href = cell.getAttribute('href') || cell.getAttribute('href-value') || '';
        if (/^tel:/i.test(href)) {
            const raw = (cell.textContent || '').trim() || href.replace(/^tel:/i, '').trim();
            return raw || null;
        }
        const text = (cell.textContent || '').trim();
        // A phone is the only thing in that cell with this many digits and no "@".
        return !text.includes('@') && (text.match(/\d/g) || []).length >= 10 ? text : null;
    }

    /** "$2,850" → 2850. The board's rate cell is a display string, the API wants a number. */
    function toInt(v) {
        if (v == null) return null;
        const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
        return Number.isFinite(n) ? n : null;
    }

    /** Same answer the send flow uses, so a saved load is attributed to the right board. */
    function platformId() {
        if (typeof tbActivePlatform === 'function') return tbActivePlatform();
        const a = window.TB_ADAPTER;
        return a && a.id === 'truckstop' ? 'TRUCKSTOP' : 'DAT';
    }

    // ---- state -----------------------------------------------------------

    function indexList(list) {
        byKey = new Map((list || []).map((l) => [l.externalKey, l]));
        laneCache = null;
    }

    async function readCache() {
        try {
            const d = await chrome.storage.local.get([CACHE_KEY]);
            if (Array.isArray(d[CACHE_KEY])) {
                indexList(d[CACHE_KEY]);
                loaded = true;
            }
        } catch { /* private mode / storage blocked: fall back to the network */ }
    }

    async function writeCache() {
        try {
            await chrome.storage.local.set({[CACHE_KEY]: [...byKey.values()]});
        } catch { /* ignore */ }
    }

    function send(message) {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(message, (r) => {
                    if (chrome.runtime.lastError) resolve({ok: false, error: chrome.runtime.lastError.message});
                    else resolve(r || {ok: false});
                });
            } catch (e) {
                resolve({ok: false, error: String(e)});
            }
        });
    }

    async function refresh() {
        const r = await send({type: 'saved_loads_get'});
        if (!r.ok) return false;
        indexList(r.data);
        loaded = true;
        await writeCache();
        repaintStars();
        renderPanel();
        // The floating button carries the count: without this it keeps whatever the cache said at
        // page load, which is zero for anyone whose first visit to the board follows a fresh login.
        updateFab();
        return true;
    }

    function isSaved(key) {
        return byKey.has(key);
    }

    /** Lane + broker, loose enough to survive a re-posting: no date, no rate, no reference. */
    function laneKeyOf(origin, destination, equipment, broker) {
        return [origin || '', destination || '', equipment || '', broker || '']
            .join('|')
            .toLowerCase()
            .trim();
    }

    /**
     * True when something already saved runs the same lane with the same broker. Tomorrow the board
     * re-posts the load under a new reference and a new pickup date, so the exact key misses — but
     * "I already took this broker on this lane" is the thing worth surfacing.
     */
    function hasLaneMatch(laneKey) {
        return !!laneKey && laneSet().has(laneKey);
    }

    /** Lane keys of everything saved, rebuilt whenever the list changes. */
    let laneCache = null;
    function laneSet() {
        if (!laneCache) {
            laneCache = new Set(
                [...byKey.values()].map((l) =>
                    laneKeyOf(l.origin, l.destination, l.equipment, l.brokerName))
            );
        }
        return laneCache;
    }

    // Another tab saved or removed something — follow along without a reload.
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;

        if (changes[CACHE_KEY]) {
            indexList(changes[CACHE_KEY].newValue);
            repaintStars();
            renderPanel();
        }

        // Signing in from the popup while the board is open used to leave the list as it was at
        // page load — an empty panel for someone who has loads saved. Follow the token instead.
        if (changes.backendToken) {
            if (changes.backendToken.newValue) {
                refresh();
            } else {
                indexList([]);
                repaintStars();
                renderPanel();
                updateFab();
            }
        }
    });

    // ---- star button -----------------------------------------------------

    // Same palette and the same square edges as the popup — the panel is injected into someone
    // else's page, so it has to carry its own tokens rather than inherit them.
    const C = {
        bg: '#f4f7fc', surface: '#ffffff', ink: '#10203a', muted: '#5b6b85', faint: '#9aa7bd',
        line: 'rgba(16,32,58,.10)', lineStrong: 'rgba(16,32,58,.20)',
        accent: '#2f7be0', accentSoft: 'rgba(47,123,224,.10)',
        ok: '#16a34a', err: '#dc2626', warn: '#f59e0b', warnSoft: 'rgba(245,158,11,.14)',
        font: "'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
    };

    const STAR_CSS =
        // The row's action group is a fixed four-slot grid: send · template · copy · star. A row
        // without an email leaves the first slots empty instead of shifting the star left, so the
        // columns line up down the board.
        '.datx-cs-actions{display:inline-grid !important;grid-auto-flow:column;' +
        'grid-template-columns:30px 16px 30px 30px;gap:6px;align-items:center;justify-items:center;}' +
        '.datx-cs-actions .datx-tpl-more{margin:0 !important;}' +
        // A hidden chevron (single template) must still hold its column.
        '.datx-cs-actions .datx-tpl-more[hidden]{display:inline-flex !important;visibility:hidden;}' +
        '.datx-slot{width:30px;height:30px;}' +
        '.datx-star{color:#9aa7bd;}' +
        '.datx-star.is-on{color:' + C.warn + ';border-color:' + C.warn + ';background:' + C.warnSoft + ';}' +
        '.datx-star.is-on:hover{border-color:' + C.warn + ';background:rgba(245,158,11,.22);}' +
        // Outline only: the lane is familiar, this posting is not saved.
        '.datx-star.is-lane{color:' + C.warn + ';border-color:rgba(245,158,11,.45);}' +

        // Floating entry point. Rests translucent over the board, firms up on approach.
        '.datx-saved-fab{position:fixed;right:20px;bottom:20px;z-index:2147483646;' +
        'display:inline-flex;align-items:center;gap:9px;padding:11px 15px;cursor:pointer;' +
        'border:1px solid transparent;color:#fff;font:700 12.5px/1 ' + C.font + ';letter-spacing:.02em;' +
        'background:rgba(47,123,224,.74);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);' +
        'box-shadow:0 10px 26px rgba(16,32,58,.18);' +
        'transition:transform .15s ease,box-shadow .15s ease,background .2s ease;}' +
        '.datx-saved-fab:hover{transform:translateY(-1px);background:' + C.accent + ';' +
        'box-shadow:0 14px 32px rgba(47,123,224,.38);}' +
        '.datx-saved-fab:active{transform:translateY(0);}' +
        '.datx-saved-fab svg{color:#ffd166;}' +
        '.datx-saved-badge{min-width:18px;padding:2px 6px;background:rgba(255,255,255,.22);' +
        'font:700 11.5px/1.3 ' + C.font + ';text-align:center;}' +
        '.datx-saved-fab.is-empty{background:rgba(255,255,255,.82);color:' + C.accent + ';' +
        'border-color:' + C.lineStrong + ';box-shadow:0 6px 18px rgba(16,32,58,.12);}' +
        '.datx-saved-fab.is-empty:hover{background:#fff;}' +
        '.datx-saved-fab.is-empty .datx-saved-badge{background:' + C.accentSoft + ';color:' + C.accent + ';}' +

        // Panel shell.
        '.datx-saved-panel{position:fixed;right:20px;bottom:70px;width:480px;max-width:calc(100vw - 40px);' +
        'max-height:76vh;display:flex;flex-direction:column;z-index:2147483647;background:' + C.surface + ';' +
        'position:fixed;' +
        'border:1px solid ' + C.lineStrong + ';overflow:hidden;box-shadow:0 24px 64px rgba(16,32,58,.24);' +
        'font:13px/1.45 ' + C.font + ';color:' + C.ink + ';}' +
        '.datx-saved-panel.is-wide{width:860px;max-height:84vh;}' +
        // The board's own reset must not round anything of ours, and vice versa.
        '.datx-saved-panel *,.datx-saved-panel *::before,.datx-saved-panel *::after,' +
        '.datx-saved-fab,.datx-saved-fab *{border-radius:0 !important;}' +

        '.datx-saved-head{display:flex;align-items:center;justify-content:space-between;gap:12px;' +
        'padding:9px 12px;border-bottom:1px solid ' + C.line + ';background:' + C.bg + ';}' +
        '.datx-saved-brand{display:flex;align-items:center;gap:8px;min-width:0;}' +
        '.datx-saved-brand-ic{display:inline-flex;width:22px;height:22px;align-items:center;' +
        'justify-content:center;background:' + C.warnSoft + ';color:' + C.warn + ';flex:0 0 auto;}' +
        '.datx-saved-brand-ic svg{width:13px;height:13px;}' +
        '.datx-saved-title{font:700 13px/1 ' + C.font + ';letter-spacing:-.01em;white-space:nowrap;}' +
        '.datx-saved-sub{font:700 9px/1 ' + C.font + ';letter-spacing:.12em;text-transform:uppercase;' +
        'color:' + C.accent + ';opacity:.8;white-space:nowrap;}' +
        '.datx-saved-headacts{display:flex;align-items:center;gap:6px;}' +
        '.datx-saved-ic{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;' +
        'cursor:pointer;border:1px solid ' + C.lineStrong + ';background:' + C.surface + ';color:' + C.muted + ';}' +
        '.datx-saved-ic:hover{border-color:' + C.accent + ';color:' + C.accent + ';background:' + C.accentSoft + ';}' +

        '.datx-saved-tabs{display:flex;align-items:center;justify-content:space-between;' +
        'padding:8px 12px;border-bottom:1px solid ' + C.line + ';}' +
        '.datx-saved-seg{display:inline-flex;border:1px solid ' + C.lineStrong + ';}' +
        '.datx-saved-segb{cursor:pointer;border:none;background:transparent;padding:6px 13px;' +
        'font:700 10.5px/1 ' + C.font + ';letter-spacing:.08em;text-transform:uppercase;color:' + C.muted + ';}' +
        '.datx-saved-segb+.datx-saved-segb{border-left:1px solid ' + C.lineStrong + ';}' +
        '.datx-saved-segb.is-on{background:' + C.accent + ';color:#fff;}' +
        '.datx-saved-total{font:700 10.5px/1 ' + C.font + ';letter-spacing:.08em;text-transform:uppercase;' +
        'color:' + C.faint + ';}' +

        '.datx-saved-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;}' +
        '.datx-saved-panel.is-wide .datx-saved-body{display:grid;grid-template-columns:1fr 340px;' +
        'align-items:start;}' +
        '.datx-saved-panel.is-wide .datx-saved-cal{border-right:1px solid ' + C.line + ';}' +

        // Month grid.
        '.datx-saved-cal{padding:10px 12px 12px;}' +
        '.datx-saved-calnav{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}' +
        '.datx-saved-calnav button{cursor:pointer;border:1px solid ' + C.lineStrong + ';background:' + C.surface + ';' +
        'width:24px;height:24px;font:600 15px/1 ' + C.font + ';color:' + C.muted + ';}' +
        '.datx-saved-calnav button:hover{border-color:' + C.accent + ';color:' + C.accent + ';}' +
        '.datx-saved-calmonth{font:700 12px/1 ' + C.font + ';letter-spacing:.02em;}' +
        '.datx-saved-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}' +
        '.datx-saved-dow{text-align:center;font:700 9px/1 ' + C.font + ';letter-spacing:.1em;' +
        'text-transform:uppercase;color:' + C.faint + ';padding-bottom:4px;}' +
        '.datx-saved-day{position:relative;min-height:36px;cursor:pointer;border:1px solid ' + C.line + ';' +
        'background:' + C.bg + ';padding:4px;text-align:left;font:inherit;color:' + C.ink + ';' +
        'display:flex;flex-direction:column;gap:2px;}' +
        '.datx-saved-panel.is-wide .datx-saved-day{min-height:62px;}' +
        '.datx-saved-day.is-pad{background:none;border-color:transparent;cursor:default;}' +
        '.datx-saved-day:hover:not(.is-pad){border-color:' + C.accent + ';}' +
        '.datx-saved-day.is-today{box-shadow:inset 0 0 0 1px ' + C.accent + ';}' +
        '.datx-saved-day.is-sel{background:' + C.accentSoft + ';border-color:' + C.accent + ';}' +
        '.datx-saved-day.has-loads{background:' + C.warnSoft + ';}' +
        '.datx-saved-day.has-loads.is-sel{background:' + C.accentSoft + ';}' +
        '.datx-saved-dnum{font:600 10.5px/1 ' + C.font + ';color:' + C.muted + ';}' +
        '.datx-saved-dot{position:absolute;right:3px;top:3px;min-width:14px;height:14px;padding:0 3px;' +
        'background:' + C.warn + ';color:#fff;font:700 9.5px/14px ' + C.font + ';text-align:center;}' +
        '.datx-saved-chip{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;' +
        'padding:2px 4px;background:' + C.surface + ';border:1px solid rgba(245,158,11,.45);' +
        'font:600 9.5px/1.3 ' + C.font + ';color:#92400e;}' +
        '.datx-saved-more{font:600 9.5px/1.3 ' + C.font + ';color:' + C.faint + ';}' +

        // List.
        '.datx-saved-list{overflow-y:auto;overflow-x:hidden;min-width:0;}' +
        '.datx-saved-filter{display:flex;align-items:center;justify-content:space-between;' +
        'padding:7px 12px;background:' + C.accentSoft + ';font:700 10.5px/1 ' + C.font + ';' +
        'letter-spacing:.06em;text-transform:uppercase;color:' + C.accent + ';}' +
        '.datx-saved-filter button{cursor:pointer;border:none;background:none;font:inherit;' +
        'color:' + C.accent + ';text-decoration:underline;}' +
        '.datx-saved-empty{padding:24px 14px;color:' + C.muted + ';text-align:center;}' +
        '.datx-saved-item{display:flex;gap:11px;padding:11px 12px;border-bottom:1px solid ' + C.line + ';}' +
        '.datx-saved-item:hover{background:rgba(47,123,224,.04);}' +
        '.datx-saved-main{flex:1;min-width:0;}' +
        // Pickup date as a stub, coloured by board: an anchor that ties a row to the calendar.
        '.datx-saved-date{flex:0 0 38px;height:40px;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;background:' + C.bg + ';' +
        'border-left:2px solid ' + C.accent + ';}' +
        '.datx-saved-date.is-ts{border-left-color:#dc2626;}' +
        '.datx-saved-mon{font:700 8.5px/1 ' + C.font + ';letter-spacing:.1em;color:' + C.faint + ';}' +
        '.datx-saved-dd{font:700 15px/1.1 ' + C.font + ';letter-spacing:-.02em;color:' + C.ink + ';}' +
        '.datx-saved-itemtop{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0;}' +
        '.datx-saved-lane{font:700 13px/1.3 ' + C.font + ';letter-spacing:-.01em;min-width:0;overflow-wrap:anywhere;}' +
        // The lane move gets the strong right-hand slot — it is why this list beats a bookmark.
        '.datx-saved-fig{flex:0 0 auto;font:700 13px/1.2 ' + C.font + ';letter-spacing:-.01em;}' +
        '.datx-saved-fig.is-up{color:' + C.ok + ';}' +
        '.datx-saved-fig.is-down{color:' + C.err + ';}' +
        '.datx-saved-meta{color:' + C.muted + ';font-size:11.5px;margin-top:3px;overflow-wrap:anywhere;}' +
        '.datx-saved-price{margin-top:5px;font-size:11.5px;color:' + C.muted + ';}' +
        '.datx-saved-price b{color:' + C.ink + ';font-weight:700;}' +
        '.datx-saved-up{color:' + C.ok + ';font-weight:700;}' +
        '.datx-saved-down{color:' + C.err + ';font-weight:700;}' +
        // The dispatcher's own note: quiet, but clearly theirs rather than board data.
        '.datx-saved-note{margin-top:6px;padding:6px 8px;border-left:2px solid ' + C.warn + ';' +
        'background:' + C.warnSoft + ';font:12px/1.45 ' + C.font + ';color:' + C.ink + ';' +
        'cursor:text;overflow-wrap:anywhere;}' +
        '.datx-saved-noteedit{margin-top:7px;}' +
        '.datx-saved-noteinput{width:100%;box-sizing:border-box;border:1px solid ' + C.lineStrong + ';' +
        'background:' + C.surface + ';color:' + C.ink + ';padding:7px 8px;' +
        'font:12px/1.45 ' + C.font + ';resize:vertical;}' +
        '.datx-saved-noteinput:focus{outline:none;border-color:' + C.accent + ';}' +
        '.datx-saved-noteacts{display:flex;justify-content:flex-end;gap:6px;margin-top:6px;}' +
        '.datx-saved-noteacts button{cursor:pointer;border:1px solid ' + C.lineStrong + ';' +
        'background:' + C.surface + ';padding:5px 10px;font:700 10px/1 ' + C.font + ';' +
        'letter-spacing:.06em;text-transform:uppercase;color:' + C.ink + ';}' +
        '.datx-saved-noteacts button.is-primary{background:' + C.accent + ';border-color:' + C.accent + ';' +
        'color:#fff;}' +
        '.datx-saved-acts{display:flex;align-items:center;gap:6px;margin-top:8px;}' +
        // Instant tooltip — the native one lags and the board's styles can swallow it.
        '.datx-saved-panel [data-tip]{position:relative;}' +
        '.datx-saved-panel [data-tip]::after{content:attr(data-tip);position:absolute;' +
        'bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;' +
        'padding:4px 7px;background:' + C.ink + ';color:#fff;font:600 10.5px/1 ' + C.font + ';' +
        'letter-spacing:.02em;text-transform:none;opacity:0;pointer-events:none;' +
        'transition:opacity .12s ease;z-index:3;}' +
        '.datx-saved-panel [data-tip]:hover::after{opacity:1;}' +
        '.datx-saved-q{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;' +
        'cursor:pointer;border:1px solid ' + C.lineStrong + ';background:' + C.surface + ';' +
        'color:' + C.muted + ';text-decoration:none;}' +
        '.datx-saved-q:hover{border-color:' + C.accent + ';color:' + C.accent + ';background:' + C.accentSoft + ';}' +
        '.datx-saved-q.is-primary{background:' + C.accent + ';border-color:' + C.accent + ';color:#fff;}' +
        '.datx-saved-q.is-primary:hover{background:#2468c4;border-color:#2468c4;color:#fff;}' +
        '.datx-saved-q.is-busy{opacity:.6;}' +
        '.datx-saved-q.is-done{background:' + C.ok + ';border-color:' + C.ok + ';color:#fff;}' +
        '.datx-saved-q.is-call{color:' + C.accent + ';}' +
        // The shared template chevron rides next to the send icon, same as on a board row.
        '.datx-saved-acts .datx-tpl-more{width:22px;height:28px;margin-left:-1px;}' +
        // Copy and remove stay out of the way until the row is under the cursor.
        '.datx-saved-quiet{margin-left:auto;display:flex;gap:4px;}' +
        '.datx-saved-quiet .datx-saved-q.is-done{background:' + C.surface + ';color:' + C.ok + ';' +
        'border-color:' + C.ok + ';}' +
        '.datx-saved-q.is-danger:hover{border-color:' + C.err + ';color:' + C.err + ';' +
        'background:rgba(220,38,38,.08);}' +
        '.datx-saved-call{font:700 11px/1 ' + C.font + ';color:' + C.accent + ';text-decoration:none;}' +

        // Footer.
        '.datx-saved-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;' +
        'padding:9px 12px;border-top:1px solid ' + C.line + ';background:' + C.bg + ';' +
        'font:11.5px/1.4 ' + C.font + ';color:' + C.faint + ';}' +
        '.datx-saved-clear{cursor:pointer;border:1px solid rgba(220,38,38,.28);background:' + C.surface + ';' +
        'padding:6px 10px;font:700 10.5px/1 ' + C.font + ';letter-spacing:.06em;text-transform:uppercase;' +
        'color:' + C.err + ';white-space:nowrap;}' +
        '.datx-saved-clear:hover{border-color:' + C.err + ';background:rgba(220,38,38,.08);}' +

        // One-off follow-up, layered over the list so the row stays in view behind it. The board's
        // own icon buttons carry the max z-index, so this has to match it to cover them.
        '.datx-saved-backdrop{position:absolute;inset:0;background:rgba(16,32,58,.38);' +
        'z-index:2147483647;}' +
        '.datx-saved-composer{position:absolute;left:0;right:0;bottom:0;max-height:92%;' +
        'display:flex;flex-direction:column;background:' + C.surface + ';' +
        'border-top:2px solid ' + C.accent + ';z-index:2147483647;' +
        'box-shadow:0 -16px 40px rgba(16,32,58,.22);}' +

        '.datx-saved-chead{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
        'padding:10px 12px;border-bottom:1px solid ' + C.line + ';background:' + C.bg + ';}' +
        '.datx-saved-cto{display:flex;align-items:baseline;gap:7px;min-width:0;}' +
        '.datx-saved-ckicker{font:700 9px/1 ' + C.font + ';letter-spacing:.14em;text-transform:uppercase;' +
        'color:' + C.faint + ';}' +
        '.datx-saved-caddr{font:700 12.5px/1.2 ' + C.font + ';color:' + C.ink + ';' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
        '.datx-saved-cclose{width:24px;height:24px;flex:0 0 auto;}' +

        '.datx-saved-cfields{flex:1;min-height:0;display:flex;flex-direction:column;padding:10px 12px 8px;}' +
        '.datx-saved-cinput,.datx-saved-carea{width:100%;box-sizing:border-box;' +
        'border:1px solid ' + C.lineStrong + ';background:' + C.surface + ';color:' + C.ink + ';' +
        'padding:9px 10px;font:13px/1.5 ' + C.font + ';}' +
        '.datx-saved-cinput{font-weight:600;margin-bottom:7px;}' +
        '.datx-saved-carea{flex:1;min-height:190px;resize:vertical;}' +
        '.datx-saved-cinput:focus,.datx-saved-carea:focus{outline:none;border-color:' + C.accent + ';' +
        'box-shadow:0 0 0 2px ' + C.accentSoft + ';}' +

        '.datx-saved-chips{display:flex;flex-wrap:wrap;align-items:center;gap:5px;' +
        'padding:9px 12px;border-top:1px solid ' + C.line + ';background:' + C.bg + ';}' +
        '.datx-saved-chiplabel{font:700 9px/1 ' + C.font + ';letter-spacing:.14em;' +
        'text-transform:uppercase;color:' + C.faint + ';margin-right:3px;}' +
        '.datx-saved-chipb{cursor:pointer;border:1px solid ' + C.lineStrong + ';background:' + C.surface + ';' +
        'padding:4px 8px;font:600 11px/1.2 ' + C.font + ';color:' + C.muted + ';}' +
        '.datx-saved-chipb:hover{border-color:' + C.accent + ';color:' + C.accent + ';' +
        'background:' + C.accentSoft + ';}' +

        '.datx-saved-cfoot{display:flex;align-items:center;gap:8px;padding:10px 12px;' +
        'border-top:1px solid ' + C.line + ';}' +
        '.datx-saved-cnote{flex:1;min-width:0;font:11px/1.4 ' + C.font + ';color:' + C.faint + ';}' +
        '.datx-saved-cfoot button{cursor:pointer;border:1px solid ' + C.lineStrong + ';' +
        'background:' + C.surface + ';padding:8px 15px;font:700 10.5px/1 ' + C.font + ';' +
        'letter-spacing:.06em;text-transform:uppercase;color:' + C.ink + ';}' +
        '.datx-saved-cfoot button:hover{border-color:' + C.accent + ';color:' + C.accent + ';}' +
        '.datx-saved-cfoot button.is-primary{background:' + C.accent + ';border-color:' + C.accent + ';' +
        'color:#fff;}' +
        '.datx-saved-cfoot button.is-primary:hover{background:#2468c4;border-color:#2468c4;color:#fff;}';

    function ensureStyle() {
        if (document.getElementById('datx-saved-style')) return;
        const st = document.createElement('style');
        st.id = 'datx-saved-style';
        st.textContent = STAR_CSS;
        (document.head || document.documentElement).appendChild(st);
    }

    const STAR_SVG =
        '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M12 3.6l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" ' +
        'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>';
    const STAR_SVG_FILLED =
        '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M12 3.6l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" ' +
        'fill="currentColor" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>';

    function paintStar(btn) {
        const on = isSaved(btn.getAttribute(STAR_ATTR) || '');
        // Not this exact posting, but the same broker on the same lane — a hint, not a state.
        const lane = !on && hasLaneMatch(btn.getAttribute(LANE_ATTR) || '');
        btn.classList.toggle('is-on', on);
        btn.classList.toggle('is-lane', lane);
        btn.innerHTML = on ? STAR_SVG_FILLED : STAR_SVG;
        btn.title = on
            ? 'Saved — click to remove'
            : lane
                ? 'You have a saved load with this broker on this lane'
                : 'Save this load';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    function repaintStars() {
        document.querySelectorAll('.datx-star').forEach(paintStar);
    }

    /** The star that goes next to the row's Send / Copy buttons. */
    function buildStarButton(row, email) {
        ensureStyle();
        if (typeof ensureDatxButtonStyle === 'function') ensureDatxButtonStyle();

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'datx-star datx-iconbtn';
        if (typeof INJECT_ATTR === 'string') btn.setAttribute(INJECT_ATTR, '1');

        const platform = platformId();
        const ctx = typeof buildContext === 'function' ? buildContext(row, email || '') : null;
        const key = keyFor(ctx, platform);
        btn.setAttribute(STAR_ATTR, key);
        btn.setAttribute(
            LANE_ATTR,
            laneKeyOf(ctx?.origin, ctx?.destination, ctx?.equipment, ctx?.brokerName)
        );
        paintStar(btn);

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (btn.disabled) return;
            btn.disabled = true;
            try {
                await toggle(row, email, btn);
            } finally {
                btn.disabled = false;
            }
        });
        return btn;
    }

    /**
     * Rows that show only a phone never get the email button group, so they used to carry nothing
     * at all — no way to save them. Give them the star and a copy-phone button in the same cell,
     * under the same class the email group uses so the existing cleanup removes it too.
     */
    function injectStarOnlyRow(row) {
        if (!(row instanceof Element) || row.querySelector('.datx-cs-actions')) return;
        const phone = readPhone(row);
        const ctx = typeof buildContext === 'function' ? buildContext(row, '') : null;
        // Nothing to save and no one to call — leave the row alone.
        if (!phone && !(ctx && ctx.origin)) return;

        ensureStyle();
        const group = document.createElement('div');
        // Shares datx-cs-actions so the existing cleanup finds it; the extra class marks it as
        // ours, because the board recycles rows and we refresh in place rather than rebuild.
        group.className = 'datx-cs-actions datx-star-only';
        if (typeof INJECT_ATTR === 'string') group.setAttribute(INJECT_ATTR, '1');
        group.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';

        // Keep the send + template columns empty so the remaining buttons land in their usual place.
        for (let i = 0; i < 2; i++) {
            const slot = document.createElement('span');
            slot.className = 'datx-slot';
            if (typeof INJECT_ATTR === 'string') slot.setAttribute(INJECT_ATTR, '1');
            group.appendChild(slot);
        }

        if (phone) {
            const copy = document.createElement('button');
            copy.type = 'button';
            copy.className = 'datx-copy-phone datx-iconbtn';
            copy.title = 'Copy phone';
            if (typeof INJECT_ATTR === 'string') copy.setAttribute(INJECT_ATTR, '1');
            // Same copy glyph as the email button: one icon, one meaning, whatever it copies.
            copy.innerHTML = IC_COPY;
            copy.dataset.phone = phone;
            copy.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const number = copy.dataset.phone;
                if (!number) return;
                try {
                    await navigator.clipboard.writeText(number);
                    toast('Phone copied', 'info');
                } catch { /* clipboard blocked */ }
            });
            group.appendChild(copy);
        }

        group.appendChild(buildStarButton(row, ''));

        const cell = typeof DTP_CELL_SEL === 'string' && DTP_CELL_SEL
            ? row.querySelector(DTP_CELL_SEL)
            : null;
        if (!cell) return;
        cell.querySelectorAll(':scope > div').forEach((d) => {
            if (!d.classList.contains('datx-cs-actions')) d.style.display = 'none';
        });
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'flex-start';
        // Same zeroing the email path does — without it the cell's own padding shifts this group
        // a few pixels right and the columns stop lining up with the rows above.
        cell.style.paddingLeft = '0';
        cell.style.paddingRight = '0';
        cell.appendChild(group);
    }

    /**
     * The row was reused for a different load: re-point the star and the phone instead of tearing
     * the group down, which would flicker and drop hover state on every scroll tick.
     */
    function refreshStarOnlyRow(row) {
        const group = row.querySelector('.datx-star-only');
        if (!group) return false;

        const ctx = typeof buildContext === 'function' ? buildContext(row, '') : null;
        const star = group.querySelector('.datx-star');
        if (star) {
            star.setAttribute(STAR_ATTR, keyFor(ctx, platformId()));
            star.setAttribute(
                LANE_ATTR,
                laneKeyOf(ctx?.origin, ctx?.destination, ctx?.equipment, ctx?.brokerName)
            );
            paintStar(star);
        }

        const phone = readPhone(row);
        const copy = group.querySelector('.datx-copy-phone');
        if (copy) {
            if (phone) copy.dataset.phone = phone;
            else copy.remove();
        }
        return true;
    }

    async function toggle(row, email, btn) {
        const platform = platformId();
        const ctx = typeof buildContext === 'function' ? buildContext(row, email || '') : null;
        const key = btn ? btn.getAttribute(STAR_ATTR) : keyFor(ctx, platform);

        const existing = byKey.get(key);
        if (existing) {
            const r = await send({type: 'saved_load_remove', id: existing.id});
            if (!r.ok) {
                toast(r.needLogin ? 'Sign in to use saved loads' : 'Could not remove', 'error');
                return;
            }
            byKey.delete(key);
            laneCache = null;
        } else {
            const payload = {
                platform,
                externalKey: key,
                origin: ctx?.origin || null,
                destination: ctx?.destination || null,
                equipment: ctx?.equipment || null,
                lengthFt: toInt(ctx?.length),
                weightLbs: toInt(ctx?.weight),
                pickupDate: ctx?.pickupDate || null,
                tripMiles: toInt(ctx?.tripMiles) ?? readTripMiles(row),
                offerPrice: toInt(ctx?.rate),
                brokerName: ctx?.brokerName || null,
                brokerEmail: ctx?.email || email || null,
                brokerPhone: ctx?.phone || readPhone(row),
                brokerMc: ctx?.mcNumber || null,
                referenceId: ctx?.referenceId || null
            };
            const r = await send({type: 'saved_load_save', data: payload});
            if (!r.ok) {
                // Keep the reason visible: a silent "could not save" is impossible to debug from
                // a support ticket, and the backend already sends a usable message.
                // Stringified: Chrome's extension error page prints objects as [object Object].
                console.warn('[TruckBox] save load failed ' + JSON.stringify({
                    status: r.status ?? null,
                    code: r.code ?? null,
                    message: r.message ?? null,
                    error: r.error ?? null,
                    needLogin: !!r.needLogin
                }));
                const msg = r.needLogin
                    ? 'Sign in to use saved loads'
                    : r.code === 1070
                        ? 'Saved list is full — remove a few first'
                        : r.message || ('Could not save this load' + (r.status ? ' (' + r.status + ')' : ''));
                toast(msg, 'error');
                return;
            }
            byKey.set(key, r.data);
            laneCache = null;
        }
        await writeCache();
        repaintStars();
        renderPanel();
        updateFab();
    }

    function toast(text, kind) {
        if (typeof showToast === 'function') showToast(text, kind === 'error' ? 'error' : 'info');
    }

    // ---- panel -----------------------------------------------------------

    /** Narrow is enough for the list; wide is for the month grid. Remembered per browser. */
    const WIDE_KEY = 'savedLoadsWide';
    const VIEW_KEY = 'savedLoadsView';
    let wide = false;
    let view = 'list';          // 'list' | 'calendar'
    let monthCursor = null;     // first day of the month on screen
    let selectedDay = null;     // 'YYYY-MM-DD' filter set by clicking a day

    function fmtUsd(n) {
        return n == null ? '—' : '$' + Number(n).toLocaleString('en-US');
    }

    /**
     * Boards print the pickup as "9/21" or a window "9/21 - 9/22" — month and day, no year. Take
     * the first date and assume the nearest sensible year: a date far in the past is next year's.
     */
    function pickupDateOf(l) {
        const m = String(l.pickupDate || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
        if (!m) return null;
        const now = new Date();
        const month = parseInt(m[1], 10) - 1;
        const day = parseInt(m[2], 10);
        let year = m[3] ? parseInt(m[3].length === 2 ? '20' + m[3] : m[3], 10) : now.getFullYear();
        let d = new Date(year, month, day);
        if (!m[3] && (now - d) / 86400000 > 60) d = new Date(year + 1, month, day);
        return isNaN(d.getTime()) ? null : d;
    }

    const dayKey = (d) =>
        d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');

    function updateFab() {
        const fab = document.getElementById('datx-saved-fab');
        if (!fab) return;
        fab.querySelector('.datx-saved-count').textContent = String(byKey.size);
        fab.classList.toggle('is-empty', byKey.size === 0);
    }

    function ensureFab() {
        ensureStyle();
        if (document.getElementById('datx-saved-fab')) {
            updateFab();
            return;
        }
        const fab = document.createElement('button');
        fab.id = 'datx-saved-fab';
        fab.type = 'button';
        fab.className = 'datx-saved-fab';
        if (typeof INJECT_ATTR === 'string') fab.setAttribute(INJECT_ATTR, '1');
        fab.innerHTML =
            STAR_SVG_FILLED +
            '<span class="datx-saved-fab-text">Saved loads</span>' +
            '<span class="datx-saved-badge datx-saved-count">0</span>';
        fab.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePanel();
        });
        document.body.appendChild(fab);
        updateFab();
    }

    async function readPrefs() {
        try {
            const d = await chrome.storage.local.get([WIDE_KEY, VIEW_KEY]);
            wide = !!d[WIDE_KEY];
            view = d[VIEW_KEY] === 'calendar' ? 'calendar' : 'list';
        } catch { /* defaults are fine */ }
    }

    function savePrefs() {
        try {
            chrome.storage.local.set({[WIDE_KEY]: wide, [VIEW_KEY]: view});
        } catch { /* ignore */ }
    }

    function togglePanel() {
        if (panelEl) {
            panelEl.remove();
            panelEl = null;
            return;
        }
        panelEl = document.createElement('div');
        panelEl.className = 'datx-saved-panel' + (wide ? ' is-wide' : '');
        if (typeof INJECT_ATTR === 'string') panelEl.setAttribute(INJECT_ATTR, '1');
        document.body.appendChild(panelEl);
        monthCursor = monthCursor || startOfMonth(new Date());
        renderPanel();
        refresh();
    }

    function openPanel() {
        if (!panelEl) togglePanel();
    }

    const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

    // ---- panel rendering -------------------------------------------------

    function renderPanel() {
        if (!panelEl) return;
        panelEl.classList.toggle('is-wide', wide);
        panelEl.innerHTML = '';
        panelEl.appendChild(renderHead());
        panelEl.appendChild(renderTabs());

        const body = document.createElement('div');
        body.className = 'datx-saved-body';
        if (view === 'calendar') body.appendChild(renderCalendar());
        body.appendChild(renderList());
        panelEl.appendChild(body);

        panelEl.appendChild(renderFoot());
    }

    function iconBtn(svg, title, onClick, extraClass) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'datx-saved-ic' + (extraClass ? ' ' + extraClass : '');
        b.setAttribute('aria-label', title);
        b.setAttribute('data-tip', title);
        b.innerHTML = svg;
        b.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            onClick.call(b, e);
        });
        return b;
    }

    const IC_WIDE =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 4H4v5M15 20h5v-5M20 9V4h-5M4 15v5h5"/></svg>';
    const IC_NARROW =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M4 9h5V4M20 15h-5v5M15 4v5h5M9 20v-5H4"/></svg>';
    const IC_CLOSE =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    function renderHead() {
        const head = document.createElement('div');
        head.className = 'datx-saved-head';

        const brand = document.createElement('div');
        brand.className = 'datx-saved-brand';
        // One line: the panel floats over someone else's page, so every row costs real estate.
        brand.innerHTML =
            '<span class="datx-saved-brand-ic">' + STAR_SVG_FILLED + '</span>' +
            '<span class="datx-saved-title">Saved loads</span>' +
            '<span class="datx-saved-sub">TruckBox</span>';
        head.appendChild(brand);

        const acts = document.createElement('div');
        acts.className = 'datx-saved-headacts';
        // Header controls carry no tooltip: they sit at the very top and the bubble would cover
        // the board behind the panel.
        const expand = iconBtn(wide ? IC_NARROW : IC_WIDE, wide ? 'Narrow' : 'Expand', () => {
            wide = !wide;
            savePrefs();
            renderPanel();
        });
        expand.removeAttribute('data-tip');
        acts.appendChild(expand);

        const close = iconBtn(IC_CLOSE, 'Close', togglePanel);
        close.removeAttribute('data-tip');
        acts.appendChild(close);
        head.appendChild(acts);
        return head;
    }

    function renderTabs() {
        const bar = document.createElement('div');
        bar.className = 'datx-saved-tabs';

        const group = document.createElement('div');
        group.className = 'datx-saved-seg';
        [['list', 'List'], ['calendar', 'Calendar']].forEach(([id, label]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'datx-saved-segb' + (view === id ? ' is-on' : '');
            b.textContent = label;
            b.addEventListener('click', () => {
                view = id;
                // Leaving the calendar must not leave an invisible day filter behind.
                if (view === 'list') selectedDay = null;
                savePrefs();
                renderPanel();
            });
            group.appendChild(b);
        });
        bar.appendChild(group);

        const count = document.createElement('span');
        count.className = 'datx-saved-total';
        count.textContent = byKey.size === 1 ? '1 load' : byKey.size + ' loads';
        bar.appendChild(count);
        return bar;
    }

    // ---- calendar --------------------------------------------------------

    /** dayKey → loads with that pickup date. */
    function byDay() {
        const map = new Map();
        for (const l of byKey.values()) {
            const d = pickupDateOf(l);
            if (!d) continue;
            const k = dayKey(d);
            if (!map.has(k)) map.set(k, []);
            map.get(k).push(l);
        }
        return map;
    }

    function renderCalendar() {
        const wrap = document.createElement('div');
        wrap.className = 'datx-saved-cal';

        const nav = document.createElement('div');
        nav.className = 'datx-saved-calnav';
        const prev = document.createElement('button');
        prev.type = 'button';
        prev.textContent = '‹';
        prev.addEventListener('click', () => {
            monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
            renderPanel();
        });
        const title = document.createElement('span');
        title.className = 'datx-saved-calmonth';
        title.textContent = monthCursor.toLocaleDateString('en-US', {month: 'long', year: 'numeric'});
        const next = document.createElement('button');
        next.type = 'button';
        next.textContent = '›';
        next.addEventListener('click', () => {
            monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
            renderPanel();
        });
        nav.appendChild(prev);
        nav.appendChild(title);
        nav.appendChild(next);
        wrap.appendChild(nav);

        const grid = document.createElement('div');
        grid.className = 'datx-saved-grid';
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) => {
            const h = document.createElement('div');
            h.className = 'datx-saved-dow';
            h.textContent = wide ? d : d[0];
            grid.appendChild(h);
        });

        const loads = byDay();
        const first = startOfMonth(monthCursor);
        const leading = first.getDay();
        const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
        const todayKey = dayKey(new Date());

        for (let i = 0; i < leading; i++) {
            const pad = document.createElement('div');
            pad.className = 'datx-saved-day is-pad';
            grid.appendChild(pad);
        }

        for (let d = 1; d <= days; d++) {
            const date = new Date(first.getFullYear(), first.getMonth(), d);
            const k = dayKey(date);
            const items = loads.get(k) || [];
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className =
                'datx-saved-day' +
                (k === todayKey ? ' is-today' : '') +
                (k === selectedDay ? ' is-sel' : '') +
                (items.length ? ' has-loads' : '');
            cell.innerHTML = '<span class="datx-saved-dnum">' + d + '</span>';

            if (items.length) {
                if (wide) {
                    items.slice(0, 2).forEach((l) => {
                        const chip = document.createElement('span');
                        chip.className = 'datx-saved-chip';
                        chip.textContent = shortLane(l);
                        cell.appendChild(chip);
                    });
                    if (items.length > 2) {
                        const more = document.createElement('span');
                        more.className = 'datx-saved-more';
                        more.textContent = '+' + (items.length - 2) + ' more';
                        cell.appendChild(more);
                    }
                } else {
                    const dot = document.createElement('span');
                    dot.className = 'datx-saved-dot';
                    dot.textContent = items.length;
                    cell.appendChild(dot);
                }
            }

            cell.addEventListener('click', () => {
                // Clicking the selected day again clears the filter — no second control needed.
                selectedDay = selectedDay === k ? null : k;
                renderPanel();
            });
            grid.appendChild(cell);
        }

        wrap.appendChild(grid);
        return wrap;
    }

    /** "Kankakee, IL → Piscataway, NJ" as "IL→NJ" for a calendar cell. */
    function shortLane(l) {
        const st = (v) => {
            const m = String(v || '').match(/,\s*([A-Za-z]{2})\s*$/);
            return m ? m[1].toUpperCase() : String(v || '').slice(0, 3);
        };
        return st(l.origin) + '→' + st(l.destination);
    }

    // ---- list ------------------------------------------------------------

    function visibleItems() {
        const all = [...byKey.values()];
        if (!selectedDay) return all;
        return all.filter((l) => {
            const d = pickupDateOf(l);
            return d && dayKey(d) === selectedDay;
        });
    }

    function renderList() {
        const list = document.createElement('div');
        list.className = 'datx-saved-list';

        if (selectedDay) {
            const bar = document.createElement('div');
            bar.className = 'datx-saved-filter';
            const [y, m, d] = selectedDay.split('-').map(Number);
            bar.innerHTML =
                '<span>' +
                new Date(y, m - 1, d).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric'
                }) +
                '</span>';
            const clear = document.createElement('button');
            clear.type = 'button';
            clear.textContent = 'Show all';
            clear.addEventListener('click', () => {
                selectedDay = null;
                renderPanel();
            });
            bar.appendChild(clear);
            list.appendChild(bar);
        }

        const items = visibleItems();
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'datx-saved-empty';
            empty.textContent = !loaded
                ? 'Loading…'
                : selectedDay
                    ? 'Nothing picking up on this day.'
                    : 'Nothing saved yet. Click the star on a load to keep it here.';
            list.appendChild(empty);
            return list;
        }

        items.forEach((l) => list.appendChild(renderItem(l)));
        return list;
    }

    const IC_MAIL =
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="5" width="18" height="14"/><path d="M3 7l9 6 9-6"/></svg>';
    const IC_PHONE =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 3h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1z"/></svg>';
    const IC_NOTE =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"/></svg>';
    const IC_COPY =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="11" height="11"/>' +
        '<path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>';
    const IC_TRASH =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg>';

    /** Month + day block on the left of a row — the anchor that ties the list to the calendar. */
    function dateBlock(l) {
        const box = document.createElement('div');
        box.className = 'datx-saved-date' + (l.platform === 'TRUCKSTOP' ? ' is-ts' : '');
        const d = pickupDateOf(l);
        if (d) {
            box.innerHTML =
                '<span class="datx-saved-mon">' +
                d.toLocaleDateString('en-US', {month: 'short'}).toUpperCase() + '</span>' +
                '<span class="datx-saved-dd">' + d.getDate() + '</span>';
        } else {
            // No parseable pickup (boards print "TBD" too) — say so instead of faking a date.
            box.innerHTML = '<span class="datx-saved-mon">NO</span><span class="datx-saved-dd">—</span>';
        }
        box.title = (l.platform === 'TRUCKSTOP' ? 'Truckstop' : 'DAT') +
            (l.pickupDate ? ' · pickup ' + l.pickupDate : '');
        return box;
    }

    function renderItem(l) {
        const box = document.createElement('div');
        box.className = 'datx-saved-item';
        box.appendChild(dateBlock(l));

        const main = document.createElement('div');
        main.className = 'datx-saved-main';

        const top = document.createElement('div');
        top.className = 'datx-saved-itemtop';

        const lane = document.createElement('div');
        lane.className = 'datx-saved-lane';
        lane.textContent = (l.origin || '?') + ' \u2192 ' + (l.destination || '?');
        top.appendChild(lane);

        // The differentiator gets the strong right-hand slot: how the lane moved since this was
        // saved. Without it the row would just be a bookmark like everyone else's.
        if (l.priceDelta != null) {
            const up = l.priceDelta > 0;
            const fig = document.createElement('span');
            fig.className = 'datx-saved-fig ' + (up ? 'is-up' : 'is-down');
            fig.textContent = (up ? '+' : '\u2212') + fmtUsd(Math.abs(l.priceDelta));
            fig.title = 'Lane now ' + fmtUsd(l.currentAvgPrice) + ', posted ' + fmtUsd(l.offerPrice);
            top.appendChild(fig);
        }
        main.appendChild(top);

        const meta = document.createElement('div');
        meta.className = 'datx-saved-meta';
        meta.textContent = [
            l.brokerName || 'Unknown broker',
            l.equipment || null,
            l.lengthFt ? l.lengthFt + ' ft' : null,
            l.brokerPhone || null
        ].filter(Boolean).join(' \u00b7 ');
        main.appendChild(meta);

        if (l.offerPrice != null || l.currentAvgPrice != null) {
            const price = document.createElement('div');
            price.className = 'datx-saved-price';
            price.textContent = l.offerPrice != null && l.currentAvgPrice != null
                ? 'Posted ' + fmtUsd(l.offerPrice) + ' \u00b7 lane now ' + fmtUsd(l.currentAvgPrice)
                : l.offerPrice != null
                    ? 'Posted ' + fmtUsd(l.offerPrice)
                    : 'Lane now ' + fmtUsd(l.currentAvgPrice);
            main.appendChild(price);
        }

        if (l.note) {
            const note = document.createElement('div');
            note.className = 'datx-saved-note';
            note.textContent = l.note;
            note.title = 'Click to edit';
            note.addEventListener('click', () => openNoteEditor(l, box));
            main.appendChild(note);
        }

        const acts = document.createElement('div');
        acts.className = 'datx-saved-acts';

        if (l.brokerEmail) {
            const send = iconBtn(IC_MAIL, 'Send email to ' + l.brokerEmail, function () {
                sendFromSaved(l, this);
            }, 'datx-saved-q is-primary');
            // No tooltip on the main action: it overlaps the row above and the icon is obvious.
            send.removeAttribute('data-tip');
            // Same hook the board's rows expose, so the shared template menu can drive this button
            // instead of us growing a second picker.
            send._tbSend = (templateId) => sendFromSaved(l, send, templateId);
            // A saved load is a follow-up, not a first quote — offer a one-off message next to the
            // templates. Board rows don't set this, so their menu is unchanged.
            send._tbExtra = {
                label: 'Custom message',
                hint: 'Write a one-off follow-up',
                onPick: () => openComposer(l, send)
            };
            acts.appendChild(send);
            if (typeof attachTemplateMoreButton === 'function') attachTemplateMoreButton(send);
            acts.appendChild(
                iconBtn(IC_COPY, 'Copy broker email', async function () {
                    try {
                        await navigator.clipboard.writeText(l.brokerEmail);
                        this.classList.add('is-done');
                        setTimeout(() => this.classList.remove('is-done'), 1200);
                    } catch { /* clipboard blocked */ }
                }, 'datx-saved-q')
            );
        }

        if (l.brokerPhone) {
            acts.appendChild(
                iconBtn(IC_PHONE, 'Copy phone', async function () {
                    try {
                        await navigator.clipboard.writeText(l.brokerPhone);
                        this.classList.add('is-done');
                        setTimeout(() => this.classList.remove('is-done'), 1200);
                    } catch { /* clipboard blocked */ }
                }, 'datx-saved-q' + (l.brokerEmail ? '' : ' is-primary'))
            );
        }

        // Always visible: hiding the note button made it undiscoverable, and a list you can't
        // annotate or prune at a glance is just a bookmark folder.
        const quiet = document.createElement('div');
        quiet.className = 'datx-saved-quiet';

        quiet.appendChild(
            iconBtn(IC_NOTE, l.note ? 'Edit note' : 'Add note', function () {
                openNoteEditor(l, box);
            }, 'datx-saved-q')
        );

        const del = iconBtn(IC_TRASH, 'Remove from saved', async function () {
            this.disabled = true;
            const r = await send({type: 'saved_load_remove', id: l.id});
            if (!r.ok) {
                this.disabled = false;
                toast('Could not remove', 'error');
                return;
            }
            byKey.delete(l.externalKey);
            laneCache = null;
            await writeCache();
            repaintStars();
            renderPanel();
            updateFab();
        }, 'datx-saved-q is-danger');
        quiet.appendChild(del);

        acts.appendChild(quiet);
        main.appendChild(acts);
        box.appendChild(main);
        return box;
    }

    /**
     * Inline note editor — opens inside the row so the dispatcher keeps the load in view while
     * writing. Enter saves, Escape cancels, blank clears the note.
     */
    function openNoteEditor(l, rowBox) {
        if (rowBox.querySelector('.datx-saved-noteedit')) return;

        const wrap = document.createElement('div');
        wrap.className = 'datx-saved-noteedit';

        const input = document.createElement('textarea');
        input.className = 'datx-saved-noteinput';
        input.rows = 2;
        input.maxLength = 500;
        input.value = l.note || '';
        input.placeholder = 'Spoke to Mike, asked for $2,900. Call back Friday.';
        wrap.appendChild(input);

        const row = document.createElement('div');
        row.className = 'datx-saved-noteacts';

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => wrap.remove());
        row.appendChild(cancel);

        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'is-primary';
        save.textContent = 'Save';
        const commit = async () => {
            save.disabled = true;
            save.textContent = 'Saving…';
            const r = await send({type: 'saved_load_note', id: l.id, note: input.value});
            if (!r.ok) {
                save.disabled = false;
                save.textContent = 'Save';
                toast('Could not save the note', 'error');
                return;
            }
            byKey.set(r.data.externalKey, r.data);
            await writeCache();
            renderPanel();
        };
        save.addEventListener('click', commit);
        row.appendChild(save);
        wrap.appendChild(row);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                wrap.remove();
            }
        });

        rowBox.querySelector('.datx-saved-main').appendChild(wrap);
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }

    // ---- custom message --------------------------------------------------

    /**
     * Prefilled follow-up for a load that was saved days ago. The text goes through the same
     * {{placeholder}} rendering as a template, so the signature fills itself.
     */
    function draftFor(l) {
        const lane = (l.origin || '') + ' \u2192 ' + (l.destination || '');
        return {
            subject: 'Following up \u2014 ' + lane,
            body:
                'Hi' + (l.brokerName ? ' ' + l.brokerName.split(/[\/,]/)[0].trim() : '') + ',\n\n' +
                'We covered ' + lane + (l.pickupDate ? ' around ' + l.pickupDate : '') +
                ' for you.\n' +
                'Do you have anything similar coming up next week? Happy to take it again.\n\n' +
                'Thanks,\n{{myName}} \u00b7 MC {{myMc}} \u00b7 {{myPhone}}'
        };
    }

    /** Drops text where the caret is and keeps focus there — not at the end of the field. */
    function insertAtCaret(field, text) {
        const start = field.selectionStart ?? field.value.length;
        const end = field.selectionEnd ?? start;
        field.value = field.value.slice(0, start) + text + field.value.slice(end);
        const at = start + text.length;
        field.focus();
        field.setSelectionRange(at, at);
    }

    function openComposer(l, sendBtn) {
        if (!panelEl) return;
        panelEl.querySelectorAll('.datx-saved-composer,.datx-saved-backdrop').forEach((n) => n.remove());

        const draft = draftFor(l);
        const box = document.createElement('div');
        box.className = 'datx-saved-composer';

        // Head -------------------------------------------------------------
        const head = document.createElement('div');
        head.className = 'datx-saved-chead';
        const to = document.createElement('span');
        to.className = 'datx-saved-cto';
        to.innerHTML = '<span class="datx-saved-ckicker">To</span>' +
            '<span class="datx-saved-caddr"></span>';
        to.querySelector('.datx-saved-caddr').textContent = l.brokerEmail || 'broker';
        head.appendChild(to);

        const close = () => {
            panelEl.querySelectorAll('.datx-saved-backdrop').forEach((n) => n.remove());
            box.remove();
        };
        const x = iconBtn(IC_CLOSE, 'Close', close, 'datx-saved-cclose');
        x.removeAttribute('data-tip');
        head.appendChild(x);
        box.appendChild(head);

        // Fields -----------------------------------------------------------
        const fields = document.createElement('div');
        fields.className = 'datx-saved-cfields';

        const subject = document.createElement('input');
        subject.type = 'text';
        subject.className = 'datx-saved-cinput';
        subject.value = draft.subject;
        subject.setAttribute('aria-label', 'Subject');
        fields.appendChild(subject);

        const body = document.createElement('textarea');
        body.className = 'datx-saved-carea';
        body.rows = 10;
        body.value = draft.body;
        body.setAttribute('aria-label', 'Message');
        fields.appendChild(body);
        box.appendChild(fields);

        // Placeholders ------------------------------------------------------
        // Click-to-insert instead of asking anyone to memorise the syntax.
        let lastField = body;
        [subject, body].forEach((f) => f.addEventListener('focus', () => (lastField = f)));

        const chips = document.createElement('div');
        chips.className = 'datx-saved-chips';
        const label = document.createElement('span');
        label.className = 'datx-saved-chiplabel';
        label.textContent = 'Insert';
        chips.appendChild(label);

        [
            ['Name', 'myName'], ['MC', 'myMc'], ['Phone', 'myPhone'],
            ['Origin', 'origin'], ['Destination', 'destination'], ['Pickup', 'pickupDate'],
            ['Equipment', 'equipment'], ['Rate', 'rate']
        ].forEach(([title, key]) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'datx-saved-chipb';
            chip.textContent = title;
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                insertAtCaret(lastField, '{{' + key + '}}');
            });
            chips.appendChild(chip);
        });
        box.appendChild(chips);

        // Foot --------------------------------------------------------------
        const foot = document.createElement('div');
        foot.className = 'datx-saved-cfoot';

        const note = document.createElement('span');
        note.className = 'datx-saved-cnote';
        note.textContent = 'Filled in with this load\u2019s details when it sends.';
        foot.appendChild(note);

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', close);
        foot.appendChild(cancel);

        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'is-primary';
        go.textContent = 'Send';
        go.addEventListener('click', async () => {
            go.disabled = true;
            go.textContent = 'Sending…';
            const ok = await sendFromSaved(l, sendBtn, null, {
                subject: subject.value.trim(),
                body: body.value
            });
            if (ok) {
                close();
                return;
            }
            go.disabled = false;
            go.textContent = 'Send';
        });
        foot.appendChild(go);
        box.appendChild(foot);

        // Escape closes from anywhere inside the editor.
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
        });

        const backdrop = document.createElement('div');
        backdrop.className = 'datx-saved-backdrop';
        backdrop.addEventListener('click', close);
        panelEl.appendChild(backdrop);
        panelEl.appendChild(box);
        body.focus();
        body.setSelectionRange(body.value.length, body.value.length);
    }

    // ---- footer ----------------------------------------------------------

    function renderFoot() {
        const foot = document.createElement('div');
        foot.className = 'datx-saved-foot';
        if (byKey.size) {
            const clear = document.createElement('button');
            clear.type = 'button';
            clear.className = 'datx-saved-clear';
            clear.textContent = 'Remove all';
            // Two-step, in place: a confirm dialog over the board would be heavier than the action.
            clear.addEventListener('click', () => {
                if (clear.dataset.armed === '1') {
                    clearAll(clear);
                    return;
                }
                clear.dataset.armed = '1';
                clear.textContent = 'Remove all ' + byKey.size + '? Click again';
                setTimeout(() => {
                    if (!clear.isConnected) return;
                    clear.dataset.armed = '';
                    clear.textContent = 'Remove all';
                }, 4000);
            });
            foot.appendChild(clear);
        }
        return foot;
    }

    async function clearAll(btn) {
        btn.disabled = true;
        btn.textContent = 'Removing…';
        const r = await send({type: 'saved_loads_clear'});
        if (!r.ok) {
            btn.disabled = false;
            btn.dataset.armed = '';
            btn.textContent = 'Remove all';
            toast('Could not clear the list', 'error');
            return;
        }
        indexList([]);
        await writeCache();
        selectedDay = null;
        repaintStars();
        renderPanel();
        updateFab();
    }

    // ---- boot ------------------------------------------------------------

    const ready = (async () => {
        await readPrefs();
        await readCache();
        ensureFab();
        repaintStars();
        await refresh();
    })();

    window.tbSaved = {
        ready, isSaved, keyFor, toggle, refresh, buildStarButton, openPanel,
        injectStarOnlyRow, refreshStarOnlyRow
    };
})();
