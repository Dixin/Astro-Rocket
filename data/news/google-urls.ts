import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, dataRootDirectory, fetchString, decodeHtml } from '../common.ts';
import * as cheerio from 'cheerio';
import newsUrls from './google-urls.json' with { type: 'json' };

const newsRootDirectory = path.join(dataRootDirectory, 'news');
const newsUrlDirectory = path.join(newsRootDirectory, 'google-urls');
const urlsFile = path.join(newsRootDirectory, 'google-urls.json');
const urls2File = path.join(newsRootDirectory, 'google-urls2.json');

const rssUrls = {
  en: {
    Beyond: 'https://news.google.com/rss/search?q=beyond+band+hongkong&hl=en-US&gl=US&ceid=US:en',
    'Wong Ka Kui': 'https://news.google.com/rss/search?q=Wong+Ka+Kui&hl=en-US&gl=US&ceid=US:en',
    'Wong Ka Keung': 'https://news.google.com/rss/search?q=Wong+Ka+Keung&hl=en-US&gl=US&ceid=US:en',
    'Paul Wong':
      'https://news.google.com/rss/search?q=Paul+Wong+Hongkong&hl=en-US&gl=US&ceid=US:en',
    'Yip Sai Wing': 'https://news.google.com/rss/search?q=Yip+Sai+Wing&hl=en-US&gl=US&ceid=US:en',
  },
  'zh-CN': {
    Beyond:
      'https://news.google.com/rss/search?q=beyond%E4%B9%90%E9%98%9F&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
    黄家驹:
      'https://news.google.com/rss/search?q=%E9%BB%84%E5%AE%B6%E9%A9%B9&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
    黄家强:
      'https://news.google.com/rss/search?q=%E9%BB%84%E5%AE%B6%E5%BC%BA&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
    黄贯中:
      'https://news.google.com/rss/search?q=%E9%BB%84%E8%B4%AF%E4%B8%AD&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
    叶世荣:
      'https://news.google.com/rss/search?q=%E5%8F%B6%E4%B8%96%E8%8D%A3&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
  },
  'zh-HK': {
    Beyond:
      'https://news.google.com/rss/search?q=beyond%E6%A8%82%E9%9A%8A&hl=zh-HK&gl=HK&ceid=HK:zh-Hant',
    黃家駒:
      'https://news.google.com/rss/search?q=%E9%BB%83%E5%AE%B6%E9%A7%92&hl=zh-HK&gl=HK&ceid=HK:zh-Hant',
    黃家強:
      'https://news.google.com/rss/search?q=%E9%BB%83%E5%AE%B6%E5%BC%B7&hl=zh-HK&gl=HK&ceid=HK:zh-Hant',
    黃貫中:
      'https://news.google.com/rss/search?q=%E9%BB%83%E8%B2%AB%E4%B8%AD&hl=zh-HK&gl=HK&ceid=HK:zh-Hant',
    葉世榮:
      'https://news.google.com/rss/search?q=%E8%91%89%E4%B8%96%E6%A6%AE&hl=zh-HK&gl=HK&ceid=HK:zh-Hant',
  },
  'zh-TW': {
    Beyond:
      'https://news.google.com/rss/search?q=beyond%E6%A8%82%E9%9A%8A&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    黃家駒:
      'https://news.google.com/rss/search?q=%E9%BB%83%E5%AE%B6%E9%A7%92&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    黃家強:
      'https://news.google.com/rss/search?q=%E9%BB%83%E5%AE%B6%E5%BC%B7&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    黃貫中:
      'https://news.google.com/rss/search?q=%E9%BB%83%E8%B2%AB%E4%B8%AD&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    葉世榮:
      'https://news.google.com/rss/search?q=%E8%91%89%E4%B8%96%E6%A6%AE&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
  },
};

type NewsUrlItem = {
  title: string;
  link: string;
  pubDate: Date;
  description: string;
  sourceName: string;
  sourceUrl: string;
  guid: string;
  tags: string[];
};

export const getUrls = async (overwrite: boolean = false) => {
  if (!overwrite && (await exists(urlsFile))) {
    const content = await fs.readFile(urlsFile, 'utf8');
    return JSON.parse(content) as Record<string, Record<string, NewsUrlItem>>;
  }

  const urls: Record<string, Record<string, NewsUrlItem>> = {};
  for (const [locale, urlsOfLocale] of Object.entries(rssUrls)) {
    urls[locale] = {};
    for (const [keyword, rssUrl] of Object.entries(urlsOfLocale)) {
      const rssFile = path.join(newsUrlDirectory, locale, `google-${keyword}.xml`);
      let rss;
      if (!overwrite && (await exists(rssFile))) {
        rss = await fs.readFile(rssFile, 'utf8');
      } else {
        rss = await fetchString(rssUrl);
        await fs.writeFile(rssFile, rss, { encoding: 'utf8' });
      }

      const $: cheerio.CheerioAPI = cheerio.load(rss, {
        xml: {
          selfClosingTags: true,
          lowerCaseTags: false,
          decodeEntities: false,
          // xmlMode: true,
        },
      });
      $('item').each((_index, item) => {
        const $item = $(item);
        const titleText = decodeHtml($item.find('title').text());
        const titleIndex1 = titleText.lastIndexOf(' - ');
        const title1 = titleIndex1 !== -1 ? titleText.substring(0, titleIndex1).trim() : titleText;
        const titleIndex2 = title1.indexOf('_');
        const title2 = titleIndex2 !== -1 ? title1.substring(0, titleIndex2).trim() : title1;
        const link = $item.find('link').text();
        const pubDate = new Date($item.find('pubDate').text());
        const $description = $item.find('description');
        $description.html(decodeHtml($description.html() || ''));
        const descriptionText = decodeHtml($description.find('a').text());
        const descriptionIndex1 = descriptionText.lastIndexOf(' - ');
        const description1 =
          descriptionIndex1 !== -1
            ? descriptionText.substring(0, descriptionIndex1).trim()
            : descriptionText;
        const descriptionIndex2 = description1.indexOf('_');
        const description2 =
          descriptionIndex2 !== -1
            ? description1.substring(0, descriptionIndex2).trim()
            : description1;
        const $source = $item.find('source');
        const sourceName = decodeHtml($source.text());
        const sourceUrl = $source.attr('url') || '';
        const guid = $item.find('guid').text();
        const existing = (newsUrls as Record<string, Record<string, NewsUrlItem>>)[locale][guid];
        if (existing) {
          if (!existing.tags.includes(keyword)) {
            existing.tags.push(keyword);
          }
          return;
        }

        urls[locale][guid] = {
          title: title2,
          link,
          pubDate,
          description: description2,
          sourceName,
          sourceUrl,
          guid,
          tags: [keyword],
        } as NewsUrlItem;
      });
    }
  }

  await fs.writeFile(urls2File, JSON.stringify(urls, null, 2), { encoding: 'utf8' });
  return urls;
};

export const writeUrls = async (overwrite: boolean = false) => {
  // const htmlFiles = (await readFiles(newsUrlDirectory, false, '.html')).filter((file) =>
  //     file.includes('google')
  // );
  // for (const htmlFile of htmlFiles) {
  //     const htmlContent = await fs.readFile(htmlFile, 'utf8');
  //     const $: cheerio.CheerioAPI = cheerio.load(htmlContent, {
  //         xml: {
  //             selfClosingTags: true,
  //             lowerCaseTags: false,
  //             decodeEntities: false,
  //         },
  //     });
  //     console.warn(htmlFile);
  //     console.warn($('c-wiz.XBspb').length);
  // }

  const urls = await getUrls(overwrite);
  const itemSet = new Set<string>();
  Object.entries(urls).forEach(([_keyword, urlsByLocale]) => {
    for (const [_locale, item] of Object.entries(urlsByLocale)) {
      const itemKey = item.guid;
      if (!itemSet.has(itemKey)) {
        itemSet.add(itemKey);
      }
    }
  });
  const uniqueCount = itemSet.size;
  console.warn(`Unique items: ${uniqueCount}`);
};

export const printUrls = () => {
  for (const [locale, urlsOfLocale] of Object.entries(
    newsUrls as Record<string, Record<string, NewsUrlItem>>
  )) {
    const items = Object.entries(urlsOfLocale).map(([_guid, item]) => item);
    console.warn(`Locale: ${locale}, Items: ${items.length}`);
    const groups = Object.groupBy(items, (item) => item.sourceUrl);
    for (const [sourceUrl, sourceItems] of Object.entries(groups).sort(
      ([_source1, group1], [_source2, group2]) => group2!.length - group1!.length
    )) {
      console.warn(`  Source: ${sourceUrl}, Items: ${sourceItems!.length}`);
    }
  }

  const items = Object.entries(newsUrls.en as Record<string, NewsUrlItem>)
    .map(([_guid, item]) => item)
    .filter((item) => item.sourceUrl.includes('scmp.com'))
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  items.forEach((item) => {
    console.warn(`  ${new Date(item.pubDate).toISOString().substring(0, 10)} ${item.title}`);
  });
};

export const updateUrls = async () => {
  const urlsByLocale: Record<string, Record<string, NewsUrlItem>> = {};
  for (const [locale, urlsOfLocale] of Object.entries(
    newsUrls as Record<string, Record<string, NewsUrlItem>>
  )) {
    const items = Object.entries(urlsOfLocale)
      .map(([_guid, item]) => item)
      .sort((a, b) => {
        const order = new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
        return order !== 0 ? order : a.title.localeCompare(b.title);
      });

    urlsByLocale[locale] = {};
    for (const item of items) {
      urlsByLocale[locale][item.guid] = item;
    }
  }

  const backupFile = urlsFile + '.bak';
  if (await exists(backupFile)) {
    await fs.unlink(backupFile);
  }
  await fs.rename(urlsFile, backupFile);
  await fs.writeFile(urlsFile, JSON.stringify(urlsByLocale, null, 2), { encoding: 'utf8' });
};

const mapKeyword = (keyword: string, locale: string): string => {
  switch (keyword.toLowerCase()) {
    case 'beyond':
      return 'Beyond';
    case 'koma':
      switch (locale) {
        case 'en':
          return 'Wong Ka Kui';
        case 'zh-CN':
          return '黄家驹';
        case 'zh-HK':
        case 'zh-TW':
          return '黃家駒';
        default:
          throw new Error(`Unknown locale: ${locale}`);
      }
    case 'steve':
      switch (locale) {
        case 'en':
          return 'Wong Ka Kui';
        case 'zh-CN':
          return '黄家强';
        case 'zh-HK':
        case 'zh-TW':
          return '黃家強';
        default:
          throw new Error(`Unknown locale: ${locale}`);
      }
    case 'paul':
      switch (locale) {
        case 'en':
          return 'Paul Wong';
        case 'zh-CN':
          return '黄贯中';
        case 'zh-HK':
        case 'zh-TW':
          return '黃貫中';
        default:
          throw new Error(`Unknown locale: ${locale}`);
      }
    case 'wing':
      switch (locale) {
        case 'en':
          return 'Yip Sai Wing';
        case 'zh-CN':
          return '叶世荣';
        case 'zh-HK':
        case 'zh-TW':
          return '葉世榮';
        default:
          throw new Error(`Unknown locale: ${locale}`);
      }
    default:
      throw new Error(`Unknown keyword: ${keyword}`);
  }
};
