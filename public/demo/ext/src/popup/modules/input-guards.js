// Keeps typed/pasted values inside what each field can hold, so nothing but plain text ever reaches
// a template (the backend cleans the same way; this just shows the user the clean value as they type).
//   MC: digits only, up to 10 · Phone: digits and + ( ) - . space
//   Names: no < > or line breaks · Subject: one line (a line break could forge email headers)
(function () {
    const CONTROL = /[\x00-\x1f\x7f]/g;
    const RULES = {
        myMc: (v) => v.replace(/\D/g, '').slice(0, 10),
        myPhone: (v) => v.replace(/[^0-9+()\-. ]/g, ''),
        myName: (v) => v.replace(/[<>]/g, '').replace(CONTROL, ''),
        tplName: (v) => v.replace(/[<>]/g, '').replace(CONTROL, ''),
        templateSubject: (v) => v.replace(CONTROL, ' ')
    };

    function clean(el, rule) {
        const before = el.value;
        const after = rule(before);
        if (after === before) return;
        const pos = el.selectionStart;
        el.value = after;
        // Keep the caret where the user was typing (minus the characters we dropped).
        if (typeof pos === 'number') {
            const p = Math.max(0, pos - (before.length - after.length));
            try { el.setSelectionRange(p, p); } catch (e) { /* inputs without a caret */ }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        Object.keys(RULES).forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => clean(el, RULES[id]));
        });
    });
})();
