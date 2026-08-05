import * as fs from 'fs/promises';
import * as path from 'path';
import { exists, dataRootDirectory, readFiles, downloadString, decodeHtml } from '../common.ts';
import { chromium } from 'playwright';
import { setTimeout } from 'timers/promises';
import * as cheerio from 'cheerio';

const newsRootDirectory = path.join(dataRootDirectory, 'news');
const newsUrlDirectory = path.join(newsRootDirectory, 'url');
const newsGoogleRssUrls = {
    beyond: {
        en: 'https://news.google.com/rss/search?q=beyond+band+hongkong&hl=en-US&gl=US&ceid=US:en',
        'zh-CN':
            'https://news.google.com/rss/search?q=beyond%E4%B9%90%E9%98%9F&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
        'zh-HK':
            'https://news.google.com/rss/search?q=beyond%E6%A8%82%E9%9A%8A&hl=zh-HK&gl=HK&ceid=HK:zh-Hant',
        'zh-TW':
            'https://news.google.com/rss/search?q=beyond%E6%A8%82%E9%9A%8A&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    },
    黄家驹: {
        en: 'https://news.google.com/rss/search?q=Wong+Ka+Kui&hl=en-US&gl=US&ceid=US:en',
        'zh-CN':
            'https://news.google.com/rss/search?q=%E9%BB%84%E5%AE%B6%E9%A9%B9&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
        'zh-HK':
            'https://news.google.com/rss/search?q=%E9%BB%83%E5%AE%B6%E9%A7%92&hl=zh-HK&gl=HK&ceid=HK:zh-Hant',
        'zh-TW':
            'https://news.google.com/rss/search?q=%E9%BB%83%E5%AE%B6%E9%A7%92&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    },
    黄家强: {
        en: 'https://news.google.com/rss/search?q=Wong+Ka+Keung&hl=en-US&gl=US&ceid=US:en',
        'zh-CN':
            'https://news.google.com/rss/search?q=%E9%BB%84%E5%AE%B6%E5%BC%BA&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
        'zh-HK':
            'https://news.google.com/rss/search?q=%E9%BB%83%E5%AE%B6%E5%BC%B7&hl=zh-HK&gl=HK&ceid=HK:zh-Hant',
        'zh-TW':
            'https://news.google.com/rss/search?q=%E9%BB%83%E5%AE%B6%E5%BC%B7&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    },
    黄贯中: {
        en: 'https://news.google.com/rss/search?q=Paul+Wong+Hongkong&hl=en-US&gl=US&ceid=US:en',
        'zh-CN':
            'https://news.google.com/rss/search?q=%E9%BB%84%E8%B4%AF%E4%B8%AD&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
        'zh-HK':
            'https://news.google.com/rss/search?q=%E9%BB%83%E8%B2%AB%E4%B8%AD&hl=zh-HK&gl=HK&ceid=HK:zh-Hant',
        'zh-TW':
            'https://news.google.com/rss/search?q=%E9%BB%83%E8%B2%AB%E4%B8%AD&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    },
    叶世荣: {
        'zh-CN':
            'https://news.google.com/rss/search?q=%E5%8F%B6%E4%B8%96%E8%8D%A3&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
        'zh-HK':
            'https://news.google.com/rss/search?q=%E8%91%89%E4%B8%96%E6%A6%AE&hl=zh-HK&gl=HK&ceid=HK:zh-Hant',
        'zh-TW':
            'https://news.google.com/rss/search?q=%E8%91%89%E4%B8%96%E6%A6%AE&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    },
};

type GoogleNewsUrlItem = {
    title: string;
    link: string;
    pubDate: Date;
    description: string;
    sourceName: string;
    sourceUrl: string;
    guid: string;
};

const getGoogleUrls = async (overwrite: boolean = false) => {
    const googleUrlsFile = path.join(newsUrlDirectory, 'google.json');
    if (!overwrite && (await exists(googleUrlsFile))) {
        const content = await fs.readFile(googleUrlsFile, 'utf8');
        return JSON.parse(content) as Record<string, Record<string, GoogleNewsUrlItem[]>>;
    }

    const urls: Record<string, Record<string, GoogleNewsUrlItem[]>> = {};
    for (const [keyword, urlsByLocale] of Object.entries(newsGoogleRssUrls)) {
        urls[keyword] = {};
        for (const [locale, rssUrl] of Object.entries(urlsByLocale)) {
            const rssFile = path.join(newsUrlDirectory, keyword, `google.${locale}.xml`);
            let rss;
            if (!overwrite && (await exists(rssFile))) {
                rss = await fs.readFile(rssFile, 'utf8');
            } else {
                rss = await downloadString(rssUrl);
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
            const items = $('item')
                .map((_, item) => {
                    const $item = $(item);
                    const titleText = decodeHtml($item.find('title').text());
                    const titleIndex1 = titleText.lastIndexOf(' - ');
                    const title1 =
                        titleIndex1 !== -1 ? titleText.substring(0, titleIndex1).trim() : titleText;
                    const titleIndex2 = title1.indexOf('_');
                    const title2 =
                        titleIndex2 !== -1 ? title1.substring(0, titleIndex2).trim() : title1;
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
                    return {
                        title: title2,
                        link,
                        pubDate,
                        description: description2,
                        sourceName,
                        sourceUrl,
                        guid,
                    } as GoogleNewsUrlItem;
                })
                .toArray();

            urls[keyword][locale] = items;
        }
    }

    await fs.writeFile(googleUrlsFile, JSON.stringify(urls, null, 2), { encoding: 'utf8' });
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

    const urls = await getGoogleUrls(overwrite);
    let totalCount = 0;
    Object.entries(urls).forEach(([keyword, urlsByLocale]) => {
        for (const [locale, items] of Object.entries(urlsByLocale)) {
            totalCount += items.length;
        }
    });
    const itemSet = new Set<string>();
    Object.entries(urls).forEach(([keyword, urlsByLocale]) => {
        for (const [locale, items] of Object.entries(urlsByLocale)) {
            for (const item of items) {
                const itemKey = item.guid;
                if (!itemSet.has(itemKey)) {
                    itemSet.add(itemKey);
                }
            }
        }
    });
    const uniqueCount = itemSet.size;
    console.log(`Total items: ${totalCount}, Unique items: ${uniqueCount}`);
};
