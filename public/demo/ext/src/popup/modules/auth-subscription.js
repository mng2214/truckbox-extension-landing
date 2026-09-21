/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */

// Shows "Phone verified ✓ <masked> · Change" only once the user is signed in. Before
// login there is no phone UI — just "Sign in with Google" (which opens the verify tab
// when the phone isn't verified yet).
async function renderPhoneState() {
    const verifiedRow = document.getElementById('phoneVerifiedRow');
    if (!verifiedRow) return;
    verifiedRow.hidden = true;

    const token = await getBackendToken();
    if (!token) return;

    const me = await new Promise((res) =>
        chrome.runtime.sendMessage({type: 'auth_me'}, (r) => res(r || {})));
    if (me?.user?.phoneVerified && me.user.phoneMasked) {
        document.getElementById('phoneMaskedText').textContent = me.user.phoneMasked;
        verifiedRow.hidden = false;
    }
}

async function updateAuthStatus() {
    if (!$status) return;

    renderPhoneState();

    const backendToken = await getBackendToken();

    if (!backendToken) {
        $status.textContent = 'Not signed in';
        $status.className = 'status err';
        return;
    }

    chrome.runtime.sendMessage({type: 'auth_me'}, (r) => {
        if (chrome.runtime.lastError) {
            console.log('auth_me error:', chrome.runtime.lastError.message);
            $status.textContent = 'Not signed in';
            $status.className = 'status err';
            return;
        }

        if (r?.ok && r.signedIn) {
            $status.textContent = 'Signed in';
            $status.className = 'status ok';
        } else {
            $status.textContent = 'Not signed in';
            $status.className = 'status err';
        }
    });
}

// Local copy of the background's getDeviceId — popup can't call background helpers
// directly, but both read the same chrome.storage.local.deviceId, so they agree.
async function getDeviceId() {
    const d = await chrome.storage.local.get(["deviceId"]);
    if (d.deviceId) return d.deviceId;
    let id;
    try { id = crypto.randomUUID(); }
    catch { id = "dev_" + Date.now() + "_" + Math.random().toString(36).slice(2); }
    await chrome.storage.local.set({deviceId: id});
    return id;
}

async function backendFetch(path, options = {}) {
    const token = await getBackendToken();
    const sessionId = await getSessionId();
    const deviceId = await getDeviceId();

    const extensionVersion = chrome.runtime.getManifest().version;

    const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        "X-Extension-Version": extensionVersion,
        "X-Device-Id": deviceId
    };

    if (sessionId) {
        headers['X-Session-Id'] = sessionId;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers
    });

    if (response.status === 401 || response.status === 403) {
        // 1069 = this account signed in on another computer: remember why, so the popup says so.
        const body = await response.clone().json().catch(() => null);
        if (body && body.code === 1069) {
            await chrome.storage.local.set({signedOutReason: 'other_device', signedOutAt: Date.now()});
        }
        await clearBackendAuth();
        await updateAuthStatus();
        setSubscriptionLoggedOutState();
        setStatsLoggedOutState();
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        // Keep the backend's ErrorCode on the error so callers can say what actually went wrong
        // instead of falling back to "try again".
        let code = null;
        try {
            code = JSON.parse(text)?.code ?? null;
        } catch {
            /* not JSON */
        }
        const error = new Error(text || `Request failed: ${response.status}`);
        error.code = code;
        error.status = response.status;
        throw error;
    }

    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('application/json') ? response.json() : response.text();
}

function renderSubscription(userStatus) {
    if (!$planStatusText || !$planAccessText || !$startSubscriptionBtn || !$cancelSubscriptionBtn) {
        return;
    }

    const status = String(userStatus?.planStatus || '').toUpperCase();
    const canUseExtension = !!userStatus?.canUseExtension;
    const cancelAtPeriodEnd = !!userStatus?.cancelAtPeriodEnd;
    const trialEnd = userStatus?.trialEnd;
    const planExpiresAt = userStatus?.planExpiresAt;
    const isCanceled = status === 'ACTIVE' && cancelAtPeriodEnd;

    setSubscriptionLoggedInState();

    if ($cancelTeamSubscriptionBtn) $cancelTeamSubscriptionBtn.style.display = 'none';

    // Team members are covered by their company plan — personal billing does not apply.
    if (userStatus?.teamMember) {
        renderTeamSubscription(
            !!userStatus?.teamOwner,
            userStatus?.organizationName,
            cancelAtPeriodEnd,
            planExpiresAt,
            userStatus?.hasSeat !== false,
            !!userStatus?.canUseExtension
        );
        return;
    }

    $startSubscriptionBtn.style.display = 'inline-block';
    $cancelSubscriptionBtn.style.display = 'inline-block';

    if (!status) {
        $planStatusText.textContent = 'Unavailable';
        $planAccessText.textContent = 'Unknown';
        if ($planDateText) $planDateText.textContent = '—';

        $startSubscriptionBtn.textContent = 'Start Subscription';
        $startSubscriptionBtn.disabled = false;
        $cancelSubscriptionBtn.disabled = true;
        return;
    }

    $planStatusText.textContent = isCanceled ? 'ACTIVE (CANCELED)' : status;

// reset class
    $planStatusText.className = 'status';

// apply styles
    switch (status) {
        case 'FREE':
            $planStatusText.classList.add('status-free');
            break;
        case 'ACTIVE':
            $planStatusText.classList.add('status-active');
            break;
        case 'TRIAL':
            $planStatusText.classList.add('status-trial');
            break;
        case 'EXPIRED':
            $planStatusText.classList.add('status-expired');
            break;
        default:
            $planStatusText.classList.add('muted');
    }

    if (isCanceled) {
        $planStatusText.classList.remove('status-active');
        $planStatusText.classList.add('status-expired');
    }

    $planAccessText.textContent = canUseExtension ? 'Enabled' : 'Disabled';

    if (status === 'TRIAL') {
        if ($planDateText) {
            $planDateText.textContent = trialEnd ? `Trial ends ${formatBackendDate(trialEnd)}` : '—';
        }

        $startSubscriptionBtn.textContent = 'Start Subscription';
        $startSubscriptionBtn.disabled = false;
        $cancelSubscriptionBtn.disabled = true;
        return;
    }

    if (status === 'ACTIVE') {

        if ($planDateText) {
            let text = planExpiresAt ? `Access until ${formatBackendDate(planExpiresAt)}` : '—';
            if (cancelAtPeriodEnd) {
                text += ' • Subscription ends (no renewal)';
            }
            $planDateText.textContent = text;
        }

        if (cancelAtPeriodEnd) {
            $startSubscriptionBtn.textContent = 'Subscribe Again';
            $startSubscriptionBtn.disabled = false;
            $cancelSubscriptionBtn.disabled = true;
        } else {
            $startSubscriptionBtn.textContent = 'Subscribed';
            $startSubscriptionBtn.disabled = true;
            $cancelSubscriptionBtn.disabled = false;
        }
        return;
    }

    if (status === 'FREE') {
        $planAccessText.textContent = 'Enabled';

        if ($planDateText) {
            $planDateText.textContent = 'Free plan';
        }

        $startSubscriptionBtn.style.display = 'none';
        $cancelSubscriptionBtn.style.display = 'none';
        return;
    }

    if (status === 'EXPIRED') {

        if ($planDateText) {
            $planDateText.textContent = planExpiresAt
                ? `Expired ${formatBackendDate(planExpiresAt)}`
                : '—';
        }

        $startSubscriptionBtn.style.display = 'inline-block';
        $cancelSubscriptionBtn.style.display = 'inline-block';
        $startSubscriptionBtn.textContent = 'Start Subscription';
        $startSubscriptionBtn.disabled = false;
        $cancelSubscriptionBtn.disabled = true;
        return;
    }

    $planStatusText.className = 'status muted';
    if ($planDateText) $planDateText.textContent = '—';

    $startSubscriptionBtn.textContent = 'Start Subscription';
    $startSubscriptionBtn.disabled = false;
    $cancelSubscriptionBtn.disabled = true;
}

async function loadUserSubscriptionStatus() {
    if (!$planStatusText) return;

    try {
        const backendToken = await getBackendToken();

        if (!backendToken) {
            setSubscriptionLoggedOutState();
            return;
        }

        setSubscriptionLoggedInState();

        if ($startSubscriptionBtn) {
            $startSubscriptionBtn.textContent = 'Start Subscription';
            $startSubscriptionBtn.style.display = 'none';
        }

        if ($cancelSubscriptionBtn) {
            $cancelSubscriptionBtn.style.display = 'none';
        }

        const data = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'user_status_get' }, (r) => {
                if (chrome.runtime.lastError || !r?.ok) {
                    reject(r?.error || 'failed');
                } else {
                    resolve(r.data);
                }
            });
        });
        renderSubscription(data);
    } catch (e) {
        console.log('loadUserSubscriptionStatus failed', e);
        setSubscriptionLoggedOutState();
    }
}

async function startSubscriptionFlow() {
    if (!$startSubscriptionBtn) return;

    try {
        $startSubscriptionBtn.disabled = true;

        const data = await backendFetch('/billing/create-checkout-session', {
            method: 'POST'
        });

        if (data?.url) {
            chrome.tabs.create({url: data.url});
            saySubscription('Checkout opened');
        } else {
            saySubscription('Checkout URL missing', true);
        }
    } catch (e) {
        console.log('startSubscriptionFlow failed', e);
        saySubscription('Failed to start subscription', true);
    } finally {
        $startSubscriptionBtn.disabled = false;
    }
}

async function cancelSubscriptionFlow() {
    if (!$cancelSubscriptionBtn) return;

    try {
        $cancelSubscriptionBtn.disabled = true;

        await backendFetch('/billing/cancel-subscription', {
            method: 'POST'
        });

        saySubscription('Subscription will cancel at period end');
        await loadUserSubscriptionStatus();
        chrome.tabs.create({url: 'https://truckbox.app/cancel'});
    } catch (e) {
        console.log('cancelSubscriptionFlow failed', e);
        if (e && e.code === 1012) {
            // Already cancelled — somewhere else, or a double click. Show the real state.
            saySubscription('Subscription already ends at the end of the period');
            await loadUserSubscriptionStatus();
        } else if (e && e.code === 1013) {
            saySubscription('No paid subscription to cancel', true);
        } else {
            saySubscription('Failed to cancel subscription', true);
        }
    } finally {
        $cancelSubscriptionBtn.disabled = false;
    }
}

// hasSeat: a role in the company is free — only a billed seat covers the extension. A seatless
// owner (signed up "back office only") may still be inside their own trial, so say where the
// access really comes from instead of crediting the company for it.
function renderTeamSubscription(isOwner, organizationName, cancelAtPeriodEnd, planExpiresAt,
                                hasSeat, canUseExtension) {
    const canceled = !!cancelAtPeriodEnd;
    const baseName = organizationName ? `TEAM · ${organizationName}` : 'TEAM';

    $planStatusText.textContent = canceled ? `${baseName} · Cancelling` : baseName;
    // Green when active; orange when scheduled to cancel.
    $planStatusText.className = canceled ? 'status' : 'status status-active';
    $planStatusText.style.color = canceled ? '#ea580c' : '';

    if (!hasSeat) {
        $planStatusText.textContent = `${baseName} · No seat`;
        $planStatusText.className = 'status';
        $planStatusText.style.color = canUseExtension ? '' : '#ea580c';
        $planAccessText.textContent = canUseExtension ? 'Enabled' : 'Disabled';
        if ($planDateText) {
            $planDateText.textContent = canUseExtension
                ? 'Your own plan, not a company seat — ask your manager for a seat to keep sending'
                : 'Back office only. Ask your manager to give you a seat.';
        }
    } else {
        $planAccessText.textContent = canceled ? 'Cancels at period end' : 'Enabled';

        if ($planDateText) {
            if (canceled) {
                $planDateText.textContent = planExpiresAt
                    ? `Active until ${formatBackendDate(planExpiresAt)}`
                    : 'Active until period end';
            } else {
                $planDateText.textContent = organizationName
                    ? `Covered by ${organizationName}`
                    : 'Covered by your company plan';
            }
        }
    }

    // Personal billing buttons never apply to team members.
    $startSubscriptionBtn.style.display = 'none';
    $cancelSubscriptionBtn.style.display = 'none';

    if ($cancelTeamSubscriptionBtn) {
        // Owner can cancel; once already cancelling, hide it (no double-cancel).
        $cancelTeamSubscriptionBtn.style.display =
            isOwner && !canceled ? 'inline-block' : 'none';
        $cancelTeamSubscriptionBtn.disabled = false;
    }
}

async function cancelTeamSubscriptionFlow() {
    if (!$cancelTeamSubscriptionBtn) return;

    try {
        $cancelTeamSubscriptionBtn.disabled = true;

        await backendFetch('/billing/cancel-team-subscription', {
            method: 'POST'
        });

        saySubscription('Team subscription will cancel at period end');
        await loadUserSubscriptionStatus();
    } catch (e) {
        console.log('cancelTeamSubscriptionFlow failed', e);
        saySubscription('Failed to cancel team subscription', true);
    } finally {
        $cancelTeamSubscriptionBtn.disabled = false;
    }
}
