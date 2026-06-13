# LUMA Theme — Reference Analysis & Build Maps

A premium, fully-editable Shopify skincare theme. UX/interaction foundation
modeled on **Rhode (rhodeskin.com)**; content/conversion structure modeled on
**Quia Beauty (collagen night wrapping mask PDP)**. All branding, copy, images,
products and prices are original placeholders, replaceable via the Theme Editor.

---

## STEP 1 — Website A Analysis (Rhode) — UX & Interaction foundation

| Area | Observed pattern | Recreated as |
|---|---|---|
| Site architecture | Flat, product-led. Home → PDP → Cart drawer. Minimal nav. | Modular JSON-template sections + cart drawer |
| Navigation | Slim sticky header, hides on scroll-down, reveals on scroll-up. Hamburger drawer on mobile. | `header.liquid` with scroll-direction logic |
| Announcement | Rotating announcement bar, auto-advancing. | `announcement-bar.liquid` (rotating blocks) |
| Hero | Full-bleed media, oversized type, soft entrance. | `hero.liquid` |
| Section hierarchy | Generous whitespace, alternating media/text, large rounded imagery. | Spacing scale + section padding controls |
| Animations | Reveal-on-scroll fades/slides, image zoom on hover, soft floating product shots, parallax. | `animations.js` IntersectionObserver engine |
| Hover/image | Product card image cross-fade to secondary image; CTA underline/arrow slide. | `product-card.liquid` |
| 3D tilt | Subtle pointer-driven tilt on featured media. | `data-tilt` in `animations.js` |
| Sticky | Sticky header, sticky PDP buy box, sticky add-to-cart bar on scroll. | `sticky-add-to-cart.liquid`, sticky media column |
| Product page | Sticky gallery, accordions, inline benefits. | `main-product.liquid` |
| Cart | Slide-in drawer, free-shipping progress bar, quantity steppers, AJAX. | `cart-drawer.liquid` + `cart.js` |
| Bundle | Build-your-set / save-more kit cards. | `bundle-offer.liquid` |
| Loading | Page fade-in, lazy media with blur-up. | `theme.js` + CSS |
| Scrolling | Smooth scroll, parallax, progressive reveal. | CSS + JS |

## STEP 2 — Website B Analysis (Quia) — Content & Conversion structure

| Block | Pattern | Recreated as |
|---|---|---|
| Product presentation | Gallery + sticky offer, value props under CTA. | `main-product.liquid` |
| Benefit sections | Icon + headline + body grid; "why it works". | `product-benefits.liquid` |
| Before/After | Draggable comparison slider. | `before-after.liquid` |
| Clinical results | Big-number stat cards ("% of users agreed"). | `clinical-results.liquid` |
| UGC | Auto/loop short videos in a scroll row. | `ugc-video.liquid` |
| Reviews | Star summary + cards w/ photos & verified badges. | `reviews.liquid` |
| Offer/Bundle | Tiered pricing, "most popular", savings %, compare-at. | `bundle-offer.liquid` |
| Trust | Guarantee/badge strip, cruelty-free icons. | `trust-badges.liquid` |
| FAQ | Accordion. | `faq.liquid` |

## STEP 3 — Site Map

```
Home (templates/index.json)
 ├─ Announcement bar (rotating)
 ├─ Header (sticky, scroll-aware) + Cart drawer
 ├─ Hero
 ├─ Trust badges (marquee)
 ├─ Product benefits
 ├─ Before / After
 ├─ Clinical results / statistics
 ├─ UGC video row
 ├─ Reviews
 ├─ Bundle offer
 ├─ FAQ
 ├─ Footer
 └─ Sticky add-to-cart bar (featured product)

Product (templates/product.json)
 ├─ Main product (sticky gallery + buy box + accordions)
 ├─ Benefits · Ingredients · Before/After · Clinical · Reviews · FAQ
 ├─ Related products
 └─ Sticky add-to-cart bar

Collection · Cart · Page · Search · 404 · Password · Customer templates
```

## STEP 4 — Animation Map

All animations are driven by `assets/animations.js` + `assets/base.css`.
They are content-agnostic (target attributes/classes, never specific content),
respect `prefers-reduced-motion`, and keep working after content swaps.

| Name | Trigger | Duration | Easing | Desktop | Mobile |
|---|---|---|---|---|---|
| `reveal` (fade/slide/zoom) | IntersectionObserver enters viewport | 700ms | cubic-bezier(.22,1,.36,1) | translate+fade in, stagger via `--reveal-delay` | same, smaller travel |
| Image hover zoom | hover on `.media-zoom` | 600ms | ease-out | scale 1.06 | disabled (no hover) |
| Product card swap | hover on `.card--product` | 450ms | ease | secondary image cross-fades in | tap shows secondary briefly |
| 3D tilt | pointermove on `[data-tilt]` | 150ms follow | linear follow | rotateX/Y ±6° + glare | disabled |
| Float | always (CSS keyframe) | 6s loop | ease-in-out | gentle Y bob | reduced amplitude |
| Parallax | scroll on `[data-parallax]` | rAF | linear | translateY by speed | reduced factor |
| Sticky header | scroll direction | 350ms | ease | hide down / show up + shrink | same |
| Sticky ATC bar | featured CTA leaves viewport | 400ms | cubic-bezier(.22,1,.36,1) | slide up from bottom | always-on bottom bar |
| Cart drawer | open/close | 450ms | cubic-bezier(.22,1,.36,1) | slide from right + overlay fade | full-width slide |
| Marquee | always | linear loop | linear | continuous scroll | continuous |
| Count-up stats | reveal | 1600ms | ease-out | number animates 0→value | same |
| Accordion | click | 350ms | ease | grid-rows height transition | same |
| Page load | DOMContentLoaded | 500ms | ease | body fade-in, blur-up media | same |
| Before/After | drag/touch | live | — | pointer drag handle | touch drag |

## STEP 5 — Section Map

Reusable sections (usable on any JSON template, all blocks editable):
announcement-bar, header, hero, trust-badges, product-benefits, before-after,
clinical-results, ugc-video, reviews, bundle-offer, faq, ingredients,
related-products, rich-text, image-with-text, main-product, cart-drawer (snippet),
sticky-add-to-cart, footer, main-cart, main-collection, main-page, main-search,
main-404, main-list-collections.

## STEP 6 — Build

See theme files. Design system: `snippets/css-variables.liquid` (driven by
`config/settings_schema.json`) + `assets/base.css`. Engine: `assets/theme.js`,
`assets/animations.js`, `assets/cart.js`.
