import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, toUid, readFiles, decodeHtml, uidRegex, fetchString } from '../common.ts';
import matter from 'gray-matter';
import newsUrls from './google-urls.json' with { type: 'json' };
import * as cheerio from 'cheerio';
import * as htmlToMarkdown from '@xberg-io/html-to-markdown';

const currentDirectory = import.meta.dirname;
const tagImageDirectory = '../../../../../assets/tags/';

const rawHtmlDirectory = path.join(currentDirectory, 'google-raw');
const trimmedHtmlDirectory = path.join(currentDirectory, 'google-trimmed');
const markdownRootDirectory = path.resolve(currentDirectory, '../../src/content/contents/news/');
const markdownDirectory = (locale: string) =>
  path.resolve(markdownRootDirectory, `${locale}/google`);
const imageRootDirectory = '../../../../../assets/news/';
const imageDirectory = path.resolve(currentDirectory, imageRootDirectory, 'google');
const markdownImageDirectory = `${imageRootDirectory}google/`;

type NewsUrlItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  guid: string;
  tags: string[];
};

const googleNewsLabels: Record<string, string> = {
  en: 'Google News',
  'zh-CN': '谷歌新闻',
  'zh-TW': 'Google新聞',
  'zh-HK': 'Google新聞',
};

const maxTitleLength = 70;

const getFile = (news: NewsUrlItem, locale: string) => {
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
  return {
    uid,
    rawHtmlFile: path.join(rawHtmlDirectory, locale, `${uid}.html`),
    trimmedHtmlFile: path.join(trimmedHtmlDirectory, locale, `${uid}.html`),
    markdownFile: path.join(markdownDirectory(locale), `${uid}.mdx`),
    source,
  };
};

let count = 1;
export const convertHtmlToMarkdown = async (overwrite = false) => {
  await Object.entries(newsUrls).forEachAsync(async ([locale, newsOfLocale]) => {
    await Object.entries(newsOfLocale).forEachAsync(async ([guid, news]) => {
      const { uid, rawHtmlFile, trimmedHtmlFile, markdownFile, source } = getFile(news, locale);
      const domains = ['chinanews.com', 'hk01.com', 'mpweekly.com', 'yahoo.com', 'scmp.com'];
      if (!(await exists(rawHtmlFile))) {
        if (domains.some((domain) => news.sourceUrl.includes(domain))) {
          return;
        }
        // if (await exists(markdownFile.replace('\\google\\', '\\google-error\\'))) {
        //   console.warn(
        //     `${count++}\n${news.sourceLinkDecoded}\n${markdownFile.replace('\\google\\', '\\google-error\\')}\n`
        //   );
        //   return;
        // }
        // if (locale !== 'zh-HK' && locale !== 'zh-TW') {
        //   throw new Error(
        //     `Raw HTML file does not exist for \n${news.sourceLinkDecoded}\n at ${rawHtmlFile}\n\n${uid}.html`
        //   );
        // }
        // try {
        //   const html = (await fetchString(news.sourceLink)).trim();
        //   await fs.writeFile(
        //     rawHtmlFile.replace('zh-HK', 'zh-HK2').replace('zh-TW', 'zh-TW2'),
        //     html,
        //     { encoding: 'utf8' }
        //   );
        // } catch (error) {
        //   await fs.writeFile(
        //     rawHtmlFile.replace('zh-HK', 'zh-HK-error').replace('zh-TW', 'zh-TW-error'),
        //     news.sourceLink,
        //     { encoding: 'utf8' }
        //   );
        // }
        // console.error(
        //   `${count++} ${locale} Raw HTML file does not exist for \n${news.sourceLinkDecoded}\n at ${rawHtmlFile}\n\n${uid}.html`
        // );
      } else {
        // if (locale !== 'en') {
        //   const html = await fs.readFile(rawHtmlFile, { encoding: 'utf8' });
        //   if (!html.includes('的')) {
        //     const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
        //     console.warn(`\n${title}\n${news.sourceLinkDecoded}\n${rawHtmlFile}\n`);
        //   }
        // }
      }

      let bodyHtml: string;
      if (overwrite || !(await exists(trimmedHtmlFile))) {
        const rawHtml = (await fs.readFile(rawHtmlFile, { encoding: 'utf8' })).trim();
        // if (
        //   news.sourceLinkDecoded ===
        //   'http://finance.sina.com.cn/wm/2026-07-02/doc-inifkups3613692.shtml'
        // ) {
        //   debugger;
        // }
        const { bodyHtml: trimmedBodyHtml, bodyText } = trimHtml(
          rawHtml,
          rawHtmlFile,
          news.sourceLinkDecoded
        );
        bodyHtml = trimmedBodyHtml;
        if (!bodyText) {
          console.error(`${count++}\n${news.sourceLinkDecoded}\n${rawHtmlFile}\n`);
        }
        await fs.writeFile(trimmedHtmlFile, bodyHtml, { encoding: 'utf8' });
      } else {
        bodyHtml = (await fs.readFile(trimmedHtmlFile, { encoding: 'utf8' })).trim();
      }

      if (overwrite || !(await exists(markdownFile))) {
        const markdownContent = htmlToMarkdown.convert(bodyHtml, {
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

        const markdown = markdownContent.content!.trim();
        const author = `${googleNewsLabels[locale]}|${news.sourceName}`;
        let source = news.sourceUrl;
        if (source.includes('://')) {
          source = source.split('://').at(-1)!;
        }
        if (source.startsWith('www.')) {
          source = source.substring(4);
        }
        const data = {
          title: news.title,
          uid: uid,
          description: news.description,
          locale: locale,
          publishedAt: news.pubDate,
          author,
          tags: news.tags,
          source: [
            {
              url: news.link,
              text: author,
              icon: 'text-search',
            },
            {
              url: news.sourceLinkDecoded,
              text: news.sourceName,
              icon: 'newspaper',
            },
          ],
          meta: [source],
          image: '',
          imageAlt: '',
        };
        const mdxContent = matter.stringify(markdown, data, { excerpt: true });
        await fs.writeFile(markdownFile, mdxContent, { encoding: 'utf8' });
      }
    });
  });
};

export const updateMarkdownFiles = async (locale: string) => {
  const files = await readFiles(markdownDirectory(locale), true, '.mdx');
  await files.forEachAsync(async (file) => {
    const fileContent = await fs.readFile(file, { encoding: 'utf8' });
    const { data, content } = matter(fileContent);
    // const matches = [...content.matchAll(/\n+!\[([^\]]+)\]\([^\)]+\)/g)];
    // matches.forEach((match) => {
    //   const tail = content.substring(0, match.index);
    //   const alt = match[1];
    //   if (tail.endsWith(alt)) {
    //     console.warn(file);
    //     console.warn(`Tail starts with alt substring: ${alt}`);
    //   }
    // });
    // const updatedContent = content.replaceAll(/!\[\]\(([^)]+)\)/g, (match, source) => {
    //   if (data.title.includes('[')) {
    //     throw new Error(`Title contains '[': ${data.title} for file: ${file}`);
    //   }
    //   return `![${data.title}](${source})`;
    // });

    // const author = data.meta.filter(
    //   (meta: string) => meta.includes('文：') || meta.startsWith('者：')
    // );
    // if (author.length > 0) {
    //   data.author += `|${author[0].split('：').at(-1)!.trim()}`;
    // }
    const updatedContent = `\n${content.trim()}\n`;
    const match = updatedContent.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (!match || match.length < 3) {
      if (!data.tags || data.tags.length === 0) {
        throw new Error(`No image found and no tags for ${file}`);
      }

      const guid = data.uid.split('-')[2];
      //const index = parseInt(guid.substring(guid.length - 1), 10);
      const index =
        Array.from({ length: guid.length }, (_, index) => index)
          .map((index) => guid[index].toLowerCase().charCodeAt(0) - 96)
          .reduce((acc, curr) => acc + curr, 0) % 10;
      const indexSuffix = index === 0 ? '' : `_${index.toString(10)}`;
      const tagMapping: Record<string, string> = {
        Beyond: 'beyond',
        'Wong Ka Kui': '黃家駒',
        'Yip Sai Wing': '葉世榮',
        'Wong Ka Keung': '黃家強',
        'Paul Wong': '黃貫中',
      };
      let fromTag: string | undefined = undefined;
      let toTag: string | undefined = undefined;
      for (const tag of Object.keys(tagMapping)) {
        if (data.tags.includes(tag)) {
          fromTag = tag;
          toTag = tagMapping[tag];
          break;
        }
      }
      if (!toTag || !fromTag) {
        throw new Error(`No image found and no matching tags for ${file}`);
      }
      data.image = `${tagImageDirectory}${toTag}${indexSuffix}.jpg`;
      data.imageAlt = fromTag;
    } else {
      const imageAlt = match[1].trim();
      const imageUrl = match[2].trim();
      if (!imageAlt || !imageUrl) {
        throw new Error(`Invalid image markdown in ${file}: ${match[0]}`);
      }
      data.image = imageUrl;
      if (!data.imageAlt || data.imageAlt.trim() === '') {
        data.imageAlt = imageAlt;
      }
    }

    //data.uid = data.uid.toLowerCase();

    const newFileContent = matter.stringify(updatedContent, data);
    await fs.writeFile(file.replace('yahoo', 'yahoo2').toLowerCase(), newFileContent, {
      encoding: 'utf8',
    });
  });
};

const trimHtml = (rawHtml: string, rawHtmlFile: string, url: string) => {
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

  $('img, IMG').each((_, image) => {
    const $image = $(image);
    if ($image.parent().is('a')) {
      $image.unwrap();
    }

    const source = $image.attr('src')?.trim();
    if (!source || source.startsWith('data:') || source.startsWith('blob:')) {
      $image.remove();
      return;
    }
    if (source.startsWith('\\"https:\\/\\/') && source.endsWith('\\"')) {
      $image.attr('src', source.slice(2, -2).replace(/\\\//g, '/'));
    }
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return;
    }

    $image.attr('src', new URL(source, url).toString());
  });

  $('style, STYLE').each((_, element) => {
    const $element = $(element);
    $element.remove();
  });

  if (!url.includes('sina.com.cn')) {
    $('script, SCRIPT').each((_, element) => {
      const $element = $(element);
      $element.remove();
    });
  }

  // Find and remove all comment nodes in the document
  $('*')
    .contents()
    .each((_, node) => {
      if (node.type.toLowerCase() === 'comment') {
        $(node).remove();
      }
    });

  $('a, p, span, center, div, A, P, SPAN, CENTER, DIV').each((_, element) => {
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
    const $tables = $('table, TABLE');
    if ($tables.length === 0) {
      break;
    }

    $tables.each((_, table) => {
      const $table = $(table);
      const $tbody = $table.children('tbody, TBODY');
      const $rows = $tbody.length > 0 ? $tbody.children('tr, TR') : $table.children('tr, TR');
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

  $('a, A').each((_, link) => {
    const $link = $(link);
    $link.replaceWith($link.contents());
  });

  if ($('a, A').length > 0) {
    throw new Error(`There are still <a> tags in the document after processing ${rawHtmlFile}`);
  }

  if ($('table, TABLE').length > 0) {
    throw new Error(`There are still <table> tags in the document after processing ${rawHtmlFile}`);
  }

  $('img, IMG').each((_index, image) => {
    const $image = $(image);
    const source = $image.attr('src')?.trim();
    if (!source || (!source.startsWith('http://') && !source.startsWith('https://'))) {
      throw new Error(`Invalid image source URL: ${source} in ${rawHtmlFile}`);
    }
  });

  $('p, P').each((_, paragraph) => {
    const $paragraph = $(paragraph);
    $paragraph.contents().each((_, node) => {
      if (node.type.toLowerCase() === 'text') {
        const $text = $(node);
        const text = $text.text();
        if (text.includes('\n')) {
          $(node).replaceWith(text.replaceAll('\n', ''));
        }
      }
    });
  });

  const trimmedBodyHtml = $.html().trim();
  return {
    bodyHtml: trimmedBodyHtml,
    bodyText: $.text().trim(),
  };
};
