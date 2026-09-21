/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
// Multi-template manager (stored in the user's account; the limit comes from the
// backend as maxTemplates = 1 + mailbox limit). Each template carries its own
// sender (mailboxId; null = this browser's Gmail / the Microsoft sign-in
// mailbox), picked in the sender picker (mailboxes.js, window.tbSender). The
// active template is mirrored into chrome.storage (templateSubject/body/myName/
// myMc/myPhone/templateId/templateMailboxId) — the email SEND flow reads it.
// Exposes window.initTemplates(), called once from popup-init.
(function () {
    var DEFAULT_MAX = 3; // until the backend says otherwise (e.g. signed out)
    var state = { templates: [], active: 0, max: DEFAULT_MAX };

    var tplChips = document.getElementById('tplChips');
    var tplAddBtn = document.getElementById('tplAddBtn');
    var tplName = document.getElementById('tplName');

    function newTemplate(i) {
        return {
            id: null,
            name: 'Template ' + (i + 1),
            subject: defaults.templateSubject,
            body: defaults.templateBody,
            myName: defaults.myName || '',
            myMc: defaults.myMc || '',
            myPhone: defaults.myPhone || '',
            mailboxId: null
        };
    }

    function active() { return state.templates[state.active]; }

    function fieldsToActive() {
        var t = active();
        if (!t) return;
        if ($subj) t.subject = $subj.value;
        if ($body) t.body = $body.value;
        if ($name) t.myName = $name.value;
        if ($mc) t.myMc = $mc.value;
        if ($ph) t.myPhone = $ph.value;
        if (tplName && tplName.value) t.name = tplName.value;
    }

    function fillFromActive() {
        var t = active();
        if (!t) return;
        if ($subj) $subj.value = t.subject || '';
        if ($body) $body.value = t.body || '';
        if ($name) $name.value = t.myName || '';
        if ($mc) $mc.value = t.myMc || '';
        if ($ph) $ph.value = t.myPhone || '';
        if (tplName) tplName.value = t.name || '';
        if (window.tbSender) window.tbSender.setValue(t.mailboxId == null ? null : t.mailboxId);
    }

    // Mirror the active template into chrome.storage so the send flow uses it.
    function mirrorActive() {
        var t = active();
        if (!t) return;
        chrome.runtime.sendMessage({
            type: 'template_set',
            data: {
                templateSubject: t.subject || '',
                templateBody: t.body || '',
                myName: t.myName || '',
                myMc: t.myMc || '',
                myPhone: t.myPhone || '',
                templateId: t.id == null ? null : t.id,
                templateMailboxId: t.mailboxId == null ? null : t.mailboxId
            }
        }, function () { void chrome.runtime.lastError; });
    }

    function buildPayload() {
        return state.templates.map(function (t, i) {
            return {
                id: t.id,
                name: t.name,
                subject: t.subject,
                body: t.body,
                myName: t.myName,
                myMc: t.myMc,
                myPhone: t.myPhone,
                mailboxId: t.mailboxId == null ? null : t.mailboxId,
                active: i === state.active
            };
        });
    }

    function adopt(data) {
        var list = (data && data.templates) || [];
        if (data && data.maxTemplates > 0) state.max = data.maxTemplates;
        var act = 0;
        state.templates = list.map(function (t, i) {
            if (t.active) act = i;
            return {
                id: t.id, name: t.name, subject: t.subject, body: t.body,
                myName: t.myName, myMc: t.myMc, myPhone: t.myPhone,
                mailboxId: t.mailboxId == null ? null : t.mailboxId
            };
        });
        state.active = act;
    }

    function persist(cb) {
        chrome.runtime.sendMessage(
            { type: 'templates_save', data: { templates: buildPayload() } },
            function (r) {
                if (chrome.runtime.lastError) { if (cb) cb(false); return; }
                if (r && r.ok && r.data && Array.isArray(r.data.templates)) {
                    adopt(r.data); // pick up new ids / server order
                    renderChips();
                }
                if (r && !r.ok && r.message) say(r.message, true);
                if (cb) cb(!!(r && r.ok));
            }
        );
    }

    var debounce = (function () {
        var t;
        return function (fn, ms) { clearTimeout(t); t = setTimeout(fn, ms || 500); };
    })();

    function renderChips() {
        if (!tplChips) return;
        tplChips.innerHTML = '';
        state.templates.forEach(function (t, i) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'tpl-chip' + (i === state.active ? ' active' : '');
            var label = document.createElement('span');
            label.className = 'tpl-chip-label';
            label.textContent = t.name || ('Template ' + (i + 1));
            chip.appendChild(label);
            chip.addEventListener('click', function () { switchTo(i); });
            if (state.templates.length > 1) {
                var x = document.createElement('span');
                x.className = 'tpl-chip-x';
                x.textContent = '×';
                x.title = 'Delete template';
                x.addEventListener('click', function (e) { e.stopPropagation(); removeAt(i); });
                chip.appendChild(x);
            }
            tplChips.appendChild(chip);
        });
        if (tplAddBtn) tplAddBtn.style.display = state.templates.length >= state.max ? 'none' : '';
    }

    function switchTo(i) {
        if (i === state.active || !state.templates[i]) return;
        fieldsToActive();
        state.active = i;
        fillFromActive();
        renderChips();
        mirrorActive();
        persist();
    }

    function addTemplate() {
        if (state.templates.length >= state.max) return;
        fieldsToActive();
        state.templates.push(newTemplate(state.templates.length));
        state.active = state.templates.length - 1;
        fillFromActive();
        renderChips();
        mirrorActive();
        persist();
    }

    function removeAt(i) {
        if (state.templates.length <= 1) return;
        if (!confirm('Delete this template?')) return;
        state.templates.splice(i, 1);
        if (state.active >= state.templates.length) state.active = state.templates.length - 1;
        else if (i < state.active) state.active -= 1;
        fillFromActive();
        renderChips();
        mirrorActive();
        persist();
    }

    function bindEditing() {
        if (window.tbSender) {
            // The sender is part of the template: change it, mirror (send flow) and save.
            window.tbSender.onChange(function (mailboxId) {
                var t = active();
                if (!t) return;
                t.mailboxId = mailboxId == null ? null : mailboxId;
                mirrorActive();
                persist(function (ok) { if (ok) say('Sender saved'); });
            });
        }
        [$subj, $body, $name, $mc, $ph].forEach(function (el) {
            if (!el) return;
            el.addEventListener('input', function () {
                fieldsToActive();
                debounce(function () { mirrorActive(); persist(); }, 600);
            });
        });
        if (tplName) {
            tplName.addEventListener('input', function () {
                var t = active();
                if (t) t.name = tplName.value;
                renderChips();
                debounce(function () { persist(); }, 600);
            });
        }
        if (tplAddBtn) {
            tplAddBtn.addEventListener('click', function (e) { e.preventDefault(); addTemplate(); });
        }
        if ($save) {
            $save.addEventListener('click', function (e) {
                e.preventDefault();
                fieldsToActive();
                mirrorActive();
                persist(function (ok) { say(ok ? 'Saved' : 'Save failed', !ok); });
            });
        }
    }

    // Existing single chrome.storage template → seed for template #1 (migration).
    function localSeed(cb) {
        chrome.runtime.sendMessage({ type: 'template_get' }, function (r) {
            var d = (r && r.ok && r.data) ? r.data : {};
            cb({
                id: null,
                name: 'Template 1',
                subject: d.templateSubject || defaults.templateSubject,
                body: d.templateBody || defaults.templateBody,
                myName: d.myName || defaults.myName || '',
                myMc: d.myMc || defaults.myMc || '',
                myPhone: d.myPhone || defaults.myPhone || '',
                mailboxId: null
            });
        });
    }

    window.initTemplates = function () {
        bindEditing();
        chrome.runtime.sendMessage({ type: 'templates_get' }, function (r) {
            if (chrome.runtime.lastError) {
                localSeed(function (t) {
                    state.templates = [t]; state.active = 0;
                    fillFromActive(); renderChips();
                });
                return;
            }
            if (r && r.ok && r.data && r.data.maxTemplates > 0) state.max = r.data.maxTemplates;
            if (r && r.ok && r.data && Array.isArray(r.data.templates) && r.data.templates.length) {
                adopt(r.data);
                fillFromActive();
                renderChips();
                mirrorActive();
            } else {
                // Empty account (or not logged in): seed #1 from the local template;
                // if we're logged in (ok), create it in the DB.
                localSeed(function (t) {
                    state.templates = [t]; state.active = 0;
                    fillFromActive(); renderChips(); mirrorActive();
                    if (r && r.ok) persist();
                });
            }
        });
    };
})();
