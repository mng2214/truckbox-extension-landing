// Web fonts load after first paint so the popup opens instantly; system fonts show until they swap.
(function attachWebFonts() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900'
        + '&family=Inter:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap';
    requestAnimationFrame(() => document.head.appendChild(link));
})();

var setLocal = (obj) => new Promise((res) => chrome.storage.local.set(obj, res));

// Picks the loads-search URL for the active tab's site. Defaults to DAT for any
// non-truckstop host, so DAT behaviour is unchanged.
function loadsUrlForTab(tab) {
    var host = '';
    try { host = new URL(tab && tab.url ? tab.url : '').hostname; } catch (e) {}
    // TODO: confirm the real truckstop.com loads-search URL once available.
    if (host.endsWith('truckstop.com')) return 'https://truckstop.com/loadboard/search';
    return 'https://one.dat.com/search-loads';
}


//    const API_BASE_URL = 'https://platform.truckbox.app/api/v1';

//  const API_BASE_URL = 'https://truckbox-app-6lcca.ondigitalocean.app/api/v1';
    const API_BASE_URL = 'http://localhost:8080/api/v1'; // local
//  const API_BASE_URL = 'https://api.truckbox.app/api/v1'; // prod



var $subj = document.getElementById('templateSubject');
var $body = document.getElementById('templateBody');
var $name = document.getElementById('myName');
var $mc = document.getElementById('myMc');
var $ph = document.getElementById('myPhone');
var $save = document.getElementById('saveBtn');
var $msg = document.getElementById('saveMsg');
var $status = document.getElementById('status');

var $planStatusText = document.getElementById('planStatusText');
var $planAccessText = document.getElementById('planAccessText');
var $planDateText = document.getElementById('planDateText');
var $startSubscriptionBtn = document.getElementById('startSubscriptionBtn');
var $cancelSubscriptionBtn = document.getElementById('cancelSubscriptionBtn');
var $cancelTeamSubscriptionBtn = document.getElementById('cancelTeamSubscriptionBtn');
var $subscriptionMsg = document.getElementById('subscriptionMsg');

var $subscriptionContent = document.getElementById('subscriptionContent');
var $subscriptionLoginRequiredBox = document.getElementById('subscriptionLoginRequiredBox');
var $subscriptionLoginBtn = document.getElementById('subscriptionLoginBtn');

var $statsContent = document.getElementById('statsContent');
var $statsLoginRequiredBox = document.getElementById('statsLoginRequiredBox');
var $statsLoginBtn = document.getElementById('statsLoginBtn');

var $logoutBtn = document.getElementById('logoutBtn');
var $signBtn = document.getElementById('login') || document.getElementById('loginBtn');

// Changes a sign-in button's text without wiping its brand logo.
function setSignInLabel(btn, text) {
    const label = btn?.querySelector('.btn-label');
    if (label) label.textContent = text;
    else if (btn) btn.textContent = text;
}

var statTotal = document.getElementById('stat-total');
var reviewBlock = document.getElementById('reviewBlock');
var statTimeSaved = document.getElementById('stat-time-saved');
var statMapViewed = document.getElementById('stat-map-viewed');
var statCall = document.getElementById('stat-call');

// Per-platform breakdown cells (DAT / Truckstop).
var statDatEmail = document.getElementById('stat-dat-email');
var statDatMap = document.getElementById('stat-dat-map');
var statDatCall = document.getElementById('stat-dat-call');
var statTsEmail = document.getElementById('stat-ts-email');
var statTsMap = document.getElementById('stat-ts-map');
var statTsCall = document.getElementById('stat-ts-call');

var $sessionIdValue = document.getElementById('sessionIdValue');
var $copySessionIdBtn = document.getElementById('copySessionIdBtn');
var $sessionCopyMsg = document.getElementById('sessionCopyMsg');

var defaults = {
    templateSubject: 'Change me Load Inquiry: {{origin}} → {{destination}} ({{pickupDate}}) referenceId : {{referenceId}}',

    templateBody: `Hi,

I have a truck available for this load:

Origin: {{origin}}
Destination: {{destination}}
Pickup Date: {{pickupDate}}
Equipment: {{equipment}}
Length: {{length}}
Weight: {{weight}}

Can you please confirm:
- Is the load still available?
- Pickup / delivery details?
- Best rate?

Thanks,  
{{myName}}  
MC: {{myMc}}  
Phone: {{myPhone}}`,

    myName: 'Change Me',
    myMc: '1234567',
    myPhone: '(555) 555-5555'
};

// Status toast next to the Save button: slides in with a drawn check (or cross), then fades.
var sayTimer = null;
var say = (t, isError = false) => {
    if (!$msg) return;
    const icon = isError
        ? '<path d="M4 4l8 8M12 4l-8 8" fill="none" stroke-width="2.2" stroke-linecap="square"/>'
        : '<path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke-width="2.2" stroke-linecap="square"/>';
    $msg.className = 'tb-toast ' + (isError ? 'is-err' : 'is-ok');
    $msg.innerHTML = '<span class="tb-toast-icon"><svg viewBox="0 0 16 16" aria-hidden="true">' + icon
        + '</svg></span><span></span>';
    $msg.lastChild.textContent = t;
    $msg.setAttribute('role', 'status');
    void $msg.offsetWidth; // restart the entrance when messages come back-to-back
    $msg.classList.add('is-show');
    const save = document.getElementById('saveBtn');
    if (save && !isError && /saved/i.test(t)) {
        save.classList.add('is-saved');
        setTimeout(() => save.classList.remove('is-saved'), 900);
    }
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => $msg.classList.remove('is-show'), 2200);
};

var saySubscription = (t, isError = false) => {
    if (!$subscriptionMsg) return;
    $subscriptionMsg.textContent = t;
    $subscriptionMsg.style.color = isError ? '#ef4444' : '#16a34a';

    setTimeout(() => {
        $subscriptionMsg.textContent = '';
    }, 2500);
};

async function loadSessionId() {
    const sessionId = await getSessionId();

    if (!$sessionIdValue) return;

    if (!sessionId) {
        $sessionIdValue.textContent = 'Not available';
        $sessionIdValue.dataset.full = '';
        $sessionIdValue.title = '';
        return;
    }

    $sessionIdValue.textContent = sessionId;
    $sessionIdValue.dataset.full = sessionId;
    $sessionIdValue.title = sessionId;
}

function showSessionCopyMessage(text, isError = false) {
    if (!$sessionCopyMsg) return;

    $sessionCopyMsg.textContent = text;
    $sessionCopyMsg.style.color = isError ? '#ef4444' : '#16a34a';

    setTimeout(() => {
        $sessionCopyMsg.textContent = '';
    }, 2000);
}

$copySessionIdBtn?.addEventListener('click', async () => {
    const fullValue = $sessionIdValue?.dataset?.full || '';

    if (!fullValue) {
        showSessionCopyMessage('No session ID yet', true);
        return;
    }

    try {
        await navigator.clipboard.writeText(fullValue);
        showSessionCopyMessage('Session ID copied');
    } catch (e) {
        // Fallback for contexts where the async Clipboard API is blocked
        // (e.g. embedded in an iframe without clipboard permission).
        if (copyViaExecCommand(fullValue)) {
            showSessionCopyMessage('Session ID copied');
        } else {
            showSessionCopyMessage('Copy failed', true);
        }
    }
});

function copyViaExecCommand(text) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (e) {
        return false;
    }
}

function getBackendToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['backendToken'], (data) => {
            resolve(data?.backendToken || null);
        });
    });
}

function clearBackendAuth() {
    return new Promise((resolve) => {
        chrome.storage.local.remove(['backendToken', 'sessionId'], resolve);
    });
}

function getSessionId() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['sessionId'], (data) => {
            resolve(data?.sessionId || null);
        });
    });
}

function formatBackendDate(value) {
    if (!value) return '—';

    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);

        return date.toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return String(value);
    }
}

function formatTimeSaved(totalEmails) {
    const totalSeconds = Number(totalEmails || 0) * 30;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} hr`;

    return `${hours} hr ${minutes} min`;
}

function triggerLogin() {
    $signBtn?.click();
}

function setSubscriptionLoggedOutState() {
    if ($planStatusText) {
        $planStatusText.textContent = 'Login required';}

    if ($planAccessText) $planAccessText.textContent = '—';
    if ($planDateText) $planDateText.textContent = '—';

    if ($startSubscriptionBtn) $startSubscriptionBtn.style.display = 'none';
    if ($cancelSubscriptionBtn) $cancelSubscriptionBtn.style.display = 'none';
    if ($cancelTeamSubscriptionBtn) $cancelTeamSubscriptionBtn.style.display = 'none';

    if ($subscriptionContent) {
        $subscriptionContent.classList.add('locked-section');
    }

    if ($subscriptionLoginRequiredBox) {
        $subscriptionLoginRequiredBox.style.display = 'flex';
    }
}

function setSubscriptionLoggedInState() {
    if ($subscriptionContent) {
        $subscriptionContent.classList.remove('locked-section');
    }

    if ($subscriptionLoginRequiredBox) {
        $subscriptionLoginRequiredBox.style.display = 'none';
    }
}

function setStatsLoggedOutState() {
    if (statTotal) statTotal.textContent = '—';
    if (statMapViewed) statMapViewed.textContent = '—';
    if (statCall) statCall.textContent = '—';
    if (statTimeSaved) statTimeSaved.textContent = '—';

    if ($statsContent) {
        $statsContent.classList.add('locked-section');
    }

    if ($statsLoginRequiredBox) {
        $statsLoginRequiredBox.style.display = 'flex';
    }

    if (reviewBlock) {
        reviewBlock.style.display = 'none';
    }
}

function setStatsLoggedInState(totalActions = 0) {
    if ($statsContent) {
        $statsContent.classList.remove('locked-section');
    }

    if ($statsLoginRequiredBox) {
        $statsLoginRequiredBox.style.display = 'none';
    }

    if (reviewBlock) {
        reviewBlock.style.display = totalActions > 0 ? 'block' : 'none';
    }
}
