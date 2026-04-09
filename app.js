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

function initFaqAccordion() {
    document.querySelectorAll('.faq-item').forEach((item) => {
        const button = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        if (!button || !answer) return;

        button.addEventListener('click', () => {
            const isOpen = item.classList.contains('active');
            document.querySelectorAll('.faq-item.active').forEach((openItem) => {
                openItem.classList.remove('active');
                const openButton = openItem.querySelector('.faq-question');
                const openAnswer = openItem.querySelector('.faq-answer');
                openButton?.setAttribute('aria-expanded', 'false');
                if (openAnswer) openAnswer.style.maxHeight = null;
            });

            if (!isOpen) {
                item.classList.add('active');
                button.setAttribute('aria-expanded', 'true');
                answer.style.maxHeight = answer.scrollHeight + 'px';
            }
        });
    });
}

async function initPage() {
    await loadIncludes();
    initYears();
    initSidebar();
    initActiveNav();
    initProgressBar();
    initSmoothScroll();
    initReveal();
    initPrintButton();
    initCaptchaAndForm();
    initFaqAccordion();
}

document.addEventListener('DOMContentLoaded', initPage);
