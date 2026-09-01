import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, decodeHtml, toUid } from '../common.ts';
import * as cheerio from 'cheerio';
import newsUrls from './mp-urls.json' with { type: 'json' };

const currentDirectory = import.meta.dirname;
const urlsHtmlFile = path.join(currentDirectory, 'mp-urls.html');
const urlsJsonFile = path.join(currentDirectory, 'mp-urls.json');

const rawHtmlDirectory = path.join(currentDirectory, 'mp-raw');
const trimmedHtmlDirectory = path.join(currentDirectory, 'mp-trimmed');
const markdownDirectory = path.resolve(
  currentDirectory,
  '../../src/content/contents/news/zh-CN/mp'
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
 if(uid.includes('　')) {
    console.error(`Invalid UID: ${uid}`);
  }
  return {
    uid,
    raw: path.join(rawHtmlDirectory, `${uid}.html`),
    trimmed: path.join(trimmedHtmlDirectory, `${uid}.html`),
    markdown: path.join(markdownDirectory, `${uid}.mdx`),
  };
};

export const getUrls = async (overwrite: boolean = false) => {
  if (!overwrite && (await exists(urlsJsonFile))) {
    const content = await fs.readFile(urlsJsonFile, 'utf8');
    return JSON.parse(content) as Record<string, NewsUrlItem>;
  }

  const urls: Record<string, NewsUrlItem> = {};
  const html = await fs.readFile(urlsHtmlFile, 'utf8');
  const $: cheerio.CheerioAPI = cheerio.load(html, {
    xml: {
      selfClosingTags: true,
      lowerCaseTags: false,
      decodeEntities: false,
      // xmlMode: true,
    },
  });
  $('.item').each((_index, item) => {
    const $item = $(item);
    const $title = $item.find('.title');
    const href = $title.attr('href');
    if (!href) {
      console.error(`Missing content: ${$item.html()}`);
      return;
    }
    const link = decodeURI(href.split('?')[0]);
    const tag = decodeHtml(
      ($item.parents('[data-keyword]').data('keyword') as string).trim() || ''
    );
    const formattedTag = tag.trim();
    const existingItem = urls[link];
    if (existingItem) {
      if (!existingItem.tags.includes(formattedTag)) {
        existingItem.tags.push(formattedTag);
      }
      return;
    }

    const title = decodeHtml($title.text().trim());
    const share = decodeURI($item.find('.whatsapp').attr('href')!.trim());
    const guid = decodeURIComponent(share.substring(share.lastIndexOf('http')));
    const seconds = $item.find('[data-timestamp]').data('timestamp') as number;
    const pubDate = new Date(seconds * 1000).toISOString();
    const $source = $item.find('.postCat');
    const $image = $item.find('img');
    urls[link] = {
      title,
      link,
      pubDate,
      description: '',
      guid,
      tags: [formattedTag],
      sourceName: decodeHtml($source.text().trim()),
      sourceUrl: $source.attr('href') || '',
      image: $image.attr('src') || '',
      imageAlt: decodeHtml($image.attr('alt') || ''),
    } as NewsUrlItem;
  });

  await fs.writeFile(urlsJsonFile, JSON.stringify(urls, null, 2), { encoding: 'utf8' });
  return urls;
};

export const updateUrls = async (overwrite: boolean = false) => {
  if (!overwrite && (await exists(urlsJsonFile))) {
    return;
  }

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

  entries.forEach(([_url, news]) => {
    news.title = news.title.replaceAll(/\s*[\u3000]+\s*/g, ' ').trim();
  });
  await fs.writeFile(urlsJsonFile, JSON.stringify(newsUrls, null, 2), { encoding: 'utf8' });
};