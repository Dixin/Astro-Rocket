/**
 * Members area — the one place that decides how member responses are cached.
 *
 * The risk this closes: a gated post rendered for a signed-in member is a
 * normal 200 with a full HTML body. A CDN in front of the site — Vercel's,
 * Cloudflare's, a company proxy — is entitled to keep that and hand it to the
 * next person who asks for the same URL. The gate would have worked and the
 * content would leak anyway, and nothing in the application would show it.
 *
 * So every response that depends on who is asking says so: `private` keeps it
 * out of shared caches, `no-store` keeps it out of the browser's disk cache
 * and out of the back/forward cache after sign-out, and `Vary: Cookie` is
 * there for anything that honours it but ignores the rest.
 *
 * Middleware rather than a line in each page, because a page added later
 * cannot forget to do it.
 *
 * Note that this runs at build time for prerendered pages, where the headers
 * are meaningless and harmless — the paths below are all on-demand routes.
 */

import type { MiddlewareHandler } from 'astro';
import membersConfig from '@/config/members.config';
import { isGated } from '@/lib/members/gating';
import { getCollection } from 'astro:content';
import { getPostUrl } from '@/lib/blog';

/** Gated post URLs, worked out once per server instance rather than per request. */
let gatedPaths: Set<string> | null = null;

async function gatedPathSet(): Promise<Set<string>> {
  if (gatedPaths) return gatedPaths;
  const posts = await getCollection('blog');
  gatedPaths = new Set(
    posts
      .filter((post) => isGated(post.data))
      .map((post) => getPostUrl(post.id, post.data.locale).replace(/\/$/, ''))
  );
  return gatedPaths;
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();

  const path = context.url.pathname.replace(/\/$/, '') || '/';
  const prefix = membersConfig.prefix.replace(/\/$/, '');

  const isMemberRoute = path === prefix || path.startsWith(`${prefix}/`);
  const isGatedPost = isMemberRoute ? false : (await gatedPathSet()).has(path);

  if (isMemberRoute || isGatedPost) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    response.headers.set('Vary', 'Cookie');
  }

  return response;
};
