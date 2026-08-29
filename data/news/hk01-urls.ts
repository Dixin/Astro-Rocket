import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, decodeHtml } from '../common.ts';
import * as cheerio from 'cheerio';

const currentDirectory = import.meta.dirname;
const urlsHtmlFile = path.join(currentDirectory, 'hk01-urls.html');
const urlsJsonFile = path.join(currentDirectory, 'hk01-urls.json');
const tagUrlsHtmlFile = path.join(currentDirectory, 'hk01-tags.html');
const tagUrlsJsonFile = path.join(currentDirectory, 'hk01-tags.json');

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

export const getUrls = async (overwrite: boolean = false) => {
  if (!overwrite && (await exists(urlsJsonFile))) {
    const content = await fs.readFile(urlsJsonFile, 'utf8');
    return JSON.parse(content) as Record<string, NewsUrlItem>;
  }

  const urls: Record<string, NewsUrlItem> = {};
  const html = await fs.readFile(urlsHtmlFile, { encoding: 'utf8' });
  const guids = new Set<string>();
  const $: cheerio.CheerioAPI = cheerio.load(html, {
    xml: {
      selfClosingTags: true,
      lowerCaseTags: false,
      decodeEntities: false,
      // xmlMode: true,
    },
  });
  $('li').each((_index, item) => {
    const $item = $(item);
    const $title = $item.find('h2 a');
    const href = $title.attr('href');
    if (!href) {
      console.error(`Missing content: ${$item.html()}`);
      return;
    }
    const link = decodeURI(href.split('?')[0]);
    const guid = link.split('/').slice(0, 5).join('/');
    if (guids.has(guid)) {
      return;
    }

    const title = $title.text().trim();
    const $image = $item.find('img');
    const $source = $item.find('span.sc-JrDLc a');
    const description = $item.find('p').text().trim();
    const sourceName = $source.text().trim();
    const sourceUrl = decodeURI($source.attr('href')!.split('?')[0]);
    const pubDate = $item.find('div.sc-fXSgeo').find('span').remove().end().text().trim();
    guids.add(guid);
    urls[guid] = {
      title,
      link,
      pubDate,
      description,
      sourceName,
      sourceUrl,
      guid,
      image: $image.attr('src') || '',
      imageAlt: $image.attr('alt') || '',
    } as NewsUrlItem;
  });

  await fs.writeFile(urlsJsonFile, JSON.stringify(urls, null, 2), { encoding: 'utf8' });
  return urls;
};

export const getTagUrls = async (overwrite: boolean = false) => {
  if (!overwrite && (await exists(tagUrlsJsonFile))) {
    const content = await fs.readFile(tagUrlsJsonFile, 'utf8');
    return JSON.parse(content) as Record<string, NewsUrlItem>;
  }

  const urls: Record<string, NewsUrlItem> = {};
  const html = await fs.readFile(tagUrlsHtmlFile, 'utf8');
  const $: cheerio.CheerioAPI = cheerio.load(html, {
    xml: {
      selfClosingTags: true,
      lowerCaseTags: false,
      decodeEntities: false,
      // xmlMode: true,
    },
  });
  $('.scroll-helper--tag-result-list').each((_index, items) => {
    const $items = $(items);
    const tag = $items.data('tag') as string;
    $items.find('[data-testid="content-card"]').each((_index, item) => {
      const $item = $(item);
      const $title = $item.find('[data-testid="content-card-title"]');
      const href = $title.attr('href');
      if (!href) {
        console.error(`Missing content: ${$item.html()}`);
        return;
      }
      const link = `https://www.hk01.com${decodeURIComponent(href.split('?')[0])}`;
      const guid = link.split('/').slice(0, 5).join('/');
      if (urls[guid]) {
        urls[guid].tags.push(tag);
        return;
      }

      const title = decodeHtml($title.text().trim());
      const $image = $item.find('img');
      const $source = $item.find('[data-testid="content-card-channel"] a');
      const sourceName = decodeHtml($source.text().trim());
      const sourceUrl = `https://www.hk01.com${decodeURIComponent($source.attr('href')!.split('?')[0])}`;
      const pubDate = $item.find('[data-testid="content-card-time"]').text().trim();
      urls[guid] = {
        title,
        link,
        pubDate,
        description: '',
        sourceName,
        sourceUrl,
        guid,
        image: ($image.attr('src') || '').split('?')[0],
        imageAlt: $image.attr('alt') || '',
        tags: [tag],
      } as NewsUrlItem;
    });
  });

  await fs.writeFile(tagUrlsJsonFile, JSON.stringify(urls, null, 2), { encoding: 'utf8' });
  return urls;
};
