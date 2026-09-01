import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, toUid, fetchFile, readFiles, fetchFileSync } from '../common.ts';
import newsUrls from './mp-urls.json' with { type: 'json' };
import matter from 'gray-matter';
import * as fsSync from 'fs';

const currentDirectory = import.meta.dirname;
const rawHtmlDirectory = path.join(currentDirectory, 'mp-raw');
const trimmedHtmlDirectory = path.join(currentDirectory, 'mp-trimmed');
const markdownDirectory = path.resolve(
  currentDirectory,
  '../../src/content/contents/news/zh-HK/mp'
);
const imageDirectory = path.resolve(currentDirectory, '../../src/assets/news/mp');
const markdownImageDirectory = '../../../../../assets/news/mp/';

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

export const downloadHtmlFiles = async (overwrite = false) => {
  const uids = new Set<string>();

  const entries = Object.entries(newsUrls as Record<string, NewsUrlItem>).sort(
    ([_link1, item1], [_link2, item2]) => item1.pubDate.localeCompare(item2.pubDate)
  );

  for (const [url, news] of entries) {
    const { uid, raw: _filePath } = getFile(news);
    if (uids.has(uid)) {
      throw new Error(`Duplicate uid: ${uid} for url: ${url}`);
    }
    uids.add(uid);
  }

  await entries.forEachAsync(async ([url, news]) => {
    const { raw: rawHtmlFilePath } = getFile(news);
    if (!overwrite && (await exists(rawHtmlFilePath))) {
      // console.warn(`File already exists, skipping: ${rawHtmlFilePath}`);
      return;
    }

    await fetchFile(url, rawHtmlFilePath);
    console.warn(`Downloaded ${url} to ${rawHtmlFilePath}`);
  });
};

export const downloadImages = async (overwrite = false) => {
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

    if (news.title.includes('图')) {
      console.warn(`News title contains '图': ${news.title} for url: ${url}`);
    }

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
    const updatedMarkdownFile = markdownFile.replace('\\mp\\', '\\mp2\\');
    // if (!overwrite && (await exists(updatedMarkdownFile))) {
    //   return;
    // }

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

        const imageExtension = imageUrl
          .split('?')[0]
          .substring(imageUrl.lastIndexOf('.'))
          .toLocaleLowerCase();
        const formattedImageExtension = imageExtension === '.jpeg' ? '.jpg' : imageExtension;
        if (
          !formattedImageExtension ||
          !formattedImageExtension.startsWith('.') ||
          formattedImageExtension.length != 4
        ) {
          throw new Error(`Invalid image extension for ${imageUrl}`);
        }
        const newImageFileName = `${existingData.uid}${indexSuffix}${formattedImageExtension}`;
        const newImageFilePath = path.resolve(imageDirectory, newImageFileName);

        if (
          imageUrl.includes('-scaled.') ||
          imageUrl.includes('-scale.') ||
          overwrite ||
          !fsSync.existsSync(newImageFilePath)
        ) {
          const trimmedImageUrl = imageUrl
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
