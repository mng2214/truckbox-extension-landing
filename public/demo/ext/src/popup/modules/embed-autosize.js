// embed-autosize.js
// When the popup is rendered inside an in-page iframe (the "Open TruckBox"
// modal injected into DAT), it reports its real content height to the parent
// so the modal can shrink/grow to fit the active tab instead of using a fixed
// height. When the popup runs normally in the Chrome toolbar there is no
// parent frame, so this does nothing.
(function () {
    // Not embedded (toolbar popup) → nothing to do.
    if (window.parent === window) return;

    const measure = () => {
        const wrap = document.querySelector('.wrap');
        const h = wrap
            ? Math.ceil(wrap.getBoundingClientRect().height)
            : document.documentElement.scrollHeight;

        window.parent.postMessage({ source: 'truckbox-popup', type: 'height', height: h }, '*');
    };

    // Re-measure whenever the content box changes size — covers tab switches,
    // async content loading, and login/logout state changes automatically.
    const target = document.querySelector('.wrap') || document.body;
    if (window.ResizeObserver) {
        new ResizeObserver(measure).observe(target);
    }

    window.addEventListener('load', measure);
    // First measure once the DOM is ready.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', measure);
    } else {
        measure();
    }
})();
