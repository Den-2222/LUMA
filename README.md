# LUMA — Premium Skincare Shopify Theme

A complete, premium, **fully-editable** Shopify theme for the skincare brand **LUMA**.
UX, interactions and architecture are modeled on Rhode; the content/conversion
structure is modeled on a high-converting skincare PDP. All branding, copy, imagery
and products are original placeholders — replace everything from the Theme Editor,
no code required.

> See [`docs/ANALYSIS.md`](docs/ANALYSIS.md) for the full reference analysis,
> site map, animation map and section map (build steps 1–6).

## Highlights

- **Design system driven by settings** — colors, pastel-pink gradients, typography,
  radius, shadows, spacing and animation toggles all live in *Theme settings*
  (`config/settings_schema.json` → `snippets/css-variables.liquid` → `assets/base.css`).
- **Content-agnostic animation engine** (`assets/animations.js`) — reveal-on-scroll,
  3D tilt, parallax, float, count-up stats, draggable before/after, rotating
  announcement bar, marquee. Respects `prefers-reduced-motion` and keeps working
  after you swap content.
- **AJAX cart** (`assets/cart.js`) — slide-out drawer, free-shipping progress bar,
  quantity steppers, quick-add, toast notifications.
- **Premium header** — sticky, hides on scroll-down / reveals on scroll-up, shrinks,
  blur background; mobile nav drawer.
- **Sticky add-to-cart** bar on product pages (and optional featured product elsewhere).

## Editable sections (Theme Editor)

Homepage & reusable: Hero · Trust badges (marquee) · Product benefits · Before/After ·
Clinical results (count-up) · UGC video · Reviews · Bundle offer · FAQ ·
Image with text · Rich text · Sticky add-to-cart · Header · Footer · Announcement bar.

Product page: Product information (gallery + buy box + accordions + variants) ·
Benefits · Ingredients · Before/After · Reviews · FAQ · Related products · Sticky ATC.

Every block — photos, videos, before/after images, review photos & videos, prices,
compare-at prices, discounts, bundles, titles, subtitles, buttons, icons, colors,
backgrounds, FAQ content, testimonials, announcement messages and menus — is editable.
**Nothing is hardcoded**; missing media falls back to Shopify placeholders.

## Structure

```
assets/      base.css · theme.js · animations.js · cart.js
config/      settings_schema.json · settings_data.json
layout/      theme.liquid · password.liquid
locales/     en.default.json
sections/    all sections + header-group.json / footer-group.json
snippets/    icon · price · star-rating · product-card · cart-drawer · css-variables
templates/   index · product · collection · cart · page · page.faq · search · 404 ·
             list-collections · blog · article · password · customers/*
docs/        ANALYSIS.md
```

## Install

1. Zip the repository contents (the folders above must be at the zip root).
2. Shopify admin → **Online Store → Themes → Add theme → Upload zip**.
   (Or use the [Shopify CLI](https://shopify.dev/themes/tools/cli): `shopify theme push`.)
3. **Customize** to add your products, media, prices, reviews and bundles.

### Recommended setup

- Create products: 3 products + 1 bundle/kit product; assign them to the
  *Bundle offer* and *Sticky add-to-cart* sections.
- Build a `main-menu` and `footer` navigation in **Navigation**.
- Set free-shipping threshold and cart type under *Theme settings → Cart*.

## Customizing animations

Master toggles live in *Theme settings → Animations* (enable, speed, tilt, parallax,
float, page fade). Per-section toggles exist where relevant (hero, product, etc.).
The engine targets attributes (`data-reveal`, `data-tilt`, `data-parallax`,
`data-float`, `data-countup`, `data-ba`), so animations continue to work no matter
what content you place inside.
