import newsUrls from './google-urls.json' with { type: 'json' };
import {
  downloadHtmlsAndImages,
  exists,
  fetchString,
  readFiles,
  toFileName,
  toUid,
  fetchFileSync,
  uidRegex,
} from '../common.ts';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';
import matter from 'gray-matter';

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

export const currentDirectory = import.meta.dirname;
const rawHtmlDirectory = path.join(currentDirectory, 'scmp-raw');
const markdownDirectory = path.resolve(currentDirectory, '../../src/content/contents/news/en/scmp');
const imageDirectory = path.resolve(currentDirectory, '../../src/assets/news/mp');
const markdownImageDirectory = '../../../../../assets/news/mp/';

export const downloadHtmlFiles = async () => {
  const urls: string[] = [];
  const urlInfo: Record<
    string,
    {
      tags: string[];
      locale: string;
      guid: string;
      news: NewsUrlItem;
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
  for (const [locale, newsOfLocale] of Object.entries(
    newsUrls as Record<string, Record<string, NewsUrlItem>>
  )) {
    for (const [_guid, news] of Object.entries(newsOfLocale)) {
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
      urlInfo[news.link] = {
        tags: news.tags,
        locale,
        guid,
        news,
        directoryName,
        directory,
        htmlFile,
      };
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
    false,
    0
  );
};

export const download = async () => {
  const items = Object.entries(newsUrls.en as Record<string, NewsUrlItem>)
    .map(([_guid, item]) => item)
    .filter((item) => item.sourceUrl.includes('scmp.com'))
    .sort((a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime());
  await items.forEachAsync(async (item) => {
    console.warn(`${new Date(item.pubDate).toISOString().substring(0, 10)} ${item.title}`);
    console.warn(`${item.link}`);
    console.warn('\n');
    const html = await fetchString(item.link);
    const uid = `${item.pubDate.substring(0, 10).replaceAll('-', '')}-google-${item.guid.substring(4, 9)}${item.guid.substring(item.guid.length - 5)}-${toUid(item.title)}`;
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
    };
    const mdxContent = matter.stringify('', data);
    await fs.writeFile(markdownFilePath, mdxContent, { encoding: 'utf-8' });
  });
};

const getFile = (news: NewsUrlItem) => {
  const uid = `${news.pubDate.substring(0, 10).replaceAll('-', '')}-google-${news.guid.substring(4, 9).toLowerCase()}${news.guid.substring(news.guid.length - 5).toLowerCase()}-${toUid(news.title)}`;
  if (uid.includes('　') || !uidRegex.test(uid)) {
    console.error(`Invalid UID: ${uid}`);
  }
  return {
    uid,
    raw: path.join(rawHtmlDirectory, `${uid}.html`),
    markdown: path.join(markdownDirectory, `${uid}.mdx`),
  };
};

export const downloadImages = async (overwrite = false) => {
  const uids = new Set<string>();
  const guids = new Set<string>();

  const entries = Object.entries(newsUrls.en as Record<string, NewsUrlItem>)
    .filter(([_guid, item]) => item.sourceUrl.includes('scmp.com'))
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
    const updatedMarkdownFile = markdownFile.replace('\\scmp\\', '\\scmp2\\');
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
        if (imageUrl && imageUrl.startsWith(markdownImageDirectory)) {
          const processedImageFile = path.parse(imageUrl);
          if (
            !processedImageFile.name.startsWith(existingData.uid) ||
            !processedImageFile.name.endsWith(indexSuffix) ||
            !processedImageFile.ext.startsWith('.') ||
            processedImageFile.ext.length !== 4 ||
            processedImageFile.ext !== processedImageFile.ext.toLowerCase()
          ) {
            throw new Error(
              `Invalid image file name: ${processedImageFile.name} for news uid: ${existingData.uid}`
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

        const imageUrlWithoutTitle = imageUrl.split(' "')[0];
        const imageExtension = imageUrlWithoutTitle
          .split('?')[0]
          .substring(imageUrlWithoutTitle.split('?')[0].lastIndexOf('.'))
          .toLocaleLowerCase();
        const formattedImageExtension = imageExtension === '.jpeg' ? '.jpg' : imageExtension;
        if (
          !formattedImageExtension ||
          !formattedImageExtension.startsWith('.') ||
          formattedImageExtension.length != 4
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
