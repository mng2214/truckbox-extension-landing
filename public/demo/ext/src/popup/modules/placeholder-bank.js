/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
// === Placeholder bank: click & drag-n-drop (caret-safe, no double insert) ===
(function placeholderBank() {
    const $list = document.getElementById('phList');
    if (!$subj || !$body || !$list) return;

    const fields = [$subj, $body];
    let last = $body;
    const caret = new WeakMap();

    function rememberCaret(el) {
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        caret.set(el, {start, end});
    }

    function insertAtCaret(el, text) {
        const c = caret.get(el) || {start: el.value.length, end: el.value.length};
        const before = el.value.slice(0, c.start);
        const after = el.value.slice(c.end);

        el.value = before + text + after;

        const pos = c.start + text.length;
        el.selectionStart = pos;
        el.selectionEnd = pos;
        caret.set(el, {start: pos, end: pos});

        el.dispatchEvent(new Event('input', {bubbles: true}));
        el.focus();
    }

    let lastInsertTs = 0;

    function insertOnce(token, target) {
        const now = Date.now();
        if (now - lastInsertTs < 150) return;
        lastInsertTs = now;

        insertAtCaret(target || last, token);
    }

    fields.forEach((el) => {
        caret.set(el, {start: el.value.length, end: el.value.length});

        el.addEventListener('focus', () => {
            last = el;
            rememberCaret(el);
        });

        el.addEventListener('click', () => rememberCaret(el));
        el.addEventListener('keyup', () => rememberCaret(el));
        el.addEventListener('input', () => rememberCaret(el));
        el.addEventListener('select', () => rememberCaret(el));

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            el.classList.add('drop-ready');
        });

        el.addEventListener('dragleave', () => {
            el.classList.remove('drop-ready');
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.classList.remove('drop-ready');

            const token = e.dataTransfer.getData('text/plain');
            insertAtCaret(el, token);
        });
    });

    $list.querySelectorAll('.ph-chip').forEach((chip) => {
        const token = `{{${chip.dataset.ph}}}`;

        chip.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            insertOnce(token, last);
        });

        chip.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', token);
            e.dataTransfer.effectAllowed = 'copy';
        });

        chip.addEventListener('click', (e) => {
            e.preventDefault();
        });
    });
})();
