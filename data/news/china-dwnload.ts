import * as fs from 'fs/promises';
import * as path from 'path';
import {
  exists,
  readFiles,
  toFileName,
  downloadFile,
} from '../common.ts';
import matter from 'gray-matter';
import newsUrls from './china-urls.json' with { type: 'json' };

const currentDirectory = import.meta.dirname;
const rawHtmlDirectory = path.join(currentDirectory, 'china-raw');
const markdownDirectory = path.resolve(
  currentDirectory,
  '../../src/content/contents/news/zh-CN/china'
);
const imageDirectory = path.resolve(currentDirectory, '../../src/assets/news/china');

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

const getHtmlFilePath = (news: NewsUrlItem) => {
  const uid = toFileName(news.title.toLowerCase());
  if (!uid) {
    throw new Error(`Invalid link: ${news.link}`);
  }
  return path.join(
    rawHtmlDirectory,
    `${news.pubDate.replaceAll('-', '')}-china-${news.guid.substring(4)}-${uid}.html`
  );
};

export const downloadHtmlFiles = async (overwrite = false) => {
  const mergedUrls: Record<string, NewsUrlItem> = {};
  const urls: string[] = [];
  const files = new Set<string>();

  Object.entries(newsUrls as Record<string, NewsUrlItem>).forEach(([_shorLink, item]) => {
    if (item.link in mergedUrls) {
      throw new Error(`Duplicate link found: ${item.link}`);
    }
    item.description = getHtmlFilePath(item);
    if (files.has(item.description)) {
      throw new Error(`Duplicate file path found: ${item.description}`);
    }
    files.add(item.description);
    mergedUrls[item.link] = item;
    urls.push(item.link);
  });

  await urls.forEachAsync(async (url) => {
    const news = mergedUrls[url];
    const filePath = news.description;
    if (!overwrite && (await exists(filePath))) {
      console.warn(`File already exists, skipping: ${filePath}`);
      return;
    }
    await downloadFile(url, filePath);
    console.warn(`Downloaded ${url} to ${filePath}`);
  });
};