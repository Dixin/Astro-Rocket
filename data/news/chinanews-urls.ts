import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, dataRootDirectory, readFiles, downloadString, decodeHtml } from '../common.ts';
import { chromium } from 'playwright';
import { setTimeout } from 'timers/promises';
import * as cheerio from 'cheerio';
//import newsUrls from './chinanews-urls.json' with { type: 'json' };

const currentDirectory = import.meta.dirname;
const urlsHtmlFile = path.join(currentDirectory, 'chinanews-urls.html');
const urlsJsonFile = path.join(currentDirectory, 'chinanews-urls.json');

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
  const html = await fs.readFile(urlsHtmlFile, 'utf8');
  const $: cheerio.CheerioAPI = cheerio.load(html, {
    xml: {
      selfClosingTags: true,
      lowerCaseTags: false,
      decodeEntities: false,
      // xmlMode: true,
    },
  });
  $('.news_title a').each((_index, item) => {
    const $item = $(item);
    const href = $item.attr('href');
    if (!href) {
      console.error(`Missing content: ${$item.html()}`);
      return;
    }
    const link = decodeURI(href.split('?')[0]);
    const tag = decodeHtml($item.find('em').text().trim());
    const formattedTag = tag.toLowerCase() === 'beyond' ? 'Beyond' : tag;
    const existingItem = urls[link];
    if (existingItem) {
      if (!existingItem.tags.includes(formattedTag)) {
        existingItem.tags.push(formattedTag);
      }
      return;
    }

    const title = decodeHtml($item.text().trim());
    const $details = $item.parent().next().find('.news_item');
    const guid = $details.find('.news_id').text().trim();
    const description = decodeHtml($details.find('.news_content').text().trim());
    const pubDate = decodeHtml($details.find('.news_other').last().text().trim());
    urls[link] = {
      title,
      link,
      pubDate,
      description,
      guid,
      tags: [formattedTag],
      sourceName: '中国新闻网',
      sourceUrl: 'http://www.chinanews.com',
      image: '',
      imageAlt: '',
    } as NewsUrlItem;
  });

  await fs.writeFile(urlsJsonFile, JSON.stringify(urls, null, 2), { encoding: 'utf8' });
  return urls;
};
