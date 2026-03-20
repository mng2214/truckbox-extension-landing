document.addEventListener("DOMContentLoaded", () => {
    // =======================
    // YEAR
    // =======================
    const yearEl = document.getElementById("y");
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    const sidebarYear = document.getElementById("sidebarYear");
    if (sidebarYear) {
        sidebarYear.textContent = new Date().getFullYear();
    }

    // =======================
    // MOBILE SIDEBAR
    // =======================
    const menuBtn = document.getElementById("menuBtn");
    const mobileSidebar = document.getElementById("mobileSidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    function closeSidebar() {
        mobileSidebar?.classList.remove("open");
        sidebarOverlay?.classList.remove("active");
        menuBtn?.classList.remove("active");
        document.body.style.overflow = "";
    }

    function openSidebar() {
        mobileSidebar?.classList.add("open");
        sidebarOverlay?.classList.add("active");
        menuBtn?.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    if (menuBtn && mobileSidebar && sidebarOverlay) {
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            mobileSidebar.classList.contains("open") ? closeSidebar() : openSidebar();
        });

        sidebarOverlay.addEventListener("click", closeSidebar);

        mobileSidebar.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeSidebar);
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeSidebar();
        });
    }

    // =======================
    // ACTIVE NAV LINK
    // =======================
    const currentPath = window.location.pathname.split("/").pop();

    document.querySelectorAll(".nav-item, .mobile-nav-item").forEach((link) => {
        const href = link.getAttribute("href");

        if (
            href === currentPath ||
            (href === "index.html" && (currentPath === "" || currentPath === "index.html"))
        ) {
            link.classList.add("active");
        }
    });

    // =======================
    // PROGRESS BAR
    // =======================
    const progressBar = document.getElementById("progressBar");

    function updateProgressBar() {
        if (!progressBar) return;

        const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;

        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        progressBar.style.width = progress + "%";
    }

    if (progressBar) {
        window.addEventListener("scroll", updateProgressBar, {passive: true});
        window.addEventListener("resize", updateProgressBar, {passive: true});

        window.addEventListener("hashchange", () => {
            setTimeout(updateProgressBar, 80);
        });

        window.addEventListener("load", updateProgressBar);

        // initial run
        updateProgressBar();
    }

    // =======================
    // SMOOTH SCROLL (same page anchors)
    // =======================
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
            const targetId = this.getAttribute("href");
            if (!targetId || targetId === "#") return;

            const target = document.querySelector(targetId);
            if (!target) return;

            e.preventDefault();

            const headerOffset = 88;
            const targetPosition =
                target.getBoundingClientRect().top + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: targetPosition,
                behavior: "smooth"
            });

            setTimeout(updateProgressBar, 120);
            setTimeout(updateProgressBar, 350);
        });
    });

    // =======================
    // SAFE TOP SPACING FOR ACTION BUTTON AREAS
    // =======================
    document.querySelectorAll(".hero-actions, .pricing-actions, .cta-actions").forEach((section) => {
        if (!section.style.marginTop) {
            section.style.marginTop = "16px";
        }
    });

    // =======================
    // REVEAL ANIMATION
    // =======================
    const revealElements = document.querySelectorAll(".reveal");

    if (revealElements.length) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            {threshold: 0.1, rootMargin: "0px 0px -50px 0px"}
        );

        revealElements.forEach((el) => observer.observe(el));
    }

    // =======================
    // PRINT BUTTON
    // =======================
    const printBtn = document.getElementById("printBtn");
    if (printBtn) {
        printBtn.addEventListener("click", () => window.print());
    }

    // =======================
    // CAPTCHA
    // =======================
    let currentCaptcha = "";

    const captchaDisplay = document.getElementById("captchaDisplay");
    const captchaInput = document.getElementById("captchaInput");
    const captchaError = document.getElementById("captchaError");
    const formError = document.getElementById("formError");

    function randomCaptcha(length = 6) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        return Array.from({length}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    }

    function renderCaptcha(code) {
        if (!captchaDisplay) return;

        captchaDisplay.innerHTML = "";

        code.split("").forEach((char) => {
            const span = document.createElement("span");
            span.textContent = char;
            span.style.display = "inline-block";
            span.style.transform = `rotate(${(Math.random() * 8 - 4).toFixed(1)}deg)`;
            span.style.margin = "0 2px";
            captchaDisplay.appendChild(span);
        });
    }

    function generateCaptcha() {
        currentCaptcha = randomCaptcha();
        renderCaptcha(currentCaptcha);

        if (captchaInput) captchaInput.value = "";
        if (captchaError) captchaError.textContent = "";
        if (formError) formError.textContent = "";
    }

    document.getElementById("refreshCaptcha")?.addEventListener("click", generateCaptcha);

    if (captchaDisplay) generateCaptcha();

    // =======================
    // CONTACT FORM
    // =======================
    const form = document.getElementById("contactForm");

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (
                captchaInput &&
                captchaInput.value.trim().toLowerCase() !== currentCaptcha.toLowerCase()
            ) {
                captchaError.textContent = "Incorrect verification code.";
                generateCaptcha();
                return;
            }

            if (captchaError) captchaError.textContent = "";
            if (formError) formError.textContent = "";

            const submitBtn = document.getElementById("submitBtn");
            const btnText = submitBtn?.querySelector(".btn-text");
            const btnLoading = submitBtn?.querySelector(".btn-loading");

            if (btnText) btnText.style.display = "none";
            if (btnLoading) btnLoading.style.display = "inline-flex";
            if (submitBtn) submitBtn.disabled = true;

            try {
                const formData = new FormData(form);

                const res = await fetch(form.action, {
                    method: "POST",
                    body: formData,
                    headers: {Accept: "application/json"}
                });

                if (res.ok) {
                    form.style.display = "none";
                    document.getElementById("formSuccess")?.style.setProperty("display", "block");
                    setTimeout(updateProgressBar, 100);
                } else {
                    if (formError) formError.textContent = "Failed to send. Try again.";
                }
            } catch (err) {
                if (formError) formError.textContent = "Network error.";
            } finally {
                if (btnText) btnText.style.display = "inline";
                if (btnLoading) btnLoading.style.display = "none";
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // =======================
    // RESET FORM
    // =======================
    document.getElementById("resetFormBtn")?.addEventListener("click", () => {
        form?.reset();
        if (form) form.style.display = "block";
        document.getElementById("formSuccess")?.style.setProperty("display", "none");
        generateCaptcha();
        setTimeout(updateProgressBar, 100);
    });
});