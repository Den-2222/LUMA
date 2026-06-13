/* ==========================================================================
   LUMA — animation engine
   Reveal-on-scroll · 3D tilt · parallax · count-up · before/after · announcement
   Content-agnostic, respects prefers-reduced-motion, and idempotent: every
   binder is guarded so re-running boot() never duplicates observers/intervals.
   ========================================================================== */
(function () {
  'use strict';

  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cfg = (window.LUMA && window.LUMA.settings) || {};
  const canHover = window.matchMedia('(hover: hover)').matches;
  const enabled = cfg.animations !== false && !reduced;

  /* ---------- Reveal on scroll (with stagger) ---------- */
  let revealIO;
  function initReveal() {
    const items = $$('[data-reveal]').filter((el) => !el.dataset.revBound);
    if (!items.length) return;
    if (!enabled) { items.forEach((el) => { el.dataset.revBound = '1'; el.classList.add('is-revealed'); }); return; }
    if (!revealIO) {
      revealIO = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const group = el.closest('[data-reveal-group]');
          if (group && !el.style.getPropertyValue('--reveal-delay')) {
            const sibs = $$('[data-reveal]', group);
            const idx = sibs.indexOf(el);
            el.style.setProperty('--reveal-delay', (idx * 90) + 'ms');
          }
          el.classList.add('is-revealed');
          obs.unobserve(el);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    }
    items.forEach((el) => { el.dataset.revBound = '1'; revealIO.observe(el); });
  }

  /* ---------- Float ---------- */
  function initFloat() {
    if (!enabled || cfg.float === false) return;
    $$('[data-float]').forEach((el, i) => {
      if (el.dataset.floatBound) return;
      el.dataset.floatBound = '1';
      el.classList.add('is-float');
      el.style.animationDelay = (i * 0.4) + 's';
      if (el.dataset.float) el.style.setProperty('animation-duration', el.dataset.float + 's');
    });
  }

  /* ---------- 3D tilt ---------- */
  function initTilt() {
    if (!enabled || cfg.tilt === false || !canHover) return;
    $$('[data-tilt]').forEach((el) => {
      if (el.dataset.tiltBound) return;
      el.dataset.tiltBound = '1';
      const max = parseFloat(el.dataset.tilt) || 6;
      let glare = el.querySelector('.tilt-glare');
      if (!glare) { glare = document.createElement('span'); glare.className = 'tilt-glare'; el.appendChild(glare); }
      let raf;
      function move(e) {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform = `perspective(900px) rotateY(${(px - 0.5) * max * 2}deg) rotateX(${(0.5 - py) * max * 2}deg)`;
          el.style.setProperty('--glare-x', (px * 100) + '%');
          el.style.setProperty('--glare-y', (py * 100) + '%');
        });
      }
      el.addEventListener('pointerenter', () => el.classList.add('is-tilting'));
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', () => { el.classList.remove('is-tilting'); el.style.transform = ''; });
    });
  }

  /* ---------- Parallax (scroll listener bound once) ---------- */
  let parallaxItems = [];
  let parallaxBound = false;
  function initParallax() {
    if (!enabled || cfg.parallax === false) return;
    parallaxItems = $$('[data-parallax]');
    if (!parallaxItems.length || parallaxBound) { if (parallaxItems.length) update(); return; }
    parallaxBound = true;
    let ticking = false;
    function onScroll() { if (!ticking) { requestAnimationFrame(update); ticking = true; } ticking = false; }
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
  function update() {
    const vh = window.innerHeight;
    parallaxItems.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0.2;
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const progress = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.transform = `translate3d(0, ${(-progress * speed * 100).toFixed(2)}px, 0)`;
    });
  }

  /* ---------- Count-up statistics ---------- */
  let countIO;
  function initCountUp() {
    const nums = $$('[data-countup]').filter((el) => !el.dataset.cuBound);
    if (!nums.length) return;
    if (!enabled) { nums.forEach((el) => { el.dataset.cuBound = '1'; el.textContent = el.dataset.countup; }); return; }
    if (!countIO) {
      countIO = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseFloat(el.dataset.countup) || 0;
          const decimals = (el.dataset.countup.split('.')[1] || '').length;
          const dur = 1600;
          const start = performance.now();
          function step(now) {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = (target * eased).toFixed(decimals);
            if (p < 1) requestAnimationFrame(step); else el.textContent = el.dataset.countup;
          }
          requestAnimationFrame(step);
          obs.unobserve(el);
        });
      }, { threshold: 0.5 });
    }
    nums.forEach((el) => { el.dataset.cuBound = '1'; countIO.observe(el); });
  }

  /* ---------- Before / After slider ---------- */
  function initBeforeAfter() {
    $$('[data-ba]').forEach((ba) => {
      if (ba.dataset.bound) return;
      const compare = ba.querySelector('.ba__compare');
      if (!compare) return;
      ba.dataset.bound = '1';
      let dragging = false;
      function setPos(clientX) {
        const r = compare.getBoundingClientRect();
        let pos = ((clientX - r.left) / r.width) * 100;
        pos = Math.max(0, Math.min(100, pos));
        compare.style.setProperty('--ba-pos', pos + '%');
      }
      function getX(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
      compare.addEventListener('pointerdown', (e) => { dragging = true; setPos(getX(e)); });
      window.addEventListener('pointermove', (e) => { if (dragging) { setPos(getX(e)); e.preventDefault(); } }, { passive: false });
      window.addEventListener('pointerup', () => { dragging = false; });
      const handle = ba.querySelector('.ba__handle');
      if (handle) {
        handle.tabIndex = 0;
        handle.addEventListener('keydown', (e) => {
          const cur = parseFloat(getComputedStyle(compare).getPropertyValue('--ba-pos')) || 50;
          if (e.key === 'ArrowLeft') compare.style.setProperty('--ba-pos', Math.max(0, cur - 4) + '%');
          if (e.key === 'ArrowRight') compare.style.setProperty('--ba-pos', Math.min(100, cur + 4) + '%');
        });
      }
    });
  }

  /* ---------- Announcement bar rotation (interval bound once per bar) ---------- */
  function initAnnouncement() {
    $$('[data-announcement]').forEach((bar) => {
      if (bar.dataset.bound) return;
      bar.dataset.bound = '1';
      const slides = $$('.announcement__slide', bar);
      if (slides.length < 2) { slides[0]?.classList.add('is-active'); return; }
      const interval = (parseInt(bar.dataset.announcement, 10) || 5) * 1000;
      let i = 0;
      slides.forEach((s) => s.classList.remove('is-active'));
      slides[0].classList.add('is-active');
      if (reduced) return;
      setInterval(() => {
        slides[i].classList.remove('is-active');
        slides[i].classList.add('is-prev');
        setTimeout(() => slides[i].classList.remove('is-prev'), 500);
        i = (i + 1) % slides.length;
        slides[i].classList.add('is-active');
      }, interval);
    });
  }

  function boot() {
    initReveal();
    initFloat();
    initTilt();
    initParallax();
    initCountUp();
    initBeforeAfter();
    initAnnouncement();
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('shopify:section:load', boot);
})();
