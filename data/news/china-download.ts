import * as path from 'path';
import { exists, toUid, downloadFile } from '../common.ts';
import newsUrls from './china-urls.json' with { type: 'json' };

const currentDirectory = import.meta.dirname;
const rawHtmlDirectory = path.join(currentDirectory, 'china-raw');
const trimmedHtmlDirectory = path.join(currentDirectory, 'china-trimmed');
const markdownDirectory = path.resolve(
  currentDirectory,
  '../../src/content/contents/news/zh-CN/china'
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
    const { raw: rawHtmlFilePath } = getFile(news);
    if (!overwrite && (await exists(rawHtmlFilePath))) {
      // console.warn(`File already exists, skipping: ${rawHtmlFilePath}`);
      return;
    }

    await downloadFile(url, rawHtmlFilePath);
    console.warn(`Downloaded ${url} to ${rawHtmlFilePath}`);
  });
};
