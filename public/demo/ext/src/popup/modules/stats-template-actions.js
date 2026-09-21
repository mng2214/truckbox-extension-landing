
function createResetButton() {
    const actionsDiv = $save?.closest('.actions');
    if (!actionsDiv) return;
    if (document.getElementById('resetBtn')) return;

    const resetBtn = document.createElement('button');
    resetBtn.id = 'resetBtn';
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset to Defaults';
    resetBtn.style.cssText = `
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #64748b;
        font-weight: 500;
    `;

    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();

        if (!confirm('Reset all fields to default values?')) return;

        if ($subj) $subj.value = defaults.templateSubject;
        if ($body) $body.value = defaults.templateBody;
        if ($name) $name.value = defaults.myName;
        if ($mc) $mc.value = defaults.myMc;
        if ($ph) $ph.value = defaults.myPhone;

        const payload = {
            templateSubject: defaults.templateSubject,
            templateBody: defaults.templateBody,
            myName: defaults.myName,
            myMc: defaults.myMc,
            myPhone: defaults.myPhone
        };

        chrome.runtime.sendMessage({type: 'template_set', data: payload}, (r) => {
            if (chrome.runtime.lastError) {
                console.log('template_set error:', chrome.runtime.lastError.message);
                say('Reset failed', true);
                return;
            }

            if (r?.ok) {
                say('Reset to defaults');
            } else {
                say('Reset failed', true);
            }
        });
    });

    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '10px';
    actionsDiv.appendChild(resetBtn);
}

function safeSendToTab(tabId, message) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
                console.log('tabs.sendMessage skipped:', chrome.runtime.lastError.message);
                resolve(null);
                return;
            }
            resolve(response || null);
        });
    });
}

async function loadStats() {
    try {
        const backendToken = await getBackendToken();

        if (!backendToken) {
            setStatsLoggedOutState();
            return;
        }

        chrome.runtime.sendMessage({ type: 'stats_get' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('stats_get error:', chrome.runtime.lastError.message);
                if (statTotal) statTotal.textContent = '—';
                if (statMapViewed) statMapViewed.textContent = '—';
                if (statCall) statCall.textContent = '—';
                if (statTimeSaved) statTimeSaved.textContent = '—';
                if (reviewBlock) reviewBlock.style.display = 'none';
                return;
            }

            if (response?.ok) {
                const stats = response.data || {};

                const emailCount = Number(stats.total || 0);
                const mapCount = Number(stats.mapViewedCount || 0);
                const callCount = Number(stats.phoneCallCount || 0);
                const totalActions = emailCount + mapCount + callCount;

                setStatsLoggedInState(totalActions);

                // Total row.
                if (statTotal) statTotal.textContent = String(emailCount);
                if (statMapViewed) statMapViewed.textContent = String(mapCount);
                if (statCall) statCall.textContent = String(callCount);
                if (statTimeSaved) statTimeSaved.textContent = formatTimeSaved(totalActions);

                // Per-platform rows.
                const dat = stats.dat || { email: 0, map: 0, call: 0 };
                const ts = stats.truckstop || { email: 0, map: 0, call: 0 };
                if (statDatEmail) statDatEmail.textContent = String(dat.email || 0);
                if (statDatMap) statDatMap.textContent = String(dat.map || 0);
                if (statDatCall) statDatCall.textContent = String(dat.call || 0);
                if (statTsEmail) statTsEmail.textContent = String(ts.email || 0);
                if (statTsMap) statTsMap.textContent = String(ts.map || 0);
                if (statTsCall) statTsCall.textContent = String(ts.call || 0);
            } else {
                [statTotal, statMapViewed, statCall, statTimeSaved,
                    statDatEmail, statDatMap, statDatCall,
                    statTsEmail, statTsMap, statTsCall].forEach((el) => {
                    if (el) el.textContent = '—';
                });
                if (reviewBlock) reviewBlock.style.display = 'none';
            }
        });
    } catch (e) {
        console.log('loadStats failed', e);
        setStatsLoggedOutState();
    }
}
