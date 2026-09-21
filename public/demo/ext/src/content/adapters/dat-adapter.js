/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
// =========================================================================
// DAT (one.dat.com) site adapter.
//
// Holds every DAT-specific selector and the loads-page detector. These strings
// were moved verbatim from ui-injector.js so DAT behaviour is unchanged — the
// modules still read them, now via the globals adapter-loader.js republishes.
// =========================================================================
(function () {
    var DAT_SELECTORS = {
        EMAIL_RE: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i, // brokers often type addresses in CAPS

        INJECT_ATTR: 'data-datx-injected',

        RESULTS_ROOT_SELECTORS:
            '[data-test="search-loads-results"], [data-test="loads-results"], .results-container, #search-results',

        DETAILS_COMMENT_SEL: [
            '.notes-contents',
            '[data-test="comments-container"]',
            '[class*="comments-container"]'
        ].join(','),

        DETAILS_EMAIL_SEL: [
            '.table-row-detail a[href^="mailto:"]',
            'dat-load-details a[href^="mailto:"]',
            '.contact-methods a[href^="mailto:"]',
            '.contacts_email a[href^="mailto:"]',
            '.contacts__email a[href^="mailto:"]',
            // New DAT: the CONTACT INFORMATION email is a web component (no mailto).
            'dat-load-details connected-email-contact-details[recipient-email]',
            '.table-row-detail connected-email-contact-details[recipient-email]'
        ].join(','),

        // DAT list rows no longer carry an <a href="mailto:">: the contact is a
        // <connected-email-contact-link> web component (visible text in a shadow
        // root) and the address only lives in its `recipient-email` attribute.
        // The compose button carries the same attribute (narrow layout).
        EMAIL_ATTR_SEL: [
            'connected-email-contact-link[recipient-email][is-email="true"]',
            'connected-email-compose-email-button[recipient-email]',
            '[data-test="connected-email-compose-button"][recipient-email]',
            'connected-email-contact-details[recipient-email]'
        ].join(','),

        // The CONTACT INFORMATION block(s). A free-text email here counts as a
        // real contact; a free-text email in the COMMENTS block does NOT.
        CONTACT_BLOCK_SEL: [
            'dat-contacts',
            '.contacts',
            '.contact-methods',
            '.contacts__email',
            '.contacts_email',
            '[data-test="contact-information-container"]'
        ].join(','),

        ROW_SEL: [
            '.row-container[id^="table-row-"]',
            'tr.mat-row.cdk-row',
            '[role="row"].mat-row'
        ].join(','),

        COMPANY_CELL_SEL: [
            '.cell-company,[class*="cell-company"]',
            'td.mat-cell.mat-column-company',
            '[class*="mat-column-company"]'
        ].join(','),

        ROUTE_CELL_SEL: [
            '.cell-route,[class*="cell-route"]',
            'td.mat-cell.mat-column-origin-destination',
            '[class*="mat-column-origin-destination"]'
        ].join(','),

        ORIGIN_CELL_SEL: [
            '[data-test="load-origin-cell"]',
            'td.mat-cell.mat-column-origin,[class*="mat-column-origin"]'
        ].join(','),

        DEST_CELL_SEL: [
            '[data-test="load-destination-cell"]',
            'td.mat-cell.mat-column-destination,[class*="mat-column-destination"]'
        ].join(','),

        PICKUP_CELL_SEL: [
            '.cell-timing,[class*="cell-timing"]',
            '[data-test="load-pick-up-cell"]',
            'td.mat-cell.mat-column-earliest-pickup',
            'td.mat-cell.mat-column-pickup',
            'td.mat-cell.mat-column-earliest-latest-pickup',
            '[class*="mat-column-earliest-pickup"]',
            '[class*="mat-column-earliest-latest-pickup"]'
        ].join(','),

        EQUIP_CELL_SEL: [
            '.cell-equipment,[class*="cell-equipment"]',
            'td.mat-cell.mat-column-equipment',
            '[class*="mat-column-equipment"]'
        ].join(','),

        LENGTH_CELL_SEL: [
            '.cell-length,[class*="cell-length"]',
            'td.mat-cell.mat-column-trip-length',
            '[class*="mat-column-trip-length"]'
        ].join(','),

        WEIGHT_CELL_SEL: [
            '.cell-weight,[class*="cell-weight"]',
            'td.mat-cell.mat-column-weight',
            '[class*="mat-column-weight"]'
        ].join(','),

        RATE_CELL_SEL: [
            '.cell-rate,[class*="cell-rate"]',
            'td.mat-cell.mat-column-rate-per-mile',
            '[class*="mat-column-rate-per-mile"]'
        ].join(','),

        // DAT "CS / DTP" column cell — where row send/copy buttons are mounted.
        DTP_CELL_SEL: '[data-test="load-cs-dtp-cell"]',

        // Open load-detail panel(s), and the column inside it to append into.
        // Lane analytics mounts here (platform-agnostic code reads these).
        DETAILS_PANEL_SEL: 'dat-load-details, .table-row-detail',
        DETAILS_COLUMN_SEL: '.details-column'
    };

    var DAT_ADAPTER = {
        id: 'dat',
        hostMatches: function (host) { return host.endsWith('dat.com'); },
        isLoadsPage: function () {
            return location.hostname.endsWith('dat.com') &&
                location.pathname.includes('/search-loads');
        },
        selectors: DAT_SELECTORS,
        // Parse one load-board row into the backend /analytics/loads item shape.
        // Reads the precise DAT `data-test` cells (so broker name / contact never
        // get glued together), and — when the row is expanded — also harvests the
        // detail panel (MC, market rates, stars, factoring, commodity, ref id).
        parseLoad: function (row) {
            try {
                if (!(row instanceof Element)) return null;

                var t = function (el) {
                    return el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '';
                };
                var q = function (sel) { return row.querySelector(sel); };
                var intOf = function (s) {
                    if (s == null) return null;
                    var m = String(s).match(/-?[\d,]+/);
                    if (!m) return null;
                    var n = parseInt(m[0].replace(/,/g, ''), 10);
                    return isNaN(n) ? null : n;
                };
                var numOf = function (s) {
                    if (s == null) return null;
                    var m = String(s).match(/-?\d+(?:\.\d+)?/);
                    if (!m) return null;
                    var n = parseFloat(m[0]);
                    return isNaN(n) ? null : n;
                };

                // Origin / destination — prefer the full "City, ST" expanded label.
                var origin = t(q('.route-dh-container-lg .origin .extended-trip-point'))
                    || t(q('[data-test="load-origin-cell"]')) || null;
                var destination = t(q('.route-dh-container-lg .destination .extended-trip-point'))
                    || t(q('[data-test="load-destination-cell"]')) || null;

                // Contact cell: mailto => email, tel => phone.
                var email = null, contact = null;
                var ca = q('[data-test="load-contact-cell"]');
                if (ca) {
                    // <a href> (old) or <connected-email-contact-link href-value> (new).
                    var href = (ca.getAttribute('href') || ca.getAttribute('href-value') || '');
                    if (/^mailto:/i.test(href)) {
                        email = href.replace(/^mailto:/i, '').trim().toLowerCase();
                    } else if (/^tel:/i.test(href)) {
                        var ph = t(ca) || href.replace(/^tel:/i, '').trim(); // web component text is in a shadow root
                        contact = (typeof normalizePhoneFromText === 'function')
                            ? (normalizePhoneFromText(ph) || ph) : ph;
                    } else {
                        var ce = t(ca);
                        if (/@/.test(ce)) email = ce.toLowerCase();
                        else if (/\d/.test(ce)) contact = ce;
                    }
                }

                var item = {
                    source: 'list',
                    seenAt: new Date().toISOString(),
                    rowDomId: row.id || null,
                    age: t(q('[data-test="load-age-cell"]')) || null,
                    offerPrice: intOf(t(q('[data-test="load-rate-cell"] .offer'))),
                    ratePerMile: numOf(t(q('[data-test="load-rate-cell"] .calculated-rate'))),
                    origin: origin,
                    destination: destination,
                    tripMiles: intOf(t(q('[data-test="load-trip-cell"]'))),
                    deadheadMiles: intOf(t(q('[data-test="load-dho-cell"]'))),
                    equipment: t(q('[data-test="load-eq-cell"]')) || null,
                    weightLbs: intOf(t(q('[data-test="load-weight-cell"]'))),
                    lengthFt: intOf(t(q('[data-test="load-length-cell"]'))),
                    fullPartial: t(q('[data-test="load-capacity-cell"]')) || null,
                    pickupRaw: t(q('[data-test="load-pick-up-cell"]')) || null,
                    brokerNameRaw: t(q('[data-test="load-company-cell"]')) || null,
                    creditScore: intOf(t(q('[data-test="load-cs-dtp-cell"] > div'))),
                    daysToPay: intOf(t(q('[data-test="load-cs-dtp-cell"] .days-to-pay'))),
                    email: email,
                    contact: contact
                };

                // Expanded? Harvest the detail panel for the rich broker/market data.
                var detail = q('dat-load-details');
                if (detail) {
                    item.source = 'detail';
                    var dq = function (sel) { return detail.querySelector(sel); };

                    var fullName = t(dq('dat-company .company-details'));
                    if (fullName) item.brokerName = fullName;

                    var spacings = detail.querySelectorAll('dat-company .city-spacing');
                    for (var i = 0; i < spacings.length; i++) {
                        var sp = t(spacings[i]);
                        var mc = sp.match(/MC#?\s*(\d+)/i);
                        if (mc) item.mcNumber = mc[1];
                        else if (/,\s*[A-Z]{2}\b/.test(sp)) item.brokerCityState = sp;
                    }

                    var dm = dq('dat-company a[href^="mailto:"]') || dq('dat-contacts a[href^="mailto:"]');
                    if (dm) {
                        var de = (dm.getAttribute('href') || '').replace(/^mailto:/i, '').trim().toLowerCase();
                        if (de) item.email = de;
                    }

                    var stars = detail.querySelectorAll('dat-company-ratings [data-mat-icon-name="star-dark"]');
                    if (stars && stars.length) item.brokerStars = stars.length;
                    var rev = t(dq('dat-company .reviews')).match(/(\d+)/);
                    if (rev) item.brokerReviews = parseInt(rev[1], 10);

                    if (dq('dat-outgo-badge')) item.factoringEligible = true;

                    var drows = detail.querySelectorAll('dat-equipment .data-row');
                    for (var j = 0; j < drows.length; j++) {
                        var lbl = t(drows[j].querySelector('.data-label'));
                        var val = t(drows[j].querySelector('.data-item'));
                        if (!val || val === '–' || val === '-') continue;
                        if (/commodity/i.test(lbl)) item.commodity = val;
                        else if (/reference id/i.test(lbl)) item.refId = val;
                    }

                    var cm = t(dq('dat-notes .notes-contents'));
                    if (cm) item.comments = cm;

                    var spot = dq('dat-search-market-rates .details-container.spot');
                    if (spot) {
                        item.marketSpot = intOf(t(spot.querySelector('.rate-data')));
                        var rg = t(spot.querySelector('.range-data'))
                            .match(/\$?\s*([\d,]+)\s*[-–]\s*\$?\s*([\d,]+)/);
                        if (rg) {
                            item.marketLow = parseInt(rg[1].replace(/,/g, ''), 10);
                            item.marketHigh = parseInt(rg[2].replace(/,/g, ''), 10);
                        }
                    }
                }

                // Only worth storing if it has a lane or a broker.
                if (!item.origin && !item.destination && !item.brokerNameRaw && !item.brokerName) {
                    return null;
                }
                return item;
            } catch (e) {
                return null;
            }
        },
        collectLoad: function () {}
    };

    (window.TB_ADAPTERS = window.TB_ADAPTERS || []).push(DAT_ADAPTER);
})();
