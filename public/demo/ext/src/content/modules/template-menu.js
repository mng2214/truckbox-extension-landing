/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
// =========================
// In-page template menu
// =========================
// A small chevron sits right after every injected Send button (DAT list rows, DAT details panel,
// Truckstop). Hovering it — or focusing / clicking it, for keyboard and touch — opens a menu of the
// user's templates, each with the mailbox it sends from. Picking one SENDS IMMEDIATELY with that
// template (through the Send button's own flow, so spinner / check / errors look the same). The
// Send button itself and keyboard shortcut "E" keep sending with the active template.
// Only shown when the account has 2+ templates.
//
// Data: chrome.storage.local.templatesCache (written by the background on every templates_get /
// templates_save, so a popup save refreshes open pages) + mailboxes_list for sender addresses and
// status (refreshed when the menu opens, at most once a minute).

var TB_TPL_MAILBOX_TTL_MS = 60 * 1000;

var tbTpl = {
    templates: [],
    loggedIn: false,
    loginProvider: null,
    accountEmail: null,    // Google sign-in: the Gmail this browser sends from
    mailboxes: null,       // null = not loaded yet
    mailboxesAt: 0,
    mailboxesLoading: false,
    moreButtons: new Set(),
    menu: null,
    anchor: null,          // the chevron the menu is open for
    pinned: false,         // opened by click/keyboard: stays open until closed explicitly
    closeTimer: null
};

var TB_TPL_G_ICON =
    '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">' +
    '<path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"/>' +
    '<path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1818l-2.9087-2.2581c-.806.54-1.8368.8591-3.0477.8591-2.344 0-4.3282-1.5831-5.0364-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"/>' +
    '<path fill="#FBBC05" d="M3.9636 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9636 10.71z"/>' +
    '<path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9636 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"/>' +
    '</svg>';
var TB_TPL_MS_ICON =
    '<svg viewBox="0 0 21 21" aria-hidden="true" focusable="false">' +
    '<rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>' +
    '<rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/>' +
    '</svg>';
var TB_TPL_MAIL_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="3" ' +
    'fill="none" stroke="#64748b" stroke-width="2"/><path d="M4 7.5 12 13l8-5.5" fill="none" stroke="#64748b" ' +
    'stroke-width="2" stroke-linecap="round"/></svg>';
var TB_TPL_CHEVRON =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" ' +
    'stroke-linejoin="round"/></svg>';

// The menu lives in the light DOM (document.body), so its stylesheet goes in document.head. The
// chevron's own look is part of DATX_BTN_CSS (load-parser.js) so it reaches Truckstop's shadow root.
function tbTplEnsureMenuStyle() {
    if (document.getElementById('datx-tpl-menu-style')) return;
    const s = document.createElement('style');
    s.id = 'datx-tpl-menu-style';
    s.textContent =
        '.datx-tpl-menu{position:fixed;z-index:2147483647;min-width:230px;max-width:320px;' +
        'box-sizing:border-box;padding:6px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;' +
        'box-shadow:0 14px 34px rgba(15,23,42,.22),0 3px 8px rgba(15,23,42,.08);' +
        'font:500 12px/1.3 Arial,Helvetica,sans-serif;color:#0f172a;text-align:left;}' +
        '.datx-tpl-menu[hidden]{display:none!important;}' +
        '.datx-tpl-head{font:800 10px/1 Arial,Helvetica,sans-serif;text-transform:uppercase;' +
        'letter-spacing:.4px;color:#64748b;padding:6px 8px 7px;}' +
        '.datx-tpl-item{display:flex;flex-direction:column;gap:4px;width:100%;box-sizing:border-box;' +
        'margin:0;padding:8px 9px;border:0;border-radius:8px;background:transparent;cursor:pointer;' +
        'text-align:left;font:inherit;color:inherit;}' +
        '.datx-tpl-item:hover,.datx-tpl-item:focus{background:#eef3ff;outline:none;}' +
        '.datx-tpl-item:focus-visible{box-shadow:inset 0 0 0 2px #0046E0;}' +
        '.datx-tpl-name{display:flex;align-items:center;gap:6px;font:700 12.5px/1.25 Arial,Helvetica,sans-serif;' +
        'color:#0f172a;}' +
        '.datx-tpl-name span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
        '.datx-tpl-extra{border-top:1px solid rgba(16,32,58,.10);}' +
        '.datx-tpl-default{flex:0 0 auto;font:800 9px/1 Arial,Helvetica,sans-serif;text-transform:uppercase;' +
        'letter-spacing:.3px;color:#0046E0;background:#eef3ff;border:1px solid #cdddff;border-radius:999px;' +
        'padding:2px 6px;}' +
        '.datx-tpl-from{display:flex;align-items:center;gap:6px;min-width:0;color:#475569;' +
        'font:500 11.5px/1.2 Arial,Helvetica,sans-serif;}' +
        '.datx-tpl-from .ic{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;' +
        'width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 0 0 1px #e2e8f0;}' +
        '.datx-tpl-from .ic svg{width:10px;height:10px;display:block;}' +
        '.datx-tpl-from .addr{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
        '.datx-tpl-from.bad{color:#dc2626;font-weight:700;}';
    (document.head || document.documentElement).appendChild(s);
}

function tbTplMultiple() {
    return tbTpl.loggedIn && tbTpl.templates.length >= 2;
}

/**
 * With one template there is nothing to choose, so the chevron goes — but it keeps its place in
 * the row's four-slot action grid. Hiding it with the `hidden` attribute collapsed that slot and
 * dragged copy and star a column left, so rows with an address no longer lined up with rows
 * without one. It is hidden by visibility instead, which holds the column.
 */
function tbTplSetMoreVisible(el, show) {
    el.hidden = false;
    el.classList.toggle('datx-tpl-more--ghost', !show);
    el.setAttribute('aria-hidden', show ? 'false' : 'true');
    el.tabIndex = show ? 0 : -1;
}

// Shows / hides every chevron (DAT light DOM and Truckstop shadow roots alike); drops detached ones.
function tbTplRefreshMoreButtons() {
    const show = tbTplMultiple();
    tbTpl.moreButtons.forEach((el) => {
        if (!el.isConnected) {
            tbTpl.moreButtons.delete(el);
            return;
        }
        tbTplSetMoreVisible(el, show);
    });
    if (!show) tbTplCloseMenu();
    else if (tbTpl.menu && !tbTpl.menu.hidden) tbTplRenderMenu();
}

// Mounts the chevron right after a placed Send button. Safe to call again (no duplicates).
function attachTemplateMoreButton(sendBtn) {
    if (!(sendBtn instanceof Element) || !sendBtn.parentNode) return null;
    const existing = sendBtn.nextElementSibling;
    if (existing && existing.classList.contains('datx-tpl-more')) return existing;

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'datx-tpl-more datx-iconbtn';
    more.title = 'Send with another template';
    more.setAttribute('aria-label', 'Send with another template');
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute(INJECT_ATTR, '1');
    more.innerHTML = TB_TPL_CHEVRON;
    tbTplSetMoreVisible(more, tbTplMultiple());
    more._tbSendBtn = sendBtn;

    more.addEventListener('mouseenter', () => {
        tbTplCancelClose();
        if (tbTpl.anchor !== more || !tbTplMenuOpen()) tbTplOpenMenu(more, false);
    });
    more.addEventListener('mouseleave', () => { if (!tbTpl.pinned) tbTplScheduleClose(); });
    more.addEventListener('focus', () => {
        tbTplCancelClose();
        if (tbTpl.anchor !== more || !tbTplMenuOpen()) tbTplOpenMenu(more, true);
    });
    more.addEventListener('blur', (e) => {
        if (tbTpl.menu && e.relatedTarget && tbTpl.menu.contains(e.relatedTarget)) return;
        tbTplScheduleClose();
    });
    // Rows expand on click; keep our clicks to ourselves.
    more.addEventListener('mousedown', (e) => e.stopPropagation());
    more.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (tbTplMenuOpen() && tbTpl.anchor === more && tbTpl.pinned) {
            tbTplCloseMenu();
            return;
        }
        tbTplOpenMenu(more, true);
    });
    more.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            tbTplOpenMenu(more, true);
            tbTplFocusItem(0);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            tbTplOpenMenu(more, true);
            tbTplFocusItem(-1);
        } else if (e.key === 'Escape' && tbTplMenuOpen()) {
            e.preventDefault();
            e.stopPropagation();
            tbTplCloseMenu();
        }
    });

    sendBtn._tbMore = more;
    sendBtn.insertAdjacentElement('afterend', more);
    tbTpl.moreButtons.add(more);
    if (!tbTpl.mailboxesAt && tbTpl.loggedIn) tbTplLoadMailboxes();
    return more;
}

// Removes a Send button together with its chevron.
function removeSendButton(sendBtn) {
    if (!sendBtn) return;
    const more = sendBtn._tbMore ||
        (sendBtn.nextElementSibling && sendBtn.nextElementSibling.classList.contains('datx-tpl-more')
            ? sendBtn.nextElementSibling : null);
    if (more) {
        if (tbTpl.anchor === more) tbTplCloseMenu();
        tbTpl.moreButtons.delete(more);
        more.remove();
    }
    sendBtn.remove();
}

// Sibling lookups that step over our chevron (it sits right after a Send button).
function tbSiblingSkippingMore(el, forward) {
    let n = el ? (forward ? el.nextElementSibling : el.previousElementSibling) : null;
    while (n && n.classList && n.classList.contains('datx-tpl-more')) {
        n = forward ? n.nextElementSibling : n.previousElementSibling;
    }
    return n;
}

// Keyboard shortcuts must not steal keys while the user drives the menu / chevron.
function tbTplMenuOwnsKey(e) {
    // composedPath()[0]: the real target even inside Truckstop's shadow DOM (e.target is the host).
    const path = e && e.composedPath ? e.composedPath() : [];
    const t = path[0] || (e && e.target);
    if (!(t instanceof Element) || !t.closest('.datx-tpl-menu, .datx-tpl-more')) return false;
    return ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Space', 'Escape', 'Tab'].includes(e.code || e.key);
}

function tbTplMenuOpen() {
    return !!(tbTpl.menu && !tbTpl.menu.hidden);
}

function tbTplCancelClose() {
    if (tbTpl.closeTimer) clearTimeout(tbTpl.closeTimer);
    tbTpl.closeTimer = null;
}

function tbTplScheduleClose() {
    tbTplCancelClose();
    tbTpl.closeTimer = setTimeout(() => {
        tbTpl.closeTimer = null;
        const active = document.activeElement;
        if (tbTpl.menu && active && tbTpl.menu.contains(active)) return; // keyboard user inside
        tbTplCloseMenu();
    }, 220);
}

function tbTplEnsureMenu() {
    if (tbTpl.menu && tbTpl.menu.isConnected) return tbTpl.menu;
    tbTplEnsureMenuStyle();
    const m = document.createElement('div');
    m.className = 'datx-tpl-menu';
    m.setAttribute('role', 'menu');
    m.setAttribute('aria-label', 'Send with template');
    m.setAttribute(INJECT_ATTR, '1');
    m.hidden = true;
    m.addEventListener('mouseenter', tbTplCancelClose);
    m.addEventListener('mouseleave', () => { if (!tbTpl.pinned) tbTplScheduleClose(); });
    m.addEventListener('mousedown', (e) => e.stopPropagation());
    m.addEventListener('focusout', (e) => {
        const to = e.relatedTarget;
        if (to && (m.contains(to) || to === tbTpl.anchor)) return;
        tbTplScheduleClose();
    });
    m.addEventListener('keydown', (e) => {
        const items = [...m.querySelectorAll('.datx-tpl-item')];
        const i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); tbTplFocusItem(i + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); tbTplFocusItem(i - 1); }
        else if (e.key === 'Home') { e.preventDefault(); tbTplFocusItem(0); }
        else if (e.key === 'End') { e.preventDefault(); tbTplFocusItem(-1); }
        else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) { e.preventDefault(); items[i].click(); }
        else if (e.key === 'Escape') {
            e.preventDefault();
            const anchor = tbTpl.anchor;
            tbTplCloseMenu();
            if (anchor && anchor.isConnected) anchor.focus({preventScroll: true});
        } else if (e.key === 'Tab') {
            tbTplCloseMenu();
            return;
        } else {
            return;
        }
        e.stopPropagation();
    });
    document.body.appendChild(m);
    tbTpl.menu = m;
    return m;
}

function tbTplFocusItem(i) {
    const items = tbTpl.menu ? [...tbTpl.menu.querySelectorAll('.datx-tpl-item')] : [];
    if (!items.length) return;
    const n = items.length;
    const idx = ((i % n) + n) % n;
    items[idx].focus({preventScroll: true});
}

// Sender of a template for display: {icon, text, bad}.
function tbTplSenderOf(t) {
    const boxes = tbTpl.mailboxes || [];
    if (t.mailboxId != null) {
        const m = boxes.find((b) => String(b.id) === String(t.mailboxId));
        if (!m) {
            return tbTpl.mailboxes
                ? {icon: TB_TPL_MAIL_ICON, text: 'Mailbox not found — reconnect it', bad: true}
                : {icon: TB_TPL_MAIL_ICON, text: 'Connected mailbox', bad: false};
        }
        return {
            icon: m.provider === 'MICROSOFT' ? TB_TPL_MS_ICON : TB_TPL_G_ICON,
            text: m.status === 'ACTIVE' ? m.address : m.address + ' · disconnected',
            bad: m.status !== 'ACTIVE'
        };
    }
    if (tbTpl.loginProvider === 'MICROSOFT') {
        const m = boxes.find((b) => b.loginMailbox && b.provider === 'MICROSOFT');
        if (!m) return {icon: TB_TPL_MS_ICON, text: 'Sign-in mailbox', bad: false};
        return {
            icon: TB_TPL_MS_ICON,
            text: m.status === 'ACTIVE' ? m.address : m.address + ' · disconnected',
            bad: m.status !== 'ACTIVE'
        };
    }
    return {icon: TB_TPL_G_ICON, text: tbTpl.accountEmail || "This browser's Gmail", bad: false};
}

function tbTplRenderMenu() {
    const m = tbTplEnsureMenu();
    const focusedIdx = [...m.querySelectorAll('.datx-tpl-item')].indexOf(document.activeElement);
    m.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'datx-tpl-head';
    head.textContent = 'Send with template';
    head.setAttribute('aria-hidden', 'true');
    m.appendChild(head);

    tbTpl.templates.forEach((t, i) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'datx-tpl-item';
        item.setAttribute('role', 'menuitem');
        item.tabIndex = -1;

        const name = document.createElement('span');
        name.className = 'datx-tpl-name';
        const label = document.createElement('span');
        label.textContent = t.name || ('Template ' + (i + 1));
        name.appendChild(label);
        if (t.active) {
            const def = document.createElement('span');
            def.className = 'datx-tpl-default';
            def.textContent = 'Default';
            name.appendChild(def);
        }

        const sender = tbTplSenderOf(t);
        const from = document.createElement('span');
        from.className = 'datx-tpl-from' + (sender.bad ? ' bad' : '');
        const ic = document.createElement('span');
        ic.className = 'ic';
        ic.innerHTML = sender.icon;
        const addr = document.createElement('span');
        addr.className = 'addr';
        addr.textContent = sender.text;
        from.appendChild(ic);
        from.appendChild(addr);

        item.appendChild(name);
        item.appendChild(from);
        item.setAttribute('aria-label',
            (t.name || ('Template ' + (i + 1))) + ', from ' + sender.text + (t.active ? ', default' : ''));
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            tbTplSendWith(t);
        });
        m.appendChild(item);
    });

    // An anchor may offer one extra action below the templates. Saved loads use it for a one-off
    // follow-up message; board rows set nothing and the menu stays as it was.
    // The menu's anchor is the chevron; the extra action is declared on the send button it drives.
    const anchorEl = tbTpl.anchor;
    const extra = anchorEl &&
        (anchorEl._tbExtra || (anchorEl._tbSendBtn && anchorEl._tbSendBtn._tbExtra));
    if (extra) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'datx-tpl-item datx-tpl-extra';
        item.setAttribute('role', 'menuitem');
        item.tabIndex = -1;

        const name = document.createElement('span');
        name.className = 'datx-tpl-name';
        const label = document.createElement('span');
        label.textContent = extra.label;
        name.appendChild(label);
        item.appendChild(name);

        if (extra.hint) {
            const hint = document.createElement('span');
            hint.className = 'datx-tpl-from';
            hint.textContent = extra.hint;
            item.appendChild(hint);
        }

        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const run = extra.onPick;
            tbTplCloseMenu();
            if (typeof run === 'function') run();
        });
        m.appendChild(item);
    }

    if (focusedIdx >= 0) tbTplFocusItem(focusedIdx);
}

function tbTplPosition() {
    const m = tbTpl.menu;
    const a = tbTpl.anchor;
    if (!m || !a || !a.isConnected) return;
    const r = a.getBoundingClientRect();
    const w = m.offsetWidth;
    const h = m.offsetHeight;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    let left = Math.min(r.left, vw - w - 8);
    let top = r.bottom + 4;
    if (top + h > vh - 8 && r.top - h - 4 > 8) top = r.top - h - 4;
    m.style.left = Math.max(8, left) + 'px';
    m.style.top = Math.max(8, top) + 'px';
}

function tbTplOpenMenu(anchor, pinned) {
    if (!tbTplMultiple() || !anchor || !anchor.isConnected) return;
    tbTplCancelClose();
    if (tbTpl.anchor && tbTpl.anchor !== anchor) tbTpl.anchor.setAttribute('aria-expanded', 'false');
    tbTpl.anchor = anchor;
    tbTpl.pinned = !!pinned || (tbTpl.pinned && tbTplMenuOpen());
    tbTplRenderMenu();
    // The menu is built once and reused. Anything mounted after it — the saved-loads panel, for
    // one — shares the same max z-index and would paint over it, so move it to the end of <body>
    // on every open and let DOM order decide in our favour.
    if (tbTpl.menu.parentNode === document.body && document.body.lastElementChild !== tbTpl.menu) {
        document.body.appendChild(tbTpl.menu);
    }
    tbTpl.menu.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    tbTplPosition();
    if (Date.now() - tbTpl.mailboxesAt > TB_TPL_MAILBOX_TTL_MS) tbTplLoadMailboxes();
}

function tbTplCloseMenu() {
    tbTplCancelClose();
    if (tbTpl.menu) tbTpl.menu.hidden = true;
    if (tbTpl.anchor) tbTpl.anchor.setAttribute('aria-expanded', 'false');
    tbTpl.anchor = null;
    tbTpl.pinned = false;
}

function tbTplSendWith(t) {
    const anchor = tbTpl.anchor;
    const sendBtn = anchor && anchor._tbSendBtn;
    tbTplCloseMenu();
    if (!sendBtn || !sendBtn.isConnected || typeof sendBtn._tbSend !== 'function') {
        showToast('This load changed — try again', 'info');
        return;
    }
    if (sendBtn.disabled) {
        showToast(sendBtn.classList.contains('datx-ok')
            ? 'Email already sent from this button'
            : 'Please wait, email is already being sent...', 'info');
        return;
    }
    sendBtn._tbSend(t.id, t.name);
}

function tbTplApplyCache(cache) {
    tbTpl.templates = (cache && Array.isArray(cache.templates)) ? cache.templates : [];
    tbTplRefreshMoreButtons();
}

function tbTplLoadAccountEmail() {
    if (tbTpl.loginProvider === 'MICROSOFT' || tbTpl.accountEmail || !isExtensionAlive()) return;
    safeSendMessage({type: 'auth_me'}).then((r) => {
        const email = r && r.ok && r.user && r.user.email;
        if (!email) return;
        tbTpl.accountEmail = email;
        if (tbTplMenuOpen()) tbTplRenderMenu();
    });
}

function tbTplLoadMailboxes() {
    if (tbTpl.mailboxesLoading || !isExtensionAlive()) return;
    tbTpl.mailboxesLoading = true;
    safeSendMessage({type: 'mailboxes_list'}).then((r) => {
        tbTpl.mailboxesLoading = false;
        tbTpl.mailboxesAt = Date.now();
        if (r && r.ok && r.data) {
            tbTpl.mailboxes = Array.isArray(r.data.mailboxes) ? r.data.mailboxes : [];
        }
        if (tbTplMenuOpen()) tbTplRenderMenu();
    });
}

(function initTemplateMenu() {
    if (!isExtensionAlive()) return;
    try {
        chrome.storage.local.get(['templatesCache', 'loginProvider', 'backendToken'], (d) => {
            if (!isExtensionAlive()) return;
            d = d || {};
            tbTpl.loginProvider = d.loginProvider || null;
            tbTpl.loggedIn = !!d.backendToken;
            tbTplApplyCache(d.templatesCache);
            if (tbTpl.loggedIn) {
                // Refresh from the account (edited on another device?); the background rewrites
                // templatesCache, which lands in the onChanged listener below.
                safeSendMessage({type: 'templates_get'});
                tbTplLoadMailboxes();
                tbTplLoadAccountEmail();
            }
        });
        chrome.storage.onChanged.addListener((ch, area) => {
            if (!isExtensionAlive() || area !== 'local') return;
            if (ch.loginProvider) tbTpl.loginProvider = ch.loginProvider.newValue || null;
            if (ch.backendToken) {
                const was = tbTpl.loggedIn;
                tbTpl.loggedIn = !!ch.backendToken.newValue;
                if (tbTpl.loggedIn && !was) {
                    tbTpl.mailboxesAt = 0;
                    tbTpl.accountEmail = null;
                    safeSendMessage({type: 'templates_get'});
                    tbTplLoadMailboxes();
                    tbTplLoadAccountEmail();
                }
                tbTplRefreshMoreButtons();
            }
            if (ch.templatesCache) tbTplApplyCache(ch.templatesCache.newValue);
        });
    } catch {
    }

    // A fixed menu can't follow its chevron through scrolling: close it instead.
    window.addEventListener('scroll', () => { if (tbTplMenuOpen()) tbTplCloseMenu(); }, true);
    window.addEventListener('resize', () => { if (tbTplMenuOpen()) tbTplCloseMenu(); });
    document.addEventListener('mousedown', (e) => {
        if (!tbTplMenuOpen()) return;
        const path = e.composedPath ? e.composedPath() : [];
        if (path.includes(tbTpl.menu) || path.includes(tbTpl.anchor)) return;
        tbTplCloseMenu();
    }, true);
})();
