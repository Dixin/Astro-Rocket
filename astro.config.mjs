import { join, dirname } from 'node:path';
import { writeFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, envField } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import netlify from '@astrojs/netlify';
import cloudflare from '@astrojs/cloudflare';
import i18nConfig from './src/config/i18n.config.ts';
import membersConfig from './src/config/members.config.ts';
import { SITE_URL_FALLBACK } from './src/config/site-url.ts';
import { SITE_NAME, THEME_COLOR } from './src/config/branding.ts';

/**
 * Deploy-target adapter selection. Vercel is the default; set
 * `DEPLOY_TARGET=netlify` or `DEPLOY_TARGET=cloudflare` to build for those
 * platforms instead. All three keep `output: 'static'`, so every page is
 * prerendered and only the `prerender = false` API routes (the contact form
 * and newsletter) ship as the platform's serverless/edge function — on
 * Cloudflare Pages, as a Pages Function.
 */
const deployTarget = process.env.DEPLOY_TARGET;
function resolveAdapter() {
  switch (deployTarget) {
    case 'netlify':
      return netlify();
    case 'cloudflare':
      return cloudflare();
    default:
      return vercel();
  }
}

/**
 * Build-time check that the site knows its own address.
 *
 * With `SITE_URL` unset the build still succeeds, and every canonical tag,
 * `og:url`, `og:image`, RSS link and sitemap entry is written against the
 * placeholder above — pointing search engines and social crawlers at a domain
 * that isn't yours. Nothing in the output looks broken, so it survives to
 * production easily. Warn where it will be read: the build log.
 */
function siteUrlCheck() {
  return {
    name: 'site-url-check',
    hooks: {
      'astro:build:start': ({ logger }) => {
        if (process.env.SITE_URL) return;
        logger.warn(
          `SITE_URL is not set, so canonical URLs, og:image, RSS and the sitemap ` +
            `will all be written against ${SITE_URL_FALLBACK}. Set SITE_URL in ` +
            `your host's environment variables to your own domain.`
        );
      },
    },
  };
}

/**
 * Pagefind static search index, generated after every `astro build`.
 *
 * Runs in the `astro:build:done` hook so it indexes the *actual* output
 * directory — the Vercel adapter writes to `.vercel/output/static`, Netlify,
 * Cloudflare, and plain static builds to `dist/` — without the build command
 * needing to know which. The index is served from `/pagefind/` and loaded lazily by
 * `src/components/layout/SearchModal.astro`; `astro dev` has no index, and
 * the search modal explains that instead of erroring.
 */
function pagefind() {
  return {
    name: 'pagefind',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const sitePath = fileURLToPath(dir);
        const outputPath = join(sitePath, 'pagefind');
        const { createIndex, close } = await import('pagefind');
        const { index } = await createIndex();
        const { page_count } = await index.addDirectory({ path: sitePath });
        await index.writeFiles({ outputPath });
        await close();
        logger.info(`indexed ${page_count} pages into ${outputPath}`);
      },
    },
  };
}

/**
 * Favicon PNG/ICO files, written after every `astro build`.
 *
 * These used to be prerendered endpoints under `src/pages/`. That worked on
 * Vercel and Netlify but broke on Cloudflare: `@astrojs/cloudflare` prerenders
 * routes inside workerd, and the renderer needs `sharp`, a native Node module
 * that cannot load there. Every favicon route failed with
 * `No such module "…/chunks/sharp"` and the build died — so Cloudflare users
 * got no site at all. Reported in #600.
 *
 * `astro:build:done` always runs in Node, whichever adapter is active, and
 * `dir` already points at that adapter's real output directory. So the same
 * files land in the same place on all three targets, with no native module
 * anywhere near a page.
 *
 * `favicon.svg` is written here too, rather than staying a route. It needs no
 * *native* module, so keeping it as a route looked safe — but `buildFaviconSvg`
 * decodes an embedded font subset with `Buffer` and parses it with fontkit,
 * and neither exists in workerd without `nodejs_compat`. As a route it emitted
 * a 0-byte file on Cloudflare while the build reported success. The cost is
 * that `astro dev` has no favicon, since build hooks do not run there.
 */
function faviconAssets() {
  const letter = SITE_NAME.charAt(0).toUpperCase();
  const pngSizes = {
    'favicon-32x32.png': 32,
    'apple-touch-icon.png': 180,
    'pwa-192x192.png': 192,
    'pwa-512x512.png': 512,
  };

  return {
    name: 'favicon-assets',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        // Imported here rather than at the top of this file: a static import
        // of the sharp-backed module makes pagefind's own dynamic import above
        // fail with "Vite module runner has been closed" (#600).
        const { buildFaviconSvg } = await import('./src/lib/favicon/svg.ts');
        const { renderFaviconPng, renderFaviconIco } = await import('./src/lib/favicon/raster.ts');
        const out = fileURLToPath(dir);

        await writeFile(join(out, 'favicon.svg'), buildFaviconSvg(letter, THEME_COLOR));

        for (const [name, size] of Object.entries(pngSizes)) {
          await writeFile(join(out, name), await renderFaviconPng(letter, THEME_COLOR, size));
        }
        await writeFile(join(out, 'favicon.ico'), await renderFaviconIco(letter, THEME_COLOR));

        logger.info(`wrote ${Object.keys(pngSizes).length + 2} favicon files to ${out}`);
      },
    },
  };
}

/**
 * OG share cards, drawn after every `astro build`.
 *
 * These used to be prerendered endpoints under `src/pages/og/`, and they hit
 * the same wall as the favicons in #600: rasterising needs `sharp`, which
 * cannot load in the workerd runtime the Cloudflare adapter prerenders in.
 * Worse than the favicons, `src/lib/og.ts` also held the `getBlogOgPath`
 * helpers that `BlogLayout` and `ProjectLayout` import — so `sharp` was
 * reachable from every blog and project page, not just from the card routes.
 * The library is split in two now: `og/svg.ts` is safe anywhere, `og/raster.ts`
 * is Node-only and reached only from here.
 *
 * Rather than re-deriving which cards to draw from the content collections —
 * which this file cannot read — the hook scans the built HTML for the
 * `og:image` each page declares, and draws exactly those. Cards therefore
 * match what the pages ask for by construction, and a page using its own cover
 * photo silently produces no card, which is correct. Title and subtitle come
 * from the same page's `og:title` and `og:description`.
 */
function ogCards() {
  const KINDS = [
    [/^\/og\/blog\/tag\//, 'BLOG'],
    [/^\/og\/blog\//, 'BLOG'],
    [/^\/og\/projects\//, 'PROJECTS'],
  ];

  async function htmlFiles(directory) {
    const found = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) found.push(...(await htmlFiles(path)));
      else if (entry.name.endsWith('.html')) found.push(path);
    }
    return found;
  }

  const meta = (html, property) => {
    const m = html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`));
    return m ? m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
                   .replace(/&lt;/g, '<').replace(/&gt;/g, '>') : undefined;
  };

  return {
    name: 'og-cards',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const { renderOgPng } = await import('./src/lib/og/raster.ts');
        const out = fileURLToPath(dir);
        const siteUrl = process.env.SITE_URL || SITE_URL_FALLBACK;
        const domain = new URL(siteUrl).host;

        // Collect one entry per distinct card path; several pages can point at
        // the same card (the default one, most obviously).
        const wanted = new Map();
        for (const file of await htmlFiles(out)) {
          const html = await readFile(file, 'utf8');
          const image = meta(html, 'og:image');
          if (!image) continue;
          let path;
          try {
            path = new URL(image, siteUrl).pathname;
          } catch {
            continue;
          }
          if (!path.startsWith('/og/') || !path.endsWith('.png') || wanted.has(path)) continue;
          wanted.set(path, {
            title: meta(html, 'og:title') || SITE_NAME,
            subtitle: meta(html, 'og:description'),
            kind: KINDS.find(([re]) => re.test(path))?.[1],
          });
        }

        for (const [path, card] of wanted) {
          const png = await renderOgPng({
            ...card,
            brandColor: THEME_COLOR,
            domain,
            siteName: SITE_NAME,
          });
          const target = join(out, path.replace(/^\//, ''));
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, png);
        }

        logger.info(`drew ${wanted.size} OG cards into ${out}`);
      },
    },
  };
}

/**
 * Native Astro i18n is only wired up when the user opts in *and* has
 * more than one locale configured. With i18n off (the default) this
 * block is undefined and the build emits the exact same routes as
 * before — no /en/ prefix, no extra pages.
 */
const i18nEnabled = i18nConfig.enabled === true && i18nConfig.locales.length > 1;

/**
 * Members area — the off switch.
 *
 * OFF BY DEFAULT, and off means absent. When the flag is false this registers
 * no routes, so the build is byte-identical to a site without the feature: no
 * member pages, and no serverless function where there was none before. A
 * runtime check inside the pages would not achieve that — anything left in
 * `src/pages/` with `prerender = false` compiles as an on-demand route
 * whatever the config says when it runs. That is why the pages live in
 * `src/members/` and are injected from here instead.
 *
 * MEMBERS_ENABLED exists for astrorocket.dev, which runs the feature on while
 * the theme ships it off. Committing `enabled: true` would turn it on for
 * everyone who clones the repository; an environment variable on one
 * deployment turns it on for one deployment.
 */
/**
 * URLs of every blog post carrying an `access:` value.
 *
 * Read off disk with a frontmatter scan rather than through the content layer,
 * because routes have to be injected in `astro:config:setup` and collections
 * do not exist yet at that point.
 *
 * The URL rule is `getPostUrl`'s: strip the locale folder from the id, and
 * prefix the path with the locale for every locale but the default. Two copies
 * of one rule is a drift risk, so `members-gating.test.ts` builds the same URL
 * both ways and fails if they stop agreeing.
 */
function gatedPosts() {
  const base = new URL('./src/content/blog/', import.meta.url);
  const locales = i18nConfig.locales ?? [];
  const defaultLocale = i18nConfig.defaultLocale;
  const urls = [];

  let entries;
  try {
    entries = readdirSync(base, { recursive: true, withFileTypes: true });
  } catch {
    return urls;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !/\.(md|mdx)$/.test(entry.name)) continue;

    const path = join(entry.parentPath ?? entry.path, entry.name);
    const source = readFileSync(path, 'utf8');
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) continue;

    const access = frontmatter[1].match(/^access:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1]?.trim();
    if (!access || access === 'public') continue;

    // The id is the path under the collection root, without its extension.
    const id = path
      .slice(fileURLToPath(base).length)
      .replace(/\\/g, '/')
      .replace(/\.(md|mdx)$/, '');
    const locale = frontmatter[1].match(/^locale:\s*["']?([\w-]+)["']?\s*$/m)?.[1] ?? defaultLocale;
    const slug = id.replace(new RegExp(`^(${[locale, ...locales].join('|')})/`), '');

    urls.push(locale === defaultLocale ? `/blog/${slug}` : `/${locale}/blog/${slug}`);
  }

  return urls;
}

function membersArea() {
  const enabled =
    membersConfig.enabled === true || process.env.MEMBERS_ENABLED === 'true';

  return {
    name: 'members-area',
    hooks: {
      'astro:config:setup': ({ injectRoute, logger }) => {
        if (!enabled) return;

        const prefix = membersConfig.prefix.replace(/\/$/, '');
        const routes = [
          ['/login', 'login.astro'],
          ['/check-email', 'check-email.astro'],
          ['/account', 'account.astro'],
          ['', 'index.astro'],
          ['/request-link', 'api/request-link.ts'],
          ['/verify', 'api/verify.ts'],
          ['/logout', 'api/logout.ts'],
          ['/demo-login', 'api/demo-login.ts'],
        ];

        for (const [path, entry] of routes) {
          injectRoute({
            pattern: `${prefix}${path}`,
            entrypoint: `./src/members/${entry}`,
            prerender: false,
          });
        }

        // One route per gated post, at the post's own URL.
        //
        // A gated post cannot be prerendered — middleware runs at build time
        // for prerendered pages, so the guard would decide once, at build,
        // for everybody. Making the whole `/blog/[...slug]` route on-demand
        // would fix that and cost every public post its static build, so
        // instead the dynamic route drops gated posts from getStaticPaths and
        // each one is injected here. Astro gives a static pattern priority
        // over a dynamic one, so `/blog/members-only` wins over
        // `/blog/[...slug]` and the URL does not change.
        const gated = gatedPosts();
        for (const url of gated) {
          injectRoute({
            pattern: url,
            entrypoint: './src/members/gated-post.astro',
            prerender: false,
          });
        }

        logger.info(
          `enabled at ${prefix} — ${routes.length} routes, ${gated.length} gated ${
            gated.length === 1 ? 'post' : 'posts'
          }, all on demand`
        );
      },
      'astro:build:start': ({ logger }) => {
        if (!enabled) return;
        if (process.env.MEMBERS_SESSION_SECRET) return;
        // A gate that fails open is worse than no gate, so this stops the
        // build rather than shipping a members area that cannot sign anything.
        throw new Error(
          'The members area is enabled but MEMBERS_SESSION_SECRET is not set. ' +
            'Generate one with `openssl rand -base64 32` and add it to your ' +
            "host's environment variables, or set members.enabled to false."
        );
      },
    },
  };
}
const astroI18nOptions = i18nEnabled
  ? {
      defaultLocale: i18nConfig.defaultLocale,
      locales: i18nConfig.locales,
      routing: {
        prefixDefaultLocale: false,
        redirectToDefaultLocale: false,
      },
    }
  : undefined;

export default defineConfig({
  output: 'static',
  adapter: resolveAdapter(),
  site: process.env.SITE_URL || SITE_URL_FALLBACK,
  ...(astroI18nOptions ? { i18n: astroI18nOptions } : {}),

  // Astro 7 changed the default to 'jsx', which strips whitespace between
  // inline elements (React-style). Pin to `true` to keep this theme's v6
  // rendering — significant whitespace between inline tags is preserved.
  compressHTML: true,

  build: {
    inlineStylesheets: 'auto',
  },

  env: {
    schema: {
      SITE_URL: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_GA_MEASUREMENT_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_GTM_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      // Umami — privacy-friendly, cookieless analytics. Set the website ID to
      // enable it; the src defaults to Umami Cloud, override it when self-hosting.
      PUBLIC_UMAMI_WEBSITE_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_UMAMI_SRC: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
        default: 'https://cloud.umami.is/script.js',
      }),
      // Signs member sessions and sign-in links. Only read when the members
      // area is enabled; the build stops if it is enabled without this.
      MEMBERS_SESSION_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_FROM_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_AUDIENCE_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      NEWSLETTER_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_SITE_VERIFICATION: envField.string({ context: 'server', access: 'public', optional: true }),
      BING_SITE_VERIFICATION: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_GOOGLE_MAPS_API_KEY: envField.string({ context: 'client', access: 'public', optional: true, default: '' }),
      PUBLIC_CONSENT_ENABLED: envField.boolean({ context: 'client', access: 'public', optional: true, default: false }),
      PUBLIC_PRIVACY_POLICY_URL: envField.string({ context: 'client', access: 'public', optional: true, default: '' }),
    },
  },

  image: {
    layout: 'constrained',
  },

  integrations: [
    react(),
    mdx(),
    sitemap(),
    icon(),
    siteUrlCheck(),
    pagefind(),
    faviconAssets(),
    ogCards(),
    membersArea(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  security: {
    checkOrigin: true,
  },

  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },

});
