// Manager team stats — shown only when the backend returns data (i.e. the user
// is an organization owner). For everyone else the block stays hidden.
(function teamStatsSection() {
    const block = document.getElementById('teamStatsBlock');
    const body = document.getElementById('teamStatsBody');
    const sub = document.getElementById('teamStatsSub');
    if (!block || !body) return;

    const esc = (s) =>
        String(s == null ? '' : s).replace(
            /[&<>"]/g,
            (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
        );

    const ICONS = {
        email:
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#2563eb" stroke-width="2"/>' +
            '<path d="M4 7.5 12 13l8-5.5" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        map:
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z" stroke="#16a34a" stroke-width="2" stroke-linejoin="round"/>' +
            '<circle cx="12" cy="10.5" r="2.4" stroke="#16a34a" stroke-width="2"/></svg>',
        call:
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="M6.5 4h-2A1.5 1.5 0 0 0 3 5.6 15 15 0 0 0 18.4 21 1.5 1.5 0 0 0 20 19.5v-2a1 1 0 0 0-.8-1l-3-.6a1 1 0 0 0-1 .4l-.8 1.1a11.5 11.5 0 0 1-5.2-5.2l1.1-.8a1 1 0 0 0 .4-1l-.6-3a1 1 0 0 0-1-.8Z" stroke="#7c3aed" stroke-width="2" stroke-linejoin="round"/></svg>',
        clock:
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<circle cx="12" cy="12" r="9" stroke="#ea580c" stroke-width="2"/>' +
            '<path d="M12 7.5V12l3 1.8" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };

    // Icon-only headers (with hover labels) so 4 metrics fit the narrow popup.
    const head = (icon, label) =>
        '<th title="' + label + '" style="padding:0 6px 7px;text-align:right;">' +
        '<span style="display:inline-flex;justify-content:flex-end;">' + icon + '</span></th>';

    // Time saved uses the same basis as personal stats: 30s per action.
    const fmtSaved = (actions) => {
        const totalMin = Math.floor((Number(actions || 0) * 30) / 60);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h <= 0) return m + 'm';
        if (m === 0) return h + 'h';
        return h + 'h ' + m + 'm';
    };

    const metricsRow = (label, w, opts) => {
        w = w || {};
        opts = opts || {};
        const actions = (w.emailsSent || 0) + (w.mapsOpened || 0) + (w.callsPlaced || 0);
        const labelStyle = opts.sub
            ? 'color:#94a3b8;padding:3px 6px 3px 14px;white-space:nowrap;'   // platform sub-row
            : 'color:#64748b;padding:3px 6px 3px 0;white-space:nowrap;';
        const top = opts.divider ? 'border-top:1px solid #eef2f7;' : '';
        return (
            '<tr>' +
            '<td style="' + labelStyle + top + '">' + label + '</td>' +
            '<td style="text-align:right;font-weight:700;padding:3px 6px;' + top + '">' + (w.emailsSent || 0) + '</td>' +
            '<td style="text-align:right;font-weight:700;padding:3px 6px;' + top + '">' + (w.mapsOpened || 0) + '</td>' +
            '<td style="text-align:right;font-weight:700;padding:3px 6px;' + top + '">' + (w.callsPlaced || 0) + '</td>' +
            '<td style="text-align:right;font-weight:700;color:#ea580c;white-space:nowrap;padding:3px 0 3px 6px;' + top + '">' + fmtSaved(actions) + '</td>' +
            '</tr>'
        );
    };

    // Total → DAT / Truckstop / Total rows from the per-platform split.
    const platformRows = (d) => {
        const by = {};
        (d.totalPlatforms || []).forEach((p) => {
            by[String(p.platform || '').toUpperCase()] = p;
        });
        return (
            metricsRow('DAT', by.DAT, { sub: true, divider: true }) +
            metricsRow('Truckstop', by.TRUCKSTOP, { sub: true }) +
            metricsRow('Total', d.total)
        );
    };

    const render = (data) => {
        const list = Array.isArray(data.dispatchers) ? data.dispatchers : [];
        if (sub) {
            sub.textContent =
                (data.organizationName ? data.organizationName + ' · ' : '') +
                list.length + ' dispatcher' + (list.length === 1 ? '' : 's');
        }
        body.innerHTML = list
            .map(
                (d) =>
                    '<div style="border-top:1px solid #e9eef5;padding:12px 0;">' +
                    '<div style="font-weight:700;color:#1e293b;font-size:13px;margin-bottom:6px;word-break:break-all;">' +
                    esc(d.email) +
                    '</div>' +
                    '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
                    '<thead><tr>' +
                    '<th></th>' +
                    head(ICONS.email, 'Emails') +
                    head(ICONS.map, 'Maps') +
                    head(ICONS.call, 'Calls') +
                    head(ICONS.clock, 'Time saved') +
                    '</tr></thead><tbody>' +
                    metricsRow('This week', d.weekToDate) +
                    metricsRow('This month', d.monthToDate) +
                    platformRows(d) +
                    '</tbody></table>' +
                    '</div>'
            )
            .join('');
    };

    try {
        chrome.runtime.sendMessage({ type: 'manager_team_stats' }, (r) => {
            if (chrome.runtime.lastError) {
                block.style.display = 'none';
                return;
            }
            if (
                !r ||
                !r.ok ||
                !r.data ||
                !Array.isArray(r.data.dispatchers) ||
                r.data.dispatchers.length === 0
            ) {
                block.style.display = 'none';
                return;
            }
            render(r.data);
            block.style.display = 'block';
        });
    } catch {
        block.style.display = 'none';
    }
})();
