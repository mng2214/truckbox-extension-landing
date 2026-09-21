/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
// Shows why the popup is signed out when the account was taken over by another computer
// (background/modules/device-session.js stores signedOutReason). Hidden again after sign-in.
(function () {
    const TEAM_URL = 'https://truckbox.app/business/start';

    function render() {
        const el = document.getElementById('deviceSignedOutNotice');
        if (!el) return;
        chrome.storage.local.get(['signedOutReason', 'backendToken'], (d) => {
            el.hidden = !(d && d.signedOutReason === 'other_device' && !d.backendToken);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const link = document.getElementById('deviceNoticeTeamLink');
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({url: TEAM_URL});
            });
        }
        render();
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && (changes.signedOutReason || changes.backendToken)) render();
        });
    });
})();
