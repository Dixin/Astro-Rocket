import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, toUid, toFileName, downloadFile, readFiles } from '../common.ts';
import matter from 'gray-matter';
import { setTimeout } from 'timers/promises';
import newsUrls from './china-urls.json' with { type: 'json' };
import * as cheerio from 'cheerio';
import * as htmlToMarkdown from '@xberg-io/html-to-markdown';
// import TurndownService from '@joplin/turndown';
// import { gfm } from 'turndown-plugin-gfm';
// import { gfm } from '@joplin/turndown-plugin-gfm';

const currentDirectory = import.meta.dirname;
const rawHtmlDirectory = path.join(currentDirectory, 'china-raw');
const trimmedHtmlDirectory = path.join(currentDirectory, 'china-trimmed');
const markdownDirectory = path.resolve(
  currentDirectory,
  '../../src/content/contents/news/zh-CN/china'
);
const imageDirectory = path.resolve(currentDirectory, '../../src/assets/news/china');
const markdownImageDirectory = '../../../../../assets/news/china/';

type NewsUrlItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  guid: string;
  image: string;
  imageAlt: string;
  tags: string[];
  uid: string;
};

const getFile = (news: NewsUrlItem) => {
  const uid = `${news.pubDate.substring(0, 10).replaceAll('-', '')}-chinanews-${news.guid.substring(4)}-${toUid(news.title)}`;

  return {
    uid,
    raw: path.join(rawHtmlDirectory, `${uid}.html`),
    trimmed: path.join(trimmedHtmlDirectory, `${uid}.html`),
    markdown: path.join(markdownDirectory, `${uid}.mdx`),
  };
};

export const downloadHtmlFiles = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    if (!news.guid.startsWith('4-8-')) {
      throw new Error(`Invalid guid: ${news.guid} for url: ${url}`);
    }
    const guid = news.guid.substring(4);
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    if (uid !== news.uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${url}, expected: ${news.uid}`);
    }
    uids.add(uid);
  }

  await entries.forEachAsync(async ([url, news]) => {
    const { uid, raw: rawHtmlFilePath } = getFile(news);
    if (!overwrite && (await exists(rawHtmlFilePath))) {
      // console.warn(`File already exists, skipping: ${rawHtmlFilePath}`);
      return;
    }

    await downloadFile(url, rawHtmlFilePath);
    console.warn(`Downloaded ${url} to ${rawHtmlFilePath}`);
  });
};

export const convertHtmlFiles = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    if (!news.guid.startsWith('4-8-')) {
      throw new Error(`Invalid guid: ${news.guid} for url: ${url}`);
    }
    const guid = news.guid.substring(4);
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    if (uid !== news.uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${url}, expected: ${news.uid}`);
    }
    uids.add(uid);
  }

  await entries.forEachAsync(async ([_url, news]) => {
    const { uid, raw, trimmed, markdown } = getFile(news);
    // const buffer = fs2.readFileSync(raw);
    // const decodedString = Iconv.decode(buffer, 'gb2312');

    // await fs.rename(raw, raw + '.bak');
    // await fs.writeFile(raw, decodedString, { encoding: 'utf8' });

    // if (!overwrite && (await exists(trimmed))) {
    //   console.warn(`File already exists, skipping: ${trimmed}`);
    //   return;
    // }

    if ((await exists(markdown)) || (await exists(markdown.replace('\\china\\', '\\china2\\')))) {
      return;
    }

    const rawHtml = await fs.readFile(raw, { encoding: 'utf8' });
    const formattedRawHtml1 = rawHtml.startsWith('<!--')
      ? rawHtml.substring(rawHtml.indexOf('-->') + '-->'.length).trim()
      : rawHtml;
    const formattedRawHtml2 =
      formattedRawHtml1.indexOf('<!DOCTYPE html') > 1
        ? `${formattedRawHtml1.substring(0, formattedRawHtml1.indexOf('<!DOCTYPE html'))}${formattedRawHtml1.substring(formattedRawHtml1.indexOf('</html>') + '</html>'.length)}`
        : formattedRawHtml1;
    const match1 = formattedRawHtml2.match(/<body[^>]*>/)!;
    const match2 = formattedRawHtml2.match(/<\/body>/)!;
    if (!match1 || !match2 || match1.index === undefined || match2.index === undefined) {
      throw new Error(`Failed to find <body> tags in ${raw}`);
    }
    if (match1.index >= match2.index) {
      throw new Error(`Invalid <body> tag positions in ${raw}`);
    }

    const body = formattedRawHtml2.substring(match1.index + match1[0].length, match2.index).trim();
    if (!body) {
      throw new Error(`Failed to extract body content from ${raw}`);
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
        console.warn(`Image source is already an absolute URL: ${source}`);
      } else if (source.startsWith('/')) {
        $image.attr('src', `https://www.chinanews.com${source}`);
      } else {
        $image.attr('src', news.link.replace(/\/[^/]*$/, '/') + source);
      }

      if (!$image.attr('alt')) {
        $image.attr('alt', news.title);
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
        if (node.type === 'comment') {
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
    // var markdownContent = turndownService.turndown(bodyHtml);
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

    const [year, month, day, hours, minutes, seconds] = news.pubDate.split(/[- :]/);
    const data: {
      title: string;
      uid: string;
      description: string;
      locale: string;
      // image: string;
      // imageAlt: string;
      publishedAt: string;
      author: string;
      links: { url: string; text: string; icon: string }[];
      sources: { url: string; text: string; icon: string }[];
      tags: string[];
      // lastModifiedTime?: string;
    } = {
      title: news.title,
      uid: uid,
      description: news.description,
      locale: 'zh-CN',
      publishedAt: new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        parseInt(seconds)
      ).toISOString(),
      author: '中国新闻网',
      tags: news.tags,
      links: [
        {
          url: news.link,
          text: '中国新闻网',
          icon: 'newspaper',
        },
      ],
      sources: [
        {
          url: news.link,
          text: '中国新闻网',
          icon: 'newspaper',
        },
      ],
    };

    const mdxContent = matter.stringify('\n' + markdownContent.content!.trim() + '\n', data);

    await fs.writeFile(markdown.replace('\\china\\', '\\china3\\'), mdxContent, {
      encoding: 'utf8',
    });
  });
};

export const downloadPaginationHtmlFiles = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    if (!news.guid.startsWith('4-8-')) {
      throw new Error(`Invalid guid: ${news.guid} for url: ${url}`);
    }
    const guid = news.guid.substring(4);
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    if (uid !== news.uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${url}, expected: ${news.uid}`);
    }
    uids.add(uid);
  }

  await entries.forEachAsync(async ([_url, news]) => {
    const { uid, raw, trimmed, markdown } = getFile(news);

    const markdownFileContent = await fs.readFile(markdown, { encoding: 'utf8' });
    const { content: existingMarkdown, data: existingData } = matter(markdownFileContent, {
      excerpt: false,
    });
    const existingMarkdownLines = existingMarkdown
      .split('\n')
      .filter((line) => line.includes('[下一页]('));
    if (existingMarkdownLines.length === 0) {
      return;
    }

    const existingMarkdownLine = existingMarkdownLines[0]
      .substring(1)
      .replace(/\[下一页\]\([^)]+\)$/, '')
      .trim();

    if (!existingMarkdownLine.startsWith('[2](') || !existingMarkdownLine.endsWith(')')) {
      throw new Error(`Invalid existing markdown line: ${existingMarkdownLine}`);
    }

    const matches = [...existingMarkdownLine.matchAll(/\[([0-9]+)\]\(([^)]+)\)/g)];
    await matches.forEachAsync(async (match) => {
      const index = match[1];
      const link = match[2];
      const additionalUid = `${uid}^${index}`;
      const additionalUrl = new URL(link, news.link).href;
      const additionalRawHtmlFilePath = path.join(rawHtmlDirectory, `${additionalUid}.html`);
      if (!overwrite && (await exists(additionalRawHtmlFilePath))) {
        console.warn(`File already exists, skipping: ${additionalRawHtmlFilePath}`);
        return;
      }
      await downloadFile(additionalUrl, additionalRawHtmlFilePath);
      console.warn(`Downloaded ${additionalUrl} to ${additionalRawHtmlFilePath}`);
    });
  });
};

export const convertPaginationHtmlFiles = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    if (!news.guid.startsWith('4-8-')) {
      throw new Error(`Invalid guid: ${news.guid} for url: ${url}`);
    }
    const guid = news.guid.substring(4);
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    if (uid !== news.uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${url}, expected: ${news.uid}`);
    }
    uids.add(uid);
  }

  const uidToNewsMap = new Map<string, NewsUrlItem>();
  entries.forEach(([_url, news]) => {
    const { uid } = getFile(news);
    uidToNewsMap.set(uid, news);
  });
  const rawHtmlFiles = (
    await readFiles(rawHtmlDirectory.replace('\\china-raw', '\\china-raw2'), true, '.html')
  ).filter((file) => path.parse(file).name.includes('^'));
  await rawHtmlFiles.forEachAsync(async (raw) => {
    const name = path.parse(raw).name;
    const [uid, index] = name.split('^');
    const news = uidToNewsMap.get(uid);
    if (!news) {
      throw new Error(`No news found for uid: ${uid}`);
    }
    const markdown = path.join(markdownDirectory, `${name}.mdx`).replace('\\china\\', '\\china2\\');

    if ((await exists(markdown)) || (await exists(markdown.replace('\\china\\', '\\china2\\')))) {
      return;
    }

    const rawHtml = await fs.readFile(raw, { encoding: 'utf8' });
    const formattedRawHtml1 = rawHtml.startsWith('<!--')
      ? rawHtml.substring(rawHtml.indexOf('-->') + '-->'.length).trim()
      : rawHtml;
    const formattedRawHtml2 =
      formattedRawHtml1.indexOf('<!DOCTYPE html') > 1
        ? `${formattedRawHtml1.substring(0, formattedRawHtml1.indexOf('<!DOCTYPE html'))}${formattedRawHtml1.substring(formattedRawHtml1.indexOf('</html>') + '</html>'.length)}`
        : formattedRawHtml1;
    const match1 = formattedRawHtml2.match(/<body[^>]*>/)!;
    const match2 = formattedRawHtml2.match(/<\/body>/)!;
    if (!match1 || !match2 || match1.index === undefined || match2.index === undefined) {
      throw new Error(`Failed to find <body> tags in ${raw}`);
    }
    if (match1.index >= match2.index) {
      throw new Error(`Invalid <body> tag positions in ${raw}`);
    }

    const body = formattedRawHtml2.substring(match1.index + match1[0].length, match2.index).trim();
    if (!body) {
      throw new Error(`Failed to extract body content from ${raw}`);
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
        console.warn(`Image source is already an absolute URL: ${source}`);
      } else if (source.startsWith('/')) {
        $image.attr('src', `https://www.chinanews.com${source}`);
      } else {
        $image.attr('src', news.link.replace(/\/[^/]*$/, '/') + source);
      }

      if (!$image.attr('alt')) {
        $image.attr('alt', news.title);
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
        if (node.type === 'comment') {
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
    // var markdownContent = turndownService.turndown(bodyHtml);
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

    const [year, month, day, hours, minutes, seconds] = news.pubDate.split(/[- :]/);
    const data: {
      title: string;
      uid: string;
      description: string;
      locale: string;
      // image: string;
      // imageAlt: string;
      publishedAt: string;
      author: string;
      links: { url: string; text: string; icon: string }[];
      sources: { url: string; text: string; icon: string }[];
      tags: string[];
      // lastModifiedTime?: string;
    } = {
      title: news.title,
      uid: uid,
      description: news.description,
      locale: 'zh-CN',
      publishedAt: new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        parseInt(seconds)
      ).toISOString(),
      author: '中国新闻网',
      tags: news.tags,
      links: [
        {
          url: news.link,
          text: '中国新闻网',
          icon: 'newspaper',
        },
      ],
      sources: [
        {
          url: news.link,
          text: '中国新闻网',
          icon: 'newspaper',
        },
      ],
    };

    const mdxContent = matter.stringify('\n' + markdownContent.content!.trim() + '\n', data);

    await fs.writeFile(markdown.replace('\\china\\', '\\china2\\'), mdxContent, {
      encoding: 'utf8',
    });
  });
};

export const convertPaginationHtmlFiles2 = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    if (!news.guid.startsWith('4-8-')) {
      throw new Error(`Invalid guid: ${news.guid} for url: ${url}`);
    }
    const guid = news.guid.substring(4);
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    if (uid !== news.uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${url}, expected: ${news.uid}`);
    }
    uids.add(uid);
  }

  const uidToNewsMap = new Map<string, NewsUrlItem>();
  entries.forEach(([_url, news]) => {
    const { uid } = getFile(news);
    uidToNewsMap.set(uid, news);
  });
  const markdownFiles = (
    await readFiles(markdownDirectory.replace('\\china', '\\china2'), true, '.mdx')
  ).filter((file) => path.parse(file).name.includes('^'));
  await markdownFiles.forEachAsync(async (markdownFile) => {
    const markdownContent = await fs.readFile(markdownFile, { encoding: 'utf8' });
    const { content: existingMarkdown, data: existingData } = matter(markdownContent, {
      excerpt: false,
    });
    const existingMarkdownLines = existingMarkdown.split('\n');
    let startIndex = 0;
    let endIndex = 0;
    for (let i = 0; i < existingMarkdownLines.length; i++) {
      if (/!\[.+\]\(.+ "点图查看下一页"\)/.test(existingMarkdownLines[i])) {
        startIndex = i;
      }
      if (existingMarkdownLines[i].startsWith('[上一页](')) {
        endIndex = i;
      }
    }

    if (startIndex === 0 || endIndex === 0 || startIndex >= endIndex) {
      throw new Error(`Invalid existing markdown lines in ${markdownFile}`);
    }

    const trimmedMarkdownLines = existingMarkdownLines.slice(startIndex, endIndex);

    await fs.writeFile(
      markdownFile.replace('\\china2\\', '\\china3\\'),
      trimmedMarkdownLines.join('\n'),
      { encoding: 'utf8' }
    );
  });
};

export const convertPaginationHtmlFiles3 = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    if (!news.guid.startsWith('4-8-')) {
      throw new Error(`Invalid guid: ${news.guid} for url: ${url}`);
    }
    const guid = news.guid.substring(4);
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    if (uid !== news.uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${url}, expected: ${news.uid}`);
    }
    uids.add(uid);
  }

  const uidToNewsMap = new Map<string, NewsUrlItem>();
  entries.forEach(([_url, news]) => {
    const { uid } = getFile(news);
    uidToNewsMap.set(uid, news);
  });
  const markdownFiles = (
    await readFiles(markdownDirectory.replace('\\china', '\\china3'), true, '.mdx')
  ).filter((file) => path.parse(file).name.includes('^'));
  await markdownFiles.forEachAsync(async (markdownFile) => {
    const markdownContent = await fs.readFile(markdownFile, { encoding: 'utf8' });

    const originalMarkdownFile = markdownFile
      .replace('\\china3\\', '\\china\\')
      .replace(/\^[0-9]+/, '');

    const copyOfOriginalMarkdownFile = originalMarkdownFile.replace('\\china\\', '\\china4\\');
    if (!(await exists(copyOfOriginalMarkdownFile))) {
      await fs.copyFile(originalMarkdownFile, copyOfOriginalMarkdownFile);
    }
    await fs.appendFile(
      copyOfOriginalMarkdownFile,
      `\n\n===\n\n${markdownContent.trim()}\n\n===\n\n`,
      {
        encoding: 'utf8',
      }
    );
  });
};

export const convertPaginationHtmlFiles4 = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    if (!news.guid.startsWith('4-8-')) {
      throw new Error(`Invalid guid: ${news.guid} for url: ${url}`);
    }
    const guid = news.guid.substring(4);
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    if (uid !== news.uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${url}, expected: ${news.uid}`);
    }
    uids.add(uid);
  }

  const uidToNewsMap = new Map<string, NewsUrlItem>();
  entries.forEach(([_url, news]) => {
    const { uid } = getFile(news);
    uidToNewsMap.set(uid, news);
  });
  const markdownFiles = await readFiles(
    markdownDirectory.replace('\\china', '\\china4'),
    true,
    '.mdx'
  );
  await markdownFiles.forEachAsync(async (markdownFile) => {
    const originalMarkdownFile = markdownFile.replace('\\china4\\', '\\china\\');

    await fs.rename(originalMarkdownFile, originalMarkdownFile + '.bak');
    await fs.copyFile(markdownFile, originalMarkdownFile);
  });
};

export const convertPaginationHtmlFiles5 = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    if (!news.guid.startsWith('4-8-')) {
      throw new Error(`Invalid guid: ${news.guid} for url: ${url}`);
    }
    const guid = news.guid.substring(4);
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    if (uid !== news.uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${url}, expected: ${news.uid}`);
    }
    uids.add(uid);
  }

  const uidToNewsMap = new Map<string, NewsUrlItem>();
  entries.forEach(([_url, news]) => {
    const { uid } = getFile(news);
    uidToNewsMap.set(uid, news);
  });
  const markdownFiles = await readFiles(markdownDirectory, true, '.mdx');
  await markdownFiles.forEachAsync(async (markdownFile) => {
    const newMarkdownFile = markdownFile.replace('\\china\\', '\\china2\\');
    if (await exists(newMarkdownFile)) {
      return;
    }
    const markdownContent = await fs.readFile(markdownFile, { encoding: 'utf8' });
    const { content: existingMarkdown, data: existingData } = matter(markdownContent, {
      excerpt: false,
    });

    if (existingMarkdown.includes('\n编辑：')) {
      return;
    }

    const rawHtmlFile = markdownFile
      .replace(markdownDirectory, rawHtmlDirectory)
      .replace('.mdx', '.html');

    const rawHtml = (await fs.readFile(rawHtmlFile, { encoding: 'utf8' })).trim();

    const formattedRawHtml1 = rawHtml.startsWith('<!--')
      ? rawHtml.substring(rawHtml.indexOf('-->') + '-->'.length).trim()
      : rawHtml;
    const formattedRawHtml2 =
      formattedRawHtml1.indexOf('<!DOCTYPE html') > 1
        ? `${formattedRawHtml1.substring(0, formattedRawHtml1.indexOf('<!DOCTYPE html'))}${formattedRawHtml1.substring(formattedRawHtml1.indexOf('</html>') + '</html>'.length)}`
        : formattedRawHtml1;
    const match1 = formattedRawHtml2.match(/<body[^>]*>/)!;
    const match2 = formattedRawHtml2.match(/<\/body>/)!;
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
    });

    $('script, style').each((_, element) => {
      const $element = $(element);
      $element.remove();
    });

    // Find and remove all comment nodes in the document
    $('*')
      .contents()
      .each((_, node) => {
        if (node.type === 'comment') {
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

    if (!trimmedBodyHtml.includes('编辑')) {
      return;
    }

    let editor = $('.left_name:contains("编辑")')
      .find('a')
      .remove()
      .end()
      .last()
      .text()
      .trim()
      .replace('【', '')
      .replace('】', '')
      .replace(':', '：');
    if (!editor) {
      editor = $('.fdr:contains("编辑")')
        .last()
        .text()
        .trim()
        .replace('【', '')
        .replace('】', '')
        .replace(':', '：');
    }
    if (!editor) {
      editor = $('[align="right"]:contains("编辑")')
        .last()
        .text()
        .trim()
        .replace('【', '')
        .replace('】', '')
        .replace(':', '：');
    }
    if (!editor) {
      editor = $('#editor:contains("编辑")')
        .last()
        .text()
        .trim()
        .replace('【', '')
        .replace('】', '')
        .replace(':', '：');
    }
    if (!editor) {
      editor = $('span[style="font-size: 12px"]:contains("编辑")')
        .last()
        .text()
        .trim()
        .replace('【', '')
        .replace('】', '')
        .replace(':', '：');
    }
    if (!editor) {
      editor = $('.13v:contains("编辑")')
        .last()
        .text()
        .trim()
        .replace('【', '')
        .replace('】', '')
        .replace(':', '：');
    }
    if (!editor) {
      editor = $('.Submit_time span:contains("编辑")')
        .last()
        .text()
        .trim()
        .replace('【', '')
        .replace('】', '')
        .replace(':', '：');
    }
    if (!editor) {
      editor = $('#editor_baidu:contains("编辑")')
        .last()
        .text()
        .trim()
        .replace('【', '')
        .replace('】', '')
        .replace(':', '：');
    }
    if (!editor) {
      throw new Error(`Failed to extract editor from ${rawHtmlFile}`);
    }

    await fs.copyFile(markdownFile, newMarkdownFile);
    await fs.appendFile(newMarkdownFile, `\n\n${editor.replace('责任编辑', '编辑').trim()}\n`, {
      encoding: 'utf8',
    });
  });
};

export const convertPaginationHtmlFiles6 = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    if (!news.guid.startsWith('4-8-')) {
      throw new Error(`Invalid guid: ${news.guid} for url: ${url}`);
    }
    const guid = news.guid.substring(4);
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    if (uid !== news.uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${url}, expected: ${news.uid}`);
    }
    uids.add(uid);
  }

  const uidToNewsMap = new Map<string, NewsUrlItem>();
  entries.forEach(([_url, news]) => {
    const { uid } = getFile(news);
    uidToNewsMap.set(uid, news);
  });
  const markdownFiles = await readFiles(markdownDirectory, true, '.mdx');
  await markdownFiles.forEachAsync(async (markdownFile) => {
    const newMarkdownFile = markdownFile.replace('\\china\\', '\\china2\\');
    if (await exists(newMarkdownFile)) {
      return;
    }
    const markdownContent = await fs.readFile(markdownFile, { encoding: 'utf8' });
    const { content: existingMarkdown, data: existingData } = matter(markdownContent, {
      excerpt: false,
    });

    if (existingMarkdown.includes('\n来源：')) {
      return;
    }

    const rawHtmlFile = markdownFile
      .replace(markdownDirectory, rawHtmlDirectory)
      .replace('.mdx', '.html');

    const rawHtml = (await fs.readFile(rawHtmlFile, { encoding: 'utf8' })).trim();

    const formattedRawHtml1 = rawHtml.startsWith('<!--')
      ? rawHtml.substring(rawHtml.indexOf('-->') + '-->'.length).trim()
      : rawHtml;
    const formattedRawHtml2 =
      formattedRawHtml1.indexOf('<!DOCTYPE html') > 1
        ? `${formattedRawHtml1.substring(0, formattedRawHtml1.indexOf('<!DOCTYPE html'))}${formattedRawHtml1.substring(formattedRawHtml1.indexOf('</html>') + '</html>'.length)}`
        : formattedRawHtml1;
    const match1 = formattedRawHtml2.match(/<body[^>]*>/)!;
    const match2 = formattedRawHtml2.match(/<\/body>/)!;
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
    });

    $('script, style').each((_, element) => {
      const $element = $(element);
      $element.remove();
    });

    // Find and remove all comment nodes in the document
    $('*')
      .contents()
      .each((_, node) => {
        if (node.type === 'comment') {
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

    if (!/[\s>]来源：/.test(trimmedBodyHtml)) {
      return;
    }

    let source = $('#source_baidu:contains("来源：")')
      .find('a')
      .remove()
      .end()
      .last()
      .text()
      .trim()
      .replace('【', '')
      .replace('】', '')
      .replace(':', '：');
    if (!source) {
      source = $('.Submit_time span:contains("来源：")')
        .find('a')
        .remove()
        .end()
        .last()
        .text()
        .trim()
        .replace('【', '')
        .replace('】', '')
        .replace(':', '：');
    }
    if (!source) {
      const match = trimmedBodyHtml.match(/[\s](来源：[^<\s]+)/);
      source =
        match?.length === 2
          ? match[1].trim().replace('【', '').replace('】', '').replace(':', '：')
          : '';
    }
    if (!source) {
      const match = trimmedBodyHtml.match(/[\s]来源：<a [^>]+>([^<]+)<\/a>/);
      source =
        match?.length === 2
          ? '来源：' + match[1].trim().replace('【', '').replace('】', '').replace(':', '：')
          : '';
    }

    if (!source || !source.startsWith('来源：')) {
      throw new Error(`Failed to extract source from ${rawHtmlFile}`);
    }

    await fs.copyFile(markdownFile, newMarkdownFile);
    const content = await fs.readFile(newMarkdownFile, { encoding: 'utf8' });
    const newContent = content.replace(/\n---\n/, `\n---\n\n${source.trim()}\n\n`);
    await fs.writeFile(newMarkdownFile, newContent, {
      encoding: 'utf8',
    });
  });
};

export const syncUrlsToMarkdowns = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    if (!news.guid.startsWith('4-8-')) {
      throw new Error(`Invalid guid: ${news.guid} for url: ${url}`);
    }
    const guid = news.guid.substring(4);
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    if (news.title.includes('图')) {
      console.warn(`News title contains '图': ${news.title} for url: ${url}`);
    }

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    if (uid !== news.uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${url}, expected: ${news.uid}`);
    }
    uids.add(uid);
  }

  const uidToNewsMap: Record<string, NewsUrlItem> = {};
  entries.forEach(([_url, news]) => {
    const { uid } = getFile(news);
    if (news.uid !== uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${news.link}, expected: ${news.uid}`);
    }
    uidToNewsMap[uid] = news;
  });
  const markdownFiles = await readFiles(markdownDirectory, true, '.mdx');
  await markdownFiles.forEachAsync(async (markdownFile) => {
    const mdxContent = (await fs.readFile(markdownFile, { encoding: 'utf8' })).trim();
    const { content: existingMarkdown, data: existingData } = matter(mdxContent, {
      excerpt: false,
    });

    const news = uidToNewsMap[path.parse(markdownFile).name];
    if (!news) {
      throw new Error(`No news found for uid: ${existingData.uid}`);
    }

    if (news.uid !== existingData.uid) {
      throw new Error(
        `UID mismatch: ${existingData.uid} for url: ${news.link}, expected: ${news.uid}`
      );
    }

    existingData.title = news.title.replaceAll(/Beyond/gi, 'Beyond').trim();
    existingData.description = news.description.replaceAll(/Beyond/gi, 'Beyond').trim();

    await fs.writeFile(
      markdownFile,
      matter.stringify(existingMarkdown.trim(), existingData, { excerpt: false }),
      { encoding: 'utf8' }
    );
  });
};

export const downloadImages = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    if (!news.guid.startsWith('4-8-')) {
      throw new Error(`Invalid guid: ${news.guid} for url: ${url}`);
    }
    const guid = news.guid.substring(4);
    if (guids.has(guid)) {
      throw new Error(`Duplicate guid: ${guid} for url: ${url}`);
    }
    guids.add(guid);

    if (news.title.includes('图')) {
      console.warn(`News title contains '图': ${news.title} for url: ${url}`);
    }

    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    if (uid !== news.uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${url}, expected: ${news.uid}`);
    }
    uids.add(uid);
  }

  const uidToNewsMap: Record<string, NewsUrlItem> = {};
  entries.forEach(([_url, news]) => {
    const { uid } = getFile(news);
    if (news.uid !== uid) {
      throw new Error(`UID mismatch: ${uid} for url: ${news.link}, expected: ${news.uid}`);
    }
    uidToNewsMap[uid] = news;
  });

  const imagesMapping: Record<string, string> = {};
  const markdownFiles = await readFiles(markdownDirectory, true, '.mdx');
  await markdownFiles.forEachAsync(async (markdownFile) => {
    const mdxContent = (await fs.readFile(markdownFile, { encoding: 'utf8' })).trim();
    const { content: existingMarkdown, data: existingData } = matter(mdxContent, {
      excerpt: false,
    });

    const news = uidToNewsMap[path.parse(markdownFile).name];
    if (!news) {
      throw new Error(`No news found for uid: ${existingData.uid}`);
    }

    if (news.uid !== existingData.uid) {
      throw new Error(
        `UID mismatch: ${existingData.uid} for url: ${news.link}, expected: ${news.uid}`
      );
    }

    let isUpdated = false;
    let imageIndex = -1;
    const updatedMarkdown = existingMarkdown.replaceAll(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, altText, imageUrl) => {
        imageIndex++;
        const indexSuffix = imageIndex === 0 ? '' : `_${imageIndex.toString(10).padStart(3, '0')}`;
        if (imageUrl && imageUrl.startsWith(markdownImageDirectory)) {
          const processedImageFile = path.parse(imageUrl);
          if (
            !processedImageFile.name.startsWith(news.uid) ||
            !processedImageFile.name.endsWith(indexSuffix) ||
            !processedImageFile.ext.startsWith('.') ||
            processedImageFile.ext.length !== 4 ||
            processedImageFile.ext !== processedImageFile.ext.toLowerCase()
          ) {
            throw new Error(
              `Invalid image file name: ${processedImageFile.name} for news uid: ${news.uid}`
            );
          }
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

        const imageExtension = imageUrl.substring(imageUrl.lastIndexOf('.')).toLocaleLowerCase();
        const formattedImageExtension = imageExtension === '.jpeg' ? '.jpg' : imageExtension;
        if (
          !formattedImageExtension ||
          !formattedImageExtension.startsWith('.') ||
          formattedImageExtension.length != 4
        ) {
          throw new Error(`Invalid image extension for ${imageUrl}`);
        }
        const newImageFileName = `${news.uid}${indexSuffix}${formattedImageExtension}`;
        const newImageFilePath = path.resolve(imageDirectory, newImageFileName);

        let isDownloadError = false;
        (async () => {
          if (overwrite || !(await exists(newImageFilePath))) {
            try {
              await downloadFile(imageUrl, newImageFilePath);
              console.warn(`Downloaded image ${imageUrl} to ${newImageFilePath}`);
            } catch (error) {
              console.error(`Failed to download image ${imageUrl} to ${newImageFilePath}:`, error);
              isDownloadError = true;
            }
          }
        })();

        if (isDownloadError) {
          return match;
        }

        const markdownImageFilePath = path.join(markdownImageDirectory, newImageFileName);
        imagesMapping[imageUrl] = markdownImageFilePath;
        isUpdated = true;
        return `![${altText}](${markdownImageFilePath})`;
      }
    );

    if (!isUpdated) {
      return;
    }

    await fs.writeFile(
      markdownFile,
      matter.stringify(updatedMarkdown.trim(), existingData, { excerpt: false }),
      { encoding: 'utf8' }
    );
  });
};
