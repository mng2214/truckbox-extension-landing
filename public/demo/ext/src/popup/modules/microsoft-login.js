/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
// "Sign in with Microsoft" in the Login tab. Hidden unless the backend has Microsoft switched on.
(function () {
    function refreshAfterLogin() {
        setTimeout(async () => {
            if (typeof updateAuthStatus === 'function') await updateAuthStatus();
            if (typeof loadUserSubscriptionStatus === 'function') await loadUserSubscriptionStatus();
            if (typeof loadSessionId === 'function') loadSessionId();
        }, 250);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('loginMicrosoft');
        if (!btn) return;

        chrome.runtime.sendMessage({type: 'auth_providers'}, (r) => {
            if (chrome.runtime.lastError || !r?.ok || !r.data?.microsoft) return;
            btn.hidden = false;
            const desc = document.getElementById('setupDesc');
            if (desc) desc.textContent = 'Sign in with Google or Microsoft to send emails from your Gmail or Outlook account.';
        });

        btn.addEventListener('click', () => {
            btn.disabled = true;
            setSignInLabel(btn, 'Signing in...');
            chrome.runtime.sendMessage({type: 'auth_login_microsoft'}, (r) => {
                btn.disabled = false;
                setSignInLabel(btn, 'Sign in with Microsoft');
                const ok = !chrome.runtime.lastError && r?.ok;
                const message = ok
                    ? 'Signed in successfully'
                    : r?.error === 'email_taken'
                        ? 'This email already has a TruckBox account. Sign in with Google, then link Microsoft in the cabinet Settings.'
                        : 'Sign-in failed';
                if (typeof say === 'function') say(message, !ok);
                refreshAfterLogin();
            });
        });
    });
})();
