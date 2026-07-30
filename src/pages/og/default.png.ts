import type { APIRoute } from 'astro';
import siteConfig from '@/config/site.config';
import { renderOgPng } from '@/lib/og';

// The site-wide share image, used by every page that has no card of its own.
// Generated rather than shipped as a file in `public/` so it follows the site
// name and brand colour set in `site.config.ts` without an image editor.
export const prerender = true;

export const GET: APIRoute = async () => {
  const png = await renderOgPng({
    title: siteConfig.name,
    subtitle: siteConfig.tagline || siteConfig.description,
  });
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
