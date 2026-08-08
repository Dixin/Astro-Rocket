/**
 * Canonical-id resolution for durable internal links.
 *
 * Phase 1: lets contents link to one another by a stable `uid` instead of a slug,
 * so renaming a file (and therefore its slug) never silently breaks inbound
 * The <ContentLink> component calls `resolveContentUrl`, which throws at build
 * time when a uid is unknown — turning a broken internal link into a failed
 * build instead of a silent 404.
 *
 * The pure helpers (`buildUidIndex`, `normalizeUid`) take plain data so they
 * can be unit-tested without the Astro content runtime. The astro-facing
 * `resolveContentUrl` / `assertValidContentUids` load the contents collection (cached)
 * and build locale-aware URLs.
 */
import { localizedPath, defaultLocale, getLocales } from '@/i18n';
import { directoryLocaleStrippedSlug } from './content-validation';

/** A content resolved from its canonical id, within one locale. */
export interface ResolvedContent {
  slug: string;
  title: string;
}

/** Minimal shape of a content entry needed to resolve canonical ids. */
interface UidEntryLike {
  id: string;
  data: { locale: string; uid?: string; title: string };
}

/**
 * Build an index of `uid -> (locale -> content)`. Contents without a uid are skipped.
 * Throws if two contents in the same locale claim the same uid, since a canonical
 * id must point to a single content per locale (the same uid across *different*
 * locales is expected — those are translations of one logical content).
 */
export function buildUidIndex(
  contents: UidEntryLike[]
): Map<string, Map<string, Map<string, ResolvedContent>>> {
  const index = new Map<string, Map<string, Map<string, ResolvedContent>>>();
  for (const content of contents) {
    const { uid, locale, title } = content.data;
    if (!uid) continue;

    const contentDirectoryName = content.id.substring(0, content.id.indexOf('/'));
    if (!contentDirectoryName) {
      throw new Error(
        `Invalid content id "${content.id}". Expected format: "<contentDirectoryName>/...".`
      );
    }
    let byDirectory = index.get(contentDirectoryName);
    if (!byDirectory) {
      byDirectory = new Map();
      index.set(contentDirectoryName, byDirectory);
    }

    let byLocale = byDirectory.get(uid);
    if (!byLocale) {
      byLocale = new Map();
      byDirectory.set(uid, byLocale);
    }
    if (byLocale.has(locale)) {
      throw new Error(
        `Duplicate canonical id "${uid}" in locale "${locale}": more than one ` +
          `content declares it. A uid must map to a single content per locale.`
      );
    }
    byLocale.set(locale, {
      slug: directoryLocaleStrippedSlug(content.id, contentDirectoryName, locale),
      title,
    });
  }
  return index;
}

/** Split an optional `contents/` prefix from a uid reference (`contents/foo` → `contents`, `foo`). */
export function normalizeUid(ref: string): { contentDirectoryName: string; uid: string } {
  const split = ref.split('/');
  if (split.length != 2 || !split[0] || !split[1]) {
    throw new Error(`Invalid uid reference "${ref}".`);
  }
  return { contentDirectoryName: split[0], uid: split[1] };
}

let cachedContents: UidEntryLike[] | null = null;

/** Load and cache the published (non-draft) content entries for build-time resolution. */
async function loadPublishedContents(): Promise<UidEntryLike[]> {
  if (cachedContents) return cachedContents;
  const { getCollection } = await import('astro:content');
  cachedContents = (await getCollection('contents')).filter(
    (content) => content.data.draft !== true
  );
  return cachedContents;
}

let cachedIndex: Map<string, Map<string, Map<string, ResolvedContent>>> | null = null;

/** Load and cache the uid index from the content collection (drafts excluded). */
async function getUidIndex(): Promise<Map<string, Map<string, Map<string, ResolvedContent>>>> {
  if (cachedIndex) return cachedIndex;
  cachedIndex = buildUidIndex(await loadPublishedContents());
  return cachedIndex;
}

/** A locale a content is available in, with its locale-aware URL. */
export interface ContentTranslation {
  locale: string;
  url: string;
}

/**
 * Every locale a content is published in, as verified `{ locale, url }` pairs
 * (always including the content's own locale). A translation is matched by
 * canonical `uid` when the content declares one — which correctly handles a
 * translation that lives at a *different* slug — otherwise by an identical
 * slug in the target locale. A locale is only included when a published content
 * actually exists for it, so the result never points at a 404. With i18n off
 * (a single locale) this is just the content itself.
 *
 * Used to build accurate `hreflang` alternates and "same content, other language"
 * links in the `LanguageSwitcher`, instead of blindly swapping the locale
 * segment of the current URL (which 404s when a translation is slugged
 * differently).
 */
export async function getContentTranslations(
  contentDirectoryName: string,
  contentUrlPath: string,
  id: string,
  locale: string,
  uid?: string
): Promise<ContentTranslation[]> {
  const slug = directoryLocaleStrippedSlug(id, contentDirectoryName, locale);
  const contents = (await loadPublishedContents()).filter((content) =>
    content.id.startsWith(`${contentDirectoryName}/`)
  );

  // Set of "<contentDirectoryName>/<locale>/<slug>" for existence checks when matching by slug.
  const existing = new Set(
    contents.map((content) => {
      return `${contentDirectoryName}/${content.data.locale}/${directoryLocaleStrippedSlug(content.id, contentDirectoryName, content.data.locale)}`;
    })
  );
  const byUid = uid ? (await getUidIndex()).get(contentDirectoryName)?.get(uid) : undefined;

  const translations: ContentTranslation[] = [];
  for (const loc of getLocales()) {
    if (loc === locale) {
      translations.push({ locale: loc, url: localizedPath(`/${contentUrlPath}/${slug}`, loc) });
      continue;
    }
    // Prefer a uid match (may resolve to a different slug); otherwise accept an
    // identically-slugged content in that locale. Skip locales with neither.
    const uidSlug = byUid?.get(loc)?.slug;
    if (uidSlug) {
      translations.push({ locale: loc, url: localizedPath(`/${contentUrlPath}/${uidSlug}`, loc) });
    } else if (existing.has(`${contentDirectoryName}/${loc}/${slug}`)) {
      translations.push({ locale: loc, url: localizedPath(`/${contentUrlPath}/${slug}`, loc) });
    }
  }
  return translations;
}

/**
 * Build-time guard: validate every canonical id (throws on duplicates). Runs
 * regardless of whether any <ContentLink> is rendered, so uid integrity is always
 * checked. Call from a route's `getStaticPaths`.
 */
export async function assertValidContentUids(): Promise<void> {
  await getUidIndex();
}

/**
 * Resolve a canonical id to a locale-aware URL and the target content's title.
 * Throws when the id is unknown (a broken internal link) so the build fails
 * loudly. Falls back to the default-locale variant when the requested locale
 * has no translation of the content.
 */
export async function resolveContentUrl(
  ref: string,
  locale: string = defaultLocale,
  contentUrlPath: string = ''
): Promise<{ url: string; title: string }> {
  const { contentDirectoryName, uid } = normalizeUid(ref);
  if (!contentUrlPath) {
    contentUrlPath = contentDirectoryName;
  }
  const index = await getUidIndex();

  const byDirectory = index.get(contentDirectoryName);
  if (!byDirectory) {
    throw new Error(
      `<ContentLink>: unknown content directory "${contentDirectoryName}". No published content ` +
        `resides in this directory — add it to the target content's frontmatter, or ` +
        `fix the reference.`
    );
  }
  const byLocale = byDirectory.get(uid);
  if (!byLocale) {
    throw new Error(
      `<ContentLink>: unknown canonical id "${uid}". No published content ` +
        `declares uid: "${uid}" — add it to the target content's frontmatter, or ` +
        `fix the reference.`
    );
  }

  const resolved = byLocale.get(locale) ?? byLocale.get(defaultLocale);
  if (!resolved) {
    throw new Error(`<ContentLink>: canonical id "${uid}" has no variant for locale "${locale}".`);
  }

  return {
    url: localizedPath(`/${contentUrlPath}/${resolved.slug}`, locale),
    title: resolved.title,
  };
}
