import cookies from './netease-cookies.json' with { type: 'json' };
import { chromium } from 'playwright';
import { downloadHtmlsAndImages, readFiles, toFileName } from '../common.ts';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

export const currentDataRootDirectory = import.meta.dirname;
const neteaseAlbumRawHtmlDirectory = path.join(currentDataRootDirectory, 'netease-raw-albums');
const neteaseSongRawHtmlDirectory = path.join(currentDataRootDirectory, 'netease-raw-songs');
const neteaseAlbumListHtmlFile = path.join(currentDataRootDirectory, 'netease-list-albums.html');

export const downloadNeteaseAlbumHtmlFiles = async () => {
  const existingAlbumFiles = await readFiles(neteaseAlbumRawHtmlDirectory);
  const existingAlbumIds = existingAlbumFiles.map((file) => path.parse(file).name);
  const htmlContent = await fs.readFile(neteaseAlbumListHtmlFile, { encoding: 'utf8' });
  const $: cheerio.CheerioAPI = cheerio.load(htmlContent, {
    xml: {
      selfClosingTags: true,
      lowerCaseTags: false,
      decodeEntities: false,
    },
  });
  const albumIds = $('a.tit')
    .map((_index, link) => $(link).attr('href'))
    .toArray()
    .filter((href) => href && href.startsWith('/album?id='))
    .map((href) => href.replace('/album?id=', ''))
    .distinct()
    .filter((id) => !existingAlbumIds.includes(id));

  console.log(`Found ${albumIds.length} new albums to download.`);

  const urls = albumIds.map((id) => `https://music.163.com/#/album?id=${id}`);

  await downloadHtmlsAndImages(
    urls,
    cookies,
    (url) => path.join(neteaseAlbumRawHtmlDirectory, `${url.split('id=')[1]}.html`),
    async (page) => {
      const frame = page.frame({ name: 'contentFrame' });
      if (!frame) {
        throw new Error('Frame not found');
      }
      return await frame.content();
    }
  );
};

export const downloadNeteaseSongHtmlFiles = async () => {
  const existingSongFiles = await readFiles(neteaseSongRawHtmlDirectory);
  const existingSongIds = existingSongFiles.map((file) => path.parse(file).name.split('^').at(-1)!);
  const albumFiles = await readFiles(neteaseAlbumRawHtmlDirectory);
  const songs: Record<
    string,
    {
      albumDate: string;
      albumId: string;
      albumTitle: string;
      songId: string;
      songTitle: string;
      songTrackNumber: string;
    }
  > = {};
  const songUrls: string[] = [];
  await albumFiles.forEachAsync(async (file) => {
    const albumHtml = await fs.readFile(file, { encoding: 'utf8' });
    if(!albumHtml.endsWith('</html>')) {
      console.error(`Album HTML file ${file} is not complete. Skipping this file.`);
      return;
    }
    const $: cheerio.CheerioAPI = cheerio.load(albumHtml, {
      xml: {
        selfClosingTags: true,
        lowerCaseTags: false,
        decodeEntities: false,
      },
    });
    const $json = $('script[type="application/ld+json"]');
    const albumJson = JSON.parse($json.eq(0).html()!);
    const songsJson = JSON.parse($json.eq(1).html()!);
    songsJson.track.itemListElement.forEach((item: { url: string; name: string; position: number }) => {
      const songId = item.url.split('id=')[1];
      if (existingSongIds.includes(songId)) {
        return;
      }
      songs[songId] = {
        albumDate: songsJson.datePublished.substring(0, 10),
        albumId: albumJson['@id'].split('id=')[1],
        albumTitle: albumJson.title.replaceAll('^', '-'),
        songId,
        songTitle: item.name.replaceAll('^', '-'),
        songTrackNumber: item.position < 10 ? `0${item.position.toString(10)}` : item.position.toString(10),
      };
      songUrls.push(`https://music.163.com/#/song?id=${songId}`);
    });
  });

  console.log(`Found ${songUrls.length} new songs to download.`);

  await downloadHtmlsAndImages(
    songUrls,
    cookies,
    (url) => {
      const songId = url.split('id=')[1];
      const song = songs[songId];
      return path.join(neteaseSongRawHtmlDirectory, toFileName(`${song.albumDate}^${song.albumTitle}^${song.albumId}^${song.songTrackNumber}^${song.songTitle}^${songId}.html`));
    },
    async (page) => {
      const frame = page.frame({ name: 'contentFrame' });
      if (!frame) {
        throw new Error('Frame not found');
      }
      return await frame.content();
    }
  );
};
