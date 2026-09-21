// =========================================================================
// Site adapter interface (contract) + no-op fallback.
//
// The extension supports more than one freight-load board (DAT, Truckstop,
// ...). Everything site-specific — DOM selectors, "am I on the loads page?",
// how to read a load row — lives behind a *site adapter*. The generic content
// modules (ui-injector / load-parser / keyboard-shortcuts / maps-integration)
// never branch on hostname; they read from the active adapter instead.
//
// Content scripts share one global scope and run in manifest order. Each
// adapter file self-registers into window.TB_ADAPTERS; adapter-loader.js then
// picks the one whose hostMatches() wins, exposes it as window.TB_ADAPTER, and
// republishes its selectors under the legacy global names the modules already
// read (ROW_SEL, ORIGIN_CELL_SEL, ...). Load order (manifest content_scripts):
//
//   site-adapter.js  ->  dat-adapter.js  ->  truckstop-adapter.js
//     ->  adapter-loader.js  ->  ui-injector.js  ->  ...
//
// Adapter shape:
//   {
//     id:            'dat' | 'truckstop' | ...
//     hostMatches(hostname): boolean   // does this adapter own the page?
//     isLoadsPage():         boolean   // are we on the loads-search page?
//     selectors: {                     // every selector the modules consume
//       EMAIL_RE, INJECT_ATTR, RESULTS_ROOT_SELECTORS,
//       DETAILS_COMMENT_SEL, DETAILS_EMAIL_SEL, CONTACT_BLOCK_SEL,
//       ROW_SEL, COMPANY_CELL_SEL, ROUTE_CELL_SEL, ORIGIN_CELL_SEL,
//       DEST_CELL_SEL, PICKUP_CELL_SEL, EQUIP_CELL_SEL, LENGTH_CELL_SEL,
//       WEIGHT_CELL_SEL, RATE_CELL_SEL, DTP_CELL_SEL
//     },
//     // FUTURE feature hooks — collect a load + its broker info and save it.
//     parseLoad(row):   object | null,        // structured data from a row
//     collectLoad(row): void | Promise<void>  // persist it (no-op for now)
//   }
// =========================================================================

// Fallback used on any host no adapter claims: inert, never injects.
var TB_NOOP_ADAPTER = {
    id: 'none',
    hostMatches: function () { return false; },
    isLoadsPage: function () { return false; },
    selectors: {},
    parseLoad: function () { return null; },
    collectLoad: function () {}
};
