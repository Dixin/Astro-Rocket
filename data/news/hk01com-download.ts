import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, readFiles, toFileName, fetchFile, toUid } from '../common.ts';
import matter from 'gray-matter';
import newsUrls from './hk01com-tags.json' with { type: 'json' };
import additionalNewsUrls from './hk01com-urls.json' with { type: 'json' };
import googleNewsUrls from './google-urls.json' with { type: 'json' };

const currentDirectory = import.meta.dirname;
const rawHtmlDirectory = path.join(currentDirectory, 'hk01com-raw');
const markdownDirectory = path.resolve(
  currentDirectory,
  '../../src/content/contents/news/zh-HK/hk01com'
);
const imageDirectory = path.resolve(currentDirectory, '../../src/assets/news/hk01com');

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
  const uid = toFileName(news.link.split('/').pop()!.toLowerCase());
  if (!uid) {
    throw new Error(`Invalid link: ${news.link}`);
  }
  return path.join(
    rawHtmlDirectory,
    `${news.pubDate.replaceAll('-', '')}-hk01com-${news.guid.split('/').at(-1)}-${uid}.html`
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
  Object.entries(additionalNewsUrls as Record<string, NewsUrlItem>).forEach(([_shorLink, item]) => {
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
    await fetchFile(url, filePath);
    console.warn(`Downloaded ${url} to ${filePath}`);
  });
};

export const convertToMarkdown = async (overwrite = false) => {
  const mergedUrls: Record<string, NewsUrlItem> = {};
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
  });
  Object.entries(additionalNewsUrls as Record<string, NewsUrlItem>).forEach(([_shorLink, item]) => {
    if (item.link in mergedUrls) {
      throw new Error(`Duplicate link found: ${item.link}`);
    }
    item.description = getHtmlFilePath(item);
    if (files.has(item.description)) {
      throw new Error(`Duplicate file path found: ${item.description}`);
    }
    files.add(item.description);
    mergedUrls[item.link] = item;
  });

  const urls = Object.entries(mergedUrls)
    .sort(([_linkA, itemA], [_linkB, itemB]) => itemA.pubDate.localeCompare(itemB.pubDate))
    .map(([link, _item]) => link);
  const imagesMapping: Record<string, string> = {};

  await urls.forEachAsync(async (url) => {
    const news = mergedUrls[url];
    const parsedHtmlFile = path.parse(news.description);
    const markdownFilePath = path.resolve(markdownDirectory, `${parsedHtmlFile.name}.mdx`);
    if (!overwrite && (await exists(markdownFilePath))) {
      console.warn(`File already exists, skipping: ${markdownFilePath}`);
      return;
    }

    const filePath = news.description;
    const html = await fs.readFile(filePath, { encoding: 'utf8' });
    const startFlag = '<script id="__NEXT_DATA__" type="application/json">';
    const endFlag = '</script>';
    const json = JSON.parse(
      html.substring(html.lastIndexOf(startFlag) + startFlag.length, html.lastIndexOf(endFlag))
    );

    const article = json.props.initialProps.pageProps.article;
    const meta = json.props.initialProps.pageProps.meta;
    if (!article || !meta) {
      throw new Error(
        `Article ${filePath} has no article or meta: ${JSON.stringify(json.props.initialProps.pageProps, null, 2)}`
      );
    }

    const data: {
      title: string;
      uid: string;
      description: string;
      locale: string;
      image: string;
      imageAlt: string;
      publishedAt: string;
      author: string;
      links: { url: string; text: string; icon: string }[];
      sources: { url: string; text: string; icon: string }[];
      tags: string[];
      lastModifiedTime?: string;
    } = {
      title: news.title,
      uid: parsedHtmlFile.name,
      description: article.description,
      locale: 'zh-HK',
      publishedAt: new Date(1000 * parseInt(article.publishTime)).toISOString(),
      author:
        article.authors && article.authors.length > 0
          ? `香港01|${article.authors.map((author: { publishName: string }) => author.publishName).join('|')}`
          : '香港01',
      tags: news.tags,
      image: await downloadImage(imagesMapping, news.image, 0, parsedHtmlFile.name, overwrite),
      imageAlt: news.title,
      links: [
        {
          url: meta.ogUrl,
          text: news.sourceName ? `香港01|${news.sourceName}` : '香港01',
          icon: 'newspaper',
        },
      ],
      sources: [
        {
          url: news.link,
          text: news.sourceName ? `香港01|${news.sourceName}` : '香港01',
          icon: 'newspaper',
        },
      ],
    };

    if (article.lastModifiedTime) {
      data.lastModifiedTime = new Date(1000 * parseInt(article.lastModifiedTime)).toISOString();
    }

    const markdownLines = await convertBlocksToMarkdown(
      article.blocks,
      news.description,
      parsedHtmlFile.name,
      news.title,
      imagesMapping,
      overwrite
    );
    if (markdownLines.length === 0) {
      throw new Error(`No content blocks found in ${news.description}`);
    }
    console.warn(
      `Converting ${news.description} to ${markdownFilePath} with ${markdownLines.length} lines of content`
    );
    const newContent = matter.stringify(markdownLines.join('\n'), data);

    await fs.writeFile(markdownFilePath, newContent, { encoding: 'utf8' });
  });
};

const downloadImage = async (
  imagesMapping: Record<string, string>,
  imageUrl: string,
  imageIndex: number,
  htmlFileName: string,
  overwrite: boolean
): Promise<string> => {
  const existingImage = imagesMapping[imageUrl];
  if (existingImage) {
    return existingImage;
  }

  const imageExtension =
    imageUrl.lastIndexOf('/') > imageUrl.lastIndexOf('.')
      ? imageUrl.substring(imageUrl.lastIndexOf('.'), imageUrl.lastIndexOf('/')).toLowerCase()
      : imageUrl.substring(imageUrl.lastIndexOf('.')).toLocaleLowerCase();
  const formattedImageExtension = imageExtension === '.jpeg' ? '.jpg' : imageExtension;
  if (
    !formattedImageExtension ||
    !formattedImageExtension.startsWith('.') ||
    formattedImageExtension.length != 4
  ) {
    throw new Error(`Invalid image extension for ${imageUrl}`);
  }

  const index = imageIndex === 0 ? '' : `_${imageIndex.toString(10).padStart(3, '0')}`;
  const newImageFileName = `${htmlFileName}${index}${formattedImageExtension}`;
  const newImageFilePath = path.resolve(imageDirectory, newImageFileName);

  if (overwrite || !(await exists(newImageFilePath))) {
    await fetchFile(imageUrl, newImageFilePath);
    console.warn(`Downloaded image ${imageUrl} to ${newImageFilePath}`);
  }

  const markdownImageFilePath = `../../../../../assets/news/hk01/${newImageFileName}`;
  imagesMapping[imageUrl] = markdownImageFilePath;
  return markdownImageFilePath;
};

const convertBlocksToMarkdown = async (
  blocks: {
    blockType: string;
    htmlTokens: {
      type: string;
      content: string;
    }[][];
    image: {
      caption?: string;
      cdnUrl: string;
    };
    images: {
      caption?: string;
      cdnUrl: string;
    }[];
    summary: string[];
    message: string;
    author: string;
    questionsAndAnswers: {
      question: {
        htmlTokens: {
          type: string;
          content: string;
        }[][];
      };
      answer: {
        htmlTokens: {
          type: string;
          content: string;
        }[][];
      };
    }[];
    videoId: string;
    type: string;
  }[],
  htmlFilePath: string,
  htmlFileName: string,
  title: string,
  imagesMapping: Record<string, string>,
  overwrite: boolean
): Promise<string[]> => {
  const markdownLines: string[] = [];
  let imageIndex = 1;
  let isYouTubeImported = false;
  await blocks.forEachAsync(async (block) => {
    switch (block.blockType) {
      case 'text':
        convertHtmlTokensToMarkdown(block.htmlTokens, htmlFilePath).forEach((line) => {
          markdownLines.push(line);
          markdownLines.push('');
        });
        break;
      case 'image':
        markdownLines.push(
          `![${(block.image.caption ?? title).replaceAll('[', '').replaceAll(']', '')}](${await downloadImage(imagesMapping, block.image.cdnUrl, imageIndex++, htmlFileName, overwrite)})`
        );
        if (block.image.caption) {
          markdownLines.push(block.image.caption);
        }
        markdownLines.push('');
        break;
      case 'gallery':
        await block.images.forEachAsync(async (image) => {
          markdownLines.push(
            `![${(image.caption ?? title).replaceAll('[', '').replaceAll(']', '')}](${await downloadImage(imagesMapping, image.cdnUrl, imageIndex++, htmlFileName, overwrite)})`
          );
          if (image.caption) {
            markdownLines.push(image.caption);
          }
          markdownLines.push('');
        });
        break;
      case 'summary':
        block.summary.forEach((summaryLine) => {
          markdownLines.push(`> ${summaryLine}`);
        });
        markdownLines.push('');
        break;
      case 'quote':
        markdownLines.push(`> ${block.message}`);
        markdownLines.push(block.author);
        markdownLines.push('');
        break;
      case 'faq':
        block.questionsAndAnswers.forEach((qa) => {
          convertHtmlTokensToMarkdown(qa.question.htmlTokens, htmlFilePath).forEach((line) => {
            markdownLines.push(`> ${line}`);
            markdownLines.push('');
          });
          convertHtmlTokensToMarkdown(qa.answer.htmlTokens, htmlFilePath).forEach((line) => {
            markdownLines.push(line);
            markdownLines.push('');
          });
        });
        break;
      case 'video':
        if (block.type === 'youtube') {
          markdownLines.push(`---`);
          if (!isYouTubeImported) {
            markdownLines.push("import YouTube from '@/components/patterns/YouTube.astro';");
            isYouTubeImported = true;
          }
          markdownLines.push(`<YouTube id="${block.videoId}" />`);
          markdownLines.push(`---`);
          markdownLines.push('');
        }
        break;
      case 'code':
      case 'related':
      case 'brightcove':
        break;
      default:
        throw new Error(
          `Unsupported block type: ${block.blockType} in ${htmlFilePath}: ${JSON.stringify(block, null, 2)}`
        );
    }
  });
  return markdownLines;
};

const convertHtmlTokensToMarkdown = (
  htmlTokens: {
    type: string;
    content: string;
  }[][],
  filePath: string
): string[] => {
  const lines = htmlTokens.map((htmlLine) => {
    const line = htmlLine
      .map((token) => {
        switch (token.type) {
          case 'text':
            return token.content;
          case 'boldText':
            return `**${token.content}**`;
          case 'h3':
            return `## ${token.content}`;
          case 'h4':
            return `### ${token.content}`;
          case 'h5':
            return `#### ${token.content}`;
          case 'h6':
            return `##### ${token.content}`;
          case 'link':
          case 'boldLink':
            return token.content;
          default:
            throw new Error(
              `Unsupported token type: ${token.type} in ${filePath}: ${JSON.stringify(htmlLine, null, 2)}`
            );
        }
      })
      .join('');
    return line;
  });
  return lines;
};

export const updateMarkdownFiles = async () => {
  // const googleHK01News = {};
  // Object.entries(googleNewsUrls).forEach(([locale, localeUrls]) => {
  //   Object.entries(localeUrls).forEach(([guid, news]) => {
  //     if (news.sourceLinkDecoded.includes('hk01.com')) {
  //       news.locale = locale;
  //       googleHK01News[news.sourceLinkDecoded] = news;
  //     }
  //   });
  // });
  // console.warn(`Found ${Object.keys(googleHK01News).length} Google News articles from hk01.com`);
  await (
    await readFiles(markdownDirectory, true, '.mdx')
  ).forEachAsync(async (markdownFilePath) => {
    const mdxContent = await fs.readFile(markdownFilePath, { encoding: 'utf8' });
    const { data, content: markdownContent } = matter(mdxContent);

    

    // const linkDecoded = data.sources[0];
    // const news = googleHK01News[linkDecoded.url];
    // if (!news) {
    //   return;
    // }
    // data.sources[0] = {
    //   url: news.link,
    //   text: `Google新聞|香港01`,
    //   icon: 'newspaper',
    // };
    // data.sources.push(linkDecoded);
    data.sources.push(data.links[0]);
    delete data.links;

    if (!data.meta) {
      data.meta = ['hk01.com'];
      const authors: string[] = data.author.split('|');
      authors
        .filter((_, index) => index > 0)
        .forEach((author) => {
          data.meta.push(`撰文：${author}`);
        });
    } else if (!data.meta.includes('hk01.com')) {
      data.meta.unshift('hk01.com');
    }

    data.author = 'Google新聞|香港01';

    const updatedMdxContent = matter.stringify(markdownContent, data);
    await fs.writeFile(markdownFilePath, updatedMdxContent, { encoding: 'utf8' });

    // const source = 'hk01com';
    // const uid = toUid(
    //   `${news.pubDate.substring(0, 10).replaceAll('-', '')}-${source}-${news.guid.substring(4, 9).toLowerCase()}${news.guid.substring(news.guid.length - 5).toLowerCase()}-${toUid(news.title).substring(0, 100)}`
    // );
    // const markdownRootDirectory = path.resolve(
    //   currentDirectory,
    //   '../../src/content/contents/news/'
    // );
    // const rawHtmlFile = path.join(currentDirectory, 'google-raw', 'zh-HK', `${uid}.html`);
    // const markdownFile = path.join(markdownRootDirectory, 'zh-HK', 'google', `${uid}.mdx`);
    // if (!(await exists(rawHtmlFile)) || !(await exists(markdownFile))) {
    //   throw new Error(
    //     `Raw HTML file or Markdown file does not exist for ${uid}: ${rawHtmlFile}, ${markdownFile}`
    //   );
    // }
    // await fs.rename(rawHtmlFile, rawHtmlFile.replace('zh-HK', 'zh-HK-delete'));
    // await fs.rename(markdownFile, markdownFile.replace('google', 'google-delete'));
  });
};
