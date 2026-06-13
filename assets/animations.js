/* ==========================================================================
   LUMA — animation engine
   Reveal-on-scroll · 3D tilt · parallax · count-up · before/after · announcement
   All effects are content-agnostic and respect prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cfg = (window.LUMA && window.LUMA.settings) || {};
  const canHover = window.matchMedia('(hover: hover)').matches;
  const enabled = cfg.animations !== false && !reduced;

  /* ---------- Reveal on scroll (with stagger) ---------- */
  function initReveal() {
    const items = $$('[data-reveal]');
    if (!enabled) { items.forEach((el) => el.classList.add('is-revealed')); return; }
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        // auto-stagger siblings sharing a [data-reveal-group]
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
    items.forEach((el) => io.observe(el));
  }

  /* ---------- Float ---------- */
  function initFloat() {
    if (!enabled || cfg.float === false) return;
    $$('[data-float]').forEach((el, i) => {
      el.classList.add('is-float');
      el.style.animationDelay = (i * 0.4) + 's';
      if (el.dataset.float) el.style.setProperty('animation-duration', el.dataset.float + 's');
    });
  }

  /* ---------- 3D tilt ---------- */
  function initTilt() {
    if (!enabled || cfg.tilt === false || !canHover) return;
    $$('[data-tilt]').forEach((el) => {
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
      el.addEventListener('pointerleave', () => {
        el.classList.remove('is-tilting');
        el.style.transform = '';
      });
    });
  }

  /* ---------- Parallax ---------- */
  function initParallax() {
    if (!enabled || cfg.parallax === false) return;
    const items = $$('[data-parallax]');
    if (!items.length) return;
    let ticking = false;
    function update() {
      const vh = window.innerHeight;
      items.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax) || 0.2;
        const r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const progress = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.transform = `translate3d(0, ${(-progress * speed * 100).toFixed(2)}px, 0)`;
      });
      ticking = false;
    }
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------- Count-up statistics ---------- */
  function initCountUp() {
    const nums = $$('[data-countup]');
    if (!nums.length) return;
    if (!enabled) { nums.forEach((el) => { el.textContent = el.dataset.countup; }); return; }
    const io = new IntersectionObserver((entries, obs) => {
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
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = el.dataset.countup;
        }
        requestAnimationFrame(step);
        obs.unobserve(el);
      });
    }, { threshold: 0.5 });
    nums.forEach((el) => io.observe(el));
  }

  /* ---------- Before / After slider ---------- */
  function initBeforeAfter() {
    $$('[data-ba]').forEach((ba) => {
      const compare = ba.querySelector('.ba__compare');
      if (!compare) return;
      let dragging = false;
      function setPos(clientX) {
        const r = compare.getBoundingClientRect();
        let pos = ((clientX - r.left) / r.width) * 100;
        pos = Math.max(0, Math.min(100, pos));
        compare.style.setProperty('--ba-pos', pos + '%');
      }
      function start(e) { dragging = true; setPos(getX(e)); }
      function move(e) { if (dragging) { setPos(getX(e)); e.preventDefault(); } }
      function end() { dragging = false; }
      function getX(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
      compare.addEventListener('pointerdown', start);
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', end);
      // keyboard a11y
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

  /* ---------- Announcement bar rotation ---------- */
  function initAnnouncement() {
    $$('[data-announcement]').forEach((bar) => {
      const slides = $$('.announcement__slide', bar);
      if (slides.length < 2) { slides[0]?.classList.add('is-active'); return; }
      const interval = (parseInt(bar.dataset.announcement, 10) || 5) * 1000;
      let i = 0;
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
