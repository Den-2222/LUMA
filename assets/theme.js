/* ==========================================================================
   LUMA — core theme behaviors (header, drawers, accordions, sticky, gallery)
   ========================================================================== */
(function () {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Page load fade ---------- */
  window.addEventListener('load', () => document.body.classList.add('is-loaded'));
  // safety: don't keep page invisible if load is slow
  setTimeout(() => document.body.classList.add('is-loaded'), 1200);

  /* ---------- Blur-up lazy images ---------- */
  function initLazy() {
    $$('img.lazy-img').forEach((img) => {
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

  /* ---------- Header: scroll direction + shrink ---------- */
  function initHeader() {
    const group = $('.header-group');
    if (!group) return;
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
    if (!nav) return;
    const open = $$('[data-mobile-nav-open]');
    const close = $$('[data-mobile-nav-close]', nav).concat($$('[data-mobile-nav-close]'));
    function openNav() { if (nav.classList.contains('is-open')) return; nav.classList.add('is-open'); showOverlay(); }
    function closeNav() { if (!nav.classList.contains('is-open')) return; nav.classList.remove('is-open'); hideOverlay(); }
    open.forEach((b) => b.addEventListener('click', openNav));
    close.forEach((b) => b.addEventListener('click', closeNav));
    overlay?.addEventListener('click', closeNav);
    nav.__close = closeNav;
  }

  /* ---------- Accordions (FAQ + product) ---------- */
  function initAccordions() {
    $$('[data-accordion]').forEach((acc) => {
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

  /* ---------- Product gallery (thumbs + main swap) ---------- */
  function initGallery() {
    $$('[data-gallery]').forEach((gallery) => {
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
      const dataEl = $('[data-variant-json]', form.closest('[data-product-root]') || document);
      if (!dataEl) return;
      let variants;
      try { variants = JSON.parse(dataEl.textContent); } catch (e) { return; }
      const root = form.closest('[data-product-root]') || document;
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
        // sync sticky bar
        document.querySelectorAll('[data-sticky-id]').forEach((el) => { el.value = v.id; });
        document.querySelectorAll('[data-sticky-price]').forEach((el) => { el.innerHTML = renderPrice(v); });
        if (v.featured_image) {
          root.querySelectorAll('[data-variant-image]').forEach((img) => { img.src = v.featured_image.src; });
        }
      }
      selects.forEach((control) => {
        // pills
        $$('[data-value]', control).forEach((pill) => {
          pill.addEventListener('click', () => {
            $$('[data-value]', control).forEach((p) => p.classList.remove('is-active'));
            pill.classList.add('is-active');
            control.dataset.value = pill.dataset.value;
            render();
          });
        });
        // native select
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

  /* ---------- Quantity steppers ---------- */
  function initSteppers() {
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
  }

  /* ---------- Sticky add-to-cart bar ---------- */
  function initStickyATC() {
    const bar = $('[data-sticky-atc]');
    if (!bar) return;
    const sentinel = $('[data-atc-sentinel]');
    if (sentinel) {
      // Product page: show bar once the main buy button has scrolled out (upward)
      const io = new IntersectionObserver(([entry]) => {
        const past = entry.boundingClientRect.top < 0;
        bar.classList.toggle('is-visible', !entry.isIntersecting && past);
      }, { threshold: 0 });
      io.observe(sentinel);
    } else {
      // Other pages (e.g. homepage featured product): show after one viewport
      let ticking = false;
      const onScroll = () => {
        bar.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.9);
        ticking = false;
      };
      window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
    }
  }

  /* ---------- UGC video: play on tap, autoplay-in-view ---------- */
  function initUGC() {
    $$('[data-ugc-item]').forEach((item) => {
      const video = $('video', item);
      const play = $('[data-ugc-play]', item);
      if (!video) return;
      play?.addEventListener('click', () => {
        if (video.paused) { video.play(); play.style.opacity = 0; } else { video.pause(); play.style.opacity = 1; }
      });
    });
    if (reduced) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = $('video[data-autoplay]', e.target);
        if (!v) return;
        if (e.isIntersecting) { v.play().catch(() => {}); } else { v.pause(); }
      });
    }, { threshold: 0.6 });
    $$('[data-ugc-item]').forEach((i) => io.observe(i));
  }

  /* ---------- Newsletter / generic AJAX-less forms keep native behavior ---------- */

  /* ---------- Boot ---------- */
  function boot() {
    initLazy();
    initHeader();
    initMobileNav();
    initAccordions();
    initMarquee();
    initGallery();
    initVariants();
    initSteppers();
    initStickyATC();
    initUGC();
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  // Re-init when Theme Editor injects/changes sections
  document.addEventListener('shopify:section:load', boot);
  document.addEventListener('shopify:section:select', () => {});
})();
