import { join } from 'node:path';
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
 * Native Astro i18n is only wired up when the user opts in *and* has
 * more than one locale configured. With i18n off (the default) this
 * block is undefined and the build emits the exact same routes as
 * before — no /en/ prefix, no extra pages.
 */
const i18nEnabled = i18nConfig.enabled === true && i18nConfig.locales.length > 1;
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
  site: process.env.SITE_URL || 'https://Beyond.ms',
  ...(astroI18nOptions ? { i18n: astroI18nOptions } : {}),

  // Astro 7 changed the default to 'jsx', which strips whitespace between
  // inline elements (React-style). Pin to `true` to keep this theme's v6
  // rendering — significant whitespace between inline tags is preserved.
  compressHTML: true,

  build: {
    inlineStylesheets: 'always',
  },

  env: {
    schema: {
      SITE_URL: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_GA_MEASUREMENT_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_GTM_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_FROM_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
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
    pagefind(),
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
