/**
 * Shared helpers for the blog listing pages (index, paginated, tag archives).
 *
 * Lives outside the page files so the index page, paginated pages, and tag
 * archive pages can share post fetching, page-size config, and tag-slug
 * conventions without drifting.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

/** Number of regular (non-featured) posts shown per blog index page. */
export const BLOG_POSTS_PER_PAGE = 12;

/** Maximum number of pages exposed for any given blog tag. */
export const TAG_POSTS_PER_PAGE = 12;

/**
 * Convert a human-readable tag (e.g. "Web Performance") to a URL slug
 * (e.g. "web-performance"). Two-way deterministic — pair with `findTagBySlug`.
 */
export function tagToSlug(tag: string): string {
  return tag
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Find the original tag string given its slug, from a list of known tags. */
export function findTagBySlug(slug: string, allTags: string[]): string | undefined {
  return allTags.find((tag) => tagToSlug(tag) === slug);
}

/**
 * Strip the locale prefix from a blog entry's id to get its URL slug
 * (e.g. "en/welcome" → "welcome").
 */
export function getPostSlug(postId: string, locale = 'en'): string {
  return postId.replace(new RegExp(`^${locale}/`), '');
}

/** URL path for an individual blog post. */
export function getPostUrl(postId: string, locale = 'en'): string {
  return `/blog/${getPostSlug(postId, locale)}`;
}

/**
 * Get all published posts for a locale, newest first. Drafts are filtered
 * out in production, kept visible in dev so authors can preview them.
 */
export async function getPublishedPosts(
  locale = 'en',
): Promise<CollectionEntry<'blog'>[]> {
  const all = await getCollection('blog', ({ data }) => {
    return data.locale === locale && (import.meta.env.PROD ? data.draft !== true : true);
  });
  return all.sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
}

/** All unique tags across the given posts, alphabetically sorted. */
export function collectTags(posts: CollectionEntry<'blog'>[]): string[] {
  return [...new Set(posts.flatMap((p) => p.data.tags))].sort();
}

/** Tag occurrence counts across the given posts, sorted by count desc then alpha. */
export function collectTagsWithCounts(
  posts: CollectionEntry<'blog'>[]
): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** The most-used tags across the given posts, capped at `limit`. */
export function collectTopTags(
  posts: CollectionEntry<'blog'>[],
  limit: number
): string[] {
  return collectTagsWithCounts(posts)
    .slice(0, limit)
    .map((t) => t.tag);
}
