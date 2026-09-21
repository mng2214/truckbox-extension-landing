
document.addEventListener('DOMContentLoaded', () => {
    createResetButton();

    // Templates are now account-backed (≤3, switchable). The manager loads them,
    // renders the switcher, mirrors the active one into chrome.storage (so the
    // send flow is unchanged) and owns the Save button + field auto-save.
    if (typeof initTemplates === 'function') initTemplates();

    // Header day/night toggle. Flips chrome.storage.local.tbDarkMode; the content
    // script applies `html.tb-dark` on the open DAT/Truckstop tab. Inlined here
    // (in the proven init path) so it always runs.
    (function setupDarkToggle() {
        var dbtn = document.getElementById('darkToggle');
        if (!dbtn) return;
        var dOn = false;
        function dSync() {
            dbtn.textContent = dOn ? 'NIGHT' : 'DAY';
            dbtn.title = dOn ? 'Switch to light mode' : 'Switch to dark mode';
        }
        try {
            chrome.storage.local.get(['tbDarkMode'], function (d) {
                dOn = !!(d && d.tbDarkMode);
                dSync();
            });
            chrome.storage.onChanged.addListener(function (ch, area) {
                if (area === 'local' && ch.tbDarkMode) {
                    dOn = !!ch.tbDarkMode.newValue;
                    dSync();
                }
            });
        } catch (e) { /* ignore */ }
        dbtn.addEventListener('click', function () {
            dOn = !dOn;
            dSync();
            try { chrome.storage.local.set({ tbDarkMode: dOn }); } catch (e) { /* ignore */ }
        });
        dSync();
    })();

    document.getElementById('changePhoneBtn')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({type: 'open_change_phone'}, () => window.close());
    });

    updateAuthStatus();
    loadUserSubscriptionStatus();
    loadSessionId();

    $logoutBtn?.addEventListener('click', async () => {
        $logoutBtn.disabled = true;

        await clearBackendAuth();

        chrome.runtime.sendMessage({type: 'auth_logout'}, () => {
            if (chrome.runtime.lastError) {
                console.log('auth_logout error:', chrome.runtime.lastError.message);
            }

            $logoutBtn.disabled = false;

            if ($status) {
                $status.textContent = 'Not signed in';
                $status.className = 'status err';
            }

            setSubscriptionLoggedOutState();
            setStatsLoggedOutState();
            loadSessionId();
        });
    });

    $startSubscriptionBtn?.addEventListener('click', () => {
        startSubscriptionFlow();
    });

    $cancelSubscriptionBtn?.addEventListener('click', () => {
        if (confirm('Cancel subscription at period end?')) {
            cancelSubscriptionFlow();
        }
    });

    $cancelTeamSubscriptionBtn?.addEventListener('click', () => {
        if (confirm('Cancel the team subscription? Every member will lose access at the end of the billing period.')) {
            cancelTeamSubscriptionFlow();
        }
    });

    $signBtn?.addEventListener('click', () => {
        $signBtn.disabled = true;
        setSignInLabel($signBtn, 'Signing in...');

        chrome.runtime.sendMessage({type: 'auth_login'}, (r) => {
            $signBtn.disabled = false;
            setSignInLabel($signBtn, 'Sign in with Google');

            if (chrome.runtime.lastError) {
                console.log('auth_login error:', chrome.runtime.lastError.message);
                say('Sign-in failed', true);
                updateAuthStatus();
                loadUserSubscriptionStatus();
                loadSessionId();
                return;
            }

            if (!r?.ok) {
                say('Sign-in failed', true);
                updateAuthStatus();
                loadUserSubscriptionStatus();
                loadSessionId();
                return;
            }

            say('Signed in successfully');

            setTimeout(async () => {
                await updateAuthStatus();
                await loadUserSubscriptionStatus();
                loadSessionId();
            }, 250);
        });
    });

    var tabs = document.querySelectorAll('.tab');
    var tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            var targetTab = tab.getAttribute('data-tab');
            if (!targetTab) return;

            tabs.forEach((t) => t.classList.remove('active'));
            tabContents.forEach((tc) => tc.classList.remove('active'));

            tab.classList.add('active');

            var targetEl = document.getElementById(`${targetTab}-tab`);
            targetEl?.classList.add('active');

            if (targetTab === 'stats') {
                loadStats();
            }

            if (targetTab === 'subscription') {
                loadUserSubscriptionStatus();
            }
        });
    });

    // One-time deep link: the load panel's "choose your factoring" prompt asks
    // the background to open this popup and leaves a hint about where to land.
    // Cleared on read so it only affects the very next open, not every one.
    try {
        chrome.storage.local.get(['openToSection'], (d) => {
            const section = d && d.openToSection;
            if (!section) return;
            chrome.storage.local.remove('openToSection');
            document.querySelector(`.tab[data-tab="${section}"]`)?.click();
        });
    } catch {
        /* extension context not ready */
    }

    $subscriptionLoginBtn?.addEventListener('click', () => {
        triggerLogin();
    });

    $statsLoginBtn?.addEventListener('click', () => {
        triggerLogin();
    });

    if (document.querySelector('#stats-tab')?.classList.contains('active')) {
        loadStats();
    }
});
