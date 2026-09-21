// Factoring tab — provider grid + per-provider detail.
// The grid shows one tile per factoring provider (RTS, Triumph and Apex live;
// the rest "Soon"). Connecting a provider here is also what makes it appear in
// the load panel — several can be connected at once, and their results are
// shown side by side rather than one being picked as "the" provider.
// Clicking a provider opens a full-area detail with the login flow and a back
// arrow. The tile badge reflects live connection status. Credentials are never
// handled here — the user logs in on the provider's own site.
(function factoringTab() {
    const grid = document.getElementById('factoringGrid');
    const intro = document.getElementById('factoringIntro');
    const detail = document.getElementById('factoringDetail');
    const loginBox = document.getElementById('factoringLoginRequiredBox');
    const loginBtn = document.getElementById('factoringLoginBtn');
    const tileRts = document.getElementById('fctTileRts');
    const rtsBadge = document.getElementById('fctRtsBadge');
    const backBtn = document.getElementById('fctBackBtn');
    const tileTriumph = document.getElementById('fctTileTriumph');
    const cardRts = document.getElementById('fctCardRts');
    const cardTriumph = document.getElementById('fctCardTriumph');
    const triumphLoginBtn = document.getElementById('triumphLoginBtn');
    const tileApex = document.getElementById('fctTileApex');
    const cardApex = document.getElementById('fctCardApex');
    const apexBadge = document.getElementById('fctApexBadge');
    const apexStatus = document.getElementById('apexStatus');
    const apexLoginBtn = document.getElementById('apexLoginBtn');
    const apexDisconnectBtn = document.getElementById('apexDisconnectBtn');
    const triumphBadge = document.getElementById('fctTriumphBadge');
    const triumphStatus = document.getElementById('triumphStatus');
    const triumphDisconnectBtn = document.getElementById('triumphDisconnectBtn');

    // Per-provider "show in load panel" switches. They only appear once that
    // provider is connected — before that there is nothing to show or hide.
    // Default ON, so connecting a provider puts it in the panel straight away;
    // the switch exists for the user who has two or three connected and doesn't
    // want all of them in every load.
    const SHOW_KEYS = { rts: 'rtsShow', triumph: 'triumphShow', apex: 'apexShow' };

    // "Selected" pill on each tile: connected AND switched on, i.e. this provider
    // is actually in the load panel right now. Connection state is only known by
    // the per-provider render functions, so they record it here and the pills are
    // repainted from one place.
    const connectedNow = { rts: false, triumph: false, apex: false };

    function paintSelectedPills() {
        try {
            chrome.storage.local.get(Object.values(SHOW_KEYS), (d) => {
                Object.keys(SHOW_KEYS).forEach((name) => {
                    const pill = document.getElementById(
                        'fct' + name.charAt(0).toUpperCase() + name.slice(1) + 'Selected'
                    );
                    if (!pill) return;
                    const shown = !d || d[SHOW_KEYS[name]] !== false;
                    pill.hidden = !(connectedNow[name] && shown);
                });
            });
        } catch {
            /* extension context not ready */
        }
    }

    // "Detected" on a tile: the provider's portal is open in a tab but the user
    // hasn't connected it here. Purely an invitation — nothing is read from that
    // tab until they act on it.
    const detected = { rts: false, triumph: false, apex: false };

    function refreshDetected() {
        try {
            chrome.runtime.sendMessage({ type: 'factoring_detect' }, (r) => {
                if (chrome.runtime.lastError) return;
                if (!r || !r.ok || !r.data) return;
                detected.rts = !!r.data.rts;
                detected.triumph = !!r.data.triumph;
                detected.apex = !!r.data.apex;
                refresh();
                refreshTriumph();
                refreshApex();
            });
        } catch {
            /* extension context not ready */
        }
    }

    // Badge for a provider that isn't connected. "Detected" (amber) when its
    // portal is open, so the tile invites the click instead of looking inert;
    // plain grey "Not connected" otherwise.
    function paintIdleBadge(el, name) {
        if (!el) return;
        el.textContent = detected[name] ? 'Detected' : 'Not connected';
        el.classList.toggle('detected', !!detected[name]);
    }

    function setConnected(name, isConnected) {
        connectedNow[name] = !!isConnected;
        paintSelectedPills();
    }

    function wireShowSwitch(name) {
        const input = document.getElementById(name + 'Show');
        if (!input) return () => {};
        const key = SHOW_KEYS[name];

        chrome.storage.local.get([key], (d) => {
            input.checked = !d || d[key] !== false; // absent = shown
        });
        input.addEventListener('change', () => {
            chrome.storage.local.set({ [key]: !!input.checked }, paintSelectedPills);
        });

        const row = document.getElementById(name + 'ShowRow');
        return (connected) => {
            if (row) row.style.display = connected ? 'flex' : 'none';
        };
    }

    const showRowRts = wireShowSwitch('rts');
    const showRowTriumph = wireShowSwitch('triumph');
    const showRowApex = wireShowSwitch('apex');

    const btn = document.getElementById('rtsLoginBtn');
    const status = document.getElementById('rtsStatus');
    const disconnectBtn = document.getElementById('rtsDisconnectBtn');
    if (!grid || !detail || !btn || !status) return;

    function fmtRemaining(exp) {
        if (!exp) return '';
        const ms = exp * 1000 - Date.now();
        if (ms <= 0) return '';
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
    }

    function showDisconnect(show) {
        if (disconnectBtn) disconnectBtn.style.display = show ? '' : 'none';
    }

    // Tile badge: Connected / Expired / Not connected.
    function setBadge(info) {
        if (!rtsBadge) return;
        rtsBadge.classList.remove('connected', 'expired', 'detected');
        if (info && info.valid) {
            rtsBadge.textContent = 'Connected';
            rtsBadge.classList.add('connected');
        } else if (info && info.token) {
            rtsBadge.textContent = 'Expired';
            rtsBadge.classList.add('expired');
        } else {
            paintIdleBadge(rtsBadge, 'rts');
        }
    }

    // Detail status line + buttons.
    function render(info) {
        setBadge(info);
        // Disconnect clears the opt-in, so offer it whenever there IS one —
        // including the case where a login was started but never finished.
        showDisconnect(!!(info && info.enabled));
        showRowRts(!!(info && info.enabled));
        setConnected('rts', info && info.enabled);

        if (!info || !info.token) {
            // RTS connects itself off a sniffed request, so a tab merely sitting
            // there hasn't produced one yet — say what actually finishes the job.
            status.textContent = detected.rts
                ? 'RTS is open in a tab — reload that tab to finish connecting.'
                : 'Not connected — log in to RTS to enable broker credit checks.';
            status.style.color = '';
            btn.textContent = 'Login to RTS';
            return;
        }
        if (!info.valid) {
            status.textContent = 'Session expired — click Login to reconnect.';
            status.style.color = '#ea580c';
            btn.textContent = 'Login to RTS';
            return;
        }
        const rem = fmtRemaining(info.exp);
        status.textContent = 'Connected' + (rem ? ` — session valid for ${rem}.` : '.');
        status.style.color = '#16a34a';
        btn.textContent = 'Re-login to RTS';
    }

    function refresh() {
        try {
            chrome.runtime.sendMessage({ type: 'rts_status' }, (r) => {
                if (chrome.runtime.lastError) return;
                render(r && r.ok ? r.data : null);
            });
        } catch {
            /* extension context not ready */
        }
    }

    // Triumph ---------------------------------------------------------------
    // Same three states as RTS, but the session comes from the Triumph portal's
    // own Okta login rather than a captured request header.
    function setTriumphBadge(info) {
        if (!triumphBadge) return;
        triumphBadge.classList.remove('connected', 'expired', 'detected');
        // canRecover: token has aged out, but a Triumph tab is open and the next
        // check pulls a fresh one from it. That's still connected, not expired.
        if (info && (info.valid || info.canRecover)) {
            triumphBadge.textContent = 'Connected';
            triumphBadge.classList.add('connected');
        } else if (info && info.token) {
            triumphBadge.textContent = 'Expired';
            triumphBadge.classList.add('expired');
        } else {
            paintIdleBadge(triumphBadge, 'triumph');
        }
    }

    function renderTriumph(info) {
        setTriumphBadge(info);
        // Same reasoning as RTS above: follow the opt-in, not the token.
        if (triumphDisconnectBtn) {
            triumphDisconnectBtn.style.display = info && info.enabled ? '' : 'none';
        }
        showRowTriumph(!!(info && info.enabled));
        setConnected('triumph', info && info.enabled);
        if (!triumphStatus) return;

        if (!info || !info.token) {
            triumphStatus.textContent = detected.triumph
                ? 'Triumph is open in a tab — connect it to check broker credit here.'
                : 'Not connected — log in to Triumph to enable broker credit checks.';
            triumphStatus.style.color = '';
            if (triumphLoginBtn) triumphLoginBtn.textContent = 'Login to Triumph';
            return;
        }
        if (!info.valid) {
            // Okta's access token lasts ~1h, but the login behind it lasts the
            // working day. With a Triumph tab open the next check refreshes
            // itself, so telling a dispatcher "expired" every hour would send
            // them re-logging in for nothing.
            if (info.canRecover) {
                triumphStatus.textContent =
                    'Connected — refreshes itself while your Triumph tab stays open.';
                triumphStatus.style.color = '#16a34a';
                if (triumphLoginBtn) triumphLoginBtn.textContent = 'Re-login to Triumph';
                return;
            }
            triumphStatus.textContent = 'Session expired — click Login to reconnect.';
            triumphStatus.style.color = '#ea580c';
            if (triumphLoginBtn) triumphLoginBtn.textContent = 'Login to Triumph';
            return;
        }
        const rem = fmtRemaining(info.exp);
        triumphStatus.textContent = 'Connected' + (rem ? ` — session valid for ${rem}.` : '.');
        triumphStatus.style.color = '#16a34a';
        if (triumphLoginBtn) triumphLoginBtn.textContent = 'Re-login to Triumph';
    }

    function refreshTriumph() {
        try {
            chrome.runtime.sendMessage({ type: 'triumph_status' }, (r) => {
                if (chrome.runtime.lastError) return;
                renderTriumph(r && r.ok ? r.data : null);
            });
        } catch {
            /* extension context not ready */
        }
    }

    // Apex ------------------------------------------------------------------
    // Only two states, not three: Apex keeps no token, so there is nothing that
    // can quietly expire. Either a portal tab is open or it isn't.
    function renderApex(info) {
        const connected = !!(info && info.enabled && info.tabOpen);
        const optedIn = !!(info && info.enabled);

        if (apexBadge) {
            apexBadge.classList.remove('connected', 'expired', 'detected');
            if (connected) {
                apexBadge.textContent = 'Connected';
                apexBadge.classList.add('connected');
            } else if (optedIn) {
                apexBadge.textContent = 'Tab closed';
                apexBadge.classList.add('expired');
            } else {
                paintIdleBadge(apexBadge, 'apex');
            }
        }

        if (apexDisconnectBtn) apexDisconnectBtn.style.display = optedIn ? '' : 'none';
        showRowApex(optedIn);
        setConnected('apex', optedIn);
        if (!apexStatus) return;

        if (connected) {
            apexStatus.textContent = 'Connected — keep the Apex tab open while you work.';
            apexStatus.style.color = '#16a34a';
            if (apexLoginBtn) apexLoginBtn.textContent = 'Open Apex again';
        } else if (optedIn) {
            apexStatus.textContent = 'No Apex tab open — checks need one.';
            apexStatus.style.color = '#ea580c';
            if (apexLoginBtn) apexLoginBtn.textContent = 'Open Apex';
        } else {
            apexStatus.textContent = detected.apex
                ? 'Apex is open in a tab — connect it to check broker credit here.'
                : 'Not connected — open Apex and log in to enable broker credit checks.';
            apexStatus.style.color = '';
            if (apexLoginBtn) apexLoginBtn.textContent = 'Open Apex';
        }
    }

    function refreshApex() {
        try {
            chrome.runtime.sendMessage({ type: 'apex_status' }, (r) => {
                if (chrome.runtime.lastError) return;
                renderApex(r && r.ok ? r.data : null);
            });
        } catch {
            /* extension context not ready */
        }
    }

    // View switching --------------------------------------------------------
    // provider: 'rts' | 'triumph' | 'apex' — each carries live status from the
    // background, so only the opened one is refreshed.
    function openDetail(provider) {
        grid.style.display = 'none';
        if (intro) intro.style.display = 'none';
        detail.style.display = '';
        if (cardRts) cardRts.style.display = provider === 'rts' ? '' : 'none';
        if (cardTriumph) cardTriumph.style.display = provider === 'triumph' ? '' : 'none';
        if (cardApex) cardApex.style.display = provider === 'apex' ? '' : 'none';
        if (provider === 'triumph') refreshTriumph();
        else if (provider === 'apex') refreshApex();
        else refresh();
    }
    function showGrid() {
        detail.style.display = 'none';
        grid.style.display = '';
        if (intro) intro.style.display = '';
        refresh();
        refreshTriumph();
        refreshApex();
    }

    // Gate the whole tab on extension login: the provider tiles only appear once
    // the user is signed in. Otherwise we show a "log in first" prompt.
    function applyAuthGate() {
        try {
            chrome.storage.local.get(['backendToken'], (d) => {
                const signedIn = !!(d && d.backendToken);
                if (signedIn) {
                    if (loginBox) loginBox.style.display = 'none';
                    showGrid();
                } else {
                    if (intro) intro.style.display = 'none';
                    grid.style.display = 'none';
                    detail.style.display = 'none';
                    if (loginBox) loginBox.style.display = 'flex';
                }
            });
        } catch {
            /* extension context not ready */
        }
    }

    if (tileRts) tileRts.addEventListener('click', () => openDetail('rts'));
    if (tileTriumph) tileTriumph.addEventListener('click', () => openDetail('triumph'));
    if (tileApex) tileApex.addEventListener('click', () => openDetail('apex'));
    if (backBtn) backBtn.addEventListener('click', showGrid);
    if (loginBtn && typeof triggerLogin === 'function') {
        loginBtn.addEventListener('click', () => triggerLogin());
    }

    // Login / disconnect ----------------------------------------------------
    // Goes through the background so the opt-in is recorded — same as Triumph
    // and Apex. Opening the tab straight from here would connect RTS without
    // ever making its control appear in the load panel.
    btn.addEventListener('click', () => {
        try {
            chrome.runtime.sendMessage({ type: 'rts_open_login' }, () => {
                if (chrome.runtime.lastError) return;
            });
        } catch {
            /* extension context not ready */
        }
    });

    // Triumph — goes through the background rather than opening the tab here, so
    // the portal's content script is armed to capture the token BEFORE the tab
    // exists. Opening the URL directly would miss this very login.
    if (triumphLoginBtn) {
        triumphLoginBtn.addEventListener('click', () => {
            try {
                chrome.runtime.sendMessage({ type: 'triumph_open_login' }, () => {
                    if (chrome.runtime.lastError) return;
                });
            } catch {
                /* extension context not ready */
            }
        });
    }

    // Apex — opening the tab IS connecting: there's no login for us to capture,
    // just the session the portal keeps in its own cookie.
    if (apexLoginBtn) {
        apexLoginBtn.addEventListener('click', () => {
            try {
                chrome.runtime.sendMessage({ type: 'apex_open_login' }, () => {
                    if (chrome.runtime.lastError) return;
                    refreshApex();
                });
            } catch {
                /* extension context not ready */
            }
        });
    }

    if (apexDisconnectBtn) {
        apexDisconnectBtn.addEventListener('click', () => {
            apexDisconnectBtn.disabled = true;
            chrome.runtime.sendMessage({ type: 'apex_disconnect' }, () => {
                apexDisconnectBtn.disabled = false;
                refreshApex();
            });
        });
    }

    if (triumphDisconnectBtn) {
        triumphDisconnectBtn.addEventListener('click', () => {
            triumphDisconnectBtn.disabled = true;
            chrome.runtime.sendMessage({ type: 'triumph_disconnect' }, () => {
                triumphDisconnectBtn.disabled = false;
                refreshTriumph();
            });
        });
    }

    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
            disconnectBtn.disabled = true;
            chrome.runtime.sendMessage({ type: 'rts_disconnect' }, () => {
                disconnectBtn.disabled = false;
                refresh();
            });
        });
    }

    // Opening the Factoring tab re-applies the login gate (grid or login prompt).
    const tabBtn = document.querySelector('.tab[data-tab="factoring"]');
    if (tabBtn) tabBtn.addEventListener('click', applyAuthGate);

    // Live updates: RTS token (badge) and extension login state (gate).
    try {
        chrome.storage.onChanged.addListener((ch, area) => {
            if (area !== 'local') return;
            if (ch.rtsToken) refresh();
            if (ch.triumphToken || ch.triumphEnabled) refreshTriumph();
            if (ch.apexEnabled) refreshApex();
            if (ch.rtsShow || ch.triumphShow || ch.apexShow) paintSelectedPills();
            if (ch.backendToken) applyAuthGate();
        });
    } catch {}

    // Initial state.
    applyAuthGate();
    refreshDetected();
})();
