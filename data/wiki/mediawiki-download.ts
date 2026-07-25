import * as fs from 'fs/promises';
import * as path from 'path';
import { exists } from '../common';
import { defaultLocale, urlDomain } from './html-download';
const __dirname = import.meta.dirname;

const listFile = path.resolve(__dirname, 'list.txt');
const getMediaDirectory = (chineseLocale: string) =>
    path.resolve(__dirname, 'media', chineseLocale);

const chineseLocales = ['zh-cn', 'zh-tw', 'zh-hk', 'zh-sg', 'zh-mo'].sort((a, b) =>
    a.localeCompare(b)
);

const downloadMedia = async (chineseUrl: string, chineseLocale: string): Promise<string> => {
    // Validate the URL format
    if (!chineseUrl.startsWith(`https://zh.${urlDomain}/${defaultLocale}/`)) {
        throw new Error(`Invalid URL. It must start with https://zh.${urlDomain}/${defaultLocale}/`);
    }

    // 1. Extract and decode the title from the end of the URL
    const baseUrl = `https://zh.${urlDomain}/${chineseLocale}/Special:Export`;
    const rawTitle = chineseUrl.split('/').pop()!;
    const title = decodeURIComponent(rawTitle);

    if (!title) {
        throw new Error('No page title found in the provided URL.');
    }

    // 2. Set up the form parameters required by the Export page
    const params = new URLSearchParams({
        action: 'submit',
        pages: title,
        curonly: '1', // 1 for current version only, 0 for full history
    });

    // 3. Fetch the data using a POST request
    const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
        },
        body: params.toString(),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // 4. Return the raw XML text
    return await response.text();
};

const getFileName = (url: string): string =>
    decodeURIComponent(url.split('/').pop()!).replaceAll(':', '-') + '.xml';

const download = async (chineseLocale: string, overwrite = false) => {
    const mediaDirectory = getMediaDirectory(chineseLocale);
    if (!(await exists(mediaDirectory))) {
        await fs.mkdir(mediaDirectory, { recursive: true });
    }

    const urls = (await fs.readFile(listFile, { encoding: 'utf8' }))
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    for (const url of urls) {
        try {
            const filename = getFileName(url);
            const outputPath = path.join(mediaDirectory, filename);
            if (!overwrite && (await exists(outputPath))) {
                console.log(`File already exists, skipping: ${outputPath}`);
                continue;
            }

            console.log(`Downloading: ${url}`);
            const content = await downloadMedia(url, chineseLocale);
            console.log(`Downloaded content length: ${content.length}`);
            await fs.writeFile(outputPath, content, { encoding: 'utf8' });
            console.log(`Saved to: ${outputPath}`);
        } catch (err) {
            console.error(`Failed to download ${url}:`, err);
        }
    }
};

const main = async () => {
    for (const chineseLocale of chineseLocales) {
        console.log(`Processing locale: ${chineseLocale}`);
        await download(chineseLocale, false);
    }
};

await main();
