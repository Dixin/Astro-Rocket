import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, toUid, readFiles, decodeHtml } from '../common.ts';
import matter from 'gray-matter';
import newsUrls from './mp-urls.json' with { type: 'json' };
import * as cheerio from 'cheerio';
import * as htmlToMarkdown from '@xberg-io/html-to-markdown';

const currentDirectory = import.meta.dirname;
const rawHtmlDirectory = path.join(currentDirectory, 'mp-raw');
const trimmedHtmlDirectory = path.join(currentDirectory, 'mp-trimmed');
const markdownDirectory = path.resolve(
  currentDirectory,
  '../../src/content/contents/news/zh-HK/mp'
);

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
};

const getFile = (news: NewsUrlItem) => {
  const uid = `${news.pubDate.substring(0, 10).replaceAll('-', '')}-mp-${news.guid.split('?p=').at(-1)}-${toUid(news.title)}`;
  if (uid.includes('　')) {
    console.error(`Invalid UID: ${uid}`);
  }
  return {
    uid,
    raw: path.join(rawHtmlDirectory, `${uid}.html`),
    trimmed: path.join(trimmedHtmlDirectory, `${uid}.html`),
    markdown: path.join(markdownDirectory, `${uid}.mdx`),
  };
};

export const convertHtmlFiles = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

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

  await entries.forEachAsync(async ([_url, news]) => {
    const { uid, raw: rawHtmlFile, markdown: markdownFile } = getFile(news);
    if (
      !overwrite &&
      ((await exists(markdownFile)) || (await exists(markdownFile.replace('\\mp\\', '\\mp2\\'))))
    ) {
      return;
    }

    const rawHtml = await fs.readFile(rawHtmlFile, { encoding: 'utf8' });
    const $: cheerio.CheerioAPI = cheerio.load(rawHtml, {
      xml: {
        selfClosingTags: true,
        lowerCaseTags: false,
        decodeEntities: false,
        // xmlMode: true,
      },
    });

    const meta = $('.credits .item')
      .map((_index, element) => {
        const $element = $(element);
        const text = decodeHtml($element.text().trim());
        return text;
      })
      .toArray();

    const trimmedArticleHtml = $('#singleArticleCnt > .inner').html()!.trim();
    // var markdownContent = turndownService.turndown(bodyHtml);
    const markdownContent = htmlToMarkdown.convert(trimmedArticleHtml, {
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

    const data: {
      title: string;
      uid: string;
      description: string;
      locale: string;
      //   image: string;
      //   imageAlt: string;
      publishedAt: string;
      author: string;
      sources: { url: string; text: string; icon: string }[];
      tags: string[];
      meta: string[];
      // lastModifiedTime?: string;
    } = {
      title: news.title,
      uid: uid,
      description: news.title,
      locale: 'zh-HK',
      publishedAt: news.pubDate,
      author: '明周',
      tags: news.tags,
      meta: meta,
      sources: [
        {
          url: news.guid,
          text: '明周',
          icon: 'newspaper',
        },
      ],
    };

    const mdxContent = matter.stringify('\n' + markdownContent.content!.trim() + '\n', data);

    await fs.writeFile(markdownFile, mdxContent, {
      encoding: 'utf8',
    });
  });
};

export const updateMarkdownFiles = async () => {
  const files = await readFiles(markdownDirectory, true, '.mdx');
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

    const author = data.meta.filter(
      (meta: string) => meta.includes('文：') || meta.startsWith('者：')
    );
    if (author.length > 0) {
      data.author += `|${author[0].split('：').at(-1)!.trim()}`;
    }
    const updatedContent = `\n${content.trim()}\n`;
    // const match = updatedContent.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    // if (!match || match.length < 3) {
    //   if (!data.tags || data.tags.length === 0) {
    //     throw new Error(`No image found and no tags for ${file}`);
    //   }

    //   const guid = data.uid.split('-')[2];
    //   const index = parseInt(guid.substring(guid.length - 1), 10);
    //   const indexSuffix = index === 0 ? '' : `_${index.toString(10)}`;
    //   const tag = data.tags[0];
    //   if (!tag) {
    //     throw new Error(`No image found and no matching tags for ${file}`);
    //   }
    //   data.image = `${tagImageDirectory}${tag}${indexSuffix}.jpg`;
    //   data.imageAlt = tag;
    // } else {
    //   const imageAlt = match[1].trim();
    //   const imageUrl = match[2].trim();
    //   if (!imageAlt || !imageUrl) {
    //     throw new Error(`Invalid image markdown in ${file}: ${match[0]}`);
    //   }
    //   data.image = imageUrl;
    //   data.imageAlt = imageAlt;
    // }

    const newFileContent = matter.stringify(updatedContent, data);
    await fs.writeFile(file, newFileContent, {
      encoding: 'utf8',
    });
  });
};
