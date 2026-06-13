/* ==========================================================================
   LUMA — core theme behaviors (header, drawers, accordions, sticky, gallery)
   Delegated (document/window) listeners are bound ONCE at init; element
   binders are guarded with dataset markers so re-running boot() (e.g. in the
   Theme Editor or after async section loads) never double-binds handlers.
   ========================================================================== */
(function () {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Page load fade ---------- */
  window.addEventListener('load', () => document.body.classList.add('is-loaded'));
  setTimeout(() => document.body.classList.add('is-loaded'), 1200);

  /* ---------- Blur-up lazy images ---------- */
  function initLazy() {
    $$('img.lazy-img').forEach((img) => {
      if (img.dataset.lazyBound) return;
      img.dataset.lazyBound = '1';
      if (img.complete && img.naturalWidth) { img.classList.add('is-loaded'); return; }
      img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
    });
  }

  /* ---------- Overlay helpers (shared by drawers) ---------- */
  const overlay = $('[data-overlay]');
  let openLayers = 0;
  function showOverlay() {
    openLayers++;
    if (overlay) { overlay.hidden = false; requestAnimationFrame(() => overlay.classList.add('is-active')); }
    document.body.classList.add('no-scroll');
  }
  function hideOverlay(force) {
    openLayers = force ? 0 : Math.max(0, openLayers - 1);
    if (openLayers === 0) {
      if (overlay) { overlay.classList.remove('is-active'); setTimeout(() => { overlay.hidden = true; }, 400); }
      document.body.classList.remove('no-scroll');
    }
  }
  window.LUMA = window.LUMA || {};
  window.LUMA.overlay = { show: showOverlay, hide: hideOverlay };

  /* ---------- Header: scroll direction + shrink (bound once) ---------- */
  let headerBound = false;
  function initHeader() {
    const group = $('.header-group');
    if (!group || headerBound) return;
    headerBound = true;
    let last = 0, ticking = false;
    const threshold = 80;
    function update() {
      const y = window.scrollY;
      group.querySelector('.header')?.classList.toggle('is-scrolled', y > 10);
      if (y > last && y > threshold && !document.body.classList.contains('no-scroll')) {
        group.classList.add('is-hidden');
      } else {
        group.classList.remove('is-hidden');
      }
      last = y;
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  /* ---------- Mobile nav drawer ---------- */
  function initMobileNav() {
    const nav = $('[data-mobile-nav]');
    if (!nav || nav.dataset.bound) return;
    nav.dataset.bound = '1';
    function openNav() { if (nav.classList.contains('is-open')) return; nav.classList.add('is-open'); showOverlay(); }
    function closeNav() { if (!nav.classList.contains('is-open')) return; nav.classList.remove('is-open'); hideOverlay(); }
    $$('[data-mobile-nav-open]').forEach((b) => b.addEventListener('click', openNav));
    $$('[data-mobile-nav-close]').forEach((b) => b.addEventListener('click', closeNav));
    overlay?.addEventListener('click', closeNav);
    nav.__close = closeNav;
  }

  /* ---------- Accordions (FAQ + product) ---------- */
  function initAccordions() {
    $$('[data-accordion]').forEach((acc) => {
      if (acc.dataset.bound) return;
      acc.dataset.bound = '1';
      const single = acc.hasAttribute('data-accordion-single');
      $$('.accordion__trigger', acc).forEach((trigger) => {
        trigger.addEventListener('click', () => {
          const item = trigger.closest('.accordion__item');
          const isOpen = item.classList.contains('is-open');
          if (single) $$('.accordion__item', acc).forEach((i) => { i.classList.remove('is-open'); $('.accordion__trigger', i)?.setAttribute('aria-expanded', 'false'); });
          item.classList.toggle('is-open', !isOpen);
          trigger.setAttribute('aria-expanded', String(!isOpen));
        });
      });
    });
  }

  /* ---------- Marquee: duplicate track for seamless loop ---------- */
  function initMarquee() {
    $$('.marquee').forEach((m) => {
      const track = $('.marquee__track', m);
      if (!track || track.dataset.cloned) return;
      const clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      m.appendChild(clone);
      track.dataset.cloned = '1';
    });
  }

  /* ---------- Featured products carousel ---------- */
  function initCarousel() {
    $$('[data-carousel]').forEach((c) => {
      if (c.dataset.bound) return;
      c.dataset.bound = '1';
      const track = $('[data-carousel-track]', c);
      if (!track) return;
      const amount = () => Math.max(track.clientWidth * 0.8, 280);
      $('[data-carousel-next]', c)?.addEventListener('click', () => track.scrollBy({ left: amount(), behavior: 'smooth' }));
      $('[data-carousel-prev]', c)?.addEventListener('click', () => track.scrollBy({ left: -amount(), behavior: 'smooth' }));
    });
  }

  /* ---------- Product gallery (thumbs + main swap) ---------- */
  function initGallery() {
    $$('[data-gallery]').forEach((gallery) => {
      if (gallery.dataset.bound) return;
      gallery.dataset.bound = '1';
      const main = $('[data-gallery-main]', gallery);
      const thumbs = $$('[data-gallery-thumb]', gallery);
      thumbs.forEach((thumb) => {
        thumb.addEventListener('click', () => {
          thumbs.forEach((t) => t.classList.remove('is-active'));
          thumb.classList.add('is-active');
          const mediaHTML = thumb.dataset.media;
          if (main && mediaHTML) { main.innerHTML = decodeURIComponent(mediaHTML); initLazy(); }
        });
      });
    });
  }

  /* ---------- Variant selection (pills/selects → update price/url/atc) ---------- */
  function initVariants() {
    $$('[data-product-form]').forEach((form) => {
      if (form.dataset.bound) return;
      const root = form.closest('[data-product-root]') || document;
      const dataEl = $('[data-variant-json]', root);
      if (!dataEl) return;
      let variants;
      try { variants = JSON.parse(dataEl.textContent); } catch (e) { return; }
      form.dataset.bound = '1';
      const selects = $$('[data-option-index]', root);
      const idInput = $('[name="id"]', form);

      function current() {
        const chosen = selects.map((s) => s.dataset.value);
        return variants.find((v) => v.options.every((opt, i) => opt === chosen[i]));
      }
      function render() {
        const v = current();
        if (!v) return;
        if (idInput) idInput.value = v.id;
        root.querySelectorAll('[data-price]').forEach((el) => { el.innerHTML = renderPrice(v); });
        const atc = $('[data-atc]', form);
        if (atc) {
          atc.disabled = !v.available;
          const label = $('[data-atc-label]', atc) || atc;
          label.textContent = v.available ? (window.LUMA.strings.addToCart) : (window.LUMA.strings.soldOut);
        }
        document.querySelectorAll('[data-sticky-id]').forEach((el) => { el.value = v.id; });
        document.querySelectorAll('[data-sticky-price]').forEach((el) => { el.innerHTML = renderPrice(v); });
        if (v.featured_image) {
          root.querySelectorAll('[data-variant-image]').forEach((img) => { img.src = v.featured_image.src; });
        }
      }
      selects.forEach((control) => {
        $$('[data-value]', control).forEach((pill) => {
          pill.addEventListener('click', () => {
            $$('[data-value]', control).forEach((p) => p.classList.remove('is-active'));
            pill.classList.add('is-active');
            control.dataset.value = pill.dataset.value;
            render();
          });
        });
        if (control.tagName === 'SELECT') {
          control.addEventListener('change', () => { control.dataset.value = control.value; render(); });
        }
      });
      render();
    });
  }

  function renderPrice(v) {
    const fmt = (cents) => formatMoney(cents);
    if (v.compare_at_price && v.compare_at_price > v.price) {
      const save = Math.round((1 - v.price / v.compare_at_price) * 100);
      return `<span class="price__sale">${fmt(v.price)}</span> <s class="price__compare">${fmt(v.compare_at_price)}</s> <span class="price__save">Save ${save}%</span>`;
    }
    return `<span>${fmt(v.price)}</span>`;
  }

  function formatMoney(cents) {
    const value = (cents / 100).toFixed(2);
    const fmt = window.LUMA.moneyFormat || '${{amount}}';
    return fmt.replace(/\{\{\s*amount\s*\}\}/, value)
              .replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(cents / 100));
  }
  window.LUMA.formatMoney = formatMoney;

  /* ---------- Quantity steppers (delegated, bound ONCE) ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-qty]');
    if (!btn) return;
    const input = $('input', btn.closest('.qty-stepper'));
    if (!input) return;
    const dir = btn.dataset.qty === 'plus' ? 1 : -1;
    const min = parseInt(input.min || '1', 10);
    input.value = Math.max(min, (parseInt(input.value, 10) || min) + dir);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /* ---------- Smooth scroll-to-content (hero button / chevron, bound ONCE) ---------- */
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-scroll-next]');
    if (!trigger) return;
    e.preventDefault();
    let target = null;
    const href = trigger.getAttribute('href');
    if (href && href.length > 1 && href.startsWith('#')) target = document.getElementById(href.slice(1));
    if (!target) {
      const sec = trigger.closest('.shopify-section');
      target = sec ? sec.nextElementSibling : null;
    }
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  });

  /* ---------- Sticky add-to-cart bar ---------- */
  function initStickyATC() {
    const bar = $('[data-sticky-atc]');
    if (!bar || bar.dataset.bound) return;
    bar.dataset.bound = '1';
    const sentinel = $('[data-atc-sentinel]');
    if (sentinel) {
      const io = new IntersectionObserver(([entry]) => {
        const past = entry.boundingClientRect.top < 0;
        bar.classList.toggle('is-visible', !entry.isIntersecting && past);
      }, { threshold: 0 });
      io.observe(sentinel);
    } else {
      let ticking = false;
      const onScroll = () => { bar.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.9); ticking = false; };
      window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
    }
  }

  /* ---------- UGC video: play on tap, autoplay-in-view ---------- */
  function initUGC() {
    const items = $$('[data-ugc-item]').filter((i) => !i.dataset.bound);
    items.forEach((item) => {
      item.dataset.bound = '1';
      const video = $('video', item);
      const play = $('[data-ugc-play]', item);
      if (!video) return;
      play?.addEventListener('click', () => {
        if (video.paused) { video.play(); play.style.opacity = 0; } else { video.pause(); play.style.opacity = 1; }
      });
    });
    if (reduced || !items.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = $('video[data-autoplay]', e.target);
        if (!v) return;
        if (e.isIntersecting) { v.play().catch(() => {}); } else { v.pause(); }
      });
    }, { threshold: 0.6 });
    items.forEach((i) => io.observe(i));
  }

  /* ---------- Boot (element binders only; all guarded) ---------- */
  function boot() {
    initLazy();
    initHeader();
    initMobileNav();
    initAccordions();
    initMarquee();
    initCarousel();
    initGallery();
    initVariants();
    initStickyATC();
    initUGC();
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  // Re-init when Theme Editor injects/changes sections (binders are idempotent)
  document.addEventListener('shopify:section:load', boot);
})();
