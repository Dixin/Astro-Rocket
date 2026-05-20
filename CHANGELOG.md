# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.4.1] — 2026-05-20

### Fixed

- **i18n: `<html lang>` and related-posts locale no longer hardcoded to `en`** — `src/layouts/BaseLayout.astro` and `src/layouts/BlogLayout.astro` now resolve the active locale from the URL via `getLocaleFromPath(Astro.url.pathname)`, so sites with i18n enabled emit the correct `lang` attribute and pull related posts from the matching content folder. Thanks @vespeng for the report (#323).

### Added

- **i18n README note** — clarified that `defaultLocale` is a routing label and that the content folder name under `src/content/blog/` must match for the root URL to serve a different default language.
- **i18n blog post update** — added a matching caveat to the 1.3.0 i18n launch post (`src/content/blog/en/i18n-in-astro-rocket.mdx`) so the `defaultLocale` vs content-folder distinction is documented in two places.
- **i18n tests** — added unit-test coverage for `getLocaleFromPath`, `stripLocaleFromPath`, and `swapLocaleInPath` to prevent regressions on locale resolution.

---

## [1.4.0] — 2026-05-19

### Added

- **Services page** — new top-level `/services` route (`src/pages/services.astro`) with three anchored sections (`#design`, `#development`, `#performance`), brand-coloured hero badges, bullet lists, and scroll-reveal animations. Added to both the header `navItems` and `footerNavItems` in `src/config/nav.config.ts` (now ordered Services → Projects → Blog → About → Contact). The mobile dropdown uses the `sparkles` icon. Homepage service cards link to the matching anchors on the Services page.
- **Project gallery + carousel** — `ProjectCarousel.astro` swipeable image carousel that replaces the single `image` in `ProjectHero` when a `gallery: [{ src, alt }]` array is present in project frontmatter. Schema added in `src/content.config.ts`.
- **Project `meta` tagline** — optional `meta: string[]` array in project frontmatter renders as a single line under the hero description with brand-coloured dot separators.
- **Project `placeholder` flag** — `placeholder: true` in frontmatter renders a branded SVG placeholder in the project hero instead of an image, for image-less starter project cards.
- **Per-project TOC override** — `toc: false` in project frontmatter, mirroring the existing blog post override.
- **Blog FAQ schema** — optional `faqs: [{ question, answer }]` array in blog frontmatter emits an additional FAQ JSON-LD block alongside the existing `BlogPosting` schema.
- **Blog pagination, tag archives, and dynamic OG images** — new routes `blog/page/[page].astro` and `blog/tag/[tag].astro`, plus dynamic OG image endpoints `og/blog/[slug].svg.ts`, `og/blog/tag/[tag].svg.ts`, and `og/projects/[slug].svg.ts`. New `Pagination.astro`, `TagList.astro`, and `ShareButtons.astro` components, with shared helpers in `src/lib/blog.ts` and `src/lib/og.ts`.
- **`Callout.astro` pattern** — new pattern component for pull-quotes and inline callouts; the existing pull-quote icon now lives inside the Callout card.
- **Global arrow-slide hover pattern** — `arrow-right` / `arrow-left` icons now slide on hover everywhere via a standardised CSS pattern in `src/styles/global.css`.
- **New project + blog content** — `src/content/projects/hans-martens.mdx`, expanded `astro-rocket.mdx` with a multi-image gallery, and a new post `src/content/blog/en/i18n-in-astro-rocket.mdx`.

### Changed

- **Header rework** (`src/components/layout/Header.astro`) — desktop breakpoint raised from `md` to `lg` to prevent tablet squeeze; theme-mode (light/dark) toggle promoted from the mobile menu to the header itself at every breakpoint; brand-coloured chrome neutralised in light mode so the header reads as neutral while keeping brand accents on hover/active states.
- **Project hero redesign** (`ProjectHero.astro`, `ProjectLayout.astro`) — synced from the live `hansmartens.dev` site: cleaner meta line, brand placeholder fallback, back-nav button, optional FAQ schema, and dropped brand glow.
- **Project cards aligned with homepage selected-work layout** — image-less grid restored as the default, `arrow-up-right` icon now shows on every card (not just hover-active), and related-project cards on `projects/[slug]` are equalised in height with three cards instead of two.
- **Blog index + post pages synced from `hansmartens.dev`** — refreshed `ArticleHero`, `BlogCard`, `BlogImageSVG`, `TableOfContents`, and the new "Follow along" section now matches between the blog index and individual posts.
- **Layout max-width** — single project pages, blog post pages, and the projects index now share the same `max-w-7xl` section width as the rest of the site.
- **Contact copy** — homepage CTA + contact hero clarified to scope work to new builds only; contact form heading "Send a message" → "Project details".
- **Homepage projects section** — replaced placeholder projects with Astro Rocket + Hans Martens Dev; redesigned section to mirror the projects-index layout 1:1.
- **`global.css` + all 12 theme tokens** (`amber`, `blue`, `cyan`, `emerald`, `green`, `indigo`, `lime`, `magenta`, `orange`, `purple`, `sky`, `teal`, `violet`) received small token tweaks for header neutrality and the new arrow-slide pattern.
- **404 page rewritten** with the same hero pattern as the rest of the marketing pages.

### Fixed

- **Reveal-animation overshoot** on contact-page slide-ins and other horizontal slide reveals — animations no longer overshoot their resting position.
- **Services-card 3-column grid** — moved the responsive snap point from `md` to `lg` so the three service cards no longer squeeze on tablet widths. `components.astro` showcase grids reverted to their original breakpoints.
- **Services "Web Development" card reveal direction** corrected to slide in from the matching side as its siblings.
- **LCP on the homepage hero** — `scrollHeight` reads deferred off the LCP critical path in `BaseLayout`; H1 opacity animation kept after a brief revert experiment.
- **Long tag titles** wrap correctly on narrow mobile screens on the `blog/tag/[tag]` page.
- **Mobile project-card images** — tightened the `sizes` hint to avoid downloading desktop-resolution images on phones.

### Removed

- **Brand glow** removed from project hero, project carousel, and blog article hero (a dark-mode hero halo was added then reverted).
- **Lighthouse score section** removed from the README in favour of pointing at the live demo.

### Upgrade notes

- **Navigation order changed** — `Services` was inserted as the first item in both `navItems` and `footerNavItems`, pushing Blog from order 1 to order 3. If you've customised `src/config/nav.config.ts`, re-apply your overrides on top of the new defaults rather than copying the file verbatim.
- **Project frontmatter additions are all optional** — existing `.mdx` projects continue to work unchanged. To opt into the new features, add `gallery: [...]`, `meta: [...]`, `placeholder: true`, or `toc: false` as needed (see `src/content/projects/astro-rocket.mdx` for examples).
- **Blog `faqs` frontmatter is optional** — set `faqs: [{ question, answer }]` to emit FAQ JSON-LD; existing posts emit only `BlogPosting` as before.
- **Header desktop breakpoint raised to `lg`** — if you've customised `Header.astro` or `header.variants.ts` against the previous `md` breakpoint, expect the desktop layout to engage one breakpoint later than before.

---

## [1.3.0] — 2026-05-11

### Added

- **Native opt-in i18n** — internationalization is now built into the theme itself, no upstream CLI required. Locale-prefixed routes, a `LanguageSwitcher` dropdown in the header and mobile menu, `hreflang` alternates emitted from the SEO component, and a `t()` translation helper backed by JSON dictionaries (`src/i18n/<locale>.json`). English and Dutch ship out of the box; add more locales by editing `src/config/i18n.config.ts` and creating `src/i18n/<code>.json`. Resolves [#207](https://github.com/hansmartensdev/Astro-Rocket/issues/207).
- **`src/i18n/` module** with `t()`, `localizedPath()`, `swapLocaleInPath()`, `stripLocaleFromPath()`, `getLocaleFromPath()`, `isEnabled()`, and locale helpers. `t()` supports `{name}` placeholder interpolation and falls back to the default locale, then to the key itself, so partial translations are visible but non-fatal.
- **`src/config/i18n.config.ts`** — new config file with master switch (`enabled`), `defaultLocale`, `locales[]`, `localeNames`, and `detectBrowserLocale`. Lives separately from `site.config.ts` so the i18n module can be unit-tested without pulling in `astro:env/server`.
- **`LanguageSwitcher.astro`** — accessible pill dropdown with a globe icon, BCP 47 locale code, and full locale names. Pure HTML `<a hreflang lang>` links built via `swapLocaleInPath()` — no framework hydration, ~1 KB of inline JS for open/close. Renders nothing when i18n is disabled.
- 10 new unit tests covering `t()` lookup, fallback, interpolation, locale validation, and `localizedPath()`.

### Changed

- `Header` now shows `LanguageSwitcher` by default when i18n is enabled (the existing `showLanguageSwitcher` prop now defaults to `i18nIsEnabled()` instead of `undefined`, so it auto-shows on multi-locale sites).
- `MarketingLayout` drops the hardcoded `showLanguageSwitcher={false}` override so it inherits the new smart default.
- `astro.config.mjs` conditionally enables Astro's native `i18n` option only when the flag is on and at least two locales are configured. Default routing matches existing behavior (`prefixDefaultLocale: false`).
- README's i18n section rewritten: the Velocity CLI is no longer the recommended path. The warning that it overwrites existing directories remains, as a footnote for anyone who still wants to try it.

### Performance

Verified zero output-size delta with i18n disabled (the default):

|                | i18n off (1.3.0)  | i18n off (1.2.1)  |
|----------------|-------------------|-------------------|
| `dist/` size   | 12 M              | 12 M              |
| Files          | 80                | 80                |
| `hreflang`     | 0                 | 0 (didn't exist)  |
| LanguageSwitcher | 0 instances     | n/a               |

The new code paths are gated on `i18nIsEnabled()`, which returns `false` whenever the flag is off OR `locales.length === 1`. When that returns false, the LanguageSwitcher wrapping `<div>` is skipped, the `hreflang` block compiles to an empty fragment, and `astro.config.mjs` omits the `i18n` option entirely.

---

## [1.2.1] — 2026-05-10

### Fixed

Six rounds of mobile Lighthouse forced-reflow fixes. The 1.2.0 release introduced the table-of-contents sidebar layout, but mobile performance dropped from 100 to 90-95 due to several layout-read sources surfacing under throttled mobile CPU. Each of the following sources was identified by Lighthouse Insights and addressed:

- **TOC scroll-spy** — replaced `entry.target.getBoundingClientRect()` inside the `IntersectionObserver` callback with the cached `entry.boundingClientRect`, which the entry already exposes. Eliminated ~200ms of forced reflow on blog post pages. (#258)
- **Hero H1 font-swap CLS** — added explicit `@font-face` declarations after the `@fontsource-variable` imports overriding `font-display` to `optional`. With the existing `<link rel="preload">` in `BaseLayout` the font usually arrives in the 100ms block window; otherwise the fallback stays for the page lifetime, eliminating the swap-induced shift. Reduced CLS from 0.197 → near zero on the homepage H1. (#258)
- **Back-to-top progress ring** — cached `docMaxScrollY` instead of reading `document.documentElement.scrollHeight` on every scroll frame. (#258, #259)
- **LetterGlitch CTA** — cached canvas width/height in a ref instead of calling `getBoundingClientRect()` on every animation frame. Removed ~215ms of per-frame reflow. (#260)
- **`docMaxScrollY` cache strategy** — initial round wrapped the `ResizeObserver`-driven read in `requestAnimationFrame` (#261), then dropped the `ResizeObserver` entirely (#262) once it became clear that other scripts queue layout writes between the observer firing and rAF execution. resize + load events are sufficient.
- **Initial `scrollHeight` read at script init** — deferred to `DOMContentLoaded` instead of running during HTML parsing, when the document hasn't been fully laid out and the read forces a synchronous layout for the partial DOM. (#263)

After all six fixes the mobile Lighthouse score returns to **100** (with normal 92-100 run-to-run variance from CPU throttling); desktop stays at a steady **100/100/100/100**.

---

## [1.2.0] — 2026-05-09

### Added

- **Table of contents layout option** — `articleFeatures.toc.layout` accepts `'inline'` (current default — card at top of article), `'sidebar'` (sticky sidebar to the right on `xl+` viewports, hidden below), or `'auto'` (sidebar on `xl+`, inline card below `xl`). The article column stays at `max-w-4xl` in every layout, so reading width never changes when the sidebar appears or disappears. Per-post `toc: false` override and `IntersectionObserver` scroll-spy work identically across all three layouts. Default stays `'inline'` so existing sites are unchanged on upgrade. See [Table of Contents — Reading Anchors for Long Posts](src/content/blog/en/table-of-contents.mdx) for setup. The Astro Rocket demo site uses `'auto'`.
- Conditional `<link rel="preconnect" href="https://giscus.app">` in `BaseLayout` when `articleFeatures.comments.enabled` is `true` — warms the DNS+TLS handshake before the lazy-loaded Giscus iframe fires.

### Changed

- **Brand accent shifted from `brand-700` to `brand-600` in light mode** for the blog SVG hero background and the mobile hamburger / close icon — completes the 1.1.0 brand-color refresh that previously covered header + footer site name, hero H1, and primary button. Dark mode unchanged.
- Header scroll behaviour and scroll-progress bar are now driven by a single `requestAnimationFrame` callback. All layout reads (`window.scrollY`, etc.) happen before any DOM writes, and `docMaxScrollY` is cached via `ResizeObserver` so the scroll path never reads `scrollHeight` after attribute writes.

### Fixed

- **Forced reflow (~537 ms)** in `Header.astro` flagged by Lighthouse Insights. Two scroll scripts (header scroll-watcher + scroll-progress bar) were running on the same frame: the first wrote attributes, the second then read `scrollHeight` and forced a synchronous layout recompute. Merging the scripts and caching `docMaxScrollY` eliminates the reflow. After the fix the live demo scores 100/100/100/100 on both mobile and desktop.
- **TOC scroll-spy + duplicate `id` in `'auto'` layout** — when both the inline and sidebar TOC are mounted (one hidden via CSS per breakpoint), the scroll-spy script previously bound to the first instance only, leaving the visible TOC without active-section highlighting on desktop. The script now iterates all `[data-toc]` instances and each instance gets a unique `aria-labelledby` heading id.

### Removed

- **Dead `morphToBar` code path.** The prop on `<Header>` and `<LandingLayout>` defaulted to `false` everywhere and was never set to `true`; the entire `initNavMorph` script (~30 lines) ran on every page load only to bail on a failing `querySelector`. Removed the prop from both components, the `data-morph-to-bar` attribute, the `initNavMorph` script + `astro:transitions/client` import, and two associated CSS rules. After removal the Header script bundle is small enough that Astro inlines it directly into the HTML, eliminating the 1.3 s critical-path fetch Lighthouse previously flagged for `Header.astro_ast_…js`.

### Upgrade notes

`articleFeatures.toc.layout` is an additive setting — existing sites pick up the default (`'inline'`) and render exactly as before. To try the new sidebar mode, set `layout: 'sidebar'` (desktop only) or `layout: 'auto'` (sidebar on `xl+`, inline card on phones/tablets) in `site.config.ts`. The brand-color tweaks are visible in light mode on blog index / post pages and the mobile menu — review the diff if you've customized either area.

---

## [1.1.0] — 2026-05-09

### Added

- **Table of contents** on blog posts — auto-generated from MDX headings, with scroll-spy that highlights the active section. Off by default; enable via `articleFeatures.toc.enabled` in `site.config.ts`. Per-post override with `toc: false` in frontmatter. See [Table of Contents — Reading Anchors for Long Posts](src/content/blog/en/table-of-contents.mdx)
- **Comments on blog posts** powered by [Giscus](https://giscus.app) and GitHub Discussions. Off by default; enable via `articleFeatures.comments.enabled` plus four IDs from giscus.app. Lazy-loaded with an IntersectionObserver — readers who don't scroll to the comments pay zero network cost. Per-post override with `comments: false` in frontmatter. See [Comments on Blog Posts — Giscus, Lazy-Loaded](src/content/blog/en/giscus-comments.mdx)
- **Independent footer menu** — `nav.config.ts` now exports `footerNavItems` and `legalLinks` separately from the header `navItems`, so the footer can show different links (Privacy, Imprint, etc.) without touching the main nav. Defaults mirror the existing nav, so existing sites are unchanged. See [Independent Footer Menu — Different Links in Header and Footer](src/content/blog/en/independent-footer-menu.mdx)
- "View all projects" outline button below the project cards on the homepage
- Arrow-right icon on the "More about me" button (homepage about section)

### Changed

- **Brand accent shifted from `brand-700` to `brand-600` in light mode** across header site name, footer site name, hero H1, and the primary button. Header and footer logo backgrounds now use `bg-brand-600` in both light and dark mode. Primary button hover shifted from `brand-800` to `brand-700` to keep the one-step-darker progression.
- Floating header (homepage) nav links now render at full opacity instead of `opacity-80` with a hover bump.
- Homepage Blog section header is now centered (matching Services, Testimonials, etc.); the inline desktop "View all posts" link was removed and replaced with a single always-visible "View all posts" outline button below the blog cards.
- "Read the full story" button on the About page is now an outline button.

### Removed

- "My Stack" section on the homepage. The `TechStack` component itself is still available for users who want to drop it into their own pages. The four sections that followed (Lighthouse, About Teaser, Blog, CTA) had their backgrounds flipped so the alternating zebra pattern continues unbroken.

### Upgrade notes

The brand-color refresh and homepage layout changes are visible after upgrading. If you've customized either, review the diff before merging — the new opt-in features (TOC, comments, footer config) are all off by default and won't change anything until you flip the switch in `site.config.ts`.

---

## [1.0.0] — 2026-04-04

Initial public release of Astro Rocket.

### Added

- Production-ready Astro 6 starter theme built on Tailwind CSS v4 and TypeScript
- 57 UI and pattern components (buttons, forms, cards, badges, inputs, selects, etc.)
- 12 live colour themes (Orange, Amber, Lime, Emerald, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Magenta) switchable at runtime without a rebuild
- Full blog with MDX support, syntax highlighting (Shiki), and RSS feed
- Auto-generated SVG favicon and monogram logo badge from `site.config.ts`
- Unified `Icon` component via Iconify (350+ Lucide icons + 3000+ Simple Icons)
- Animated typing effect in hero section
- Contact form with Zod validation, honeypot bot detection, and Resend integration
- Newsletter signup form with Resend Audiences integration
- Cookie consent banner with Google Consent Mode v2 support
- Google Analytics 4 and Google Tag Manager integration (consent-aware)
- Built-in SEO layer: JSON-LD structured data, Open Graph, sitemap, robots.txt
- Dark mode via `sessionStorage` (resets to dark on each new session)
- Search powered by Pagefind
- Multiple deployment targets: Vercel, Netlify, Cloudflare Pages
- Security headers configured for all deployment targets
- GitHub Actions CI/CD workflow (lint, type-check, build)
- Vitest unit tests for API endpoint validation schemas

### Changed (from Velocity)

- Forked and extended [Velocity](https://github.com/southwellmedia/velocity) by Southwell Media
- Added theme switching, 12 colour themes, typed logo badge, auto favicon
- Replaced localStorage with sessionStorage for dark mode preference
- Added blog image gradients that update with the active theme
- Upgraded icon system to Iconify
- Targeted at complete, ready-to-launch sites rather than a bare boilerplate
