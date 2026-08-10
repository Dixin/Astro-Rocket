import * as fs from 'fs/promises';
import * as path from 'path';
import { exists } from '../common.ts';
import { chromium } from 'playwright';
import { setTimeout } from 'timers/promises';

export const currentDataRootDirectory = import.meta.dirname;
const listFileDirectory = path.join(currentDataRootDirectory, 'url');
export const getUrlListFile = (language: string) => path.join(listFileDirectory, `${language}.txt`);
const getHtmlSubDirectory = (locale: string) =>
    path.join(currentDataRootDirectory, 'html-raw', locale);

export const defaultLocale = path.parse(currentDataRootDirectory).name;
const urlName = `${defaultLocale}pedia`;
export const urlDomain = `${urlName}.org`;

const imageRootDirectory = path.resolve(
    currentDataRootDirectory,
    '../../src/assets',
    defaultLocale
);
export const imagesToSkip = [
    '.svg.png',
    '.svg',
    '.gif',
    'Icon_pdf_file.png',
    `${urlName}.png`,
    '40px-Wikipetan-manga.png',
    'Trustly_logos_only.png',
    '20px-EC1835_C_cut.jpg',
    'load.php',
];

export const languageLocales = {
    en: [defaultLocale],
    zh: ['zh-CN', 'zh-HK', 'zh-MO', 'zh-SG', 'zh-TW'].sort((a, b) => a.localeCompare(b)),
};

const downloadHtmlContent = async (
    url: string,
    language: string,
    locale: string = defaultLocale
): Promise<string> => {
    const baseUrl = `https://${language}.${urlDomain}/${defaultLocale}/`;
    // Validate the URL format
    if (!url.startsWith(baseUrl)) {
        throw new Error(`Invalid URL. It must start with ${baseUrl}`);
    }

    const localeUrl = url.replace(baseUrl, `https://${language}.${urlDomain}/${locale}/`);
    const response = await fetch(localeUrl, {
        method: 'GET',
        headers: {
            Accept: 'text/html',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.text();
};

export const downloadHtmlsAndImages = async (
    overwriteHtml: boolean = false,
    overwriteImages: boolean = false
) => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    page.on('response', async (response) => {
        if (response.request().resourceType() === 'image' && response.ok()) {
            try {
                const url = response.url();
                const imageFileName = decodeURIComponent(url.split('/').pop()!.split('?')[0]);
                if (!imageFileName) {
                    throw new Error(`Could not extract filename from URL: ${url}`);
                }
                if (imagesToSkip.some((skip) => imageFileName.endsWith(skip))) {
                    return;
                }
                const imageFilePath = path.join(imageRootDirectory, imageFileName);
                if (!overwriteImages && (await exists(imageFilePath))) {
                    console.warn(`Image already exists and overwrite is false: ${imageFileName}`);
                    return;
                }

                const buffer = await response.body();
                await fs.writeFile(imageFilePath, buffer);
                console.warn(`Downloaded image: ${imageFileName}`);
            } catch (error) {
                console.error(`Failed to download image from ${response.url()}:`, error);
            }
        }
    });

    const languageLocale = Object.entries(languageLocales).flatMap(([language, locales]) =>
        locales.map((locale) => ({ language, locale }))
    );

    const htmlFiles: { file: string; isSkipped: boolean }[] = [];
    for (const { language, locale } of languageLocale) {
        const urls = await getUrlsFromListFile(getUrlListFile(language));
        const htmlDirectory = getHtmlSubDirectory(locale === defaultLocale ? language : locale);
        if (!(await exists(htmlDirectory))) {
            await fs.mkdir(htmlDirectory, { recursive: true });
        }

        // Open the web page
        for (const url of urls) {
            const baseUrl = `https://${language}.${urlDomain}/${defaultLocale}/`;
            // Validate the URL format
            if (!url.startsWith(baseUrl)) {
                throw new Error(`Invalid URL. It must start with ${baseUrl}`);
            }

            const localeUrl = url.replace(
                baseUrl,
                `https://${language}.${urlDomain}/${locale.toLowerCase()}/`
            );

            try {
                const htmlFileName =
                    urlPathToFileName(decodeURIComponent(url.split('/').pop()!)) + '.html';
                const htmlFilePath = path.join(htmlDirectory, htmlFileName);
                if (!overwriteHtml && (await exists(htmlFilePath))) {
                    console.warn(`File already exists, skipping: ${htmlFilePath}`);
                    htmlFiles.push({ file: htmlFilePath, isSkipped: true });
                    continue;
                }

                await page.goto(localeUrl, { waitUntil: 'networkidle' });
                const htmlContent = await page.content();
                await fs.writeFile(htmlFilePath, htmlContent, { encoding: 'utf8' });
                console.warn(`Downloaded and saved HTML for ${url} to ${htmlFilePath}`);
                htmlFiles.push({ file: htmlFilePath, isSkipped: false });
                await setTimeout(1000); // Wait for 2 seconds to ensure all images are loaded
            } catch (err) {
                console.error(`Failed to download ${url}:`, err);
            }
        }
    }

    await browser.close();

    return htmlFiles;
};

const getHtmlFileName = (url: string): string =>
    urlPathToFileName(decodeURIComponent(url.split('/').pop()!));

const downloadAllHtmlByLanguageLocale = async (
    language: string,
    locale: string = defaultLocale,
    overwrite = false
) => {
    const urls = await getUrlsFromListFile(getUrlListFile(language));
    const htmlDirectory = getHtmlSubDirectory(locale === defaultLocale ? language : locale);
    const htmlFiles: { file: string; isSkipped: boolean }[] = [];
    if (!(await exists(htmlDirectory))) {
        await fs.mkdir(htmlDirectory, { recursive: true });
    }

    for (const url of urls) {
        try {
            const htmlFileName = getHtmlFileName(url);
            const htmlFilePath = path.join(htmlDirectory, `${htmlFileName}.html`);
            if (!overwrite && (await exists(htmlFilePath))) {
                console.warn(`File already exists, skipping: ${htmlFilePath}`);
                htmlFiles.push({ file: htmlFilePath, isSkipped: true });
                continue;
            }

            console.warn(`Downloading: ${url}`);
            const content = await downloadHtmlContent(url, language, locale);
            console.warn(`Downloaded content length: ${content.length}`);
            await fs.writeFile(htmlFilePath, content, { encoding: 'utf8' });
            console.warn(`Saved to: ${htmlFilePath}`);
            htmlFiles.push({ file: htmlFilePath, isSkipped: false });
        } catch (err) {
            console.error(`Failed to download ${url}:`, err);
        }
    }

    return htmlFiles;
};

const getUrlsFromListFile = async (listFile: string): Promise<string[]> => {
    return (await fs.readFile(listFile, { encoding: 'utf8' }))
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .distinct()
        .sort((a, b) => a.localeCompare(b));
};

export const downloadAllHtmlFiles = async (overwrite = false) => {
    return (
        await Promise.all(
            Object.entries(languageLocales)
                .flatMap(([language, locales]) => locales.map((locale) => ({ language, locale })))
                .map(({ language, locale }) =>
                    downloadAllHtmlByLanguageLocale(language, locale, overwrite)
                )
        )
    ).flatMap((files) => files);
};

export const urlPathToFileName = (urlPath: string): string => urlPath.replaceAll(':', '----');

export const fileNameToUrlPath = (fileName: string): string => fileName.replaceAll('----', ':');
