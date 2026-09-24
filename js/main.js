document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Hero splat-map simulation ---
    const scene = window.createSplatScene(
        document.getElementById('map-canvas'),
        document.getElementById('cam-canvas'),
        {
            splats: document.getElementById('hud-splats'),
            obs: document.getElementById('hud-obs'),
            pose: document.getElementById('hud-pose'),
            time: document.getElementById('hud-time')
        },
        reduceMotion
    );

    // --- Theme toggle (dark by default) ---
    const themeToggle = document.getElementById('theme-toggle');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const applyTheme = (theme) => {
        root.dataset.theme = theme;
        themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        themeMeta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
        scene.refreshColors();
    };
    applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
    themeToggle.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem('theme', next); } catch (e) {}
    });

    // --- Header background + reading progress ---
    const header = document.querySelector('.site-header');
    const progress = document.getElementById('progress');
    const onScroll = () => {
        header.classList.toggle('scrolled', window.scrollY > 8);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    // --- Mobile menu ---
    const menuBtn = document.getElementById('menu-btn');
    const nav = document.getElementById('nav');
    const setMenu = (open) => {
        nav.classList.toggle('open', open);
        menuBtn.setAttribute('aria-expanded', String(open));
        menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    document.addEventListener('click', (e) => {
        if (nav.classList.contains('open') && !nav.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
    });

    // --- Active nav link ---
    const navLinks = [...nav.querySelectorAll('.nav-link')];
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            navLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
            });
        });
    }, { rootMargin: '-45% 0px -55% 0px' });
    document.querySelectorAll('main section[id]').forEach(s => sectionObserver.observe(s));

    // --- Reveal on scroll (staggered within siblings) ---
    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach(el => {
        const siblings = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
        el.style.setProperty('--d', `${Math.min(siblings.indexOf(el), 5) * 70}ms`);
        // Drop the stagger once revealed so hover transitions respond immediately
        el.addEventListener('transitionend', (e) => {
            if (e.propertyName === 'opacity' && el.classList.contains('in')) el.style.setProperty('--d', '0s');
        });
    });
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => revealObserver.observe(el));

    // --- Cursor spotlight on cards ---
    if (window.matchMedia('(hover: hover)').matches) {
        document.addEventListener('pointermove', (e) => {
            const card = e.target.closest && e.target.closest('.card');
            if (!card) return;
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${e.clientX - r.left}px`);
            card.style.setProperty('--my', `${e.clientY - r.top}px`);
        }, { passive: true });
    }

    // --- Copy email ---
    const toast = document.getElementById('toast');
    let toastTimer;
    const showToast = (msg) => {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
    };
    document.getElementById('copy-email').addEventListener('click', async (e) => {
        const email = e.currentTarget.dataset.email;
        try {
            await navigator.clipboard.writeText(email);
            showToast('Email copied to clipboard');
        } catch (err) {
            window.location.href = `mailto:${email}`;
        }
    });

    document.getElementById('year').textContent = new Date().getFullYear();
});
