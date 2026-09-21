/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
// Profit calculator — the "take it or negotiate" math, inside the load's own details panel.
//
// A dispatcher does this in their head on every call: rate minus fuel, tolls and the driver's cut.
// The numbers it needs are already on screen (DAT prints the rate and the trip miles), so the only
// things we ask for are the truck's economics — and those are asked once, then remembered.
//
// The second figure matters more than the profit: the minimum rate. Percentage-based pay grows with
// the rate, so break-even is not "costs" but costs / (1 − percent).
//
// Exposes window.tbProfit: { mount }.

(function () {
    const MOUNT_CLASS = 'tb-profit';
    /**
     * Put on the details column that holds the calculator. The board narrows its columns as the
     * window shrinks; the floor is the compact layout — three fields to a row, labels clipped
     * rather than stacked. Below it the block folds into two columns and stops being readable at
     * a glance. Removed again when the calculator is switched off, so a dispatcher who does not
     * use it gets the board's own widths back.
     */
    const HOST_CLASS = 'tb-profit-col';
    /** Open load-detail panels — the same ones ui-injector mounts into. */
    const DETAILS_SEL = 'dat-load-details, .table-row-detail';
    const DEFAULT_MPG = 6.5;
    /** Typical company-driver rate; the dispatcher overwrites it once and we keep theirs. */
    const DEFAULT_PAY_PER_MILE = 0.75;

    /**
     * The dispatcher's own numbers — mpg, driver pay, the fuel price they run on. Settings, not
     * data: they live in this browser only and the server never sees them.
     */
    const PREFS_KEY = 'profitPrefs';
    /** Shown until the dispatcher sets their own, and whenever the index is unreachable. */
    const FALLBACK_DIESEL = 6.0;

    /** Popup switch (Filters → Profit Calculator). Default on; off removes the block entirely. */
    const ENABLED_KEY = 'profitCalcEnabled';

    let prefs = {};
    let enabled = true;
    const mounted = new Set();
    let saveTimer = null;

    function send(message) {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(message, (r) => {
                    if (chrome.runtime.lastError) resolve({ok: false});
                    else resolve(r || {ok: false});
                });
            } catch {
                resolve({ok: false});
            }
        });
    }

    async function loadPrefs() {
        try {
            const d = await chrome.storage.local.get([PREFS_KEY, ENABLED_KEY]);
            if (d[PREFS_KEY]) prefs = d[PREFS_KEY];
            enabled = d[ENABLED_KEY] !== false;
        } catch { /* storage blocked: defaults are fine */ }
        return prefs;
    }

    const settingsReady = loadPrefs();

    // Another panel — or another tab — changed the numbers: follow along without a reload.
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[PREFS_KEY]) {
            prefs = changes[PREFS_KEY].newValue || {};
            mounted.forEach((apply) => apply());
        }
        if (changes[ENABLED_KEY]) {
            enabled = changes[ENABLED_KEY].newValue !== false;
            // Switched in the popup while panels are open: apply it to them now, rather than
            // leaving the dispatcher to reload the board to see their own setting take effect.
            if (enabled) {
                document.querySelectorAll(DETAILS_SEL).forEach((el) => mount(el));
            } else {
                document.querySelectorAll('.' + MOUNT_CLASS).forEach((box) => {
                    const column = box.closest('.' + HOST_CLASS);
                    if (column) column.classList.remove(HOST_CLASS);
                    const wrap = box.closest('.row-spacing');
                    (wrap || box).remove();
                });
            }
        }
    });

    /** The index is weekly, so one reading serves the whole browsing session. */
    const INDEX_TTL_MS = 30 * 60 * 1000;
    let indexCache = null;   // {data, at}
    let indexInFlight = null;

    /**
     * One request per reading, however many times the button is pressed and from however many
     * open panels: a fresh-enough answer is reused, and simultaneous clicks share the same call.
     */
    function fetchIndex() {
        if (indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) {
            return Promise.resolve(indexCache.data);
        }
        if (indexInFlight) return indexInFlight;
        indexInFlight = send({type: 'fuel_price_get'})
            .then((r) => {
                indexInFlight = null;
                if (!r.ok || !r.data || r.data.pricePerGallon == null) return null;
                indexCache = {data: r.data, at: Date.now()};
                return r.data;
            })
            .catch(() => {
                indexInFlight = null;
                return null;
            });
        return indexInFlight;
    }

    /** Debounced: the dispatcher types, we don't write on every keystroke. */
    function persist() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try {
                chrome.storage.local.set({[PREFS_KEY]: prefs});
            } catch { /* ignore */ }
        }, 400);
    }

    // ---- reading what DAT already shows ----------------------------------

    const num = (v) => {
        if (v == null) return null;
        const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) ? n : null;
    };

    /** The rate and trip miles printed in the details panel's Rate column. */
    function readRate(detailsEl) {
        const total = detailsEl.querySelector('dat-rate .data-item-total');
        const items = [...detailsEl.querySelectorAll('dat-rate .data-item')];
        const miles = items.map((el) => el.textContent || '').find((t) => /mi\b/i.test(t));
        return {rate: num(total?.textContent), miles: num(miles)};
    }

    /**
     * Deadhead to pickup. DAT prints it in the origin city itself ("Wayne, NJ (85)"), which is
     * what the route block already parses — so we reuse its reader instead of keeping a second
     * one that has to be fixed twice.
     */
    function readDeadhead(detailsEl) {
        if (typeof readDeadheadMiles === 'function') {
            const mi = readDeadheadMiles(detailsEl);
            if (mi != null) return mi;
        }
        const el = detailsEl.querySelector('.tb-route-dh .tb-route-v, [data-tb-deadhead]');
        return num(el?.textContent);
    }

    // ---- math ------------------------------------------------------------

    /**
     * @returns {{fuel:number, tolls:number, pay:number, net:number,
     *            perMile:number|null, minRate:number|null}}
     */
    function compute(v) {
        const miles = v.miles || 0;
        const gallons = v.mpg > 0 ? miles / v.mpg : 0;
        const fuel = gallons * (v.fuelPrice || 0);
        const tolls = v.tolls || 0;

        // Percentage pay scales with the rate; per-mile pay does not. That difference is what makes
        // the minimum rate a division rather than a sum.
        const pct = v.payMode === 'percent' ? (v.payPercent || 0) / 100 : 0;
        const pay = v.payMode === 'percent' ? (v.rate || 0) * pct : miles * (v.payPerMile || 0);

        const fixed = fuel + tolls + (v.payMode === 'percent' ? 0 : pay);
        const net = (v.rate || 0) - (fuel + tolls + pay);

        return {
            fuel,
            tolls,
            pay,
            net,
            perMile: miles > 0 ? net / miles : null,
            // What the load must pay to break even. Undefined if the driver takes everything.
            minRate: pct < 1 ? fixed / (1 - pct) : null
        };
    }

    const usd = (n) =>
        n == null || !Number.isFinite(n)
            ? '—'
            : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

    /** Per-mile figures are cents-sensitive: $2.70/mi must not round to $3. */
    const usdCents = (n) =>
        n == null || !Number.isFinite(n) ? '—' : (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);

    // ---- UI --------------------------------------------------------------

    const CSS =
        // A query container: the Rate column is as wide as the browser window lets it be, and
        // the calculator has to stay readable in a half-width window without a media query
        // guessing at the viewport.
        '.tb-profit{font:12px/1.4 Arial,Helvetica,sans-serif;color:#10203a;' +
        'container-type:inline-size;}' +
        // The floor: the compact three-across layout, ~296px of content inside the column.
        '.tb-profit-col{min-width:312px;}' +
        '.tb-profit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;' +
        'margin-top:8px;}' +
        '.tb-profit-f{display:flex;flex-direction:column;gap:3px;min-width:0;}' +
        '.tb-profit-f label{font:700 10px/1 Arial,Helvetica,sans-serif;letter-spacing:.09em;' +
        'text-transform:uppercase;color:#9aa7bd;white-space:nowrap;overflow:hidden;' +
        'text-overflow:ellipsis;}' +
        '.tb-profit-grid{row-gap:10px;}' +
        // The fields are half a column wide and hold four characters — spend that space on the
        // number itself, which is what the dispatcher actually reads.
        '.tb-profit-f input{width:100%;box-sizing:border-box;border:1px solid rgba(16,32,58,.2);' +
        'background:#fff;color:#10203a;padding:5px 7px;' +
        'font:700 16px/1.35 Arial,Helvetica,sans-serif;letter-spacing:-.01em;}' +
        '.tb-profit-f input::placeholder{font-weight:400;font-size:13px;color:#9aa7bd;}' +
        // The deadhead switch lives inside the miles box: it is the same number being counted two
        // ways, so it belongs on the number, not in a row of its own.
        '.tb-profit-inwrap{position:relative;display:flex;min-width:0;}' +
        '.tb-profit-f .tb-profit-inwrap input{padding-left:38px;}' +
        '.tb-profit-dh{position:absolute;left:1px;top:1px;bottom:1px;width:30px;padding:0;' +
        'cursor:pointer;border:none;border-right:1px solid rgba(16,32,58,.14);background:#eef2f8;' +
        'color:#9aa7bd;font:700 10px/1 Arial,Helvetica,sans-serif;letter-spacing:.04em;}' +
        '.tb-profit-dh:hover{color:#2f7be0;}' +
        '.tb-profit-dh.is-on{background:#2f7be0;border-right-color:#2f7be0;color:#fff;}' +
        '.tb-profit-dh.is-on:hover{color:#fff;}' +
        '.tb-profit-f input:focus{outline:none;border-color:#2f7be0;}' +
        '.tb-profit-pay{display:flex;gap:0;margin-bottom:3px;}' +
        '.tb-profit-pay button{flex:1;cursor:pointer;border:1px solid rgba(16,32,58,.2);' +
        'background:#fff;padding:5px 0;font:700 10px/1.2 Arial,Helvetica,sans-serif;' +
        'letter-spacing:.06em;text-transform:uppercase;color:#5b6b85;}' +
        '.tb-profit-pay button+button{border-left:none;}' +
        '.tb-profit-pay button.is-on{background:#2f7be0;border-color:#2f7be0;color:#fff;}' +
        '.tb-profit-out{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;' +
        'margin-top:10px;padding-top:9px;border-top:1px solid rgba(16,32,58,.1);}' +
        '.tb-profit-net{font:800 26px/1 Arial,Helvetica,sans-serif;letter-spacing:-.025em;}' +
        '.tb-profit-net.is-bad{color:#dc2626;}' +
        '.tb-profit-net.is-good{color:#16a34a;}' +
        '.tb-profit-sub{font:600 13.5px/1.35 Arial,Helvetica,sans-serif;color:#5b6b85;margin-top:5px;}' +
        '.tb-profit-min{text-align:right;font:600 12px/1.35 Arial,Helvetica,sans-serif;color:#5b6b85;}' +
        '.tb-profit-min b{display:block;font:800 17px/1.2 Arial,Helvetica,sans-serif;color:#10203a;}' +
        '.tb-profit-note{margin-top:8px;font:12px/1.4 Arial,Helvetica,sans-serif;' +
        'color:#10203a;}' +
        // Only the amounts are red — the labels are just labels, and a fully red line shouts.
        '.tb-profit-note b{font-weight:700;color:#c0564f;}' +
        '.tb-profit-head{display:flex;align-items:center;}' +
        '.tb-profit-info{display:inline-flex;align-items:center;margin-left:auto;cursor:help;' +
        'color:#8492a6;}' +
        '.tb-profit-info:hover{color:#2f7be0;}' +
        '.tb-profit-tip{position:fixed;z-index:2147483647;max-width:300px;padding:9px 11px;' +
        'background:#10203a;color:#fff;font:400 12px/1.5 Arial,Helvetica,sans-serif;' +
        'box-shadow:0 10px 28px rgba(16,32,58,.3);pointer-events:none;}' +
        '.tb-profit-src{font:11.5px/1.35 Arial,Helvetica,sans-serif;color:#8492a6;}' +
        // Pulls the index on demand — no background fetching, no stale cache to explain.
        '.tb-profit-getavg{margin-top:4px;align-self:flex-start;cursor:pointer;' +
        'border:1px solid rgba(16,32,58,.2);' +
        'background:#fff;padding:4px 8px;font:700 10px/1.2 Arial,Helvetica,sans-serif;' +
        'letter-spacing:.06em;text-transform:uppercase;color:#2f7be0;white-space:nowrap;}' +
        '.tb-profit-getavg:hover{border-color:#2f7be0;background:rgba(47,123,224,.08);}' +
        '.tb-profit-getavg:disabled{opacity:.6;cursor:default;}' +
        '.tb-profit-src{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
        '.tb-profit-src a{color:#2f7be0;text-decoration:none;}' +
        '.tb-profit-src a:hover{text-decoration:underline;}' +
        // Narrow column: give the numbers the room and let the chrome shrink around them.
        '@container (max-width:360px){' +
        '.tb-profit-grid{gap:5px;row-gap:8px;}' +
        '.tb-profit-f label{font-size:9px;letter-spacing:.04em;}' +
        '.tb-profit-f input{padding:4px 6px;font-size:14px;}' +
        '.tb-profit-f input::placeholder{font-size:11px;}' +
        '.tb-profit-pay button{padding:4px 0;font-size:9px;letter-spacing:.02em;}' +
        '.tb-profit-getavg{padding:3px 6px;font-size:9px;}' +
        '.tb-profit-src{font-size:10px;}' +
        '.tb-profit-net{font-size:21px;}' +
        '.tb-profit-sub{font-size:11.5px;}' +
        '.tb-profit-min{font-size:11px;}' +
        '.tb-profit-min b{font-size:14px;}' +
        '.tb-profit-note{font-size:11px;}' +
        '.tb-profit-dh{width:26px;font-size:9px;}' +
        '.tb-profit-f .tb-profit-inwrap input{padding-left:32px;}' +
        '}' +
        // Half a column wide: three fields no longer fit on a line.
        '@container (max-width:265px){' +
        '.tb-profit-grid{grid-template-columns:repeat(2,minmax(0,1fr));}' +
        '.tb-profit-out{flex-wrap:wrap;gap:6px;}' +
        '.tb-profit-min{text-align:left;}' +
        '}' +
        '@container (max-width:170px){' +
        '.tb-profit-grid{grid-template-columns:minmax(0,1fr);}' +
        '}';

    const IC_INFO =
        '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<circle cx="8" cy="8" r="6.6" stroke="currentColor" stroke-width="1.4"/>' +
        '<path d="M8 7.2v4M8 4.7v.9" stroke="currentColor" stroke-width="1.6" ' +
        'stroke-linecap="round"/></svg>';

    const DISCLAIMER =
        'A rough estimate, meant to give you context while you negotiate — not accounting. ' +
        'It counts fuel, tolls and driver pay only. Truck payment, insurance, authority and MC ' +
        'costs, maintenance, depreciation, taxes and overhead are not in it.';

    /**
     * Tooltip anchored in the viewport rather than inside the panel: the details column clips its
     * overflow, and a bubble positioned inside it would be cut off.
     */
    function attachInfo(icon, text) {
        let bubble = null;
        const hide = () => {
            if (bubble) bubble.remove();
            bubble = null;
        };
        icon.addEventListener('mouseenter', () => {
            hide();
            bubble = document.createElement('div');
            bubble.className = 'tb-profit-tip';
            bubble.textContent = text;
            document.body.appendChild(bubble);
            const r = icon.getBoundingClientRect();
            const w = bubble.offsetWidth;
            const left = Math.max(8, Math.min(r.left - w / 2 + r.width / 2,
                document.documentElement.clientWidth - w - 8));
            const below = r.bottom + 8;
            const fits = below + bubble.offsetHeight < document.documentElement.clientHeight - 8;
            bubble.style.left = left + 'px';
            bubble.style.top = (fits ? below : r.top - bubble.offsetHeight - 8) + 'px';
        });
        icon.addEventListener('mouseleave', hide);
        icon.addEventListener('blur', hide);
    }

    function ensureStyle() {
        if (document.getElementById('tb-profit-style')) return;
        const st = document.createElement('style');
        st.id = 'tb-profit-style';
        st.textContent = CSS;
        (document.head || document.documentElement).appendChild(st);
    }

    /**
     * Digits and at most one decimal point. Letters, a second dot, a pasted "$2,700" — all are
     * dropped as they are typed, so every field holds a number the moment the next keystroke
     * lands and nothing downstream has to guess what a half-typed value meant.
     */
    function numericOnly(input) {
        input.addEventListener('input', () => {
            const before = input.value;
            let v = before.replace(/[^0-9.]/g, '');
            const dot = v.indexOf('.');
            if (dot !== -1) {
                v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
            }
            if (v === before) return;
            // Keep the caret where the typing left it, minus whatever we removed before it.
            const caret = Math.max(0, (input.selectionStart || 0) - (before.length - v.length));
            input.value = v;
            try {
                input.setSelectionRange(caret, caret);
            } catch { /* not a text input on this browser: the value is what matters */ }
        });
    }

    function field(label, value) {
        const wrap = document.createElement('div');
        wrap.className = 'tb-profit-f';
        const l = document.createElement('label');
        l.textContent = label;
        const i = document.createElement('input');
        i.type = 'text';
        i.inputMode = 'decimal';
        i.value = value == null ? '' : String(value);
        numericOnly(i);
        wrap.appendChild(l);
        wrap.appendChild(i);
        wrap.input = i;
        return wrap;
    }

    /** Builds the calculator for one details panel. */
    function build(detailsEl) {
        ensureStyle();
        const read = readRate(detailsEl);
        const deadhead = readDeadhead(detailsEl);


        const box = document.createElement('div');
        box.className = MOUNT_CLASS;
        if (typeof INJECT_ATTR === 'string') box.setAttribute(INJECT_ATTR, '1');

        const grid = document.createElement('div');
        grid.className = 'tb-profit-grid';

        const rate = field('Rate $', read.rate != null ? Math.round(read.rate) : '');
        // DAT prints the loaded miles; the deadhead comes from our own route block, when it has
        // one. Which of the two the truck is paid to run is the dispatcher's call — hence the
        // switch above the fields, not a second number to reconcile.
        const dhMiles = deadhead ? Math.round(deadhead) : 0;
        let withDh = dhMiles > 0 && prefs.includeDeadhead !== false;
        const miles = field('Miles',
            read.miles != null ? Math.round(read.miles) + (withDh ? dhMiles : 0) : '');
        // The DH chip sits inside the box, to the left of the number it changes.
        let dhBtn = null;
        if (dhMiles > 0) {
            const inwrap = document.createElement('div');
            inwrap.className = 'tb-profit-inwrap';
            miles.insertBefore(inwrap, miles.input);
            dhBtn = document.createElement('button');
            dhBtn.type = 'button';
            dhBtn.className = 'tb-profit-dh';
            dhBtn.textContent = 'DH';
            inwrap.appendChild(dhBtn);
            inwrap.appendChild(miles.input);
        }
        const diesel = field('Diesel $/gal', prefs.fuelPricePerGal ?? FALLBACK_DIESEL);
        // Say where the number came from — a price nobody can trace is a price nobody trusts.
        const dieselSrc = document.createElement('div');
        dieselSrc.className = 'tb-profit-src';
        // EIA's API terms require their name to identify the source.
        const srcLink = document.createElement('a');
        srcLink.href = 'https://www.eia.gov/petroleum/gasdiesel/';
        srcLink.target = '_blank';
        srcLink.rel = 'noopener';
        srcLink.textContent = 'EIA national average';
        dieselSrc.appendChild(srcLink);

        const getAvg = document.createElement('button');
        getAvg.type = 'button';
        getAvg.className = 'tb-profit-getavg';
        getAvg.textContent = 'Get average';
        getAvg.title = 'Fill in the current U.S. national diesel average';
        getAvg.addEventListener('click', async (e) => {
            e.preventDefault();
            getAvg.disabled = true;
            getAvg.textContent = '…';
            const data = await fetchIndex();
            getAvg.disabled = false;
            getAvg.textContent = 'Get average';
            if (!data) {
                getAvg.textContent = 'Unavailable';
                setTimeout(() => (getAvg.textContent = 'Get average'), 1800);
                return;
            }
            diesel.input.value = data.pricePerGallon;
            // Treated as their price from here on: it is in the field, so it must survive a reload.
            prefs.fuelPricePerGal = Number(data.pricePerGallon);
            persist();
            recalc();
        });
        // The button lives under its own field; the source label goes under MPG, where there is
        // room for it to stay readable instead of being squeezed to an ellipsis.
        diesel.appendChild(getAvg);
        const mpg = field('Truck MPG', prefs.mpg ?? DEFAULT_MPG);
        mpg.appendChild(dieselSrc);
        const tolls = field('Tolls $', '');

        const pay = document.createElement('div');
        pay.className = 'tb-profit-f';
        const payLabel = document.createElement('label');
        payLabel.textContent = 'Driver pay';
        pay.appendChild(payLabel);
        const modes = document.createElement('div');
        modes.className = 'tb-profit-pay';
        const perMileBtn = document.createElement('button');
        perMileBtn.type = 'button';
        perMileBtn.textContent = '$/MI';
        const pctBtn = document.createElement('button');
        pctBtn.type = 'button';
        pctBtn.textContent = '%/RATE';
        modes.appendChild(perMileBtn);
        modes.appendChild(pctBtn);
        pay.appendChild(modes);
        const payInput = document.createElement('input');
        payInput.type = 'text';
        payInput.inputMode = 'decimal';
        numericOnly(payInput);
        pay.appendChild(payInput);

        let payMode = prefs.driverPayMode === 'percent' ? 'percent' : 'mile';
        const paintMode = () => {
            perMileBtn.classList.toggle('is-on', payMode === 'mile');
            pctBtn.classList.toggle('is-on', payMode === 'percent');
            payInput.value =
                payMode === 'percent'
                    ? (prefs.driverPayPercent ?? '')
                    : (prefs.driverPayPerMile ?? DEFAULT_PAY_PER_MILE);
            payInput.placeholder = payMode === 'percent' ? 'e.g. 25' : 'e.g. 0.60';
        };

        if (dhBtn) {
            const paintDh = () => {
                dhBtn.classList.toggle('is-on', withDh);
                dhBtn.title = withDh
                    ? 'Includes ' + dhMiles + ' mi deadhead — click for loaded miles only'
                    : 'Loaded miles only — click to add ' + dhMiles + ' mi deadhead';
            };
            // The field is adjusted by the deadhead rather than rewritten, so a dispatcher who
            // typed their own mileage keeps it — clicking twice returns the same number.
            dhBtn.addEventListener('click', () => {
                const current = num(miles.input.value);
                withDh = !withDh;
                prefs.includeDeadhead = withDh;
                persist();
                if (current != null) {
                    const next = current + (withDh ? dhMiles : -dhMiles);
                    miles.input.value = String(Math.max(0, Math.round(next)));
                }
                paintDh();
                recalc();
            });
            paintDh();
        }

        [rate, miles, tolls, diesel, mpg].forEach((f) => grid.appendChild(f));
        grid.appendChild(pay);
        box.appendChild(grid);

        const out = document.createElement('div');
        out.className = 'tb-profit-out';
        const left = document.createElement('div');
        const net = document.createElement('div');
        net.className = 'tb-profit-net';
        const sub = document.createElement('div');
        sub.className = 'tb-profit-sub';
        left.appendChild(net);
        left.appendChild(sub);
        const min = document.createElement('div');
        min.className = 'tb-profit-min';
        out.appendChild(left);
        out.appendChild(min);
        box.appendChild(out);

        const note = document.createElement('div');
        note.className = 'tb-profit-note';
        box.appendChild(note);

        const recalc = () => {
            const v = {
                rate: num(rate.input.value),
                miles: num(miles.input.value),
                fuelPrice: num(diesel.input.value),
                mpg: num(mpg.input.value) || DEFAULT_MPG,
                tolls: num(tolls.input.value),
                payMode,
                payPerMile: payMode === 'mile' ? num(payInput.value) : null,
                payPercent: payMode === 'percent' ? num(payInput.value) : null
            };
            const r = compute(v);

            net.textContent = v.rate ? usd(r.net) : '—';
            net.classList.toggle('is-good', !!v.rate && r.net > 0);
            net.classList.toggle('is-bad', !!v.rate && r.net <= 0);
            sub.textContent =
                !v.rate || r.perMile == null
                    ? 'Enter the rate to see the profit'
                    : usdCents(r.perMile) + '/mi after costs'
                      + (dhMiles > 0 ? (withDh ? ' (with DH)' : ' (loaded)') : '');
            min.innerHTML = '';
            const minLabel = document.createElement('span');
            minLabel.textContent = 'Break-even';
            const minVal = document.createElement('b');
            minVal.textContent = usd(r.minRate);
            min.appendChild(minLabel);
            min.appendChild(minVal);

            // Amounts bolded, labels plain — the eye lands on the numbers.
            const part = (label, value) => label + ' <b>' + usd(value) + '</b>';
            note.innerHTML =
                part('Fuel', r.fuel) +
                (r.tolls ? ' \u00b7 ' + part('Tolls', r.tolls) : '') +
                ' \u00b7 ' + part('Driver', r.pay);
        };

        // The panel already has a rate box in the RPM calculator. Two fields for the same number
        // that disagree are worse than one, so they mirror each other — with a guard, or each
        // update would echo back and forth.
        const rpmInput = detailsEl.querySelector('.tb-calc-input');
        let syncing = false;
        if (rpmInput) {
            if (!rate.input.value && rpmInput.value) rate.input.value = rpmInput.value;

            rpmInput.addEventListener('input', () => {
                if (syncing) return;
                syncing = true;
                rate.input.value = rpmInput.value;
                syncing = false;
                recalc();
            });

            rate.input.addEventListener('input', () => {
                if (syncing) return;
                syncing = true;
                rpmInput.value = rate.input.value;
                // Its own handler listens for 'input', so tell it the value changed.
                rpmInput.dispatchEvent(new Event('input', {bubbles: true}));
                syncing = false;
            });
        }

        const bindSetting = (input, key, parse) => {
            input.addEventListener('input', () => {
                prefs[key] = parse ? parse(input.value) : input.value;
                persist();
                recalc();
            });
        };
        bindSetting(diesel.input, 'fuelPricePerGal', num);
        bindSetting(mpg.input, 'mpg', num);
        payInput.addEventListener('input', () => {
            const value = num(payInput.value);
            prefs.driverPayMode = payMode;
            if (payMode === 'percent') prefs.driverPayPercent = value;
            else prefs.driverPayPerMile = value;
            persist();
            recalc();
        });
        [rate.input, miles.input, tolls.input].forEach((i) =>
            i.addEventListener('input', recalc)
        );
        const setMode = (mode) => {
            payMode = mode;
            prefs.driverPayMode = mode;
            paintMode();
            persist();
            recalc();
        };
        perMileBtn.addEventListener('click', () => setMode('mile'));
        pctBtn.addEventListener('click', () => setMode('percent'));

        /**
         * Re-applies the stored numbers after someone edited them elsewhere. Only the settings —
         * the rate, miles and tolls belong to this load and are never overwritten. A field being
         * typed into is left alone, or the caret would jump mid-keystroke.
         */
        const applyPrefs = () => {
            if (document.activeElement !== diesel.input) {
                diesel.input.value = prefs.fuelPricePerGal ?? FALLBACK_DIESEL;
            }
            if (document.activeElement !== mpg.input) {
                mpg.input.value = prefs.mpg ?? DEFAULT_MPG;
            }
            if (document.activeElement !== payInput) {
                payMode = prefs.driverPayMode === 'percent' ? 'percent' : 'mile';
                paintMode();
            }
            recalc();
        };
        mounted.add(applyPrefs);

        // Drop the hook when the panel is gone, or the set grows with every expanded row.
        const observer = new MutationObserver(() => {
            if (!box.isConnected) {
                mounted.delete(applyPrefs);
                observer.disconnect();
            }
        });
        observer.observe(document.body, {childList: true, subtree: true});

        paintMode();
        recalc();
        return box;
    }

    /**
     * Mounts into the Rate column, under DAT's own market rates — the dispatcher is already
     * reading numbers there, so ours belong in the same place, not in a corner of the page.
     */
    /**
     * Waits for the stored preferences before drawing. Reading chrome.storage is asynchronous, and
     * the details panel opens sooner — without this the calculator rendered the defaults and the
     * dispatcher's own fuel price appeared to have been forgotten.
     */
    function mount(detailsEl) {
        if (!(detailsEl instanceof Element) || detailsEl.querySelector('.' + MOUNT_CLASS)) return;
        settingsReady.then(() => mountNow(detailsEl));
    }

    function mountNow(detailsEl) {
        if (!enabled) return;
        if (!(detailsEl instanceof Element) || detailsEl.querySelector('.' + MOUNT_CLASS)) return;
        // DAT only for now: Truckstop's details panel is a different shape and we have no account
        // there yet to build it against.
        const platform = typeof tbActivePlatform === 'function' ? tbActivePlatform() : 'DAT';
        if (platform !== 'DAT') return;

        const rateBlock = detailsEl.querySelector('dat-rate');
        const column = rateBlock && rateBlock.closest('.details-column');
        if (!column) return;

        const wrap = document.createElement('div');
        wrap.className = 'row-spacing';
        if (typeof INJECT_ATTR === 'string') wrap.setAttribute(INJECT_ATTR, '1');

        // Clone one of DAT's own column headers so the grey bar matches theirs exactly — the clone
        // keeps Angular's scoping attribute, so their CSS styles it for free.
        const refHeader = detailsEl.querySelector('dat-rate .details-header');
        if (refHeader) {
            const header = refHeader.cloneNode(true);
            header.querySelectorAll('a').forEach((a) => a.remove());
            const lbl = header.querySelector('.label') || header;
            // Same badge the injected route block carries, so both of our blocks are marked alike.
            lbl.innerHTML = 'Profit calculator' +
                (typeof TB_PB_BADGE === 'string' ? TB_PB_BADGE : '');
            const info = document.createElement('span');
            info.className = 'tb-profit-info';
            info.tabIndex = 0;
            info.setAttribute('aria-label', DISCLAIMER);
            info.innerHTML = IC_INFO;
            attachInfo(info, DISCLAIMER);
            // On the header itself, not inside the label: it belongs at the far right of the bar.
            header.classList.add('tb-profit-head');
            header.appendChild(info);
            wrap.appendChild(header);
        }

        wrap.appendChild(build(detailsEl));
        column.appendChild(wrap);
        column.classList.add(HOST_CLASS);
    }

    window.tbProfit = {mount};
})();
