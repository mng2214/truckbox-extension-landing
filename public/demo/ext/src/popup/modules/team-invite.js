/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
// "Acme invited you to their team → Review": Accept / Decline live in the cabinet (the team pays for
// the seat and sees activity stats, so the decision gets the full explanation there).
(function () {
    const CABINET_URL = 'https://truckbox.app/business/accounts';

    function load() {
        const el = document.getElementById('teamInviteNotice');
        if (!el) return;
        chrome.runtime.sendMessage({type: 'team_invites'}, (r) => {
            if (chrome.runtime.lastError || !r || !r.ok || !Array.isArray(r.data) || !r.data.length) {
                el.hidden = true;
                return;
            }
            el.textContent = r.data[0].organizationName + ' invited you to their team → Review';
            el.hidden = false;
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('teamInviteNotice');
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({url: CABINET_URL});
            });
        }
        load();
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.backendToken) load();
        });
    });
})();
