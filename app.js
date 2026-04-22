async function loadIncludes() {
    const nodes = Array.from(document.querySelectorAll('[data-include]'));
    await Promise.all(nodes.map(async (node) => {
        const url = node.getAttribute('data-include');
        if (!url) return;
        try {
            const res = await fetch(url, {cache: 'no-cache'});
            if (!res.ok) throw new Error(`Failed to load ${url}`);
            node.outerHTML = await res.text();
        } catch (err) {
            console.error('[Truck Box] include load failed:', err);
        }
    }));
}

function initYears() {
    document.querySelectorAll('[data-year]').forEach((el) => {
        el.textContent = new Date().getFullYear();
    });
}

function initSidebar() {
    const menuBtn = document.getElementById('menuBtn');
    const mobileSidebar = document.getElementById('mobileSidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (!menuBtn || !mobileSidebar || !sidebarOverlay) return;

    function closeSidebar() {
        mobileSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
        menuBtn.classList.remove('active');
        menuBtn.setAttribute('aria-expanded', 'false');
        mobileSidebar.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function openSidebar() {
        mobileSidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
        menuBtn.classList.add('active');
        menuBtn.setAttribute('aria-expanded', 'true');
        mobileSidebar.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileSidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    sidebarOverlay.addEventListener('click', closeSidebar);
    mobileSidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeSidebar));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });
}

function initActiveNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const page = document.body.dataset.page;

    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach((link) => {
        const href = link.getAttribute('href') || '';
        const pageLink = link.getAttribute('data-page-link');
        if (
            pageLink === page ||
            href === currentPath ||
            (href === 'index.html' && (currentPath === '' || currentPath === 'index.html') && page === 'home')
        ) {
            link.classList.add('active');
        }
    });
}

function initProgressBar() {
    const progressBar = document.getElementById('progressBar');
    if (!progressBar) return;

    function updateProgressBar() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        progressBar.style.width = progress + '%';
    }

    window.addEventListener('scroll', updateProgressBar, { passive: true });
    window.addEventListener('resize', updateProgressBar, { passive: true });
    window.addEventListener('hashchange', () => setTimeout(updateProgressBar, 80));
    window.addEventListener('load', updateProgressBar);
    updateProgressBar();
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (!targetId || targetId === '#') return;
            const target = document.querySelector(targetId);
            if (!target) return;
            e.preventDefault();
            const headerOffset = 88;
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
            window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        });
    });
}

function initReveal() {
    const revealElements = document.querySelectorAll('.reveal');
    if (!revealElements.length) return;

    const isInstagram = /Instagram/i.test(navigator.userAgent || '');

    if (isInstagram || !('IntersectionObserver' in window)) {
        revealElements.forEach((el) => el.classList.add('visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    revealElements.forEach((el) => observer.observe(el));
}

function initPrintButton() {
    document.getElementById('printBtn')?.addEventListener('click', () => window.print());
}

function initCaptchaAndForm() {
    let currentCaptcha = '';
    const captchaDisplay = document.getElementById('captchaDisplay');
    const captchaInput = document.getElementById('captchaInput');
    const captchaError = document.getElementById('captchaError');
    const formError = document.getElementById('formError');
    const form = document.getElementById('contactForm');

    function randomCaptcha(length = 6) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    function renderCaptcha(code) {
        if (!captchaDisplay) return;
        captchaDisplay.innerHTML = '';
        code.split('').forEach((char) => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.display = 'inline-block';
            span.style.transform = `rotate(${(Math.random() * 8 - 4).toFixed(1)}deg)`;
            span.style.margin = '0 2px';
            captchaDisplay.appendChild(span);
        });
    }

    function generateCaptcha() {
        currentCaptcha = randomCaptcha();
        renderCaptcha(currentCaptcha);
        if (captchaInput) captchaInput.value = '';
        if (captchaError) captchaError.textContent = '';
        if (formError) formError.textContent = '';
    }

    document.getElementById('refreshCaptcha')?.addEventListener('click', generateCaptcha);
    if (captchaDisplay) generateCaptcha();

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (captchaInput && captchaInput.value.trim().toLowerCase() !== currentCaptcha.toLowerCase()) {
            if (captchaError) captchaError.textContent = 'Incorrect verification code.';
            generateCaptcha();
            return;
        }

        const formData = new FormData(form);
        const name = (formData.get('name') || '').toString().trim();
        const email = (formData.get('email') || '').toString().trim();
        const message = (formData.get('message') || '').toString().trim();

        if (!name || !email || !message) {
            if (formError) formError.textContent = 'Please fill in all fields.';
            return;
        }

        const successBox = document.createElement('div');
        successBox.className = 'form-success';
        successBox.innerHTML = `
            <h3>Thank you!</h3>
            <p>Your message has been prepared. Connect your backend or form service later to send it live.</p>
            <p class="small">For now, this form is front-end only.</p>
        `;
        form.replaceWith(successBox);
    });
}

function initRolePopup() {
    const modal = document.getElementById('roleModal');
    if (!modal || document.body.dataset.page !== 'home' || /Instagram/i.test(navigator.userAgent || '')) return;

    const step1 = modal.querySelector('[data-role-step="1"]');
    const step2 = modal.querySelector('[data-role-step="2"]');
    const nextBtn = document.getElementById('roleNextBtn');
    const skipBtn = document.getElementById('roleSkipBtn');
    const backBtn = document.getElementById('roleBackBtn');
    const closeBtn = document.getElementById('roleModalClose');
    const closeTargets = modal.querySelectorAll('[data-role-close]');
    const roleInputs = modal.querySelectorAll('input[name="userRole"]');
    const titleEl = document.getElementById('roleDynamicTitle');
    const introEl = document.getElementById('roleDynamicIntro');
    const benefitsEl = document.getElementById('roleBenefits');
    const ctaBtn = document.getElementById('roleCtaBtn');

    const storageKey = 'truckbox-role-popup-state';
    const roleKey = 'truckbox-selected-role';

    const roleContent = {
        dispatcher: {
            title: 'Built for Dispatchers',
            intro: 'Truck Box helps dispatchers move faster on DAT and save valuable time every day.',
            benefits: [
                'Send broker emails in 1 click from the DAT Search Truck page.',
                'Use saved templates for fast and consistent outreach.',
                'Navigate DAT Search Loads with keyboard shortcuts.',
                'Open load locations instantly with built-in Google Maps links.',
                'Hide short trips and focus on better loads (Beta).',
                'Save hours on repetitive work and book loads faster.'
            ],
            cta: 'Install for Dispatching'
        },
        driver: {
            title: 'Faster Dispatch Means Less Waiting',
            intro: 'Drivers benefit when dispatch can reach brokers quickly and secure loads faster.',
            benefits: [
                'Faster communication between dispatchers and brokers.',
                'Reduced waiting time for load confirmations.',
                'Smoother coordination and fewer delays.'
            ],
            cta: 'See How It Works'
        },
        business_owner: {
            title: 'Built for Efficient Carrier Teams',
            intro: 'Truck Box helps owners streamline operations and maximize dispatcher productivity.',
            benefits: [
                'Reduce time spent on repetitive email outreach.',
                'Standardize communication with reusable templates.',
                'Help dispatchers focus on higher-quality loads.',
                'Affordable solution with a strong return on investment.'
            ],
            cta: 'Start Free Trial'
        },
        other: {
            title: 'A Faster Way to Work on DAT',
            intro: 'Truck Box simplifies broker outreach and speeds up your workflow inside DAT.',
            benefits: [
                'Send emails directly from DAT load rows.',
                'Use ready-made templates for consistent messaging.',
                'Enjoy a cleaner and more efficient workflow.'
            ],
            cta: 'Explore Truck Box'
        }
    };

    let selectedRole = localStorage.getItem(roleKey) || '';
    let openTimer = null;
    let hasOpened = false;

    function setStep(step) {
        step1.classList.toggle('active', step === 1);
        step2.classList.toggle('active', step === 2);
    }

    function renderRole(role) {
        const content = roleContent[role] || roleContent.other;
        titleEl.textContent = content.title;
        introEl.textContent = content.intro;
        benefitsEl.innerHTML = content.benefits.map((item) => `<div class="role-benefit">${item}</div>`).join('');
        ctaBtn.textContent = content.cta;
    }

    function track(eventName, params = {}) {
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, params);
        }
    }

    function cleanupOpenTriggers() {
        if (openTimer) {
            clearTimeout(openTimer);
            openTimer = null;
        }
        window.removeEventListener('scroll', handleScrollOpen);
    }

    function openModal() {
        if (hasOpened || localStorage.getItem(storageKey) === 'done') return;
        hasOpened = true;
        cleanupOpenTriggers();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        track('role_popup_shown');
    }

    function closeModal(markDismissed = true) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        cleanupOpenTriggers();

        if (markDismissed) {
            localStorage.setItem(storageKey, 'done');
        }
    }

    function handleScrollOpen() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

        if (progress >= 0.35) {
            openModal();
        }
    }

    if (localStorage.getItem(storageKey) === 'done') return;

    if (selectedRole) {
        const matchedInput = Array.from(roleInputs).find((input) => input.value === selectedRole);
        if (matchedInput) {
            matchedInput.checked = true;
            nextBtn.disabled = false;
        }
    }

    setStep(1);

    roleInputs.forEach((input) => {
        input.addEventListener('change', () => {
            selectedRole = input.value;
            nextBtn.disabled = !selectedRole;
            localStorage.setItem(roleKey, selectedRole);
            track('role_selected', { role: selectedRole });
        });
    });

    nextBtn?.addEventListener('click', () => {
        if (!selectedRole) return;
        renderRole(selectedRole);
        setStep(2);
        track('role_popup_continue', { role: selectedRole });
    });

    backBtn?.addEventListener('click', () => setStep(1));

    skipBtn?.addEventListener('click', () => {
        closeModal(true);
        track('role_popup_skipped');
    });

    closeBtn?.addEventListener('click', () => closeModal(true));
    closeTargets.forEach((el) => el.addEventListener('click', () => closeModal(true)));

    ctaBtn?.addEventListener('click', () => {
        closeModal(true);
        track('role_popup_cta_click', { role: selectedRole || 'unknown' });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) {
            closeModal(true);
        }
    });

    window.addEventListener('scroll', handleScrollOpen, { passive: true });

    openTimer = window.setTimeout(() => {
        openModal();
    }, 8000);
}

function initFaqAccordion() {
    const items = document.querySelectorAll('.faq-item');
    if (!items.length) return;

    items.forEach((item, index) => {
        const button = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');

        if (!button || !answer) return;

        const answerId = answer.id || `faq-answer-${index + 1}`;
        answer.id = answerId;

        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', answerId);
        answer.setAttribute('hidden', '');
        answer.style.maxHeight = '0px';

        button.addEventListener('click', () => {
            const isOpen = item.classList.contains('active');

            items.forEach((otherItem) => {
                const otherButton = otherItem.querySelector('.faq-question');
                const otherAnswer = otherItem.querySelector('.faq-answer');
                if (!otherButton || !otherAnswer) return;

                otherItem.classList.remove('active');
                otherButton.setAttribute('aria-expanded', 'false');
                otherAnswer.style.maxHeight = '0px';
                otherAnswer.setAttribute('hidden', '');
            });

            if (isOpen) {
                item.classList.remove('active');
                button.setAttribute('aria-expanded', 'false');
                answer.style.maxHeight = '0px';
                answer.setAttribute('hidden', '');
            } else {
                item.classList.add('active');
                button.setAttribute('aria-expanded', 'true');
                answer.removeAttribute('hidden');
                answer.style.maxHeight = answer.scrollHeight + 'px';
            }
        });
    });

    window.addEventListener('resize', () => {
        const openItem = document.querySelector('.faq-item.active .faq-answer');
        if (openItem) {
            openItem.style.maxHeight = openItem.scrollHeight + 'px';
        }
    });
}

function initPointerGlow() {
    const hero = document.querySelector('.hero-luxe');
    if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId = null;
    hero.addEventListener('pointermove', (e) => {
        const rect = hero.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        if (rafId) cancelAnimationFrame(rafId);

        rafId = requestAnimationFrame(() => {
            hero.style.setProperty('--mx', x.toFixed(2) + '%');
            hero.style.setProperty('--my', y.toFixed(2) + '%');
        });
    });
}

async function initPage() {
    try {
        await loadIncludes();
    } catch (e) {
        console.warn('[Truck Box] includes skipped', e);
    }

    initYears();
    initSidebar();
    initActiveNav();
    initProgressBar();
    initSmoothScroll();
    initReveal();
    initPrintButton();
    initCaptchaAndForm();
    initFaqAccordion();
    initRolePopup();
    initPointerGlow();
}

document.addEventListener('DOMContentLoaded', initPage);