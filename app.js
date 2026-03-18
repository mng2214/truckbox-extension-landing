document.addEventListener("DOMContentLoaded", () => {
    // =======================
    // YEAR
    // =======================
    const yearEl = document.getElementById("y");
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    // =======================
    // MOBILE SIDEBAR
    // =======================
    const menuBtn = document.getElementById("menuBtn");
    const mobileSidebar = document.getElementById("mobileSidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    function closeSidebar() {
        if (mobileSidebar) mobileSidebar.classList.remove("open");
        if (sidebarOverlay) sidebarOverlay.classList.remove("active");
        if (menuBtn) menuBtn.classList.remove("active");
        document.body.style.overflow = "";
    }

    function openSidebar() {
        if (mobileSidebar) mobileSidebar.classList.add("open");
        if (sidebarOverlay) sidebarOverlay.classList.add("active");
        if (menuBtn) menuBtn.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    if (menuBtn && mobileSidebar && sidebarOverlay) {
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (mobileSidebar.classList.contains("open")) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });

        sidebarOverlay.addEventListener("click", closeSidebar);

        mobileSidebar.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeSidebar);
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && mobileSidebar.classList.contains("open")) {
                closeSidebar();
            }
        });
    }

    // =======================
    // PAGE SWITCHING
    // =======================
    const homePage = document.getElementById("home-page");
    const privacyPage = document.getElementById("privacy-policy-page");

    function setActive(pageName, options = {}) {
        const { scrollTop = true, behavior = "smooth" } = options;

        document.querySelectorAll(".home-section").forEach((el) => {
            el.classList.remove("active");
        });

        const page = document.getElementById(pageName + "-page");
        if (page) {
            page.classList.add("active");
        }

        updateActiveNavItems(pageName);

        if (scrollTop) {
            window.scrollTo({ top: 0, behavior });
        }
    }

    function updateActiveNavItems(pageName, sectionName = "") {
        document.querySelectorAll(".nav-item, .mobile-nav-item").forEach((item) => {
            item.classList.remove("active");
        });

        // mark page-level nav active
        document.querySelectorAll(`[data-nav="${pageName}"]`).forEach((item) => {
            item.classList.add("active");
        });

        // mark section link active too, when applicable
        if (sectionName) {
            document.querySelectorAll(`[data-section="${sectionName}"]`).forEach((item) => {
                item.classList.add("active");
            });
        }
    }

    function scrollToSection(sectionId, delay = 180) {
        if (!sectionId) return;

        const targetEl = document.getElementById(sectionId);
        if (!targetEl) return;

        setTimeout(() => {
            targetEl.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }, delay);
    }

    function getPageForSection(sectionId) {
        const privacySections = new Set([
            "privacy-policy",
            "privacy",
            "what-we-collect",
            "how-we-use",
            "oauth-scopes",
            "storage-security",
            "deletion",
            "rights",
            "children",
            "limited-use",
            "terms",
            "contact"
        ]);

        if (privacySections.has(sectionId)) {
            return "privacy-policy";
        }

        return "home";
    }

    function handleHash() {
        const rawHash = window.location.hash || "#home";
        const hash = rawHash.replace("#", "").toLowerCase();

        if (!hash || hash === "home") {
            setActive("home");
            updateActiveNavItems("home");
            return;
        }

        if (hash === "privacy-policy") {
            setActive("privacy-policy");
            updateActiveNavItems("privacy-policy");
            return;
        }

        const targetEl = document.getElementById(hash);

        if (!targetEl) {
            setActive("home");
            updateActiveNavItems("home");
            return;
        }

        const targetPage = getPageForSection(hash);

        if (targetPage === "privacy-policy") {
            if (!privacyPage?.classList.contains("active")) {
                setActive("privacy-policy", { scrollTop: true, behavior: "auto" });
            }
            updateActiveNavItems("privacy-policy", hash);
            scrollToSection(hash);
            return;
        }

        if (!homePage?.classList.contains("active")) {
            setActive("home", { scrollTop: true, behavior: "auto" });
        }
        updateActiveNavItems("home", hash);
        scrollToSection(hash);
    }

    // =======================
    // NAVIGATION CLICK HANDLERS
    // =======================
    document.querySelectorAll("[data-nav]").forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();

            const targetPage = link.getAttribute("data-nav");
            const targetSection = link.getAttribute("data-section");
            const href = link.getAttribute("href");

            if (targetSection) {
                history.pushState(null, "", "#" + targetSection);
            } else if (href && href.startsWith("#")) {
                history.pushState(null, "", href);
            } else if (targetPage) {
                history.pushState(null, "", "#" + targetPage);
            }

            handleHash();
            closeSidebar();
        });
    });

    // =======================
    // OPTIONAL SMOOTH SCROLL LINKS
    // =======================
    document.querySelectorAll("[data-scroll]").forEach((anchor) => {
        anchor.addEventListener("click", (e) => {
            e.preventDefault();

            const href = anchor.getAttribute("href");
            if (!href || !href.startsWith("#")) return;

            history.pushState(null, "", href);
            handleHash();
        });
    });

    window.addEventListener("hashchange", handleHash);

    // Initial load
    handleHash();

    // =======================
    // PROGRESS BAR
    // =======================
    const progressBar = document.getElementById("progressBar");
    if (progressBar) {
        window.addEventListener("scroll", () => {
            const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
            progressBar.style.width = progress + "%";
        }, { passive: true });
    }

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
            { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
        );

        revealElements.forEach((el) => observer.observe(el));
    }

    // =======================
    // PRINT BUTTON
    // =======================
    const printBtn = document.getElementById("printBtn");
    if (printBtn) {
        printBtn.addEventListener("click", () => {
            window.print();
        });
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
        return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    }

    function renderCaptcha(code) {
        if (!captchaDisplay) return;
        captchaDisplay.innerHTML = "";

        code.split("").forEach((char) => {
            const span = document.createElement("span");
            span.textContent = char;
            span.style.display = "inline-block";
            span.style.transform = `rotate(${(Math.random() * 8 - 4).toFixed(1)}deg) translateY(${(Math.random() * 3 - 1.5).toFixed(1)}px)`;
            span.style.opacity = String(0.85 + Math.random() * 0.15);
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

    const refreshCaptchaBtn = document.getElementById("refreshCaptcha");
    if (refreshCaptchaBtn) {
        refreshCaptchaBtn.addEventListener("click", generateCaptcha);
    }

    if (captchaDisplay) {
        generateCaptcha();
    }

    // =======================
    // CONTACT FORM
    // =======================
    const form = document.getElementById("contactForm");

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (
                captchaInput &&
                (captchaInput.value || "").trim().toLowerCase() !== currentCaptcha.toLowerCase()
            ) {
                if (captchaError) {
                    captchaError.textContent = "Incorrect verification code. Please try again.";
                }
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
                    headers: { Accept: "application/json" }
                });

                if (res.ok) {
                    form.style.display = "none";
                    const successBlock = document.getElementById("formSuccess");
                    if (successBlock) {
                        successBlock.style.display = "block";
                    }
                } else {
                    const data = await res.json().catch(() => ({}));
                    if (formError) {
                        formError.textContent =
                            data?.error || "Failed to send. Please try again later.";
                    }
                }
            } catch (err) {
                console.error("Form submit error:", err);
                if (formError) {
                    formError.textContent =
                        "Network error. Please check your connection and try again.";
                }
            } finally {
                if (btnText) btnText.style.display = "inline";
                if (btnLoading) btnLoading.style.display = "none";
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    const resetFormBtn = document.getElementById("resetFormBtn");
    if (resetFormBtn && form) {
        resetFormBtn.addEventListener("click", () => {
            form.reset();
            form.style.display = "block";

            const successBlock = document.getElementById("formSuccess");
            if (successBlock) {
                successBlock.style.display = "none";
            }

            generateCaptcha();
            if (captchaError) captchaError.textContent = "";
            if (formError) formError.textContent = "";
        });
    }
});