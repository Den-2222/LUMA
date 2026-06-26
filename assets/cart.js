/* ==========================================================================
   LUMA — AJAX cart (drawer, add/update/remove, free-shipping bar, toast)
   ========================================================================== */
(function () {
  'use strict';
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const L = window.LUMA || {};
  const routes = L.routes || {};
  const drawer = $('[data-cart-drawer]');

  function fmt(c) { return (L.formatMoney ? L.formatMoney(c) : '$' + (c / 100).toFixed(2)); }

  /* ---------- Drawer open/close ---------- */
  function openDrawer() {
    if (!drawer || drawer.classList.contains('is-open')) return;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    L.overlay && L.overlay.show();
  }
  function closeDrawer() {
    if (!drawer || !drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    L.overlay && L.overlay.hide();
  }
  window.LUMA.cart = { open: openDrawer, close: closeDrawer };

  $$('[data-cart-open]').forEach((b) => b.addEventListener('click', (e) => {
    if (L.cartType === 'drawer') { e.preventDefault(); refresh().then(openDrawer); }
  }));
  $$('[data-cart-close]').forEach((b) => b.addEventListener('click', closeDrawer));
  $('[data-overlay]')?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  /* ---------- Toast ---------- */
  let toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add('is-visible'));
    clearTimeout(toastEl.__t);
    toastEl.__t = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
  }

  /* ---------- Add to cart (forms + quick add) ---------- */
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-product-form], [data-quick-add-form], [data-sticky-form]');
    if (!form) return;
    e.preventDefault();
    const btn = form.querySelector('[type="submit"], [data-atc]');
    const formData = new FormData(form);
    if (btn) { btn.classList.add('is-loading'); btn.dataset.label = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>'; }
    fetch(routes.cart_add_url + '.js', {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: formData
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.status) { toast(data.description || data.message); return; }
        if (L.cartType === 'drawer') openDrawer();      // open instantly for a snappy feel
        return refresh().then(() => {
          if (L.cartType !== 'drawer') toast(L.strings ? L.strings.added : 'Added');
        });
      })
      .catch(() => toast('Something went wrong'))
      .finally(() => { if (btn) { btn.classList.remove('is-loading'); btn.innerHTML = btn.dataset.label || 'Add to cart'; } });
  });

  /* ---------- Change line quantity / remove (delegated) ---------- */
  document.addEventListener('click', (e) => {
    const rem = e.target.closest('[data-line-remove]');
    if (rem) { e.preventDefault(); updateLine(rem.dataset.lineRemove, 0); }
  });
  document.addEventListener('change', (e) => {
    const input = e.target.closest('[data-line-qty]');
    if (input) queueLine(input.dataset.lineQty, parseInt(input.value, 10));
  });

  // Debounce rapid +/- clicks into a single request, with instant count feedback
  const lineTimers = {};
  function optimisticCount() {
    let n = 0;
    $$('[data-line-qty]').forEach((i) => { n += Math.max(0, parseInt(i.value, 10) || 0); });
    $$('[data-cart-count]').forEach((el) => { el.textContent = n; el.classList.toggle('is-visible', n > 0); });
  }
  function queueLine(line, qty) {
    optimisticCount();
    clearTimeout(lineTimers[line]);
    lineTimers[line] = setTimeout(() => updateLine(line, qty), 320);
  }

  function updateLine(line, qty) {
    fetch(routes.cart_change_url + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ line: parseInt(line, 10), quantity: qty })
    })
      .then((r) => r.json())
      .then((cart) => render(cart));
  }

  /* ---------- Refresh cart UI ---------- */
  function refresh() {
    return fetch(routes.cart_url + '.js', { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((cart) => { render(cart); return cart; });
  }
  window.LUMA.cart.refresh = refresh;

  function render(cart) {
    // bubble counts
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = cart.item_count;
      el.classList.toggle('is-visible', cart.item_count > 0);
      el.classList.remove('bump'); void el.offsetWidth; if (cart.item_count > 0) el.classList.add('bump');
    });
    // totals
    $$('[data-cart-total]').forEach((el) => { el.textContent = fmt(cart.total_price); });
    // free shipping bar
    renderFreeShip(cart);
    // line items
    const list = $('[data-cart-items]');
    if (list) {
      if (cart.item_count === 0) {
        list.innerHTML = '<div class="cart-empty"><p>Your bag is empty.</p><a class="btn" href="/collections/all">Continue shopping</a></div>';
        $('[data-cart-foot]')?.setAttribute('hidden', '');
      } else {
        $('[data-cart-foot]')?.removeAttribute('hidden');
        list.innerHTML = cart.items.map(lineItemHTML).join('');
      }
    }
    renderRecs(cart);
  }

  /* ---------- "You may also like" recommendations ---------- */
  let recsLoadedFor = null;
  function renderRecs(cart) {
    const wrap = $('[data-cart-recs]');
    if (!wrap) return;
    if (cart.item_count === 0) { wrap.hidden = true; recsLoadedFor = null; return; }
    const anchor = cart.items[0].product_id;
    if (recsLoadedFor === anchor) return;
    const base = routes.product_recommendations_url;
    if (!base) { wrap.hidden = true; return; }
    fetch(base + '.json?product_id=' + anchor + '&limit=6&intent=related', { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((data) => {
        const inCart = new Set(cart.items.map((i) => i.product_id));
        const recs = (data.products || []).filter((p) => !inCart.has(p.id)).slice(0, 3);
        const listEl = $('[data-cart-recs-list]', wrap);
        if (!recs.length || !listEl) { wrap.hidden = true; return; }
        recsLoadedFor = anchor;
        listEl.innerHTML = recs.map(recHTML).join('');
        wrap.hidden = false;
      })
      .catch(() => { wrap.hidden = true; });
  }
  function recHTML(p) {
    const v = (p.variants || []).find((x) => x.available) || (p.variants || [])[0] || {};
    const img = p.featured_image ? `<img src="${sizedImage(p.featured_image, 100)}" alt="${esc(p.title)}" loading="lazy">` : '';
    const price = fmt(v.price != null ? v.price : p.price);
    return `<div class="cart-rec">
      <a href="${p.url}" class="cart-rec__img">${img}</a>
      <div class="cart-rec__info"><a href="${p.url}" class="cart-rec__name">${esc(p.title)}</a><span class="price">${price}</span></div>
      <button type="button" class="cart-rec__add" data-rec-add="${v.id || ''}" aria-label="Add ${esc(p.title)}">+</button>
    </div>`;
  }

  // Add a recommended product (delegated, bound once)
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-rec-add]');
    if (!add || !add.dataset.recAdd) return;
    add.disabled = true;
    recsLoadedFor = null; // force recs to refresh after adding
    fetch(routes.cart_add_url + '.js', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: add.dataset.recAdd, quantity: 1 })
    })
      .then((r) => r.json())
      .then(() => refresh())
      .finally(() => { add.disabled = false; });
  });

  function lineItemHTML(item, i) {
    const line = i + 1;
    const img = item.image ? `<img class="line-item__img" src="${sizedImage(item.image, 120)}" alt="${esc(item.title)}" loading="lazy">` : '';
    const variant = item.variant_title && item.variant_title !== 'Default Title' ? `<span class="line-item__variant">${esc(item.variant_title)}</span>` : '';
    const compare = item.original_line_price > item.final_line_price
      ? `<s class="price__compare">${fmt(item.original_line_price)}</s>` : '';
    return `
      <div class="line-item" data-line="${line}">
        <a href="${item.url}">${img}</a>
        <div class="line-item__info">
          <a href="${item.url}" class="line-item__title">${esc(item.product_title)}</a>
          ${variant}
          <div class="qty-stepper">
            <button type="button" data-qty="minus" aria-label="Decrease">&minus;</button>
            <input type="number" min="0" value="${item.quantity}" data-line-qty="${line}" aria-label="Quantity">
            <button type="button" data-qty="plus" aria-label="Increase">+</button>
          </div>
          <div class="line-item__bottom">
            <span class="price">${compare} ${fmt(item.final_line_price)}</span>
            <button type="button" class="line-item__remove" data-line-remove="${line}">Remove</button>
          </div>
        </div>
      </div>`;
  }

  function renderFreeShip(cart) {
    const wrap = $('[data-free-ship]');
    if (!wrap || !L.freeShip || !L.freeShip.enabled) return;
    const threshold = L.freeShip.threshold;
    if (threshold <= 0) { wrap.hidden = true; return; }
    wrap.hidden = false;
    const remaining = threshold - cart.total_price;
    const pct = Math.min(100, (cart.total_price / threshold) * 100);
    $('[data-free-ship-fill]', wrap).style.width = pct + '%';
    const msg = $('[data-free-ship-msg]', wrap);
    if (remaining <= 0) msg.innerHTML = '🎉 You\'ve unlocked <strong>free shipping</strong>!';
    else msg.innerHTML = `You're <strong>${fmt(remaining)}</strong> away from free shipping`;
  }

  function esc(s) { return (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // Insert Shopify size param (_120x) before extension, preserving query string
  function sizedImage(url, size) {
    try {
      const u = new URL(url, location.origin);
      u.pathname = u.pathname.replace(/(\.(?:jpg|jpeg|png|gif|webp|avif))$/i, `_${size}x$1`);
      return u.toString();
    } catch (e) { return url; }
  }

  // initial paint (counts already server-rendered; sync free-ship)
  document.addEventListener('DOMContentLoaded', () => { if ($('[data-free-ship]')) refresh(); });
})();
