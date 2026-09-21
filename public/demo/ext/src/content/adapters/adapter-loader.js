// =========================================================================
// Adapter loader — runs after the adapter definition files, before the
// content modules. Picks the adapter for this host and republishes its
// selectors under the legacy global names the modules read, so none of the
// existing module code needs to change.
// =========================================================================
(function () {
    var host = location.hostname;
    var list = window.TB_ADAPTERS || [];
    var adapter = null;
    for (var i = 0; i < list.length; i++) {
        if (list[i].hostMatches(host)) { adapter = list[i]; break; }
    }
    if (!adapter) adapter = TB_NOOP_ADAPTER;
    window.TB_ADAPTER = adapter;

    // Republish selectors as the global var names the content modules consume.
    var s = adapter.selectors || {};
    window.EMAIL_RE = s.EMAIL_RE;
    window.INJECT_ATTR = s.INJECT_ATTR || 'data-datx-injected';
    window.RESULTS_ROOT_SELECTORS = s.RESULTS_ROOT_SELECTORS;
    window.DETAILS_COMMENT_SEL = s.DETAILS_COMMENT_SEL;
    window.DETAILS_EMAIL_SEL = s.DETAILS_EMAIL_SEL;
    // Optional: site whose broker-email anchor is clipped by an overflow:hidden
    // wrapper (Truckstop) can mount the Send button in the email-row icon slot
    // instead. Undefined on sites that don't need it -> ensureEmailIconButtons()
    // no-ops there.
    window.EMAIL_ICON_SEL = s.EMAIL_ICON_SEL;
    // Optional: element carrying the email in an attribute (DAT's compose
    // button, `recipient-email`). Undefined elsewhere -> findContactEmail skips it.
    window.EMAIL_ATTR_SEL = s.EMAIL_ATTR_SEL;
    window.CONTACT_BLOCK_SEL = s.CONTACT_BLOCK_SEL;
    window.ROW_SEL = s.ROW_SEL;
    window.COMPANY_CELL_SEL = s.COMPANY_CELL_SEL;
    window.ROUTE_CELL_SEL = s.ROUTE_CELL_SEL;
    window.ORIGIN_CELL_SEL = s.ORIGIN_CELL_SEL;
    window.DEST_CELL_SEL = s.DEST_CELL_SEL;
    window.PICKUP_CELL_SEL = s.PICKUP_CELL_SEL;
    window.EQUIP_CELL_SEL = s.EQUIP_CELL_SEL;
    window.LENGTH_CELL_SEL = s.LENGTH_CELL_SEL;
    window.WEIGHT_CELL_SEL = s.WEIGHT_CELL_SEL;
    window.RATE_CELL_SEL = s.RATE_CELL_SEL;
    window.DTP_CELL_SEL = s.DTP_CELL_SEL;
    window.DETAILS_PANEL_SEL = s.DETAILS_PANEL_SEL;
    window.DETAILS_COLUMN_SEL = s.DETAILS_COLUMN_SEL;

    // Legacy alias so existing call sites keep working unchanged.
    window.onDatLoadsPage = function () { return window.TB_ADAPTER.isLoadsPage(); };
})();
