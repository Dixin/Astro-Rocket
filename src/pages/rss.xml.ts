import type { APIContext } from 'astro';
import siteConfig from '@/config/site.config';
import { getContentSlug, getAllPublishedContents } from '@/lib/contents';
import { defaultLocale } from '@/i18n';

/**
 * Escapes XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats a date to RFC-822 format for RSS
 */
function formatRfc822Date(date: Date): string {
  return date.toUTCString();
}

export async function GET(context: APIContext) {
  const site = context.site?.toString() ?? siteConfig.url;
  const siteUrl = site.endsWith('/') ? site.slice(0, -1) : site;

  const contentRssItems: string[] = [];
  const contents = (await getAllPublishedContents()).slice(0, 100);
  for (const content of contents) {
    const link = content.content.data.locale === defaultLocale
      ? `${siteUrl}/${content.contentDirectoryName}/${getContentSlug(content.contentDirectoryName, content.content.id, content.content.data.locale)}/`
      : `${siteUrl}/${content.content.data.locale}/${content.contentDirectoryName}/${getContentSlug(content.contentDirectoryName, content.content.id, content.content.data.locale)}/`;
    const categories = content.content.data.tags
      .map((tag) => `<category>${escapeXml(tag)}</category>`)
      .join('\n        ');

    contentRssItems.push(`    <item>
        <title>${escapeXml(content.content.data.title)}</title>
        <link>${link}</link>
        <guid>${link}</guid>
        <description>${escapeXml(content.content.data.description)}</description>
        <pubDate>${formatRfc822Date(content.content.data.publishedAt)}</pubDate>
        <author>${escapeXml(content.content.data.author ?? '')}</author>
        ${categories}
      </item>`);
  }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.name)}</title>
    <description>${escapeXml(siteConfig.description)}</description>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <language>${defaultLocale}</language>
    <lastBuildDate>${formatRfc822Date(new Date())}</lastBuildDate>
${contentRssItems.join('\n')}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
