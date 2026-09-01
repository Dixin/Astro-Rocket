import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, toUid, readFiles, decodeHtml, uidRegex } from '../common.ts';
import matter from 'gray-matter';
import newsUrls from './google-urls.json' with { type: 'json' };
import * as cheerio from 'cheerio';
import * as htmlToMarkdown from '@xberg-io/html-to-markdown';

const currentDirectory = import.meta.dirname;
const rawHtmlDirectory = path.join(currentDirectory, 'scmp-raw');
const markdownDirectory = path.resolve(currentDirectory, '../../src/content/contents/news/en/scmp');
const tagImageDirectory = '../../../../../assets/tags/';

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

    // const author = data.meta.filter(
    //   (meta: string) => meta.includes('文：') || meta.startsWith('者：')
    // );
    // if (author.length > 0) {
    //   data.author += `|${author[0].split('：').at(-1)!.trim()}`;
    // }
    const updatedContent = `\n${content.trim()}\n`;
    // const match = updatedContent.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    // if (!match || match.length < 3) {
    //   if (!data.tags || data.tags.length === 0) {
    //     throw new Error(`No image found and no tags for ${file}`);
    //   }

    //   const guid = data.uid.split('-')[2];
    //   //const index = parseInt(guid.substring(guid.length - 1), 10);
    //   const index =
    //     Array.from({ length: guid.length }, (_, index) => index)
    //       .map((index) => guid[index].toLowerCase().charCodeAt(0) - 96)
    //       .reduce((acc, curr) => acc + curr, 0) % 10;
    //   const indexSuffix = index === 0 ? '' : `_${index.toString(10)}`;
    //   const tagMapping: Record<string, string> = {
    //     Beyond: 'beyond',
    //     'Wong Ka Kui': '黃家駒',
    //     'Yip Sai Wing': '葉世榮',
    //     'Wong Ka Keung': '黃家強',
    //     'Paul Wong': '黃貫中',
    //   };
    //   let fromTag: string | undefined = undefined;
    //   let toTag: string | undefined = undefined;
    //   for (const tag of Object.keys(tagMapping)) {
    //     if (data.tags.includes(tag)) {
    //       fromTag = tag;
    //       toTag = tagMapping[tag];
    //       break;
    //     }
    //   }
    //   if (!toTag || !fromTag) {
    //     throw new Error(`No image found and no matching tags for ${file}`);
    //   }
    //   data.image = `${tagImageDirectory}${toTag}${indexSuffix}.jpg`;
    //   data.imageAlt = fromTag;
    // } else {
    //   const imageAlt = match[1].trim();
    //   const imageUrl = match[2].trim();
    //   if (!imageAlt || !imageUrl) {
    //     throw new Error(`Invalid image markdown in ${file}: ${match[0]}`);
    //   }
    //   data.image = imageUrl;
    //   if (!data.imageAlt || data.imageAlt.trim() === '') {
    //     data.imageAlt = imageAlt;
    //   }
    // }

    data.uid = data.uid.toLowerCase();

    const newFileContent = matter.stringify(updatedContent, data);
    await fs.writeFile(file.replace('scmp', 'scmp2').toLowerCase(), newFileContent, {
      encoding: 'utf8',
    });
  });
};
