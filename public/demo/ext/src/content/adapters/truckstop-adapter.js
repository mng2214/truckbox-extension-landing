/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
// =========================================================================
// Truckstop (main.truckstop.com) site adapter.
//
// SLICE 1 — email button only. On Truckstop the loads list is an AG-Grid
// virtualized table whose rows carry NO broker email/phone; the broker's
// contact (email/phone/MC/DOT) lives ONLY in the left detail side panel
// (shared-broker-details) of the currently-open load. So for this first slice
// we light up exactly one thing: the inline "Send" button next to the broker
// email in that panel. It reuses the existing, selector-driven pipeline —
// ensureEmailButtonsInDetails() scans DETAILS_EMAIL_SEL each tick and mounts
// buildSendButton() next to every mailto it finds. No new injection code.
//
// IMPORTANT: every selector the modules read (republished by adapter-loader.js)
// must be a VALID, NON-EMPTY string. document.querySelector('') throws a
// SyntaxError and would abort scanOnce() before it reaches the details-email
// scan. So selectors we haven't implemented yet are set to TS_NONE — a valid
// selector that matches nothing — instead of ''. The per-row loop in
// scanOnce() therefore iterates zero rows (ROW_SEL matches nothing) and never
// touches the not-yet-real cell selectors. Fill these in for the next slices
// (per-row capture / parseLoad into the canonical load format).
// =========================================================================
(function () {
    // Valid selector that intentionally matches nothing (placeholder for the
    // selectors we haven't wired up yet). Keeps querySelector* from throwing.
    var TS_NONE = '.tb-ts-unset';

    var TRUCKSTOP_SELECTORS = {
        EMAIL_RE: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i, // generic, safe; brokers often type in CAPS
        INJECT_ATTR: 'data-datx-injected',

        // The detail side panel watched by getResultsRoot()/observers. The email
        // we target lives inside mat-sidenav-container; load-search-grid keeps
        // the list in scope for later slices.
        RESULTS_ROOT_SELECTORS: 'mat-sidenav-container, load-search-grid',

        // The broker email anchor lives inside an overflow:hidden .truncate
        // wrapper, so a button placed next to it gets clipped. We mount the Send
        // button in the email-row ICON slot instead (EMAIL_ICON_SEL below), so
        // the generic next-to-mailto scan is left off here.
        DETAILS_EMAIL_SEL: TS_NONE,

        // Email-row icon in the broker detail panel. ensureEmailIconButtons()
        // reads the row's mailto and replaces this envelope icon with our Send
        // button (the icon slot is NOT truncated, so the button stays visible).
        EMAIL_ICON_SEL: '[data-testid="email-icon"]',

        // --- Not implemented in this slice: kept as valid no-match selectors. ---
        DETAILS_COMMENT_SEL: TS_NONE,
        CONTACT_BLOCK_SEL: TS_NONE,
        ROW_SEL: TS_NONE,           // keeps the per-row loop empty (see header)
        COMPANY_CELL_SEL: TS_NONE,
        ROUTE_CELL_SEL: TS_NONE,
        ORIGIN_CELL_SEL: TS_NONE,
        DEST_CELL_SEL: TS_NONE,
        PICKUP_CELL_SEL: TS_NONE,
        EQUIP_CELL_SEL: TS_NONE,
        LENGTH_CELL_SEL: TS_NONE,
        WEIGHT_CELL_SEL: TS_NONE,
        RATE_CELL_SEL: TS_NONE,
        DTP_CELL_SEL: TS_NONE,
        DETAILS_PANEL_SEL: TS_NONE,
        DETAILS_COLUMN_SEL: TS_NONE
    };

    // ---- Email-template fields, read from the OPEN load detail panel ----------
    // Truckstop carries no per-row data: the load's fields live only in the
    // detail panel that GetLoadById fills on expand. The Send button calls this
    // (via buildContext's adapter hook) to populate the same dynamic fields the
    // DAT path reads from row cells. All targets use stable data-testid hooks
    // inside load-search-load-details-general-details-tab.
    var TS_PANEL_SEL = 'load-search-load-details-general-details-tab';

    function tsText(el) {
        return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
    }

    // The panel the Send button belongs to. closest() first (handles multiple
    // open panels); fall back to the button's root, then the document.
    function tsPanel(anchorEl) {
        var root = anchorEl && anchorEl.getRootNode ? anchorEl.getRootNode() : document;
        return (anchorEl && anchorEl.closest && anchorEl.closest(TS_PANEL_SEL)) ||
            (root && root.querySelector && root.querySelector(TS_PANEL_SEL)) ||
            document.querySelector(TS_PANEL_SEL);
    }

    function tsTestId(panel, id) {
        return panel ? panel.querySelector('[data-testid="' + id + '"]') : null;
    }

    // Number-only text: drop the grey unit spans (" mi", " lbs", " L") so
    // length/weight come back as "41'" / "67,241" rather than "41' L".
    function tsNum(el) {
        if (!el) return null;
        var c = el.cloneNode(true);
        c.querySelectorAll('.text-secondary-500').forEach(function (s) { s.remove(); });
        return tsText(c) || null;
    }

    function tsBuildEmailContext(anchorEl, email) {
        var panel = tsPanel(anchorEl);
        if (!panel) {
            return {
                email: email, origin: null, destination: null, pickupDate: null,
                brokerName: null, rate: null, equipment: null, length: null,
                weight: null, loadId: null
            };
        }

        // Origin holds a nested deadhead span ("75 mi") — strip it before reading.
        var origin = null;
        var originEl = tsTestId(panel, 'origin-location');
        if (originEl) {
            var oc = originEl.cloneNode(true);
            var dh = oc.querySelector('[data-testid="origin-deadhead"]');
            if (dh) dh.remove();
            origin = tsText(oc) || null;
        }
        var destination = tsText(tsTestId(panel, 'destination-location')) || null;

        // Posted rate "$10,500" -> "$10500" (first dollar amount, no separators).
        var rate = null;
        var rateEl = tsTestId(panel, 'posted-rate');
        var rateTxt = rateEl ? tsText(rateEl.querySelector('.tsx-h6') || rateEl) : '';
        var rm = rateTxt.match(/\$\s*[\d,]+(?:\.\d{1,2})?/);
        if (rm) rate = rm[0].replace(/[\s,]/g, '');

        // Pickup row: the .load-date-wrapper row whose title is "Pickup".
        var pickupDate = null;
        var rows = panel.querySelectorAll('.load-date-wrapper__row');
        for (var i = 0; i < rows.length; i++) {
            if (/pickup/i.test(tsText(rows[i].querySelector('.load-date-wrapper__cell-title')))) {
                pickupDate = tsText(rows[i].querySelector('.load-date-wrapper__cell-value')) || null;
                break;
            }
        }

        // Load number lives in the free-text notes ("Load number: 1256792;").
        var loadId = null;
        var lm = tsText(panel.querySelector('.notes-values')).match(/load\s*number[:\s]*([0-9]+)/i);
        if (lm) loadId = lm[1];

        return {
            email: email,
            origin: origin,
            destination: destination,
            pickupDate: pickupDate,
            brokerName: tsText(tsTestId(panel, 'company-name')) || null,
            rate: rate,
            equipment: tsText(tsTestId(panel, 'equipment')) || null,
            length: tsNum(tsTestId(panel, 'length')),
            weight: tsNum(tsTestId(panel, 'weight')),
            loadId: loadId
        };
    }

    // City,ST of the pickup, with the deadhead span ("75 mi") stripped out.
    function tsPickupCity(panel) {
        var el = tsTestId(panel, 'origin-location');
        if (!el) return null;
        var c = el.cloneNode(true);
        var dh = c.querySelector('[data-testid="origin-deadhead"]');
        if (dh) dh.remove();
        return tsText(c) || null;
    }

    // Full text referenced by aria-describedby (the search tab truncates its own
    // text node to "Chicago, I...", but the linked tooltip holds "Chicago, IL").
    function tsResolveAria(el) {
        var ids = el && el.getAttribute && el.getAttribute('aria-describedby');
        if (!ids) return null;
        ids = ids.split(/\s+/);
        for (var i = 0; i < ids.length; i++) {
            var v = tsText(document.getElementById(ids[i]));
            if (v) return v;
        }
        return null;
    }

    // The carrier's truck location = the Origin of the ACTIVE search tab. The tab
    // label is truncated, so prefer its aria tooltip; fall back to the (de-dead-
    // headed) node text. Returns null (→ 2-point route) if it isn't a "City, ST".
    function tsSearchOrigin(root) {
        var sel = '.mat-tab-link.mat-tab-label-active';
        var scope = (root && root.querySelector && root.querySelector(sel)) ||
            document.querySelector(sel) ||
            (typeof tbDeepQueryShadow === 'function' ? tbDeepQueryShadow(sel)[0] : null);
        var el = scope && scope.querySelector('[data-testid="origin-location"]');
        if (el) {
            var v = tsResolveAria(el);
            if (!v) {
                var c = el.cloneNode(true);
                var dh = c.querySelector('[data-testid="origin-deadhead"]');
                if (dh) dh.remove();
                v = tsText(c);
            }
            if (v && /[A-Za-z].*,\s*[A-Z]{2}/.test(v)) return v;
        }
        // Fallback: a plain search Origin input, if the UI exposes one.
        var inp = document.querySelector(
            'input[data-testid="origin-input"], input[data-test="origin-input"], ' +
            'input[aria-label*="Origin" i], input[placeholder*="Origin" i]'
        );
        var iv = inp && (inp.value || '').trim();
        return (iv && /[A-Za-z].*,\s*[A-Z]{2}/.test(iv)) ? iv : null;
    }

    // Map button under the native detail map: truck → pickup → delivery.
    function tsBuildMapRoute(panelOrAnchor) {
        var panel = (panelOrAnchor && panelOrAnchor.closest &&
            panelOrAnchor.closest(TS_PANEL_SEL)) || tsPanel(panelOrAnchor);
        if (!panel) return null;
        return {
            truck: tsSearchOrigin(panel.getRootNode && panel.getRootNode()),
            origin: tsPickupCity(panel),
            dest: tsText(tsTestId(panel, 'destination-location')) || null
        };
    }

    // ---- List-grid capture (source:"list") ------------------------------------
    // The AG-Grid list lives in the Shadow DOM and addresses cells by col-id.
    // captureRows() shadow-pierces (load-capture reads it instead of a plain
    // document query); parseLoad() turns one row into a canonical capture item.
    // ROW_SEL stays TS_NONE so the DAT per-row UI loop never touches these rows.
    var TS_GRID_ROW_SEL = '.ts-grid-row';

    function tsCell(row, colId) {
        var el = row.querySelector('[col-id="' + colId + '"]');
        return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
    }
    function tsInt(s) {
        var m = String(s == null ? '' : s).replace(/,/g, '').match(/-?\d+/);
        return m ? parseInt(m[0], 10) : null;
    }
    function tsMoneyInt(s) {
        var m = String(s == null ? '' : s).replace(/[,\s]/g, '').match(/\$?(\d+(?:\.\d+)?)/);
        return m ? Math.round(parseFloat(m[1])) : null;
    }
    function tsFloat(s) {
        var m = String(s == null ? '' : s).replace(/[,\s$]/g, '').match(/-?\d+(?:\.\d+)?/);
        return m ? parseFloat(m[0]) : null;
    }
    function tsCityState(city, st) {
        city = (city || '').trim();
        st = (st || '').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
        if (!city && !st) return null;
        return city + (city && st ? ', ' : '') + st;
    }

    function tsParseGridRow(row) {
        if (!(row instanceof Element)) return null;
        var origin = tsCityState(tsCell(row, 'originCity'), tsCell(row, 'originState'));
        var dest = tsCityState(tsCell(row, 'destinationCity'), tsCell(row, 'destinationState'));
        if (!origin || !dest) return null; // loading/placeholder row → skip

        var item = {
            source: 'list',
            platform: 'TRUCKSTOP',
            refId: row.getAttribute('row-id') || null,
            rowDomId: row.getAttribute('row-id') || null,
            origin: origin,
            destination: dest,
            equipment: tsCell(row, 'equipmentCode') || null,
            offerPrice: tsMoneyInt(tsCell(row, 'postedRate')),
            ratePerMile: tsFloat(tsCell(row, 'rpm')),
            tripMiles: tsInt(tsCell(row, 'tripDistance')),
            deadheadMiles: tsInt(tsCell(row, 'originDeadhead')),
            weightLbs: tsInt(tsCell(row, 'dimensionsWeight')),
            lengthFt: tsInt(tsCell(row, 'dimensionsLength')),
            pickupRaw: tsCell(row, 'originEarlyTime') || null,
            brokerName: tsCell(row, 'accountName') || null,
            brokerNameRaw: tsCell(row, 'accountName') || null
        };

        // Truckstop-only extras → preserved server-side in raw JSONB via `extra`.
        var daysToPay = tsInt(tsCell(row, 'daysToPay'));
        if (daysToPay != null) item.daysToPay = daysToPay;
        var grade = tsCell(row, 'experienceFactor');
        if (grade) item.creditGrade = grade;
        var dimW = tsInt(tsCell(row, 'dimensionsWidth'));
        if (dimW != null) item.dimWidthIn = dimW;
        var dimH = tsInt(tsCell(row, 'dimensionsHeight'));
        if (dimH != null) item.dimHeightIn = dimH;
        var views = tsCell(row, 'loadViews');
        if (views) item.loadViews = views;

        return item;
    }

    // Shadow-piercing row query for the capture loop (the grid is in a shadow
    // root, so document.querySelectorAll wouldn't see it).
    function tsCaptureRows() {
        if (typeof tbDeepQueryShadow === 'function') return tbDeepQueryShadow(TS_GRID_ROW_SEL);
        return Array.prototype.slice.call(document.querySelectorAll(TS_GRID_ROW_SEL));
    }

    // ---- Detail-panel capture (source:"detail") -------------------------------
    // The opened load's panel carries everything the grid lacks: broker MC /
    // email / phone / DOT. Normalization matches the (MC-less) broker created
    // from the grid by company name and enriches it (promotes MC, appends
    // email/phone). DOT + contact name + rich fields go to `extra` (raw JSONB).
    function tsDigits(el) {
        var m = el && String(el.textContent || '').match(/\d{4,9}/);
        return m ? m[0] : null;
    }
    function tsContact(el, scheme) {
        if (!el) return null;
        var v = (el.getAttribute('href') || el.textContent || '')
            .replace(new RegExp('^' + scheme + ':', 'i'), '').trim();
        return v || null;
    }
    function tsPickupRaw(panel) {
        var rows = panel.querySelectorAll('.load-date-wrapper__row');
        for (var i = 0; i < rows.length; i++) {
            if (/pickup/i.test(tsText(rows[i].querySelector('.load-date-wrapper__cell-title')))) {
                return tsText(rows[i].querySelector('.load-date-wrapper__cell-value')) || null;
            }
        }
        return null;
    }

    function tsParseDetailPanel(panel) {
        if (!(panel instanceof Element)) return null;
        var origin = tsPickupCity(panel);
        var dest = tsText(tsTestId(panel, 'destination-location')) || null;
        if (!origin || !dest) return null;

        var bp = panel.querySelector('shared-broker-details') || panel;
        var company = tsText(bp.querySelector('[data-testid="company-name"]')) || null;
        var loadNum = (tsText(panel.querySelector('.notes-values'))
            .match(/load\s*number[:\s]*([0-9]+)/i) || [])[1] || null;

        var rateEl = tsTestId(panel, 'posted-rate');
        var rateTxt = rateEl ? tsText(rateEl.querySelector('.tsx-h6') || rateEl) : '';

        var item = {
            source: 'detail',
            platform: 'TRUCKSTOP',
            refId: loadNum,
            rowDomId: loadNum,
            origin: origin,
            destination: dest,
            equipment: tsText(tsTestId(panel, 'equipment')) || null,
            offerPrice: tsMoneyInt(rateTxt),
            ratePerMile: tsFloat(tsText(tsTestId(panel, 'rate-per-mile'))),
            tripMiles: tsInt(tsText(tsTestId(panel, 'distance'))),
            deadheadMiles: tsInt(tsText(tsTestId(panel, 'origin-deadhead'))),
            weightLbs: tsInt(tsNum(tsTestId(panel, 'weight'))),
            lengthFt: tsInt(tsNum(tsTestId(panel, 'length'))),
            pickupRaw: tsPickupRaw(panel),
            brokerName: company,
            brokerNameRaw: company,
            mcNumber: tsDigits(bp.querySelector('[data-testid="contact-broker-mc"]')),
            contact: tsContact(bp.querySelector('[data-testid="contact-phone"]'), 'tel'),
            email: tsContact(bp.querySelector('[data-testid="contact-email"]'), 'mailto')
        };

        // Truckstop-only extras → raw JSONB (no broker columns for these yet).
        var dot = tsDigits(bp.querySelector('[data-testid="contact-dot"]'));
        if (dot) item.dot = dot;
        var contactName = tsText(bp.querySelector('[data-testid="broker-name"]'));
        if (contactName) item.contactName = contactName;
        var daysToPay = tsInt(tsText(bp.querySelector('[data-testid="days-to-pay"]')));
        if (daysToPay != null) item.daysToPay = daysToPay;
        var grade = tsText(bp.querySelector('[data-testid="experience-factor"]'));
        if (grade) item.creditGrade = grade;

        return item;
    }

    // Capture items for any open detail panel(s). Returns [] / [item...]; the
    // capture loop's session dedup (keyOf) ships each unique load once.
    function tsCaptureDetail() {
        var panels = (typeof tbDeepQueryShadow === 'function')
            ? tbDeepQueryShadow(TS_PANEL_SEL)
            : Array.prototype.slice.call(document.querySelectorAll(TS_PANEL_SEL));
        var out = [];
        for (var i = 0; i < panels.length; i++) {
            var it = tsParseDetailPanel(panels[i]);
            if (it) out.push(it);
        }
        return out;
    }

    var TRUCKSTOP_ADAPTER = {
        id: 'truckstop',
        hostMatches: function (host) { return host.endsWith('truckstop.com'); },
        isLoadsPage: function () {
            if (!location.hostname.endsWith('truckstop.com')) return false;
            // SPA route is /app/search/loads; fall back to the page's own
            // markers so we still match if the route shape changes.
            if (/\/search\/loads/i.test(location.pathname)) return true;
            return !!document.querySelector('load-search-grid, load-search-load-search-sidenav');
        },
        selectors: TRUCKSTOP_SELECTORS,
        buildEmailContext: tsBuildEmailContext,  // Send button pulls template fields from the panel
        buildMapRoute: tsBuildMapRoute,          // route button under the native detail map
        parseLoad: tsParseGridRow,               // capture: one AG-Grid row → canonical item
        captureRows: tsCaptureRows,              // capture: shadow-piercing row query
        captureDetail: tsCaptureDetail,          // capture: open detail panel(s) → broker-rich items
        collectLoad: function () {}               // TODO
    };

    (window.TB_ADAPTERS = window.TB_ADAPTERS || []).push(TRUCKSTOP_ADAPTER);
})();
