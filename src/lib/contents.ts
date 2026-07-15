/**
 * Shared helpers for the content listing pages (index, paginated, tag archives).
 *
 * Lives outside the page files so the index page, paginated pages, and tag
 * archive pages can share content fetching, page-size config, and tag-slug
 * conventions without drifting.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import siteConfig from '@/config/site.config';
import { defaultLocale, localizedPath, isEnabled, getLocales } from '@/i18n';
import { tagToSlug, findTagBySlug } from '@/lib/tags';

/** Number of regular (non-featured) contents shown per content index page. */
export const CONTENTS_PER_PAGE = siteConfig.contents?.contentsPerPage ?? 12;

/**
 * How many of the most-used tags to surface in the content tag cloud. Single
 * source for the index, paginated, and tag-archive routes so they can't drift.
 */
export const CONTENT_TAG_CLOUD_LIMIT = siteConfig.contents?.tagCloudLimit ?? 10;

// Tag-slug helpers live in `lib/tags` so content archives share one
// set of slug rules. Imported above so this module can build tag URLs, and
// re-exported here to keep existing import sites working.
export { tagToSlug, findTagBySlug };

/**
 * Strip the locale prefix from a content entry's id to get its URL slug
 * (e.g. "en/welcome" → "welcome").
 */
export function getContentSlug(contentDirectoryName: string, contentId: string, locale: string = defaultLocale): string {
  // Strip the leading locale-folder segment, leaving a single-segment slug. The
  // prefix is normally `locale`, but we also strip any other configured locale,
  // so a folder/locale mismatch still yields a clean slug rather than one
  // containing a slash (which would break single-segment `[slug]` routes).
  const localePrefix = new RegExp(`^${contentDirectoryName}/(${[locale, ...getLocales()].join('|')})/`, `i`);
  return contentId.replace(localePrefix, '');
}

/**
 * URL path for an individual content, locale-aware. The default locale stays
 * at the site root (`/content/<slug>`); additional locales are prefixed
 * (`/<locale>/content/<slug>`), matching `localizedPath` and the
 * canonical-id resolver in `lib/content-links`.
 */
export function getContentUrl(contentDirectoryName: string, contentId: string, locale: string = defaultLocale, contentUrlPath: string | undefined = undefined): string {
  return localizedPath(`/${contentUrlPath ?? contentDirectoryName}/${getContentSlug(contentDirectoryName, contentId, locale)}`, locale);
}

/** URL of the content index for a locale (`/content` or `/<locale>/content`). */
export function getContentBaseUrl(contentUrlPath: string, locale: string = defaultLocale): string {
  return localizedPath(`/${contentUrlPath}`, locale);
}

/**
 * URL for a content index page number, locale-aware. Page 1 is the content root
 * (no `/page/1` segment), matching the routing in `content/page/[page].astro`.
 */
export function getContentPageUrl(contentUrlPath: string, page: number, locale: string = defaultLocale): string {
  return page <= 1 ? getContentBaseUrl(contentUrlPath, locale) : localizedPath(`/${contentUrlPath}/page/${page}`, locale);
}

/** URL for a tag archive page, locale-aware. */
export function getTagUrl(contentUrlPath: string, tag: string, locale: string = defaultLocale): string {
  return localizedPath(`/${contentUrlPath}/tag/${tagToSlug(tag)}`, locale);
}

/**
 * The non-default locales that should get their own prefixed content routes
 * (`/<locale>/content/...`). Empty when i18n is off or only one locale is
 * configured, so the locale-prefixed `getStaticPaths` emit nothing and
 * single-locale builds stay byte-for-byte unchanged.
 */
export function getSecondaryLocales(): string[] {
  if (!isEnabled()) return [];
  return getLocales().filter((locale) => locale !== defaultLocale);
}

/**
 * Get published contents for a content directory name and a locale, newest first. Drafts are filtered
 * out in production, kept visible in dev so authors can preview them.
 */
export async function getPublishedContents(
  contentDirectoryName: string,
  locale: string = defaultLocale,
): Promise<CollectionEntry<'contents'>[]> {
  const all = await getCollection('contents', (content) => {
    return content.data.locale === locale && (import.meta.env.PROD ? content.data.draft !== true : true) && content.id.startsWith(`${contentDirectoryName}/`);
  });
  const orderEnabledCount = all.filter((content) => content.data.order !== undefined).length;
  if (orderEnabledCount === all.length) {
    return all.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  }
  if (orderEnabledCount === 0) {
    return all.sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
  }
  throw new Error(`Inconsistent order values in ${contentDirectoryName} contents: some entries have 'order' set, others do not. Either set 'order' for all entries or remove it from all entries.`);
}

export async function getAllPublishedContents(): Promise<{contentDirectoryName: string; content: CollectionEntry<'contents'>}[]> {
  const allContents = await getCollection('contents', (content) => import.meta.env.PROD ? content.data.draft !== true : true);
  const contentDirectoryNames = getContentDirectoryNames();
  return allContents
    .map((content) => {
      const contentDirectoryName = content.id.substring(0, content.id.indexOf('/'));
      if (!contentDirectoryNames.includes(contentDirectoryName)) {
        throw new Error(`Content directory name "${contentDirectoryName}" from content id "${content.id}" is not in the list of known content directories: ${contentDirectoryNames.join(', ')}`);
      }
      return { contentDirectoryName, content };
    })
    .sort((a, b) => {
      return b.content.data.publishedAt.valueOf() - a.content.data.publishedAt.valueOf();
    });
}

/**
 * Total number of content index pages for a locale. Page 1 carries the featured
 * contents plus the first slice of regular contents; pages 2..N hold the rest.
 * Shared by the default and locale-prefixed pagination routes so they agree
 * on the page count.
 */
export async function getContentPageCount(contentDirectoryName: string, locale: string = defaultLocale): Promise<number> {
  const contents = await getPublishedContents(contentDirectoryName, locale);
  const nonFeatured = contents.filter(content => !content.data.featured);
  const regularContentsAll = nonFeatured.length > 0 ? nonFeatured : contents;
  return Math.max(1, Math.ceil(regularContentsAll.length / CONTENTS_PER_PAGE));
}

/** All unique tags across the given contents, alphabetically sorted. */
export function collectTags(contents: CollectionEntry<'contents'>[]): string[] {
  return [...new Set(contents.flatMap(content => content.data.tags))].sort();
}

/** Tag occurrence counts across the given contents, sorted by count desc then alpha. */
export function collectTagsWithCounts(
  contents: CollectionEntry<'contents'>[]
): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const content of contents) {
    for (const t of content.data.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** The most-used tags across the given contents, capped at `limit`. */
export function collectTopTags(
  contents: CollectionEntry<'contents'>[],
  limit: number
): string[] {
  return collectTagsWithCounts(contents)
    .slice(0, limit)
    .map((t) => t.tag);
}

export function getContentDirectoryNames(): string[] {
  const contentFiles = import.meta.glob<string>('/src/content/contents/**/*', { import: 'default', eager: true });
  const contentDirectoryNames = new Set<string>();
  Object.keys(contentFiles).forEach((path) => {
    if(!path.startsWith('/src/content/contents/') || path.split('/').length < 5) {
      throw new Error(`Unexpected content file path: ${path}. Expected to be under /src/content/contents/`);
    }
    const segments = path.split('/');
    contentDirectoryNames.add(segments[4]);
  });
  return Array.from(contentDirectoryNames);
}
