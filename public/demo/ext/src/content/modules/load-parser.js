// Keeps a row's CS-DTP-cell email button in sync with the load's *actual* email.
// An email counts only if it belongs to THIS load: shown in the row itself, or
// inside this row's expanded details panel. A collapsed posting's next sibling
// is another load, so we never read it — that was the "button on a phone-only /
// unopened load, pointing at the neighbour's email" bug. No email => no button.
function reconcileRowEmailButton(row) {
    if (!(row instanceof Element)) return;

    let email = null;
    let anchor = null;

    // 1) A real contact email in the row itself (mailto / contact block).
    const inRow = findContactEmail(row);
    if (inRow?.email) {
        email = inRow.email;
        anchor = inRow.anchor;
    } else {
        // 2) A real contact email inside THIS row's expanded details (mailto or
        //    the CONTACT INFORMATION block) — never a free-text comment email.
        const details = getRowDetailsElement(row);
        if (details) {
            const inside = findContactEmail(details);
            if (inside?.email) email = inside.email;
        }
    }

    if (email) {
        const host = anchor || row.querySelector(DTP_CELL_SEL) || row;
        injectButton(host, row, email); // creates the button, or updates its email in place
        return;
    }

    // Phone-only rows still deserve the star (and a copy-phone) — they used to get nothing.
    // Refresh in place when we already own this row: the board recycles rows while scrolling.
    if (window.tbSaved && window.tbSaved.refreshStarOnlyRow(row)) return;

    removeRowButton(row);
    if (window.tbSaved) window.tbSaved.injectStarOnlyRow(row);

    // No email: keep the score column clean by hiding the native CS / DTP
    // values too. Gated on DTP_CELL_SEL so it only runs on sites that have that
    // column (DAT today) — on others the selector is empty and we skip it.
    if (DTP_CELL_SEL) clearCsDtpValuesForRow(row);
}

// Removes our injected CS-DTP button group and restores the native CS / DTP
// score values that placeRowButtons() had hidden. No-ops on rows we never
// touched, so it never disturbs an untouched cell.
function removeRowButton(row) {
    if (!(row instanceof Element)) return;

    const groups = row.querySelectorAll('.datx-cs-actions');
    if (!groups.length) return;

    groups.forEach((g) => g.remove());

    const cell = row.querySelector(DTP_CELL_SEL);
    if (!cell) return;

    cell.querySelectorAll(':scope > div').forEach((d) => {
        if (d.style.display === 'none') d.style.display = '';
    });
    cell.style.display = '';
    cell.style.alignItems = '';
    cell.style.justifyContent = '';
    cell.style.paddingLeft = '';
    cell.style.paddingRight = '';
}

function getTopPostedOrigin() {
    const el = document.querySelector('input[data-test="origin-input"]');
    if (!el) return null;
    const val = (el.value || '').trim();
    return /[A-Za-z].*,\s*[A-Z]{2}/.test(val) ? normalizePlace(val) : null;
}

function buildMapsLink(start, waypoint, dest) {
    const p = new URLSearchParams();
    if (start) p.set('origin', start);
    if (dest) p.set('destination', dest);
    if (start && waypoint && dest) p.set('waypoints', waypoint);
    return `https://www.google.com/maps/dir/?api=1&${p.toString()}`;
}

function readCityState(cell) {
    if (!cell) return null;

    const cityEl = cell.querySelector('.city,[class*="city"]');
    const stateEl = cell.querySelector('.state,[class*="state"]');
    const city = cityEl?.textContent?.trim();
    const state = stateEl?.textContent?.trim();
    if (city || state) {
        const s = (state || '').replace(/[^A-Z]/g, '').slice(0, 2);
        const val = `${city || ''}${city && s ? ', ' : ''}${s || ''}`.trim();
        return normalizePlace(val);
    }

    const dc = cell.getAttribute('data-city');
    const ds = cell.getAttribute('data-state');
    if (dc || ds) return normalizePlace(`${(dc || '').trim()}${dc && ds ? ', ' : ''}${(ds || '').trim()}`);

    const raw = (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim();

    let m = raw.match(/([A-Za-z.'\- ]+?),\s*([A-Z]{2})(?![A-Za-z])/);
    if (m) return `${m[1].trim()}, ${m[2]}`;
    m = raw.match(/([A-Za-z.'\- ]+)\s+([A-Z]{2})(?![A-Za-z])/);
    if (m) return `${m[1].trim()}, ${m[2]}`;

    const prevTxt = cell.previousElementSibling?.textContent?.trim();
    if (/^[A-Z]{2}$/.test(raw) && prevTxt && /[A-Za-z]/.test(prevTxt)) {
        return `${prevTxt.replace(/\s+/g, ' ').trim()}, ${raw}`;
    }
    return normalizePlace(raw) || null;
}

// FUTURE: this is the natural body for the active adapter's parseLoad(row) once
// the load/broker collection feature lands — it already extracts structured
// load data (origin, destination, rate, equipment, broker, ...) from a row.
// DAT board Reference ID — only present in the EXPANDED detail panel, so it's
// null for a collapsed load. Markup: <div class="data-row"><div class="data-label">
// Reference ID</div><div class="data-item">12149270</div></div>.
function readRefId(row) {
    if (!(row instanceof Element)) return null;

    // The Send button may resolve `row` to an inner <mat-row> whose detail panel
    // is a sibling, so re-root on the outer .row-container that holds the panel.
    const scope = row.closest('.row-container[id^="table-row-"]') || row;
    const detail =
        scope.querySelector('dat-load-details') ||
        scope.querySelector('.table-row-detail') ||
        scope;

    const rows = detail.querySelectorAll('.data-row');
    for (let i = 0; i < rows.length; i++) {
        const lbl = text(rows[i].querySelector('.data-label'));
        if (/reference id/i.test(lbl)) {
            const val = text(rows[i].querySelector('.data-item'));
            if (val && val !== '–' && val !== '-') return val;
        }
    }
    return null;
}

function buildContext(row, email) {
    if (!(row instanceof Element)) {
        return {
            email,
            origin: null,
            destination: null,
            pickupDate: null,
            brokerName: null,
            rate: null,
            equipment: null,
            length: null,
            weight: null,
            referenceId: null,
            loadId: null
        };
    }

    let origin = readCityState(row.querySelector(ORIGIN_CELL_SEL));
    let destination = readCityState(row.querySelector(DEST_CELL_SEL));

    const routeTxt = text(row.querySelector(ROUTE_CELL_SEL));
    const byPairs = routeCityStateFallback(routeTxt);
    const bySplit = parseRoute(routeTxt);

    if (!origin) origin = byPairs.origin || bySplit.origin || origin;
    if (!destination) destination = byPairs.destination || bySplit.destination || destination;

    if (isOnlyState(origin) && byPairs.origin) origin = byPairs.origin;
    if (isOnlyState(destination) && byPairs.destination) destination = byPairs.destination;

    origin = normalizePlace(origin);
    destination = normalizePlace(destination);

    const pickupDate = normalizePickup(text(row.querySelector(PICKUP_CELL_SEL))) || null;

    const equipCell = row.querySelector(EQUIP_CELL_SEL);
    const equipRaw = text(equipCell);
    const equipment = extractEquipShort(equipRaw);

    let length = text(row.querySelector(LENGTH_CELL_SEL)) || '';
    let weight = text(row.querySelector(WEIGHT_CELL_SEL)) || '';

    if (!length || !/\d/.test(length) || !/ft\b/i.test(length)) {
        const fromEq = extractLenWtCapFromEquip(equipRaw);
        if (fromEq.length) length = fromEq.length;
        if (!weight && fromEq.weight) weight = fromEq.weight;
    }

    return {
        email,
        origin,
        destination,
        pickupDate,
        brokerName: text(row.querySelector(COMPANY_CELL_SEL)) || null,
        // Rate cell often shows both the total ($2,850) and per-mile ($3.67*/mi).
        // Take only the first dollar amount (the total) so the two don't get
        // concatenated into garbage like "$2850$3.67".
        rate: (() => {
            const raw = text(row.querySelector(RATE_CELL_SEL)) || '';
            const m = raw.match(/\$\s*[\d,]+(?:\.\d{1,2})?/);
            return m ? m[0].replace(/[\s,]/g, '') : null;
        })(),
        equipment,
        length: length || null,
        weight: weight || null,
        referenceId: readRefId(row),
        loadId: null
    };
}

// =========================
// Email button injection
// =========================

// "Copy broker email" button — sits next to the send button.
// Shared style for the injected Send / Copy icon-buttons. One brand-aligned
// look (TruckBox blue), crisp micro-interactions (hover lift, active press,
// spinner→check on send, copied flash) — no neon glow.
const DATX_BTN_CSS =
    '.datx-iconbtn{box-sizing:border-box;display:inline-flex;align-items:center;' +
    'justify-content:center;width:30px;height:30px;padding:0;cursor:pointer;' +
    'border:1.5px solid #dbe1ea;border-radius:9px;background:#fff;position:relative;' +
    'z-index:2147483647;color:#0046E0;' +
    'box-shadow:0 1px 2px rgba(16,24,40,.07);' +
    'transition:border-color .18s ease,box-shadow .18s ease,background .18s ease,' +
    'transform .12s cubic-bezier(.34,1.4,.64,1);}' +
    '.datx-iconbtn:hover{border-color:#0046E0;background:#f3f7ff;' +
    'box-shadow:0 3px 9px rgba(0,70,224,.2);transform:translateY(-1.5px);}' +
    '.datx-iconbtn:active{transform:translateY(0) scale(.92);' +
    'box-shadow:0 1px 2px rgba(0,70,224,.16);}' +
    '.datx-iconbtn:disabled{cursor:default;}' +
    '.datx-iconbtn:disabled:hover{transform:none;}' +
    '.datx-iconbtn svg,.datx-iconbtn img{display:block;pointer-events:none;}' +
    '.datx-ic{display:flex;align-items:center;justify-content:center;' +
    'transition:transform .18s ease,opacity .18s ease;}' +
    // Truckstop variant: a compact square button with a plain blue envelope
    // inside instead of the TruckBox logo.
    '.datx-send--env{width:26px;height:26px;border-radius:7px;}' +
    '.datx-send--env svg{width:16px;height:16px;}' +
    // success / sent confirmation states
    '.datx-iconbtn.datx-ok{border-color:#16a34a;background:#f0fdf4;color:#16a34a;}' +
    '.datx-iconbtn.datx-ok:hover{border-color:#16a34a;background:#f0fdf4;' +
    'box-shadow:0 3px 9px rgba(22,163,74,.2);}' +
    '@keyframes datx-pop{0%{transform:scale(0) rotate(-12deg);opacity:0;}' +
    '60%{transform:scale(1.22) rotate(2deg);}100%{transform:scale(1) rotate(0);opacity:1;}}' +
    '.datx-pop{animation:datx-pop .3s cubic-bezier(.34,1.56,.64,1) both;}' +
    // sending spinner
    '@keyframes datx-spin{to{transform:rotate(360deg);}}' +
    '.datx-spin{animation:datx-spin .7s linear infinite;}' +
    // Template-menu chevron (template-menu.js): a slim companion glued to the Send button's right.
    '.datx-tpl-more{width:16px;margin:0 0 0 2px;border-radius:0 7px 7px 0;color:#64748b;}' +
    '.datx-cs-actions .datx-tpl-more{margin-left:-4px;}' +
    '.datx-send[data-datx-inline-before]+.datx-tpl-more{margin-left:-4px;margin-right:6px;}' +
    '.datx-tpl-more:hover,.datx-tpl-more[aria-expanded="true"]{color:#0046E0;transform:none;}' +
    '.datx-tpl-more:focus-visible{outline:2px solid #0046E0;outline-offset:1px;}' +
    '.datx-tpl-more[hidden]{display:none!important;}' +
    // Single template: the chevron stays in the layout and holds its slot, invisible.
    '.datx-tpl-more--ghost{visibility:hidden;pointer-events:none;}' +
    '.datx-send[data-datx-inline-btn]+.datx-tpl-more{width:14px;height:24px;vertical-align:middle;}' +
    '.datx-send--env+.datx-tpl-more{height:26px;}' +
    '.datx-inline-group{display:inline-flex;align-items:center;flex:0 0 auto;align-self:flex-start;' +
    'vertical-align:middle;margin-top:4px;}' +
    // Sharp edition: every element TruckBox injects is square (matches truckbox.app). Matches only
    // our own datx-/tb- classes and datx- ids, never DAT's markup (html.tb-dark is excluded).
    ':not(html):not(body):is([class^="datx-"],[class*=" datx-"],[class^="tb-"],[class*=" tb-"],[id^="datx-"])' +
    '{border-radius:0!important;}' +
    // The CS/DTP column now holds our Send/Copy buttons: drop its column divider line.
    '[data-test="load-cs-dtp-cell"]{border-left:0!important;border-right:0!important;box-shadow:none!important;}' +
    '[data-test="load-cs-dtp-cell"]::before,[data-test="load-cs-dtp-cell"]::after{display:none!important;}';

// Injects the button stylesheet into a given root. Defaults to the document,
// but Truckstop mounts the Send button inside a Shadow DOM — a stylesheet in
// document.head can't cross that boundary, so we inject a copy into the shadow
// root too. Guarded so each root only gets one copy.
function ensureDatxButtonStyle(root) {
    root = root || document;
    const has = root.querySelector ? root.querySelector('#datx-btn-style') : null;
    if (has) return;
    const s = document.createElement('style');
    s.id = 'datx-btn-style';
    s.textContent = DATX_BTN_CSS;
    const mount = root === document ? (document.head || document.documentElement)
                                    : (root.head || root); // ShadowRoot has no .head
    mount.appendChild(s);
}

const DATX_CHECK_SVG =
    '<svg class="datx-ic datx-pop" width="17" height="17" viewBox="0 0 24 24" fill="none" ' +
    'aria-hidden="true"><path d="M5 12.5L10 17.5L19 7" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

const DATX_SPINNER_SVG =
    '<svg class="datx-ic datx-spin" width="17" height="17" viewBox="0 0 24 24" fill="none" ' +
    'aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="rgba(0,70,224,.18)" stroke-width="2.4"/>' +
    '<path d="M21 12a9 9 0 0 0-9-9" stroke="#0046E0" stroke-width="2.4" stroke-linecap="round"/></svg>';

function buildCopyEmailButton(email) {
    ensureDatxButtonStyle();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'datx-copy-email datx-iconbtn';
    btn.title = 'Copy broker email';
    btn.setAttribute(INJECT_ATTR, '1');
    btn.dataset.datxEmail = email || '';

    const copyIcon =
        '<span class="datx-ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" ' +
        'aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5" ' +
        'stroke="currentColor" stroke-width="2"/>' +
        '<path d="M5 15V5a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round"/></svg></span>';
    btn.innerHTML = copyIcon;

    let resetT = null;
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const em = btn.dataset.datxEmail || email;
        if (!em) {
            showToast('No broker email on this load', 'info');
            return;
        }
        try {
            await navigator.clipboard.writeText(em);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = em;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch {}
            ta.remove();
        }
        showToast('Email copied: ' + em, 'success');
        btn.classList.add('datx-ok');
        btn.innerHTML = DATX_CHECK_SVG;
        btn.title = 'Copied';
        if (resetT) clearTimeout(resetT);
        resetT = setTimeout(() => {
            btn.classList.remove('datx-ok');
            btn.innerHTML = copyIcon;
            btn.title = 'Copy broker email';
        }, 1300);
    });

    return btn;
}

// Hides the CS / DTP score values for a row even when it has no email button,
// so the whole "CS DTP" column reads clean. Skips rows where our action group
// is already mounted (those values are handled by placeRowButtons).
function clearCsDtpValuesForRow(row) {
    if (!(row instanceof Element)) return;
    const cell = row.querySelector(DTP_CELL_SEL);
    if (!cell || cell.querySelector('.datx-cs-actions')) return;
    cell.querySelectorAll(':scope > div').forEach((d) => {
        if (!d.classList.contains('datx-cs-actions')) d.style.display = 'none';
    });
}

// Places the send + copy buttons in the row's "CS DTP" column (replacing the
// CS / DTP score values). Falls back to before the email anchor if the cell
// isn't found.
function placeRowButtons(row, anchor, sendBtn, email) {
    sendBtn.style.marginRight = '0';

    const group = document.createElement('div');
    group.className = 'datx-cs-actions';
    group.setAttribute(INJECT_ATTR, '1');
    group.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
    group.appendChild(sendBtn);
    group.appendChild(buildCopyEmailButton(email));
    // Star: keeps this load reachable after the board pulls the posting.
    if (window.tbSaved) group.appendChild(window.tbSaved.buildStarButton(row, email));
    if (typeof attachTemplateMoreButton === 'function') attachTemplateMoreButton(sendBtn);

    const cell = row.querySelector(DTP_CELL_SEL);
    if (cell) {
        // Hide the CS / DTP score values, drop any previous button group.
        cell.querySelectorAll(':scope > div').forEach((d) => {
            if (d.classList.contains('datx-cs-actions')) d.remove();
            else d.style.display = 'none';
        });
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'flex-start';
        cell.style.paddingLeft = '0';
        cell.style.paddingRight = '0';
        cell.appendChild(group);
    } else {
        anchor.insertAdjacentElement('beforebegin', group);
    }
}

// Builds the TruckBox Send-Email button with its full click -> backend flow.
// Placement (list "CS DTP" cell vs. inline in details) is left to the caller.
// States: idle (brand mark) -> sending (spinner) -> sent (green check) / error
// (back to idle). Visuals live in ensureDatxButtonStyle(); JS only swaps icons.
function buildSendButton(email, row, opts) {
    opts = opts || {};
    ensureDatxButtonStyle();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'datx-send datx-iconbtn' + (opts.envelopeOnly ? ' datx-send--env' : '');
    btn.title = 'Send email via Truck Box';
    btn.setAttribute(INJECT_ATTR, '1');
    btn.dataset.datxEmail = email || '';
    btn.style.marginRight = '8px';

    // Brand-blue envelope. Default builds use the packaged TruckBox icon and
    // fall back to this; envelopeOnly builds (Truckstop) always use it.
    const fallbackEnvelope =
        '<span class="datx-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
        'aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3.5" ' +
        'stroke="currentColor" stroke-width="2"/>' +
        '<path d="M4 7.5L12 13L20 7.5" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

    const iconUrl = opts.envelopeOnly ? null : safeGetRuntimeUrl('icons/icon32.png');
    const renderIdle = () => {
        if (iconUrl) {
            btn.innerHTML =
                '<span class="datx-ic"><img src="' + iconUrl + '" width="18" height="18" ' +
                'alt="Send email" style="border-radius:4px"></span>';
            const img = btn.querySelector('img');
            if (img) img.onerror = () => { btn.innerHTML = fallbackEnvelope; };
        } else {
            btn.innerHTML = fallbackEnvelope;
        }
        btn.classList.remove('datx-ok');
    };
    renderIdle();

    // templateId null = the active template (button click, shortcut "E"); otherwise the template
    // picked in the in-page template menu (template-menu.js calls btn._tbSend).
    const send = async (templateId, templateName) => {
        if (btn.disabled) return;

        if (sendInFlight) {
            showToast('Please wait, email is already being sent...', 'info');
            return;
        }

        sendInFlight = true;
        btn.disabled = true;
        btn.innerHTML = DATX_SPINNER_SVG; // sending state

        const clickEmail = btn.dataset.datxEmail || email;

        const freshRow =
            findRowFromDetails(btn) ||
            btn.closest(ROW_SEL) ||
            row;

        // DAT reads the email fields from the row cells (buildContext). Truckstop
        // has no per-row data — its adapter pulls the same fields from the open
        // detail panel via buildEmailContext(). Use the adapter's when present.
        const a = window.TB_ADAPTER;
        const context = (a && typeof a.buildEmailContext === 'function')
            ? a.buildEmailContext(btn, clickEmail)
            : buildContext(freshRow, clickEmail);

        const markError = (msg) => {
            if (msg) showToast(msg, 'error');
            renderIdle();
            btn.disabled = false;
        };

        const markSent = (toastMsg) => {
            if (toastMsg) showToast(toastMsg, 'success');
            btn.classList.add('datx-ok');
            btn.innerHTML = DATX_CHECK_SVG;
            btn.disabled = true;
            btn.title = 'Email sent';
        };

        try {
            if (!isExtensionAlive()) {
                return markError('Extension was reloaded. Refresh the page.');
            }

            const msg = {
                type: 'datx_email_click',
                email: clickEmail,
                context,
                platform: typeof tbActivePlatform === 'function' ? tbActivePlatform() : 'DAT'
            };
            if (templateId != null) msg.templateId = templateId;
            const resp = await safeSendMessage(msg);

            if (resp?.ok && resp?.dedup) {
                markError(null);
                showToast('Email already sent recently', 'info');
                return;
            }

            if (resp?.ok) {
                markSent(templateId != null && templateName
                    ? `Email sent to ${clickEmail} (${templateName})`
                    : `Email sent to ${clickEmail}`);
                return;
            }

            if (resp?.needLogin) {
                markError(null);
                showLoginBanner();
                return;
            }

            if (resp?.accessDenied) {
                markError('Your subscription is not active. Please subscribe.');
                return;
            }

            if (resp?.needPermission) {
                markError(
                    'Gmail "Send email" permission was not granted. Please log out and log in again, and check the box that allows sending email on your behalf.'
                );
                return;
            }

            // The template's own sender failed — never retried from another mailbox.
            if (resp?.reason === 'mailbox_disconnected') {
                markError("This template's mailbox is disconnected. Reconnect it in the TruckBox cabinet → Mailboxes. Nothing was sent.");
                return;
            }
            if (resp?.reason === 'no_mailbox_selected') {
                markError("This template's sender mailbox is missing. Reconnect it in the cabinet or pick another sender in the popup. Nothing was sent.");
                return;
            }
            if (resp?.reason === 'mailbox_not_available') {
                markError("This template's Microsoft account can't send email. Pick another sender in the popup. Nothing was sent.");
                return;
            }
            if (resp?.reason === 'template_missing') {
                markError('That template no longer exists. Nothing was sent.');
                return;
            }

            markError('Failed to send email');
        } catch {
            markError('Failed to send email');
        } finally {
            sendInFlight = false;
        }
    };

    btn._tbSend = send;
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        send(null);
    });

    return btn;
}

// Places the send + copy buttons in the row's "CS DTP" cell. Dedups per row.
function injectButton(anchor, row, email) {
    if (!isExtensionAlive()) return;
    if (!(anchor instanceof Element)) return;
    if (!(row instanceof Element)) return;

    const existingBtn = row.querySelector('.datx-send');
    if (existingBtn) {
        existingBtn.dataset.datxEmail = email || '';
        const existingCopy = row.querySelector('.datx-copy-email');
        if (existingCopy) existingCopy.dataset.datxEmail = email || '';
        if (typeof attachTemplateMoreButton === 'function') attachTemplateMoreButton(existingBtn);
        return;
    }

    const btn = buildSendButton(email, row);
    placeRowButtons(row, anchor, btn, email);

    try {
        processedRows.add(row);
    } catch {
    }
}

// Inline Send-Email button placed right after an email occurrence inside the
// expanded load details (contact rows, contact-info block, comments). One
// button per occurrence — the same email in multiple spots gets a button each.
function injectInlineEmailButton(target, row, email) {
    if (!isExtensionAlive()) return;
    if (!(target instanceof Element)) return;
    if (!email) return;

    // Angular recycles detail DOM nodes: a button we injected earlier can end up
    // sitting next to a *different* load's email after the node is reused. So we
    // never trust a stale guard — we reconcile against the live DOM every pass.
    // DAT's contact web component renders as a block (email on its own line):
    // for it the button goes in FRONT of the email, on the same line.
    const before = target.hasAttribute('recipient-email');
    // Our template chevron sits right after a Send button: step over it.
    let existing = before
        ? (typeof tbSiblingSkippingMore === 'function'
            ? tbSiblingSkippingMore(target, false)
            : target.previousElementSibling)
        : target.nextElementSibling;
    // "After" buttons live in an inline group (see below): look inside it.
    if (existing instanceof Element && existing.classList.contains('datx-inline-group')) {
        existing = existing.querySelector('.datx-send[data-datx-inline-btn]');
    }
    if (
        existing instanceof Element &&
        existing.classList.contains('datx-send') &&
        existing.hasAttribute('data-datx-inline-btn')
    ) {
        // A button is already here. Re-point it at whatever email the target
        // actually shows right now (fall back to the caller-supplied email).
        const live = liveEmailForTarget(target) || email;
        if (existing.dataset.datxEmail !== live) {
            existing.dataset.datxEmail = live;
        }
        target.setAttribute('data-datx-inline', '1');
        return;
    }

    target.setAttribute('data-datx-inline', '1');

    const btn = buildSendButton(email, row instanceof Element ? row : document.body);
    btn.setAttribute('data-datx-inline-btn', '1');
    btn.style.margin = before ? '0 6px 0 0' : '0';
    btn.style.verticalAlign = 'middle';
    btn.style.width = '24px';
    btn.style.height = '24px';
    if (before) {
        btn.setAttribute('data-datx-inline-before', '1');
        target.style.display = 'inline-block';
        target.style.verticalAlign = 'middle';
        target.insertAdjacentElement('beforebegin', btn);
    } else {
        // Send + template chevron travel as one inline group, so a column-flex parent (DAT's
        // COMMENTS block) can't stack them on separate lines.
        const group = document.createElement('span');
        group.className = 'datx-inline-group';
        group.setAttribute(INJECT_ATTR, '1');
        group.appendChild(btn);
        target.insertAdjacentElement('afterend', group);
    }
    if (typeof attachTemplateMoreButton === 'function') attachTemplateMoreButton(btn);
}

// The element an inline Send button belongs to (the email / comment it sits next to).
function inlineButtonTarget(btn) {
    if (btn.hasAttribute('data-datx-inline-before')) {
        return typeof tbSiblingSkippingMore === 'function'
            ? tbSiblingSkippingMore(btn, true)
            : btn.nextElementSibling;
    }
    const group = btn.parentElement;
    if (group && group.classList.contains('datx-inline-group')) return group.previousElementSibling;
    return btn.previousElementSibling;
}

// Reads the email currently shown next to an inline button's target — either a
// mailto anchor or a free-text element (e.g. the comments block). Returns '' if
// the target no longer carries an email (e.g. the node was reused for a load
// with no email), which is the signal to remove a stale button.
function liveEmailForTarget(target) {
    if (!(target instanceof Element)) return '';

    // DAT web component: the address is an attribute, textContent is empty.
    if (target.hasAttribute('recipient-email')) return emailOfElement(target);

    const mailto = target.matches?.('a[href^="mailto:"]')
        ? target
        : target.querySelector?.('a[href^="mailto:"]');
    if (mailto) {
        const e = normalizeEmail(mailto.getAttribute('href') || mailto.textContent || '');
        if (e) return e;
    }

    const m = String(target.textContent || '').match(EMAIL_RE);
    return m ? normalizeEmail(m[0]) : '';
}

// Self-healing sweep over every injected inline button. The inject passes only
// visit targets that still have an email, so they can't clean up buttons whose
// email vanished after a recycle — this does. Runs each scan.
function reconcileInlineEmailButtons(root = document) {
    if (!isExtensionAlive()) return;

    root.querySelectorAll('.datx-send[data-datx-inline-btn]').forEach((btn) => {
        const target = inlineButtonTarget(btn);
        const live = liveEmailForTarget(target);

        if (!live) {
            if (target instanceof Element) target.removeAttribute('data-datx-inline');
            const group = btn.parentElement && btn.parentElement.classList.contains('datx-inline-group')
                ? btn.parentElement : null;
            if (typeof removeSendButton === 'function') removeSendButton(btn);
            else btn.remove();
            if (group) group.remove();
            return;
        }

        if (btn.dataset.datxEmail !== live) {
            btn.dataset.datxEmail = live;
        }
    });
}

// =========================================================================
// Hide DAT's own send-email button
// =========================================================================
// DAT now renders its own email control in the contact area, right beside
// ours — two envelopes side by side, doing the same job. Hidden by default;
// the Filters tab has a switch to bring it back.
//
// Done with CSS keyed off a root class rather than by removing nodes. DAT's
// Angular recycles these cells constantly, so a removal would have to re-run
// on every mutation and could never win the race cleanly; a rule also covers
// nodes that don't exist yet and reverses the instant the switch flips.
//
// We target DAT's custom element, NOT the button inside it. That button lives
// three open shadow roots deep (connected-email-compose-email-button ->
// connected-email-send-icon-button -> cg-icon-button -> button), and CSS does
// not cross a shadow boundary — a rule aimed at the button could never match.
// The host element is in the light DOM, and hiding it hides everything it
// contains. Two selectors for the same node: the tag name, and DAT's own test
// hook, so a rename of either one alone doesn't silently stop working.
//
// Nothing of ours is at risk here: our button is `.datx-send`, in a different
// cell entirely. DAT's `<a href="mailto:">` is also untouched — that's the
// address text itself, not a duplicate action.
var TB_DAT_EMAIL_HIDE_CLASS = 'tb-hide-dat-email';
var TB_DAT_OWN_EMAIL_BTN_SEL =
    'connected-email-compose-email-button,' +
    '[data-test="connected-email-compose-button"],' +
    'connected-email-connect-cta,' +
    '[data-test="connected-email-connect-cta"]';

function ensureDatOwnEmailHideStyle() {
    if (document.getElementById('tb-dat-email-hide-style')) return;
    const st = document.createElement('style');
    st.id = 'tb-dat-email-hide-style';
    // The selector is a list, so the root class has to be prefixed onto each
    // part — 'html.x a,b' would leave `b` unscoped and hide it for everyone.
    st.textContent =
        TB_DAT_OWN_EMAIL_BTN_SEL.split(',')
            .map((sel) => 'html.' + TB_DAT_EMAIL_HIDE_CLASS + ' ' + sel.trim())
            .join(',') + '{display:none !important;}';
    (document.head || document.documentElement).appendChild(st);
}

function applyDatOwnEmailPref(showDatButton) {
    ensureDatOwnEmailHideStyle();
    document.documentElement.classList.toggle(TB_DAT_EMAIL_HIDE_CLASS, !showDatButton);
}

if (isExtensionAlive()) {
    try {
        // Default OFF: a fresh install hides DAT's button without being asked.
        chrome.storage.local.get(['datOwnEmailBtnEnabled'], (d) => {
            if (!isExtensionAlive()) return;
            applyDatOwnEmailPref(!!(d && d.datOwnEmailBtnEnabled));
        });
    } catch {
    }

    try {
        chrome.storage.onChanged.addListener((ch, area) => {
            if (!isExtensionAlive() || area !== 'local' || !ch.datOwnEmailBtnEnabled) return;
            applyDatOwnEmailPref(!!ch.datOwnEmailBtnEnabled.newValue);
        });
    } catch {
    }
}

