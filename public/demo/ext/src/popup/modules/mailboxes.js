// Per-template sender picker (Template tab → template editor). Each template is bound to one
// sender: the picker edits the ACTIVE template's mailboxId (template-manager.js owns the value and
// saves it). Hidden until the mailbox list loads (signed out / offline: stays hidden).
// null = this browser's Gmail (Google sign-in) / the sign-in mailbox (Microsoft sign-in).
// Mailboxes are managed in the cabinet only. A sender that is disconnected or gone is shown as such
// and never silently replaced.
// API: window.tbSender.setValue(mailboxId|null), window.tbSender.onChange(fn).
(function () {
    const CABINET_MAILBOXES_URL = 'https://truckbox.app/business/mailboxes';

    const G_ICON =
        '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">' +
        '<path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"/>' +
        '<path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1818l-2.9087-2.2581c-.806.54-1.8368.8591-3.0477.8591-2.344 0-4.3282-1.5831-5.0364-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"/>' +
        '<path fill="#FBBC05" d="M3.9636 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9636 10.71z"/>' +
        '<path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9636 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"/>' +
        '</svg>';
    const MS_ICON =
        '<svg viewBox="0 0 21 21" aria-hidden="true" focusable="false">' +
        '<rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>' +
        '<rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/>' +
        '</svg>';
    const WARN_ICON =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" d="M12 8v5m0 3.5v.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>';

    let mailboxes = null;      // null = not loaded yet
    let loginProvider = null;
    let accountEmail = null;   // Google sign-in: the Gmail this browser sends from
    let value = null;          // the active template's mailboxId
    let changeCb = null;
    let open = false;
    let focusIdx = -1;

    const $ = (id) => document.getElementById(id);

    function openCabinet(e) {
        if (e) e.preventDefault();
        chrome.tabs.create({url: CABINET_MAILBOXES_URL});
    }

    // Connecting your own Gmail in the cabinet while signed in to this browser with the same
    // account produces two entries for one address: the browser row (null) and the stored mailbox.
    // Same sender either way, so the list shows it once — as the browser row.
    function duplicatesBrowserGmail(m) {
        return loginProvider !== 'MICROSOFT'
            && m.provider === 'GOOGLE'
            && !!accountEmail
            && String(m.address || '').toLowerCase() === String(accountEmail).toLowerCase();
    }

    /** A template bound to that hidden mailbox id means the browser row. */
    function normalize(v) {
        if (v == null) return null;
        const m = (mailboxes || []).find((x) => String(x.id) === String(v));
        return m && duplicatesBrowserGmail(m) ? null : v;
    }

    // Options shown in the list. Google sign-in: "This browser's Gmail" (null) + every mailbox.
    // Microsoft sign-in: every mailbox; null stands for the sign-in mailbox.
    function options() {
        const list = [];
        if (loginProvider !== 'MICROSOFT') {
            list.push({
                value: null,
                provider: 'GOOGLE',
                address: accountEmail || "This browser's Gmail",
                sub: 'Gmail · signed in on this browser',
                active: true
            });
        }
        (mailboxes || []).forEach((m) => {
            if (duplicatesBrowserGmail(m)) return;
            list.push({
                value: m.id,
                provider: m.provider,
                address: m.address,
                sub: (m.provider === 'MICROSOFT' ? 'Outlook' : 'Gmail') + (m.loginMailbox ? ' · sign-in mailbox' : ''),
                active: m.status === 'ACTIVE'
            });
        });
        return list;
    }

    function loginMailbox() {
        return (mailboxes || []).find((m) => m.loginMailbox && m.provider === 'MICROSOFT') || null;
    }

    // What the current value resolves to: {opt} | {missing:true}.
    function current() {
        const opts = options();
        const v = normalize(value);
        if (v == null) {
            if (loginProvider === 'MICROSOFT') {
                const lm = loginMailbox();
                const opt = lm ? opts.find((o) => o.value === lm.id) : null;
                return opt ? {opt} : {missing: true};
            }
            return {opt: opts[0]};
        }
        const opt = opts.find((o) => String(o.value) === String(v));
        return opt ? {opt} : {missing: true};
    }

    function iconFor(provider) {
        return provider === 'MICROSOFT' ? MS_ICON : G_ICON;
    }

    function fillRow(el, opt) {
        el.innerHTML = '';
        const ic = document.createElement('span');
        ic.className = 'sender-ic';
        ic.innerHTML = opt ? iconFor(opt.provider) : WARN_ICON;
        const txt = document.createElement('span');
        txt.className = 'sender-text';
        const addr = document.createElement('span');
        addr.className = 'sender-addr';
        const sub = document.createElement('span');
        sub.className = 'sender-sub';
        if (opt) {
            addr.textContent = opt.address;
            sub.textContent = opt.active ? opt.sub : opt.sub + ' · Disconnected';
            if (!opt.active) sub.classList.add('is-bad');
        } else {
            addr.textContent = 'Mailbox not found';
            sub.textContent = 'Removed or not connected';
            sub.classList.add('is-bad');
        }
        txt.appendChild(addr);
        txt.appendChild(sub);
        el.appendChild(ic);
        el.appendChild(txt);
    }

    function render() {
        const box = $('senderBox');
        const trigger = $('senderTrigger');
        const face = $('senderFace');
        if (!box || !trigger || !face) return;
        if (mailboxes === null) { box.hidden = true; return; }
        box.hidden = false;

        const cur = current();
        fillRow(face, cur.opt || null);
        const bad = cur.missing || (cur.opt && !cur.opt.active);
        trigger.classList.toggle('is-bad', !!bad);

        const warn = $('senderWarn');
        const warnText = $('senderWarnText');
        if (warn && warnText) {
            warn.hidden = !bad;
            warnText.textContent = cur.missing
                ? (loginProvider === 'MICROSOFT' && value == null ? 'No sign-in mailbox — ' : 'Mailbox not found — ')
                : 'Mailbox disconnected — ';
        }
        const add = $('senderAddLink');
        if (add) add.hidden = (mailboxes || []).some((m) => !m.loginMailbox);

        if (open) renderList();
    }

    function renderList() {
        const list = $('senderList');
        if (!list) return;
        list.innerHTML = '';
        const cur = current();
        options().forEach((opt, i) => {
            const li = document.createElement('li');
            li.id = 'senderOpt' + i;
            li.className = 'sender-opt';
            li.setAttribute('role', 'option');
            const selected = !!(cur.opt && String(cur.opt.value) === String(opt.value));
            li.setAttribute('aria-selected', selected ? 'true' : 'false');
            if (!opt.active) li.setAttribute('aria-disabled', 'true');
            if (i === focusIdx) li.classList.add('is-focus');
            fillRow(li, opt);
            if (selected) {
                const check = document.createElement('span');
                check.className = 'sender-check';
                check.setAttribute('aria-hidden', 'true');
                check.textContent = '✓';
                li.appendChild(check);
            }
            li.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus on the list
            li.addEventListener('click', () => choose(i));
            li.addEventListener('mousemove', () => { if (focusIdx !== i) { focusIdx = i; syncFocus(); } });
            list.appendChild(li);
        });
        syncFocus();
    }

    function syncFocus() {
        const list = $('senderList');
        if (!list) return;
        [...list.children].forEach((li, i) => li.classList.toggle('is-focus', i === focusIdx));
        const el = list.children[focusIdx];
        if (el) {
            list.setAttribute('aria-activedescendant', el.id);
            el.scrollIntoView({block: 'nearest'});
        } else {
            list.removeAttribute('aria-activedescendant');
        }
    }

    function setOpen(next) {
        const list = $('senderList');
        const trigger = $('senderTrigger');
        if (!list || !trigger) return;
        open = next;
        trigger.setAttribute('aria-expanded', next ? 'true' : 'false');
        list.hidden = !next;
        if (next) {
            const opts = options();
            const cur = current();
            focusIdx = cur.opt ? opts.findIndex((o) => String(o.value) === String(cur.opt.value)) : 0;
            if (focusIdx < 0) focusIdx = 0;
            renderList();
            list.focus();
        }
    }

    function choose(i) {
        const opt = options()[i];
        if (!opt || !opt.active) return; // a disconnected mailbox can't become a sender
        setOpen(false);
        $('senderTrigger')?.focus();
        if (String(opt.value) === String(normalize(value))) return;
        value = opt.value;
        render();
        if (changeCb) changeCb(value);
    }

    function move(delta) {
        const n = options().length;
        if (!n) return;
        focusIdx = ((focusIdx < 0 ? 0 : focusIdx) + delta + n) % n;
        syncFocus();
    }

    function bind() {
        const trigger = $('senderTrigger');
        const list = $('senderList');
        if (!trigger || !list) return;

        // While open the list holds focus; keep it there so this click closes instead of reopening.
        trigger.addEventListener('mousedown', (e) => { if (open) e.preventDefault(); });
        trigger.addEventListener('click', () => setOpen(!open));
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setOpen(true);
            }
        });
        list.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
            else if (e.key === 'Home') { e.preventDefault(); focusIdx = 0; syncFocus(); }
            else if (e.key === 'End') { e.preventDefault(); focusIdx = options().length - 1; syncFocus(); }
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(focusIdx); }
            else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); trigger.focus(); }
            else if (e.key === 'Tab') { setOpen(false); }
        });
        list.addEventListener('blur', () => { if (open) setOpen(false); });
        document.addEventListener('mousedown', (e) => {
            const picker = $('senderPicker');
            if (open && picker && !picker.contains(e.target)) setOpen(false);
        });

        document.querySelectorAll('[data-cabinet-link]').forEach((a) => a.addEventListener('click', openCabinet));
    }

    window.tbSender = {
        setValue(v) {
            value = v == null ? null : v;
            render();
        },
        onChange(fn) { changeCb = fn; }
    };

    // Loads sign-in provider, account email and mailboxes. Runs on open and again whenever the
    // user signs in or out inside the popup (backendToken changes), so the picker never waits for
    // the popup to be reopened.
    function load() {
        chrome.storage.local.get(['loginProvider', 'backendToken'], (d) => {
            loginProvider = (d && d.loginProvider) || null;
            const manage = $('loginManageMailboxes');
            if (manage) manage.hidden = !(d && d.backendToken);
            if (!d || !d.backendToken) {
                mailboxes = null;
                accountEmail = null;
                render();
                return;
            }
            if (loginProvider !== 'MICROSOFT') {
                chrome.runtime.sendMessage({type: 'auth_me'}, (me) => {
                    if (chrome.runtime.lastError) return;
                    const email = me && me.ok && me.user && me.user.email;
                    if (email) { accountEmail = email; render(); }
                });
            }
            chrome.runtime.sendMessage({type: 'mailboxes_list'}, (r) => {
                if (chrome.runtime.lastError || !r) return;
                if (r.ok && r.data) {
                    mailboxes = Array.isArray(r.data.mailboxes) ? r.data.mailboxes : [];
                    render();
                }
                // Signed out / offline: stay hidden.
            });
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        bind();
        load();
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && (changes.backendToken || changes.loginProvider)) load();
        });
    });
})();
