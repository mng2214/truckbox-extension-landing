/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */

(function tripFilterSection() {
    const $en = document.getElementById('tripFilterEnabled');
    const $min = document.getElementById('tripMinMiles');
    const $apply = document.getElementById('filterApplyBtn');
    const $clear = document.getElementById('filterClearBtn');
    const $filterMsg = document.getElementById('filterMsg');

    const sayFilter = (t, err = false) => {
        if (!$filterMsg) return;
        $filterMsg.textContent = t;
        $filterMsg.style.color = err ? '#ef4444' : '#16a34a';

        setTimeout(() => {
            $filterMsg.textContent = '';
        }, 1600);
    };

    chrome.storage.local.get(['tripFilterEnabled', 'tripMinMiles'], (d) => {
        if ($en) $en.checked = !!d.tripFilterEnabled;
        if ($min) $min.value = d.tripMinMiles ?? '';
        if ($min && $en) $min.disabled = !$en.checked;

        $en?.addEventListener('change', () => {
            if ($min) $min.disabled = !$en.checked;
        });
    });

    $apply?.addEventListener('click', async () => {
        const enabled = !!$en?.checked;
        const minMiles = Math.min(5000, Math.max(0, parseInt($min?.value || '0', 10) || 0));

        await chrome.storage.local.set({
            tripFilterEnabled: enabled,
            tripMinMiles: minMiles
        });

        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        const target = loadsUrlForTab(tab);

        if (tab?.url?.startsWith(target) && tab.id) {
            await safeSendToTab(tab.id, {type: 'trip_filter_apply'});
        } else if (tab?.id) {
            chrome.tabs.update(tab.id, {url: target});
        } else {
            chrome.tabs.create({url: target});
        }

        sayFilter('Saved');
    });

    $clear?.addEventListener('click', async () => {
        await chrome.storage.local.set({
            tripFilterEnabled: false,
            tripMinMiles: 0
        });

        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

        if (tab?.id) {
            await safeSendToTab(tab.id, {type: 'trip_filter_apply'});
        }

        if ($en) $en.checked = false;
        if ($min) $min.value = '';
        if ($min) $min.disabled = true;

        sayFilter('Cleared');
    });
})();

// Map on/off toggle — instant save. The content script picks up the change via
// chrome.storage.onChanged and re-renders open DAT panels live.
(function mapToggleSection() {
    const $map = document.getElementById('mapEnabled');
    const $msg = document.getElementById('mapToggleMsg');
    if (!$map) return;

    const say = (t) => {
        if (!$msg) return;
        $msg.textContent = t;
        $msg.style.color = '#16a34a';
        setTimeout(() => {
            $msg.textContent = '';
        }, 1400);
    };

    chrome.storage.local.get(['mapEnabled'], (d) => {
        $map.checked = d.mapEnabled !== false; // default ON
    });

    $map.addEventListener('change', async () => {
        await chrome.storage.local.set({ mapEnabled: !!$map.checked });
        say('Saved');
    });
})();

// Profit-calculator toggle — instant save, default ON. profit-calc.js watches the
// key and adds or removes the block in every open panel without a reload.
(function profitCalcSection() {
    const $calc = document.getElementById('profitCalcEnabled');
    const $msg = document.getElementById('profitCalcMsg');
    if (!$calc) return;

    const say = (t) => {
        if (!$msg) return;
        $msg.textContent = t;
        $msg.style.color = '#16a34a';
        setTimeout(() => {
            $msg.textContent = '';
        }, 1400);
    };

    chrome.storage.local.get(['profitCalcEnabled'], (d) => {
        $calc.checked = d.profitCalcEnabled !== false; // default ON
    });

    $calc.addEventListener('change', async () => {
        await chrome.storage.local.set({ profitCalcEnabled: !!$calc.checked });
        say('Saved');
    });
})();

// Duplicate-load greyout toggle — instant save, default ON. Content script
// re-applies live via chrome.storage.onChanged.
(function dupFilterSection() {
    const $dup = document.getElementById('dupFilterEnabled');
    const $msg = document.getElementById('dupToggleMsg');
    if (!$dup) return;

    const say = (t) => {
        if (!$msg) return;
        $msg.textContent = t;
        $msg.style.color = '#16a34a';
        setTimeout(() => {
            $msg.textContent = '';
        }, 1400);
    };

    chrome.storage.local.get(['dupFilterEnabled'], (d) => {
        $dup.checked = d.dupFilterEnabled !== false; // default ON
    });

    $dup.addEventListener('change', async () => {
        await chrome.storage.local.set({ dupFilterEnabled: !!$dup.checked });
        say('Saved');
    });
})();

// DAT's own send-email button — instant save, default OFF (button hidden), so a
// fresh install shows one envelope, not two. Content script re-applies live via
// chrome.storage.onChanged.
(function datOwnEmailButtonSection() {
    const $on = document.getElementById('datOwnEmailBtnEnabled');
    const $msg = document.getElementById('datOwnEmailBtnMsg');
    if (!$on) return;

    const say = (t) => {
        if (!$msg) return;
        $msg.textContent = t;
        $msg.style.color = '#16a34a';
        setTimeout(() => {
            $msg.textContent = '';
        }, 1400);
    };

    chrome.storage.local.get(['datOwnEmailBtnEnabled'], (d) => {
        $on.checked = !!(d && d.datOwnEmailBtnEnabled); // default OFF
    });

    $on.addEventListener('change', async () => {
        await chrome.storage.local.set({ datOwnEmailBtnEnabled: !!$on.checked });
        say('Saved');
    });
})();
