# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
