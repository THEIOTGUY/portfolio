/* Small, independent enhancements for the static GitHub Pages portfolio. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const root = document.documentElement;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let mapScene = null;

  const themeButton = $('#theme-toggle');
  const themeMeta = $('meta[name="theme-color"]');
  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeButton?.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    themeButton?.setAttribute('title', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    themeMeta?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
    mapScene?.refreshColors();
  }
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
  themeButton?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch (_) { /* Private browsing may disable storage. */ }
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    try { if (['light', 'dark'].includes(localStorage.getItem('theme'))) return; } catch (_) { /* Follow system preference. */ }
    applyTheme(event.matches ? 'dark' : 'light');
  });

  const nav = $('#nav');
  const menuButton = $('#menu-btn');
  const mobileViewport = matchMedia('(max-width: 680px)');
  function setMenu(open, restoreFocus = false) {
    nav?.classList.toggle('open', open);
    menuButton?.setAttribute('aria-expanded', String(open));
    menuButton?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) nav?.querySelector('a')?.focus();
    else if (restoreFocus) menuButton?.focus();
  }
  menuButton?.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    setMenu(false);
    const hash = link.getAttribute('href');
    if (hash.startsWith('#')) {
      const target = $(hash);
      if (target) {
        target.setAttribute('tabindex', '-1');
        requestAnimationFrame(() => target.focus({ preventScroll: true }));
      }
    }
  }));
  document.addEventListener('click', event => {
    if (nav?.classList.contains('open') && !nav.contains(event.target) && !menuButton.contains(event.target)) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (!nav?.classList.contains('open')) return;
    if (event.key === 'Escape') { event.preventDefault(); setMenu(false, true); }
    if (event.key !== 'Tab') return;
    const focusable = [...nav.querySelectorAll('a'), menuButton];
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && index === 0) { event.preventDefault(); menuButton.focus(); }
    else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
  });
  mobileViewport.addEventListener('change', event => { if (!event.matches) setMenu(false); });

  const filters = $$('.filter-btn');
  const projects = $$('[data-category]');
  const filterStatus = $('#filter-status');
  filters.forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.filter;
    let visibleCount = 0;
    projects.forEach(project => {
      project.hidden = category !== 'all' && !project.dataset.category.split(' ').includes(category);
      if (!project.hidden) visibleCount++;
    });
    filters.forEach(filter => {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    if (filterStatus) filterStatus.textContent = `${visibleCount} ${category === 'all' ? 'selected ' : ''}${visibleCount === 1 ? 'project' : 'projects'}`;
  }));
  const filterGroup = $('.project-filters');
  if (filterGroup && projects.length) filterGroup.hidden = false;

  const clock = $('#clock');
  if (clock) {
    const formatter = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    const tick = () => {
      const now = new Date();
      clock.textContent = `${formatter.format(now)} IST`;
      clock.dateTime = now.toISOString();
    };
    tick();
    setInterval(tick, 60000);
  }
  const progress = $('#progress');
  let scrollQueued = false;
  function updateProgress() {
    const max = root.scrollHeight - innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0})`;
    scrollQueued = false;
  }
  addEventListener('scroll', () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  addEventListener('resize', updateProgress);
  filters.forEach(button => button.addEventListener('click', updateProgress));
  updateProgress();

  const links = $$('.nav-link[href^="#"]');
  const sections = links.map(link => $(link.getAttribute('href'))).filter(Boolean);
  function updateActiveSection() {
    const offset = parseInt(getComputedStyle(root).getPropertyValue('--header-h'), 10) + 100;
    let current = null;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= offset && (!current || section.offsetTop > current.offsetTop)) current = section;
    }
    if (scrollY > 0 && Math.ceil(scrollY + innerHeight) >= root.scrollHeight - 2) current = sections[sections.length - 1];
    links.forEach(link => {
      const active = current && link.getAttribute('href') === `#${current.id}`;
      link.classList.toggle('active', Boolean(active));
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(updateActiveSection, { rootMargin: '-80px 0px -55% 0px', threshold: [0, .1, .5, 1] });
    sections.forEach(section => sectionObserver.observe(section));
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    }), { threshold: .03 });
    $$('.reveal').forEach(element => revealObserver.observe(element));
  }
  // Also resolves the active link after jumping to a short section or changing filters.
  addEventListener('scroll', updateActiveSection, { passive: true });
  addEventListener('resize', updateActiveSection);
  filters.forEach(button => button.addEventListener('click', updateActiveSection));
  updateActiveSection();

  const toast = $('#toast');
  let toastTimer;
  function flash(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
  }
  const copyButton = $('#copy-email');
  let copyTimer;
  copyButton?.addEventListener('click', async () => {
    const email = copyButton.dataset.email;
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(email); copied = true; } catch (_) { /* Use the selection fallback. */ }
    }
    if (!copied) {
      const field = document.createElement('textarea');
      field.value = email;
      field.setAttribute('aria-label', 'Email address to copy');
      field.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.append(field);
      field.select();
      try { copied = document.execCommand('copy'); } catch (_) { /* Report the manual option. */ }
      field.remove();
      copyButton.focus({ preventScroll: true });
    }
    clearTimeout(copyTimer);
    copyButton.textContent = copied ? 'Copied ✓' : 'Select email to copy';
    flash(copied ? 'Email copied to clipboard' : `Copy this address: ${email}`);
    copyTimer = setTimeout(() => { copyButton.textContent = 'Copy email'; }, 2500);
  });
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  // Canvas failure must never prevent navigation, filtering, or contact actions.
  const canvas = $('#map-canvas');
  if (canvas && typeof window.createSplatScene === 'function') {
    try {
      mapScene = window.createSplatScene(canvas, $('#camera-canvas'), {
        splats: $('#hud-splats'), obs: $('#hud-obs'), pose: $('#hud-pose'), time: $('#hud-time'),
        coverage: $('#hud-coverage'), progress: $('#map-progress'), status: $('#map-status')
      }, motionPreference.matches);
      if (mapScene) $('.map-controls').hidden = false;
    } catch (error) {
      console.warn('The research illustration is unavailable.', error);
      $('#map-caption').textContent = 'Research across robot perception, semantic maps, and language-guided navigation. Explore the projects below.';
    }
  }
})();
