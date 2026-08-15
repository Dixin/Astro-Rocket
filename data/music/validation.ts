import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, readFiles } from '../common.ts';
import { chromium } from 'playwright';
import { setTimeout } from 'timers/promises';
import matter from 'gray-matter';

export const currentDataRootDirectory = import.meta.dirname;
const musicDirectory = path.resolve(
  currentDataRootDirectory,
  '../../src/content/contents/music/zh-HK'
);
const wikiDirectory = path.resolve(
  currentDataRootDirectory,
  '../../src/content/contents/wiki/zh-HK'
);

export const validateMusicFiles = async () => {
  const musicFiles = await readFiles(musicDirectory, true, '.mdx');
  const wikiFileNames = (await readFiles(wikiDirectory, true, '.mdx')).map(
    (file) => path.parse(file).name
  );
  const existingWikiFileNames = new Set<string>();
  const sourceUrls = new Set<string>();
  const links = new Set<string>();
  await musicFiles.forEachAsync(async (file) => {
    const content: string = await fs.readFile(file, { encoding: 'utf8' });
    const { data, content: markdown } = matter(content, { excerpt: false });

    // const text = data.sourceUrl.includes('wikipedia.org') ? '維基百科' : data.sourceUrl.includes('apple.com') ? 'Apple Music' : data.sourceUrl.includes('spotify.com') ? 'Spotify' : data.sourceUrl.includes('163.com') ? '網易雲音樂' : data.sourceUrl.includes('douban.com') ? '豆瓣' : data.sourceUrl.includes('musicbrainz.org') ? 'MusicBrainz' : '其它';
    // const icon = data.sourceUrl.includes('wikipedia.org') ? 'book-open-text' : data.sourceUrl.includes('apple.com') ? 'apple' : data.sourceUrl.includes('spotify.com') ? 'music' : data.sourceUrl.includes('163.com') ? 'disc-2' : data.sourceUrl.includes('douban.com') ? 'book-open' : data.sourceUrl.includes('musicbrainz.org') ? 'list-music' : 'headphones';
    // data.sources = [{ url: data.sourceUrl, text, icon }];
    // delete data.sourceUrl;
    // const newContent = matter.stringify(markdown, data);
    // await fs.writeFile(file, newContent, { encoding: 'utf8' });

    const titleIndex = data.title.lastIndexOf(' - ');
    if (titleIndex <= 0) {
      console.error(`File ${file} has an invalid title format: ${data.title}`);
    } else {
      const tags = data.title.substring(titleIndex + 3);
      if (data.tags.join(' ') !== tags) {
        console.error(`File ${file} has mismatched tags: ${data.tags.join(' ')} vs ${tags}`);
      }
    }

    if (data.title !== data.imageAlt) {
      console.error(
        `File ${file} has mismatched title and imageAlt: ${data.title} vs ${data.imageAlt}`
      );
    }

    const fileName: string = path.parse(file).name;
    if (path.parse(data.image).name !== fileName) {
      console.error(`File ${file} has mismatched image: ${data.image}`);
    }

    const title = fileName.replaceAll('_', ' ');
    if (title !== data.title.substring(0, titleIndex)) {
      console.error(`File ${file} has mismatched title: ${data.title}`);
    }

    const uid = fileName
      .replaceAll(/[_&\+・～]/g, '-')
      .replaceAll(/[!']/g, '')
      .replaceAll(/[\-]{2,}/g, '-')
      .replace(/[\-]+$/, '')
      .toLowerCase();
    if (uid !== data.uid) {
      console.error(`File ${file} has mismatched uid: ${uid} vs ${data.uid}`);
    }

    data.sources.forEach((source: { url: string; text: string; icon: string }) => {
      const sourceUrl = source.url;
      if (sourceUrls.has(sourceUrl)) {
        console.error(`File ${file} has a duplicated sourceUrl: ${sourceUrl}`);
      }
      sourceUrls.add(sourceUrl);

      if (sourceUrl.includes('wikipedia.org')) {
        const wikiFileName = sourceUrl.split('/').pop()!;
        if (existingWikiFileNames.has(wikiFileName)) {
          console.error(`File ${file} has a sourceUrl that is duplicated in wiki: ${sourceUrl}`);
        }
        existingWikiFileNames.add(wikiFileName);
        if (!wikiFileName || !wikiFileNames.includes(wikiFileName)) {
          console.error(`File ${file} has a sourceUrl that does not exist in wiki: ${sourceUrl}`);
        }

        if (markdown.trim() === '') {
          console.error(
            `File ${file} has an empty content for a wikipedia sourceUrl: ${sourceUrl}`
          );
        }
      } else {
        if (markdown.trim()) {
          console.error(
            `File ${file} has a non-empty content for a non-wikipedia sourceUrl: ${sourceUrl}`
          );
        }
      }

      if (
        [
          'wikipedia.org',
          'apple.com',
          'spotify.com',
          '163.com',
          'douban.com',
          'musicbrainz.org',
        ].every((site) => !sourceUrl.includes(site))
      ) {
        console.error(`File ${file} has an invalid sourceUrl: ${sourceUrl}`);
      }

      if (sourceUrl.includes('%')) {
        console.error(`File ${file} has an encoded sourceUrl: ${sourceUrl}`);
      }
    });

    const years = data.tags.filter((tag: string) => /^\d{4}$/.test(tag));
    if (years.length !== 1) {
      console.error(`File ${file} has an invalid year tag: ${years.join(', ')}`);
    } else {
      if (
        !data.publishedAt.startsWith(`${years[0]}-`) ||
        data.publishedAt.length !== '0000-00-00'.length
      ) {
        console.error(
          `File ${file} has a publishedAt date that does not match the year tag: ${data.publishedAt}`
        );
      }
    }

    if (data.author === 'Beyond.ms') {
      console.error(`File ${file} has an invalid author: ${data.author}`);
    }

    if (data.links) {
      data.links.forEach((link: { url: string; text: string; icon: string }) => {
        if (links.has(link.url)) {
          console.error(`File ${file} has a duplicated link URL: ${link.url}`);
        }
        links.add(link.url);
      });
    }

    // if (!data.links && data.sourceUrl.includes('music.apple.com')) {
    //   const separators = lines
    //     .map((line, index) => ({ line, index }))
    //     .filter(({ line }) => line.startsWith('---'));
    //   if (separators.length !== 2) {
    //     console.error(`File ${file} has an invalid number of separators: ${separators.length}`);
    //   } else {
    //     const links = `links:
    // - url: "${data.sourceUrl}"
    //   text: "Apple Music"
    //   icon: "apple"`.split('\n');
    //     lines.splice(separators[1].index, 0, ...links);
    //     await fs.writeFile(file, lines.join('\n'), { encoding: 'utf8' });
    //     console.warn(`File ${file} is missing links, added Apple Music link automatically`);
    //   }
    // }

    if (data.links) {
      const linkUrl = data.links[0].url;
      if (linkUrl.includes('%')) {
        const decodedUrl = decodeURI(linkUrl);
        await fs.writeFile(file, content.replaceAll(linkUrl, decodedUrl), { encoding: 'utf8' });
        console.warn(`File ${file} has an invalid link URL, decoded automatically`);
      }
    }
  });
};
