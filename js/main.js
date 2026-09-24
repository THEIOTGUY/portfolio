document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Theme toggle ---
    const themeToggle = document.getElementById('theme-toggle');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
    const currentTheme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');

    themeToggle.addEventListener('click', () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch (e) {}
        scan.refreshColors();
    });
    systemDark.addEventListener('change', () => scan.refreshColors());

    // --- Header border on scroll ---
    const header = document.querySelector('.site-header');
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
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

    // --- Hero point cloud ("LiDAR scan") ---
    const scan = createPointCloud(document.getElementById('scan'), document.getElementById('scan-count'), reduceMotion);
});

function createPointCloud(canvas, counter, reduceMotion) {
    const ctx = canvas.getContext('2d');
    const points = [];

    // Fibonacci sphere, gently displaced so it reads as a scanned object rather than a perfect ball
    const SPHERE = 1100;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < SPHERE; i++) {
        const y = 1 - (i / (SPHERE - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = golden * i;
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        const bump = 1 + 0.08 * Math.sin(x * 5 + y * 3) * Math.cos(z * 4);
        points.push({ x: x * bump, y: y * bump, z: z * bump, ring: false });
    }
    // Tilted orbital ring
    const RING = 360;
    for (let i = 0; i < RING; i++) {
        const a = (i / RING) * Math.PI * 2;
        const rad = 1.55 + (Math.random() - 0.5) * 0.12;
        points.push({ x: Math.cos(a) * rad, y: (Math.random() - 0.5) * 0.04, z: Math.sin(a) * rad, ring: true });
    }

    let colors = {};
    const refreshColors = () => {
        const cs = getComputedStyle(document.documentElement);
        colors = {
            ink: cs.getPropertyValue('--ink').trim(),
            accent: cs.getPropertyValue('--accent').trim()
        };
    };
    refreshColors();

    let width = 0, height = 0, dpr = 1;
    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = rect.width;
        height = rect.height;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    new ResizeObserver(() => { resize(); if (!running) draw(0); }).observe(canvas);
    resize();

    // Rotation state: auto-rotate plus drag / pointer tilt
    let rotY = 0.6, rotX = -0.35, velY = 0.0035;
    let targetTilt = 0, tilt = 0;
    let dragging = false, lastX = 0, lastY = 0;

    canvas.addEventListener('pointerdown', (e) => {
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
        const rect = canvas.getBoundingClientRect();
        targetTilt = ((e.clientY - rect.top) / rect.height - 0.5) * 0.4;
        if (!dragging) return;
        velY = (e.clientX - lastX) * 0.004;
        rotX = Math.max(-1.2, Math.min(1.2, rotX + (e.clientY - lastY) * 0.004));
        rotY += velY;
        lastX = e.clientX; lastY = e.clientY;
    });
    const endDrag = () => { dragging = false; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => { targetTilt = 0; });

    let shown = reduceMotion ? points.length : 0;

    function draw(t) {
        ctx.clearRect(0, 0, width, height);
        const scale = Math.min(width, height) * 0.27;
        const cx = width / 2, cy = height / 2 - height * 0.02;
        const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        const ax = rotX + tilt;
        const cosX = Math.cos(ax), sinX = Math.sin(ax);
        // Scan plane sweeps top → bottom in object space
        const scanY = Math.sin(t * 0.0006) * 1.3;

        for (let i = 0; i < shown; i++) {
            const p = points[i];
            // rotate Y then X
            let x = p.x * cosY - p.z * sinY;
            let z = p.x * sinY + p.z * cosY;
            let y = p.y * cosX - z * sinX;
            z = p.y * sinX + z * cosX;

            const persp = 3.2 / (3.2 + z);
            const sx = cx + x * scale * persp;
            const sy = cy + y * scale * persp;
            const depth = (1 - z) / 2; // 0 = far, 1 = near

            const nearScan = Math.abs(p.y - scanY) < 0.05 && !p.ring;
            ctx.globalAlpha = nearScan ? 1 : 0.12 + depth * 0.6;
            ctx.fillStyle = nearScan || p.ring && depth > 0.5 ? colors.accent : colors.ink;
            const size = (nearScan ? 2.2 : 1.3) * persp;
            ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
    }

    let running = false, rafId = null, lastCount = -1;
    function frame(t) {
        if (!dragging) {
            velY += (0.0035 - velY) * 0.02; // ease back to idle spin
            rotY += velY;
        }
        tilt += (targetTilt - tilt) * 0.05;
        if (shown < points.length) shown = Math.min(points.length, shown + 18);
        draw(t);
        if (shown !== lastCount) { counter.textContent = `n = ${shown.toLocaleString()}`; lastCount = shown; }
        rafId = requestAnimationFrame(frame);
    }
    const start = () => { if (!running && !reduceMotion) { running = true; rafId = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(rafId); };

    // Only animate while visible
    new IntersectionObserver(([entry]) => { entry.isIntersecting ? start() : stop(); }).observe(canvas);
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });

    if (reduceMotion) {
        draw(0);
        counter.textContent = `n = ${points.length.toLocaleString()}`;
    }

    return {
        refreshColors: () => { refreshColors(); if (!running) draw(0); }
    };
}
