import newsUrls from './google-urls.json' with { type: 'json' };
import { downloadHtmlsAndImages, exists, readFiles, toFileName } from '../common.ts';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

export const currentDataRootDirectory = import.meta.dirname;
const rawHtmlDirectory = path.join(currentDataRootDirectory, 'google-raw');

export const downloadHtmlFiles = async () => {
  const urls: string[] = [];
  const urlInfo: Record<
    string,
    {
      keyword: string;
      locale: string;
      guid: string;
      news: any;
      directory: string;
      htmlFile: string;
      directoryName: string;
    }
  > = {};

  const localeDirectories = await fs.readdir(rawHtmlDirectory, {
    withFileTypes: false,
    recursive: false,
  });
  const newsHtmlFiles = (
    await localeDirectories.mapAsync(async (localeDirectory) => {
      const localeDirectoryPath = path.join(rawHtmlDirectory, localeDirectory);
      return await readFiles(localeDirectoryPath, true, 'index.html');
    })
  ).flatMap((localeHtmlFile) => localeHtmlFile);
  const guids = new Set<string>(
    newsHtmlFiles
      .map((newsHtmlFile) => path.dirname(newsHtmlFile))
      .map((newsDirectoryName) =>
        newsDirectoryName.substring(0, newsDirectoryName.lastIndexOf('^'))
      )
  );
  for (const [keyword, newsByLocale] of Object.entries(newsUrls)) {
    for (const [locale, newsList] of Object.entries(newsByLocale)) {
      for (const news of newsList) {
        const guid = `${news.pubDate.substring(0, 10)}^${news.guid.substring(4, 9)}^${news.guid.slice(-5)}`;
        if (guids.has(guid)) {
          continue;
        }
        guids.add(guid);
        urls.push(news.link);
        const directoryName = `${guid}^${toFileName(news.title.replaceAll('^', '-')).substring(0, 100)}`;
        const directory = path.join(rawHtmlDirectory, locale, directoryName);
        // await fs.mkdir(directory, { recursive: true });
        const htmlFile = path.join(directory, 'index.html');
        urlInfo[news.link] = { keyword, locale, guid, news, directoryName, directory, htmlFile };
      }
    }
  }

  await downloadHtmlsAndImages(
    urls,
    [],
    async (url) => {
      const directory = urlInfo[url].directory;
      if (!(await exists(directory))) {
        await fs.mkdir(directory, { recursive: true });
      }
      return urlInfo[url].htmlFile;
    },
    undefined,
    async (mediaUrl, _mediaType, htmlUrl) => {
      const { pathname } = new URL(mediaUrl);
      const fileName = path.basename(pathname);
      return path.join(urlInfo[htmlUrl].directory, fileName);
    },
    false,
    false,
    true,
    0
  );
};
