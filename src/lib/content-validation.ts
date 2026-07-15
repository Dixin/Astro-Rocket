import { getAllPublishedContents } from '@/lib/contents'
import { getCollection } from 'astro:content';
import { defaultLocale } from '@/i18n';

/**
 * Build-time content validation.
 *
 * Phase 0: fail the build when two pieces of content resolve to the same URL
 * within a locale. As the content set grows — and especially once slugs are
 * derived from filenames across many posts — duplicate slugs become an easy
 * mistake that otherwise fails silently (one post quietly shadows another).
 * Catching it at build time turns a silent content bug into a loud, actionable
 * error.
 *
 * The pure helpers (`collectSlugRecords`, `findSlugCollisions`,
 * `formatSlugCollisions`) take plain data so they can be unit-tested without
 * the Astro content runtime. `assertNoSlugCollisions` is the build-time entry
 * point that loads the collections and throws.
 */

/** A single URL a piece of content will be published at, within a locale. */
export interface SlugRecord {
  contentDirectoryName: string;
  /** Locale the entry belongs to; collisions are only checked within a locale. */
  locale: string;
  slug: string;
}

/** Minimal shape shared by content-collection entries used here. */
interface ContentEntryLike {
  id: string;
  data: { locale: string };
}

/**
 * Strip a leading `<locale>/` segment from a collection entry id to get its
 * slug. Mirrors `getContentSlug` in `./contents`, kept here free of the
 * `astro:content` runtime import so it stays unit-testable and can be reused
 * by other build-time helpers (e.g. canonical-id resolution).
 */
export function localeStrippedSlug(id: string, locale: string): string {
  const prefix = `${locale}/`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

/**
 * Strip a leading `<contents>/<locale>/` segment from a collection entry id to get its
 * slug. Mirrors `getContentSlug` in `./content`, kept here free of the
 * `astro:content` runtime import so it stays unit-testable and can be reused
 * by other build-time helpers (e.g. canonical-id resolution).
 */
export function directoryLocaleStrippedSlug(id: string, contentDirectoryName: string, locale: string): string {
  const prefix = new RegExp(`^${contentDirectoryName}/(${locale})/`, `i`);
  return id.replace(prefix, '');
}

/**
 * Build the list of published URLs from the blog, pages, and projects
 * collections. Blog posts live under `/blog/<slug>`; projects under
 * `/projects/<slug>`; pages live at the site root `/<slug>`.
 */
export function collectSlugRecords(
  pages: ContentEntryLike[],
  contents: { contentDirectoryName: string; content: ContentEntryLike }[] = []
): SlugRecord[] {
  const records: SlugRecord[] = [];

  for (const content of contents) {
    const locale = content.content.data.locale;
    records.push({
      contentDirectoryName: content.contentDirectoryName,
      locale,
      slug: directoryLocaleStrippedSlug(content.content.id, content.contentDirectoryName, locale),
    });
  }

  for (const page of pages) {
    const locale = page.data.locale;
    records.push({
      contentDirectoryName: '',
      locale,
      slug: localeStrippedSlug(page.id, locale),
    });
  }

  return records;
}

/**
 * Group records by (locale, path) and return every path that more than one
 * entry resolves to. Output is sorted (locale, then path) and each collision's
 * sources are sorted, so error messages are deterministic.
 */
export function findSlugCollisions(records: SlugRecord[]): string[] {
  const groups = new Map<string, SlugRecord[]>();
  for (const record of records) {
    const key = record.contentDirectoryName 
      ? record.locale === defaultLocale
        ? `${record.contentDirectoryName}/${record.slug}`
        : `${record.contentDirectoryName}/${record.locale}/${record.slug}`
      : record.locale === defaultLocale
        ? `${record.slug}`
        : `${record.locale}/${record.slug}`;
    const existing = groups.get(key);
    if (existing) existing.push(record);
    else groups.set(key, [record]);
  }

  const collisions: string[] = [];
  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      collisions.push(key);
    }
  }

  return collisions.sort((a, b) => a.localeCompare(b));
}

/** Render collisions as a single, actionable error message. */
export function formatSlugCollisions(collisions: string[]): string {
  return (
    `Duplicate slugs detected — every entry must resolve to a unique URL ` +
    `within its locale:\n\n${collisions.join('\n')}\n\n` +
    `Rename the offending file(s) so each resolves to a distinct slug.`
  );
}

/**
 * Build-time guard: throw if any two published entries collide on the same URL
 * within a locale. Drafts are excluded — they are not emitted in production, so
 * they cannot cause a real collision. Call this from a route's
 * `getStaticPaths`; a throw here aborts `astro build`.
 */
export async function assertNoSlugCollisions(): Promise<void> {
  const pages = await getCollection('pages');
  const publishableContents = await getAllPublishedContents();
  const collisions = findSlugCollisions(
    collectSlugRecords(pages, publishableContents)
  );

  if (collisions.length > 0) {
    throw new Error(formatSlugCollisions(collisions));
  }
}
