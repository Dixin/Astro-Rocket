import newsUrls from './google-urls.json' with { type: 'json' };
import { exists, fetchString, readFiles, toUid, fetchFileSync, uidRegex } from '../common.ts';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';
import matter from 'gray-matter';
import * as cheerio from 'cheerio';
import * as htmlToMarkdown from '@xberg-io/html-to-markdown';

const maxTitleLength = 70;

type NewsUrlItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  guid: string;
  tags: string[];
  sourceLink: string;
  sourceLinkDecoded: string;
};

const googleNewsLabels: Record<string, string> = {
  en: 'Google News',
  'zh-CN': '谷歌新闻',
  'zh-TW': 'Google新聞',
  'zh-HK': 'Google新聞',
};

export const currentDirectory = import.meta.dirname;
const rawHtmlDirectory = path.join(currentDirectory, 'google-raw');
const trimmedHtmlDirectory = path.join(currentDirectory, 'google-trimmed');
const markdownRootDirectory = path.resolve(currentDirectory, '../../src/content/contents/news/');
const markdownDirectory = (locale: string) =>
  path.resolve(currentDirectory, `../../src/content/contents/news/${locale}/google`);
const imageDirectory = path.resolve(currentDirectory, '../../src/assets/news/google');
const markdownImageRootDirectory = '../../../../../assets/news/';
const markdownImageDirectory = `${markdownImageRootDirectory}google/`;

const getFile = (news: NewsUrlItem, locale: string) => {
  const uid = toUid(
    `${news.pubDate.substring(0, 10).replaceAll('-', '')}-google-${news.guid.substring(4, 9).toLowerCase()}${news.guid.substring(news.guid.length - 5).toLowerCase()}-${toUid(news.title).substring(0, maxTitleLength)}`
  );
  if (uid.includes('　') || !uidRegex.test(uid)) {
    console.error(`Invalid UID: ${uid}`);
  }
  return {
    uid,
    raw: path.join(rawHtmlDirectory, locale, `${uid}.html`),
    trimmed: path.join(trimmedHtmlDirectory, locale, `${uid}.html`),
    markdown: path.join(markdownDirectory(locale), `${uid}.mdx`),
  };
};

export const downloadHtmlFiles = async (overwrite = false) => {
  const urls: string[] = [];
  const guids = new Set<string>();
  const urlMap: Record<
    string,
    {
      news: NewsUrlItem;
      uid: string;
      locale: string;
      guid: string;
      source: string;
      rawHtmlFile: string;
      markdownFile: string;
    }
  > = {};

  await Object.entries(newsUrls as Record<string, Record<string, NewsUrlItem>>).forEachAsync(
    async ([locale, newsOfLocale]): Promise<void> => {
      if (locale !== 'zh-CN') {
        return;
      }
      return await Object.entries(newsOfLocale).forEachAsync(async ([guid, news]) => {
        let source = news.sourceUrl.toLowerCase();
        if (source.includes('://')) {
          source = source.split('://').at(-1)!;
        }
        if (source.startsWith('www.')) {
          source = source.substring(4);
        }
        source = source.replaceAll('.', '').replaceAll('-', '').replaceAll('_', '');
        const uid = toUid(
          `${news.pubDate.substring(0, 10).replaceAll('-', '')}-${source}-${news.guid.substring(4, 9).toLowerCase()}${news.guid.substring(news.guid.length - 5).toLowerCase()}-${toUid(news.title).substring(0, maxTitleLength)}`
        );
        if (uid.includes('　') || !uidRegex.test(uid)) {
          throw new Error(`Invalid UID: ${uid}`);
        }

        if (!news.sourceLink) {
          throw new Error(
            `Missing sourceLink for guid: ${guid}, title: ${news.title}, link: ${news.link}`
          );
        }
        urls.push(news.sourceLink!);
        const rawHtmlFile = path.join(rawHtmlDirectory, locale, `${uid}.html`);
        const markdownFile = path.join(markdownRootDirectory, locale, 'google', `${uid}.mdx`);
        if (guids.has(news.guid)) {
          if (locale === 'zh-TW' && urlMap[news.link].locale === 'zh-HK') {
            return;
          }
          throw new Error(`Duplicate guid: ${news.guid} for url: ${news.link}`);
        }
        guids.add(news.sourceLink!);
        urlMap[news.sourceLink!] = {
          news,
          uid,
          locale,
          guid,
          source,
          rawHtmlFile,
          markdownFile,
        };
      });
    }
  );

  await urls.forEachAsync(async (url) => {
    const info = urlMap[url];
    const news = info.news;
    const rawHtmlFileWithError = info.rawHtmlFile.replace('google-raw', 'google-raw-error');
    let html: string | undefined = undefined;
    if (overwrite || !(await exists(info.rawHtmlFile))) {
      let hasError = false;
      try {
        html = (await fetchString(url, undefined, 'gb2312')).trim();
      } catch (error) {
        hasError = true;
        console.error(`Failed to fetch ${url}:`, error);
        await fs.writeFile(rawHtmlFileWithError, news.sourceLinkDecoded, { encoding: 'utf-8' });
      }

      if (!hasError) {
        if (html && html.length > 0 && /<html/i.test(html) && /<body/i.test(html)) {
          await fs.writeFile(info.rawHtmlFile, html, { encoding: 'utf-8' });
        } else {
          await fs.writeFile(rawHtmlFileWithError, news.sourceLinkDecoded, { encoding: 'utf-8' });
        }
      }
    }
    if (overwrite || !(await exists(info.markdownFile))) {
      const markdownFileWithError = info.markdownFile.replace('\\google\\', '\\google-error\\');
      const googleNewsLabel = googleNewsLabels[info.locale]!;
      const author = news.sourceName ? `${googleNewsLabel}|${news.sourceName}` : googleNewsLabel;
      let source = news.sourceUrl;
      if (source.includes('://')) {
        source = source.split('://').at(-1)!;
      }
      if (source.startsWith('www.')) {
        source = source.substring(4);
      }
      const data = {
        title: news.title,
        uid: info.uid,
        description: news.description,
        locale: info.locale,
        publishedAt: news.pubDate,
        author,
        tags: news.tags,
        source: [
          {
            url: news.link,
            text: googleNewsLabel,
            icon: 'newspaper',
          },
          {
            url: news.sourceLink!,
            text: news.sourceName,
            icon: 'newspaper',
          },
        ],
        meta: [source],
        image: '',
        imageAlt: '',
      };
      if (!html) {
        try {
          html = (await fetchString(url)).trim();
        } catch (error) {
          console.error(`Failed to fetch ${url}:`, error);
        }
      }

      if (html && html.length > 0 && /<html/i.test(html) && /<body/i.test(html)) {
        const mdxContent = matter.stringify(
          `\n${fullHtmlToMarkdown(html.trim(), info.rawHtmlFile, news.sourceLink!)}\n`,
          data
        );
        await fs.writeFile(info.markdownFile, mdxContent, { encoding: 'utf-8' });
      } else {
        const mdxContent = matter.stringify('', data);
        await fs.writeFile(markdownFileWithError, mdxContent, {
          encoding: 'utf-8',
        });
      }
    }
  });
};

export const downloadHtmlFilesWithErrors = async (overwrite = false) => {
  const urls: string[] = [];
  const guids = new Set<string>();
  const urlMap: Record<
    string,
    {
      news: NewsUrlItem;
      uid: string;
      locale: string;
      guid: string;
      source: string;
      rawHtmlFile: string;
      markdownFile: string;
    }
  > = {};

  await Object.entries(newsUrls as Record<string, Record<string, NewsUrlItem>>).forEachAsync(
    async ([locale, newsOfLocale]) =>
      await Object.entries(newsOfLocale).forEachAsync(async ([guid, news]) => {
        let source = news.sourceUrl.toLowerCase();
        if (source.includes('://')) {
          source = source.split('://').at(-1)!;
        }
        if (source.startsWith('www.')) {
          source = source.substring(4);
        }
        source = source.replaceAll('.', '').replaceAll('-', '').replaceAll('_', '');
        const uid = toUid(
          `${news.pubDate.substring(0, 10).replaceAll('-', '')}-${source}-${news.guid.substring(4, 9).toLowerCase()}${news.guid.substring(news.guid.length - 5).toLowerCase()}-${toUid(news.title).substring(0, maxTitleLength)}`
        );
        if (uid.includes('　') || !uidRegex.test(uid)) {
          throw new Error(`Invalid UID: ${uid}`);
        }

        if (!news.sourceLink) {
          throw new Error(
            `Missing sourceLink for guid: ${guid}, title: ${news.title}, link: ${news.link}`
          );
        }
        urls.push(news.sourceLink!);
        const rawHtmlFile = path.join(rawHtmlDirectory, locale, `${uid}.html`);
        const markdownFile = path.join(markdownRootDirectory, locale, 'google', `${uid}.mdx`);
        if (guids.has(news.guid)) {
          if (locale === 'zh-TW' && urlMap[news.link].locale === 'zh-HK') {
            return;
          }
          throw new Error(`Duplicate guid: ${news.guid} for url: ${news.link}`);
        }
        guids.add(news.sourceLink!);
        urlMap[news.sourceLink!] = {
          news,
          uid,
          locale,
          guid,
          source,
          rawHtmlFile,
          markdownFile,
        };
      })
  );

  await urls.forEachAsync(async (url) => {
    const info = urlMap[url];
    const news = info.news;
    if (!(await exists(info.rawHtmlFile))) {
      return;
    }
    if (await exists(info.markdownFile)) {
      return;
    }
    const googleNewsLabel = googleNewsLabels[info.locale]!;
    const author = news.sourceName ? `${googleNewsLabel}|${news.sourceName}` : googleNewsLabel;
    let source = news.sourceUrl;
    if (source.includes('://')) {
      source = source.split('://').at(-1)!;
    }
    if (source.startsWith('www.')) {
      source = source.substring(4);
    }
    const data = {
      title: news.title,
      uid: info.uid,
      description: news.description,
      locale: info.locale,
      publishedAt: news.pubDate,
      author,
      tags: news.tags,
      source: [
        {
          url: news.link,
          text: googleNewsLabel,
          icon: 'newspaper',
        },
        {
          url: news.sourceLink!,
          text: news.sourceName,
          icon: 'newspaper',
        },
      ],
      meta: [source],
      image: '',
      imageAlt: '',
    };
    const html = (await fs.readFile(info.rawHtmlFile, { encoding: 'utf-8' })).trim();

    if (html && html.length > 0 && /<html/i.test(html) && /<body/i.test(html)) {
      const mdxContent = matter.stringify(
        `\n${fullHtmlToMarkdown(html.trim(), info.rawHtmlFile, news.sourceLink!)}\n`,
        data
      );
      await fs.writeFile(info.markdownFile, mdxContent, { encoding: 'utf-8' });
    } else {
      throw new Error(`Invalid HTML content in ${info.rawHtmlFile} for url: ${url}`);
    }
  });
};

export const download = async () => {
  const items = Object.entries(newsUrls.en as Record<string, NewsUrlItem>)
    .map(([_guid, item]) => item)
    .filter((item) => item.sourceUrl.includes('yahoo'))
    .sort((a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime());
  await items.forEachAsync(async (item) => {
    console.warn(`${new Date(item.pubDate).toISOString().substring(0, 10)} ${item.title}`);
    console.warn(`${item.link}`);
    console.warn('\n');
    const html = await fetchString(item.link);
    const uid = `${item.pubDate.substring(0, 10).replaceAll('-', '')}-google-${item.guid.substring(4, 9).toLowerCase()}${item.guid.substring(item.guid.length - 5).toLowerCase()}-${toUid(item.title)}`;
    const htmlFilePath = path.join(rawHtmlDirectory, `${uid}.html`);
    await fs.writeFile(htmlFilePath, html, { encoding: 'utf-8' });

    const markdownFilePath = path.join(markdownDirectory, `${uid}.mdx`);
    const author = item.sourceName ? `Google News|${item.sourceName}` : 'Google News';
    let source = item.sourceUrl;
    if (source.includes('://')) {
      source = source.split('://').at(-1)!;
    }
    if (source.startsWith('www.')) {
      source = source.substring(4);
    }
    const data = {
      title: item.title,
      uid,
      description: item.description,
      locale: 'en',
      publishedAt: item.pubDate,
      author,
      tags: item.tags,
      source: [
        {
          url: item.link,
          text: item.sourceName,
          icon: 'newspaper',
        },
      ],
      meta: [source],
      image: '',
      imageAlt: '',
    };
    const mdxContent = matter.stringify('', data);
    await fs.writeFile(markdownFilePath, mdxContent, { encoding: 'utf-8' });
  });
};

export const downloadImages = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls.en as Record<string, NewsUrlItem>)
    .filter(([_guid, item]) => item.sourceUrl.includes('yahoo'))
    .sort(([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate));

  for (const [url, news] of entries) {
    const guid = news.guid;
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    uids.add(uid);
  }

  const uidToNewsMap: Record<string, NewsUrlItem> = {};
  entries.forEach(([_url, news]) => {
    const { uid } = getFile(news);
    uidToNewsMap[uid] = news;
  });

  const imagesMapping: Record<string, string> = {};
  const markdownFiles = await readFiles(markdownDirectory, true, '.mdx');
  await markdownFiles.forEachAsync(async (markdownFile) => {
    const updatedMarkdownFile = markdownFile.replace('\\yahoo\\', '\\yahoo2\\');
    if (!overwrite && (await exists(updatedMarkdownFile))) {
      return;
    }

    const mdxContent = (await fs.readFile(markdownFile, { encoding: 'utf8' })).trim();
    const { content: existingMarkdown, data: existingData } = matter(mdxContent, {
      excerpt: false,
    });

    const news = uidToNewsMap[path.parse(markdownFile).name];
    if (!news) {
      throw new Error(`No news found for uid: ${existingData.uid}`);
    }
    if (news.title !== existingData.title) {
      throw new Error(
        `Title mismatch for uid: ${existingData.uid}. Expected: ${news.title}, Found: ${existingData.title}`
      );
    }
    if (existingData.publishedAt !== news.pubDate) {
      throw new Error(
        `PubDate mismatch for uid: ${existingData.uid}. Expected: ${news.pubDate}, Found: ${existingData.publishedAt}`
      );
    }
    if (existingData.uid !== getFile(news).uid) {
      throw new Error(
        `UID mismatch for uid: ${existingData.uid}. Expected: ${getFile(news).uid}, Found: ${existingData.uid}`
      );
    }

    let isUpdated = false;
    let imageIndex = -1;
    const updatedMarkdown = existingMarkdown.replaceAll(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, altText, imageUrl) => {
        imageIndex++;
        const indexSuffix = imageIndex === 0 ? '' : `_${imageIndex.toString(10).padStart(3, '0')}`;
        if (imageUrl && imageUrl.startsWith(markdownImageRootDirectory)) {
          // const processedImageFile = path.parse(imageUrl);
          // if (
          //   !processedImageFile.name.startsWith(existingData.uid) ||
          //   !processedImageFile.name.endsWith(indexSuffix) ||
          //   !processedImageFile.ext.startsWith('.') ||
          //   processedImageFile.ext.length !== 4 ||
          //   processedImageFile.ext !== processedImageFile.ext.toLowerCase()
          // ) {
          //   throw new Error(
          //     `Invalid image file name: ${processedImageFile.name} for news uid: ${existingData.uid}`
          //   );
          // }
          return match;
        }

        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          throw new Error(`Invalid image URL: ${imageUrl} in ${markdownFile}`);
        }
        const exitingImage = imagesMapping[imageUrl];
        if (exitingImage) {
          isUpdated = true;
          return `![${altText}](${exitingImage})`;
        }

        const imageUrlWithoutTitle = imageUrl.split(' "')[0];
        const imageExtension = imageUrlWithoutTitle.includes('format_webp')
          ? '.webp'
          : imageUrlWithoutTitle
              .split('?')[0]
              .substring(imageUrlWithoutTitle.split('?')[0].lastIndexOf('.'))
              .toLocaleLowerCase();
        const formattedImageExtension = imageExtension === '.jpeg' ? '.jpg' : imageExtension;
        if (
          !formattedImageExtension ||
          !formattedImageExtension.startsWith('.') ||
          (formattedImageExtension.length != 4 && formattedImageExtension !== '.webp')
        ) {
          // https://img.i-scmp.com/cdn-cgi/image/fit=contain,width=1024,format=auto/sites/default/files/d8/images/canvas/2021/08/17/c138c65a-f4c8-4d87-97cc-c2ba894612ca_fafb1f5b.jpg
          throw new Error(`Invalid image extension for ${imageUrlWithoutTitle}`);
        }
        const newImageFileName = `${existingData.uid}${indexSuffix}${formattedImageExtension}`;
        const newImageFilePath = path.resolve(imageDirectory, newImageFileName);

        if (overwrite || !fsSync.existsSync(newImageFilePath)) {
          const trimmedImageUrl = imageUrlWithoutTitle
            .replace('-scale.', '.')
            .replace('-scaled.', '.')
            .replace(/-[0-9]+x[0-9]+\./, '.');
          try {
            fetchFileSync(trimmedImageUrl, newImageFilePath);
            console.warn(`Downloaded image ${trimmedImageUrl} to ${newImageFilePath}`);
          } catch (error) {
            if (error instanceof Error && error.message.includes(': 404')) {
              console.warn(`404: ${trimmedImageUrl}`);
            } else {
              console.error(
                `Failed to download image ${trimmedImageUrl} to ${newImageFilePath}:`,
                error
              );
            }
            return match;
          }
        }

        const markdownImageFilePath = `${markdownImageDirectory}${newImageFileName}`;
        imagesMapping[imageUrl] = markdownImageFilePath;
        isUpdated = true;
        return `![${altText ?? news.title}](${markdownImageFilePath})`;
      }
    );

    if (!isUpdated) {
      return;
    }

    await fs.writeFile(
      updatedMarkdownFile,
      matter.stringify(updatedMarkdown, existingData, { excerpt: false }),
      { encoding: 'utf8' }
    );
  });
};

const fullHtmlToMarkdown = (rawHtml: string, rawHtmlFile: string, url: string) => {
  let formattedRawHtml1 = rawHtml.trim();
  while (formattedRawHtml1.startsWith('<!--')) {
    formattedRawHtml1 = formattedRawHtml1
      .substring(formattedRawHtml1.indexOf('-->') + '-->'.length)
      .trim();
  }
  const formattedRawHtml2 =
    formattedRawHtml1.indexOf('<!DOCTYPE html') > 1
      ? `${formattedRawHtml1.substring(0, formattedRawHtml1.indexOf('<!DOCTYPE html'))}${formattedRawHtml1.substring(formattedRawHtml1.indexOf('</html>') + '</html>'.length)}`
      : formattedRawHtml1;
  const match1 = formattedRawHtml2.match(/<body[^>]*>/i)!;
  const match2 = formattedRawHtml2.match(/<\/body>/i)!;
  if (!match1 || !match2 || match1.index === undefined || match2.index === undefined) {
    throw new Error(`Failed to find <body> tags in ${rawHtmlFile}`);
  }
  if (match1.index >= match2.index) {
    throw new Error(`Invalid <body> tag positions in ${rawHtmlFile}`);
  }

  const body = formattedRawHtml2.substring(match1.index + match1[0].length, match2.index).trim();
  if (!body) {
    throw new Error(`Failed to extract body content from ${rawHtmlFile}`);
  }
  const formattedBody = /^<tr/i.test(body) ? `<div><table>${body}</table></div>` : body;
  const $: cheerio.CheerioAPI = cheerio.load(formattedBody, {
    xml: {
      selfClosingTags: true,
      lowerCaseTags: false,
      decodeEntities: false,
      // xmlMode: true,
    },
  });

  $('img').each((_, image) => {
    const $image = $(image);
    if ($image.parent().is('a')) {
      $image.unwrap();
    }

    const source = $image.attr('src');
    if (!source) {
      return;
    }
    if (source.startsWith('http://') || source.startsWith('https://')) {
      // console.warn(`Image source is already an absolute URL: ${source}`);
    } else if (source.startsWith('//')) {
      $image.attr('src', `${url.split('//')[0]}${source}`);
    } else if (source.startsWith('\\"https:\\/\\/') && source.endsWith('\\"')) {
      $image.attr('src', source.slice(2, -2).replace(/\\\//g, '/'));
    } else {
      $image.attr('src', new URL(source, url).toString());
    }
  });

  $('script, style').each((_, element) => {
    const $element = $(element);
    $element.remove();
  });

  // Find and remove all comment nodes in the document
  $('*')
    .contents()
    .each((_, node) => {
      if (node.type.toLowerCase() === 'comment') {
        $(node).remove();
      }
    });

  $('a, p, span, center').each((_, element) => {
    const $element = $(element);
    if ($element.contents().length === 0) {
      $element.remove();
    }
  });

  // $('center').each((_, center) => {
  //   const $center = $(center);
  //   $center.replaceWith($('<div />').html($center.html()!));
  // });
  while (true) {
    const $tables = $('table');
    if ($tables.length === 0) {
      break;
    }

    $tables.each((_, table) => {
      const $table = $(table);
      const $tbody = $table.children('tbody');
      const $rows = $tbody.length > 0 ? $tbody.children('tr') : $table.children('tr');
      $table.replaceWith(
        $rows
          .toArray()
          .map((row) => $(row).children().toArray())
          .flatMap((cells) => cells)
          .map((cell) => $(cell).html())
          .join('\n')
      );
    });
  }

  const trimmedBodyHtml = $.html();
  const markdownContent = htmlToMarkdown.convert(trimmedBodyHtml, {
    listIndentWidth: 4,
    // brInTables: false,
    compactTables: true,
    // preserveTags: [LinkTagName],
    bullets: '-',
    strongEmSymbol: '**',
    extractMetadata: false,
    defaultTitle: false,
    preprocessing: {
      enabled: true,
      preset: htmlToMarkdown.PreprocessingPreset.Minimal,
    },
    skipImages: false,
  });

  return markdownContent.content!.trim();
};

export const shortenTitles = async () => {
  const rawHtmlFiles = await readFiles(rawHtmlDirectory, true, '.html');
  await rawHtmlFiles.forEachAsync(async (rawHtmlFile) => {
    const uid = path.parse(rawHtmlFile).name;
    const uidSegments = uid.split('-');
    const titleUid = uidSegments.slice(3).join('-');
    if (titleUid.length <= maxTitleLength) {
      return;
    }

    const shortenedTitleUid = titleUid.substring(0, maxTitleLength);
    const shortenedUid = toUid(`${uidSegments.slice(0, 3).join('-')}-${shortenedTitleUid}`);
    const shortenedRawHtmlFile = path.join(path.parse(rawHtmlFile).dir, `${shortenedUid}.html`);
    await fs.rename(rawHtmlFile, shortenedRawHtmlFile);
  });

  const markdownFiles = (await readFiles(markdownRootDirectory, true, '.mdx')).filter((file) =>
    file.includes('\\google\\')
  );
  await markdownFiles.forEachAsync(async (markdownFile) => {
    const uid = path.parse(markdownFile).name;
    const uidSegments = uid.split('-');
    const titleUid = uidSegments.slice(3).join('-');
    if (titleUid.length <= maxTitleLength) {
      return;
    }

    const shortenedTitleUid = titleUid.substring(0, maxTitleLength);
    const shortenedUid = toUid(`${uidSegments.slice(0, 3).join('-')}-${shortenedTitleUid}`);
    const shortenedMarkdownFile = path.join(path.parse(markdownFile).dir, `${shortenedUid}.mdx`);
    await fs.rename(markdownFile, shortenedMarkdownFile);

    const { content, data } = matter(
      await fs.readFile(shortenedMarkdownFile, { encoding: 'utf8' }),
      {
        excerpt: false,
      }
    );
    data.uid = shortenedUid;
    await fs.writeFile(shortenedMarkdownFile, matter.stringify(content, data, { excerpt: false }), {
      encoding: 'utf8',
    });
  });
};

import domainNewsUrls from './mpweeklycom-urls.json' with { type: 'json' };

export const updateMarkdownFiles = async (isDryRun = false) => {
  // const domain = 'mpweekly.com';
  // const domainLocale = 'zh-HK';
  // const domainName = 'mpweeklycom';
  // const domainLabel = '明周';
  // const googleDomainNews: Record<string, NewsUrlItem> = {};
  // Object.entries(newsUrls).forEach(([locale, localeUrls]) => {
  //   Object.entries(localeUrls).forEach(([guid, news]) => {
  //     if (news.sourceLinkDecoded.includes(domain)) {
  //       googleDomainNews[news.sourceLinkDecoded] = news;
  //     }
  //   });
  // });
  // console.warn(`Found ${Object.keys(googleDomainNews).length} Google News articles from ${domain}`);

  // const domainNewsUrlsMap: Record<string, string> = {};
  // Object.entries(domainNewsUrls).forEach(([decodedLink, news]) => {
  //   if (domainNewsUrlsMap[news.guid]) {
  //     throw new Error(`Duplicate guid: ${news.guid} for decodedLink: ${decodedLink}`);
  //   }
  //   domainNewsUrlsMap[news.guid] = decodedLink;
  // });
  await (
    await readFiles(markdownRootDirectory, true, '.mdx')
  ).forEachAsync(async (markdownFilePath) => {
    const mdxContent = await fs.readFile(markdownFilePath, { encoding: 'utf8' });
    let { data, content: markdownContent } = matter(mdxContent);
    // if (!data.links) {
    //   // throw new Error(`Unexpected sources or links length in ${markdownFilePath}`);
    //   return;
    // }
    // const guid = data.sources.at(-1).url;
    // const linkDecoded = domainNewsUrlsMap[guid];
    // if (!linkDecoded) {
    //   throw new Error(`No decoded link found for guid: ${guid} in ${markdownFilePath}`);
    // }
    // const news = googleDomainNews[linkDecoded];
    // if (news) {
    //   data.sources.unshift({
    //     url: news.link,
    //     text: `${googleNewsLabels[data.locale]}|${domainLabel}`,
    //     icon: 'newspaper',
    //   });
    //   let uid = toUid(
    //     `${news.pubDate.substring(0, 10).replaceAll('-', '')}-${domainName}-${news.guid.substring(4, 9).toLowerCase()}${news.guid.substring(news.guid.length - 5).toLowerCase()}-${toUid(news.title).substring(0, maxTitleLength)}`
    //   );
    //   const markdownRootDirectory = path.resolve(
    //     currentDirectory,
    //     '../../src/content/contents/news/'
    //   );
    //   let source = news.sourceUrl;
    //   if (source.includes('://')) {
    //     source = source.split('://').at(-1)!;
    //   }
    //   if (source.startsWith('www.')) {
    //     source = source.substring(4);
    //   }
    //   source = source.replaceAll('.', '').replaceAll('-', '').replaceAll('_', '');
    //   uid = toUid(uid.replaceAll(`-${domainName}-`, `-${source}-`));
    //   const rawHtmlFile = path.join(currentDirectory, 'google-raw', domainLocale, `${uid}.html`);
    //   const markdownFile = path.join(markdownRootDirectory, domainLocale, 'google', `${uid}.mdx`);
    //   if (!(await exists(rawHtmlFile)) || !(await exists(markdownFile))) {
    //     throw new Error(
    //       `Raw HTML file or Markdown file does not exist for ${uid}: ${rawHtmlFile}, ${markdownFile}`
    //     );
    //   }
    //   // await fs.rename(rawHtmlFile, rawHtmlFile.replace(domainLocale, `${domainLocale}-delete`));
    //   // await fs.rename(markdownFile, markdownFile.replace('google', 'google-delete'));
    // }

    // data.sources.unshift({
    //   url: linkDecoded,
    //   text: domainLabel,
    //   icon: 'newspaper',
    // });
    // delete data.links;

    // if (!data.meta) {
    //   data.meta = [domain];
    // } else if (!data.meta.includes(domain)) {
    //   data.meta.unshift(domain);
    // }

    // const authors: string[] = data.author.split('|').slice(1);
    // authors
    //   .filter((author) => data.meta.every((meta: string) => !meta.includes(author)))
    //   .forEach((author) => {
    //     data.meta.push(`撰文：${author}`);
    //   });

    // data.author = `Google新聞|${domainLabel}`;
    // let isUpdated = false;
    // [...markdownContent.matchAll(/!\[([^\]]+)\]\([^\)]+\)\n\n/g)].reverse().forEach((match) => {
    //   const text = match[1].trim();
    //   if (
    //     text.length > 0 &&
    //     markdownContent
    //       .substring(match.index! + match[0].length)
    //       .toLowerCase()
    //       .trimStart()
    //       .startsWith(text.toLowerCase() + '\n')
    //   ) {
    //     isUpdated = true;
    //     markdownContent =
    //       markdownContent.substring(0, match.index! + match[0].length).trimEnd() +
    //       '\n*' +
    //       text +
    //       '*\n\n' +
    //       markdownContent.substring(match.index! + match[0].length + text.length).trimStart();
    //   }
    // });
    // if (!isUpdated) return;
    if (!data.uid.endsWith(toUid(data.title))) {
      console.error(`UID does not match title: \n${data.uid}\n${toUid(data.title)}\n\n`);
    }

    const name = path.parse(markdownFilePath).name;
    if (!name.endsWith(data.uid)) {
      console.error(`Markdown file does not match UID: \n${markdownFilePath}\n${data.uid}\n`);
    }

    let isUpdated = false;
    const newsGuid = data.uid.split('-')[2];
    markdownContent = markdownContent.replaceAll(/!\[[^\]]*\]\(([^\)]+)\)/g, (match) => {
      const imagePath = match.match(/^!\[[^\]]*\]\(([^\)]+)\)$/)![1];
      if (imagePath.startsWith('../../../../../assets/')) {
        const imageName = path.parse(imagePath).name;
        const imageNames = imageName.split('-');
        if (imageNames.length > 2) {
          const imageGuid = imageNames[2];
          const imageUid = imageName.replace(/_[0-9]{3}$/, '');
          if (imageGuid === newsGuid && imageUid !== data.uid) {
            const imagePostfix = imageName.substring(imageUid.length);
            const newImage = match.replace(imageUid, data.uid);
            console.log(`Updating image path: \n${match}\n${newImage}\n`);

            const newImagePath = imagePath.replace(imageUid, data.uid);
            const fromFile = path.resolve(
              currentDirectory,
              imagePath.replace('../../../../../assets/', '../../src/assets/')
            );
            const toFile = path.resolve(
              currentDirectory,
              newImagePath.replace('../../../../../assets/', '../../src/assets/')
            );
            if (!fsSync.existsSync(fromFile)) {
              throw new Error(`Source image file does not exist: \n${fromFile}\n`);
            }
            if (fsSync.existsSync(toFile)) {
              throw new Error(`Destination image file already exists: \n${toFile}\n`);
            }
            if (!isDryRun) {
              fsSync.renameSync(fromFile, toFile);
            }
            isUpdated = true;
            return newImage;
          }
        }
      }

      return match;
    });

    if (data.image && data.image.startsWith('../../../../../assets/')) {
      const imageName = path.parse(data.image).name;
      const imageNames = imageName.split('-');
      if (imageNames.length > 2) {
        const imageGuid = imageNames[2];
        const imageUid = imageName.replace(/_[0-9]{3}$/, '');
        if (imageGuid === newsGuid && imageUid !== data.uid) {
          const imagePostfix = imageName.substring(imageUid.length);
          const newImage = data.image.replace(imageUid, data.uid);
          console.log(`Updating image path: \n${data.image}\n${newImage}\n`);

          const fromFile = path.resolve(
            currentDirectory,
            data.image.replace('../../../../../assets/', '../../src/assets/')
          );
          const toFile = path.resolve(
            currentDirectory,
            newImage.replace('../../../../../assets/', '../../src/assets/')
          );
          if (isDryRun) {
            if (!fsSync.existsSync(fromFile)) {
              throw new Error(`Source image file does not exist: \n${fromFile}\n`);
            }
            if (fsSync.existsSync(toFile)) {
              throw new Error(`Destination image file already exists: \n${toFile}\n`);
            }
          } else {
            data.image = newImage;
            isUpdated = true;
          }
        }
      }
    }

    // if (markdownContent.trim().match(/!\[[^\]]*\]\([^\)]+\)$/)) {
    //   console.warn(markdownFilePath);
    // }
    if (!isUpdated || isDryRun) {
      return;
    }
    const updatedMdxContent = matter.stringify('\n' + markdownContent.trim() + '\n', data);
    await fs.copyFile(markdownFilePath, markdownFilePath + '.bak');
    await fs.writeFile(markdownFilePath, updatedMdxContent, { encoding: 'utf8' });
  });
};

export const updateMarkdownImagesWithUid = async (isDryRun = false) => {
  await (
    await readFiles(markdownRootDirectory, true, '.mdx')
  ).forEachAsync(async (markdownFilePath) => {
    const mdxContent = await fs.readFile(markdownFilePath, { encoding: 'utf8' });
    let { data, content: markdownContent } = matter(mdxContent);
    if (!data.uid.endsWith(toUid(data.title))) {
      throw new Error(`UID does not match title: \n${data.uid}\n${toUid(data.title)}\n\n`);
    }

    const name = path.parse(markdownFilePath).name;
    if (!name.endsWith(data.uid)) {
      throw new Error(`Markdown file does not match UID: \n${markdownFilePath}\n${data.uid}\n`);
    }

    let isUpdated = false;
    const newsGuid = data.uid.split('-')[2];
    markdownContent = markdownContent.replaceAll(/!\[[^\]]*\]\(([^\)]+)\)/g, (match) => {
      const imagePath = match.match(/^!\[[^\]]*\]\(([^\)]+)\)$/)![1];
      if (imagePath.startsWith('../../../../../assets/')) {
        const imageName = path.parse(imagePath).name;
        const imageNames = imageName.split('-');
        if (imageNames.length > 2) {
          const imageGuid = imageNames[2];
          const imageUid = imageName.replace(/_[0-9]{3}$/, '');
          if (imageGuid === newsGuid && imageUid !== data.uid) {
            const imagePostfix = imageName.substring(imageUid.length);
            const newImage = match.replace(imageUid, data.uid);
            console.log(`Updating image path: \n${match}\n${newImage}\n`);

            const newImagePath = imagePath.replace(imageUid, data.uid);
            const fromFile = path.resolve(
              currentDirectory,
              imagePath.replace('../../../../../assets/', '../../src/assets/')
            );
            const toFile = path.resolve(
              currentDirectory,
              newImagePath.replace('../../../../../assets/', '../../src/assets/')
            );
            if (!fsSync.existsSync(fromFile)) {
              throw new Error(`Source image file does not exist: \n${fromFile}\n`);
            }
            if (fsSync.existsSync(toFile)) {
              throw new Error(`Destination image file already exists: \n${toFile}\n`);
            }
            if (!isDryRun) {
              fsSync.renameSync(fromFile, toFile);
            }
            isUpdated = true;
            return newImage;
          }
        }
      }

      return match;
    });

    if (data.image && data.image.startsWith('../../../../../assets/')) {
      const imageName = path.parse(data.image).name;
      const imageNames = imageName.split('-');
      if (imageNames.length > 2) {
        const imageGuid = imageNames[2];
        const imageUid = imageName.replace(/_[0-9]{3}$/, '');
        if (imageGuid === newsGuid && imageUid !== data.uid) {
          const imagePostfix = imageName.substring(imageUid.length);
          const newImage = data.image.replace(imageUid, data.uid);
          console.log(`Updating image path: \n${data.image}\n${newImage}\n`);

          const fromFile = path.resolve(
            currentDirectory,
            data.image.replace('../../../../../assets/', '../../src/assets/')
          );
          const toFile = path.resolve(
            currentDirectory,
            newImage.replace('../../../../../assets/', '../../src/assets/')
          );
          if (isDryRun) {
            if (!fsSync.existsSync(fromFile)) {
              throw new Error(`Source image file does not exist: \n${fromFile}\n`);
            }
            if (fsSync.existsSync(toFile)) {
              throw new Error(`Destination image file already exists: \n${toFile}\n`);
            }
          } else {
            data.image = newImage;
            isUpdated = true;
          }
        }
      }
    }

    if (!isUpdated || isDryRun) {
      return;
    }
    const updatedMdxContent = matter.stringify('\n' + markdownContent.trim() + '\n', data);
    await fs.copyFile(markdownFilePath, markdownFilePath + '.bak');
    await fs.writeFile(markdownFilePath, updatedMdxContent, { encoding: 'utf8' });
  });
};