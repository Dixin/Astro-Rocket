import siteConfig from '@/config/site.config';
import { defaultLocale } from '@/i18n';
import { getAllPublishedContents, getContentUrl } from '@/lib/contents';

/**
 * RSS feed generation, shared by `/rss.xml` and `/<locale>/rss.xml`.
 *
 * The feed used to be built inline in the default-locale route, filtered to
 * the default locale's posts and hardcoded `/blog/<slug>` links. Every page in
 * every locale linked to it, so a reader on a translated page was offered a
 * feed in a language they had not asked for, with links to pages in that other
 * language. Moving the body here lets each locale have its own feed without
 * two copies of the XML drifting apart.
 */

const RssFeedMaxItems = 1000;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRfc822Date(date: Date): string {
  return date.toUTCString();
}

interface BuildFeedOptions {
  /** The locale this feed is for. Decides the posts, the links and the language. */
  locale?: string;
  /** The site's own address, from `Astro.site` where available. */
  site?: string;
  /** Path this feed is served at, for the self-referencing atom:link. */
  feedPath?: string;
}

export async function buildRssFeed({
  locale = defaultLocale,
  site,
  feedPath = '/rss.xml',
}: BuildFeedOptions = {}): Promise<string> {
  const contents = (await getAllPublishedContents(locale)).slice(0, RssFeedMaxItems);

  const base = (site ?? siteConfig.url).replace(/\/$/, '');

  const contentRssItems = contents
    .map((content) => {
      // getPostUrl prefixes the locale for every locale but the default one,
      // so a translated feed links to the translated pages.
      const link = `${base}${getContentUrl(content.contentDirectoryName, content.content.id, locale)}/`;
      const categories = content.content.data.tags
        .map((tag) => `<category>${escapeXml(tag)}</category>`)
        .join('\n        ');

      return `    <item>
      <title>${escapeXml(content.content.data.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <description>${escapeXml(content.content.data.description)}</description>
      <pubDate>${formatRfc822Date(content.content.data.publishedAt)}</pubDate>
      <author>${escapeXml(content.content.data.author || '')}</author>
      ${categories}
    </item>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.name)}</title>
    <description>${escapeXml(siteConfig.description)}</description>
    <link>${base}</link>
    <atom:link href="${base}${feedPath}" rel="self" type="application/rss+xml"/>
    <language>${locale}</language>
    <lastBuildDate>${formatRfc822Date(new Date())}</lastBuildDate>
${contentRssItems.join('\n')}
  </channel>
</rss>`;
}
