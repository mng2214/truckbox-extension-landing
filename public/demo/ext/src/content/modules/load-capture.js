// =========================================================================
// Passive load capture.
//
// Periodically reads the visible load-board rows via the ACTIVE site adapter
// (TB_ADAPTER.parseLoad), dedups per session, batches them, and ships them to
// the background worker, which POSTs to /analytics/loads. The backend then
// normalizes them into brokers / loads / observations.
//
// Platform-agnostic by design: it never branches on hostname — it asks the
// adapter to parse a row and tags the batch with the adapter id. DAT implements
// parseLoad(); Truckstop returns null for now, so capture is simply inert there
// until its adapter learns to parse a row. Nothing here touches the email/UI
// flow — it only adds a new, isolated message type.
// =========================================================================
(function () {
    if (!window.TB_ADAPTER) return;

    var SCAN_INTERVAL_MS = 4000; // sweep visible rows every few seconds
    var MAX_BATCH = 100;         // well under the backend's 500 cap

    var seen = new Set();        // per-session dedup keys
    var pending = [];

    function alive() {
        try {
            return typeof isExtensionAlive === 'function'
                ? isExtensionAlive()
                : !!(chrome && chrome.runtime && chrome.runtime.id);
        } catch (e) {
            return false;
        }
    }

    // A captured row re-posts when its price changes (new observation) or when it
    // gains detail data (e.g. the user expands it and we learn the MC / ref id);
    // otherwise it's deduped for the session.
    function keyOf(it) {
        return [
            it.source, it.origin, it.destination, it.brokerNameRaw, it.equipment,
            it.offerPrice, it.mcNumber || '', it.refId || ''
        ].join('|');
    }

    // Dedup (per session) and buffer one parsed item for the next flush.
    function enqueue(item) {
        if (!item) return;
        var k = keyOf(item);
        if (seen.has(k)) return;
        seen.add(k);
        pending.push(item);
        if (pending.length >= MAX_BATCH) flush();
    }

    function scan() {
        try {
            if (!alive()) return;
            var a = window.TB_ADAPTER;
            if (!a || typeof a.isLoadsPage !== 'function' || !a.isLoadsPage()) return;
            if (typeof a.parseLoad !== 'function') return;

            // Some platforms (Truckstop) render rows in a Shadow DOM a plain
            // document query can't reach, and keep ROW_SEL empty so the DAT
            // per-row UI loop never touches them. Those adapters expose
            // captureRows() (shadow-piercing) just for the capture pass.
            var rows;
            if (typeof a.captureRows === 'function') {
                rows = a.captureRows() || [];
            } else {
                var sel = window.ROW_SEL;
                if (!sel) return;
                rows = document.querySelectorAll(sel);
            }
            for (var i = 0; i < rows.length; i++) {
                var item = null;
                try { item = a.parseLoad(rows[i]); } catch (e) { item = null; }
                enqueue(item);
            }

            // Detail-panel capture (already-canonical items, no parseLoad). Used
            // by platforms whose broker data only exists in the open panel
            // (Truckstop). Session dedup (keyOf) ships each unique load once.
            if (typeof a.captureDetail === 'function') {
                var det = [];
                try { det = a.captureDetail() || []; } catch (e) { det = []; }
                for (var j = 0; j < det.length; j++) enqueue(det[j]);
            }
        } catch (e) { /* never disturb the page */ }
    }

    function flush() {
        try {
            if (!pending.length || !alive()) return;
            var batch = pending.splice(0, MAX_BATCH);
            if (typeof safeSendMessage === 'function') {
                // fire-and-forget; safeSendMessage resolves (never rejects)
                safeSendMessage({
                    type: 'datx_capture_loads',
                    platform: window.TB_ADAPTER.id,
                    loads: batch
                });
            }
        } catch (e) { /* ignore */ }
    }

    // Ask the background to POST whatever is buffered right now (used on leave so
    // a tail smaller than the flush threshold still gets sent).
    function requestFlush() {
        try {
            if (alive() && typeof safeSendMessage === 'function') {
                safeSendMessage({type: 'datx_flush_loads'});
            }
        } catch (e) { /* ignore */ }
    }

    setInterval(function () {
        scan();
        flush(); // forwards newly found rows into the background buffer
    }, SCAN_INTERVAL_MS);

    // On leave: forward anything pending, then force a flush of the buffer.
    function onLeave() {
        scan();
        flush();
        requestFlush();
    }
    window.addEventListener('pagehide', onLeave);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') onLeave();
    });
})();
