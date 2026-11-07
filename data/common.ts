import path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { chromium, type Page, type Response } from 'playwright';
import { setTimeout } from 'timers/promises';
import fetchSync from 'sync-fetch';
import { compile } from '@mdx-js/mdx';
//import * as Iconv from 'iconv-lite';

declare global {
  interface Array<T> {
    forEachAsync(callback: (value: T, index: number, array: T[]) => Promise<void>): Promise<void>;

    mapAsync<Result>(
      callback: (value: T, index: number, array: T[]) => Promise<Result>
    ): Promise<Result[]>;
  }

  interface Array<T extends string | number | symbol> {
    distinct(): T[];
  }
}

if (!Array.prototype.distinct) {
  Array.prototype.distinct = function <T>(this: T[]): T[] {
    const seen = new Set<T>();
    return this.filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  };
}

if (!Array.prototype.forEachAsync) {
  Array.prototype.forEachAsync = async function <T>(
    this: T[],
    callback: (value: T, index: number, array: T[]) => Promise<boolean | void>
  ): Promise<void> {
    for (let index = 0; index < this.length; index++) {
      if (await callback(this[index], index, this)) {
        break;
      }
    }
  };
}

if (!Array.prototype.mapAsync) {
  Array.prototype.mapAsync = async function <T, Result>(
    this: T[],
    callback: (value: T, index: number, array: T[]) => Promise<Result>
  ): Promise<Result[]> {
    const results: Result[] = [];
    for (let index = 0; index < this.length; index++) {
      results.push(await callback(this[index], index, this));
    }
    return results;
  };
}

export const toFileName = (name: string): string => {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
};

export const uidRegex =
  /^[a-z0-9\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+(?:-[a-z0-9\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+)*$/u;

export const toUid = (title: string): string => {
  // \u00A0 No-Break Space (NBSP)
  // \u00AD soft hyphen
  // \u200B zero-width space
  // \uDFB8, \uDCCD, \uDCF8, \uDFB6 are some special characters that may appear in titles
  // \u2010, \u2011, \u2012, \u2013, \u2014, \u2015, \uFF0D are various dash characters
  // \u3000 is ideographic space
  const uid = title
    .toLowerCase()
    .replaceAll(
      /[_!@#&$~,<>:;"/|│?*+^\\.[\](){}【】（）“”‘’『』「」《》〈〉❺／＠、，。·￥…—‧·・•～？！︰：﹕；×∽｜︱丨🎂🤘🏻💥⏰\uDFB8\uDCCD\uDCF8\uDFB6\u2010\u2011\u2012\u2013\u2014\u2015\uFF0D\u3000]|\s+/g,
      '-'
    )
    .replaceAll(/['\u00A0\u00AD\u200B]/g, '')
    .replaceAll('℃', 'c')
    .replaceAll(/[-]{2,}/g, '-')
    .replace(/[-]+$/, '')
    .replace(/^[-]+/, '');
  if (!uid || !uidRegex.test(uid)) {
    throw new Error(`Invalid title to uid: ${title} => ${uid}`);
  }
  return uid;
};

export const dataRootDirectory = import.meta.dirname;

export const exists = async (path: string): Promise<boolean> => {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
};

export const getLanguageFromLocale = (locale: string): string => {
  const language = locale.split('-')[0];
  return language;
};

export const readFiles = async (
  directory: string,
  isRecursive = true,
  extension: string | undefined = undefined
): Promise<string[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (isRecursive && entry.isDirectory()) {
      files.push(...(await readFiles(fullPath, isRecursive, extension)));
    } else if (entry.isFile() && (!extension || entry.name.endsWith(extension))) {
      files.push(fullPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
};

export const readDirectories = async (directory: string, isRecursive = true): Promise<string[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const directories: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (isRecursive && entry.isDirectory()) {
      directories.push(...(await readDirectories(fullPath, isRecursive)));
    } else if (entry.isDirectory()) {
      directories.push(fullPath);
    }
  }
  return directories.sort((a, b) => a.localeCompare(b));
};

const headers = {
  'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  Accept: '*/*',
  Origin: 'https://news.google.com',
  Referer: 'https://news.google.com/',
  'Sec-Ch-Ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

export const fetchFile = async (url: string, filePath: string): Promise<void> => {
  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
  }
  const fileData = await response.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(fileData));
};

export const fetchFileSync = (url: string, filePath: string): void => {
  const response = fetchSync(url, {
    headers,
  });
  if (!response.ok) {
    throw new Error(
      `Failed to download file from ${url}: ${response.status} ${response.statusText}`
    );
  }
  const fileData = response.arrayBuffer();
  fsSync.writeFileSync(filePath, Buffer.from(fileData));
};

export const fetchString = async (
  url: string,
  cookie?: string,
  encoding?: string
): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      ...headers,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
  }
  // if (response.redirected) {
  //   console.warn(`Redirected to ${response.url} from ${url}`);
  // }
  if (!encoding || encoding.toLowerCase() === 'utf8' || encoding.toLowerCase() === 'utf-8') {
    return await response.text();
  }
  const decoder = new TextDecoder(encoding);
  const arrayBuffer = await response.arrayBuffer();
  return decoder.decode(arrayBuffer);
};

export const decodeHtml = (html: string): string => {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, '`')
    .replace(/&#x3D;/g, '=');
};

export const downloadHtmlsAndImages = async (
  urls: string[],
  htmlFulfilled: (page: Page, url: string) => Promise<void>,
  htmlRejected?: (page: Page, url: string, error: Error) => Promise<void>,
  mediaFulfilled?: (
    mediaUrl: string,
    htmlUrl: string,
    resourceType: string,
    page: Page,
    response: Response
  ) => Promise<void>,
  loadMedia: boolean = false,
  wait: number = 1000,
  cookies: ReadonlyArray<{
    name: string;

    value: string;

    /**
     * Either `url` or both `domain` and `path` are required. Optional.
     */
    url?: string;

    /**
     * For the cookie to apply to all subdomains as well, prefix domain with a dot, like this: ".example.com". Either
     * `url` or both `domain` and `path` are required. Optional.
     */
    domain?: string;

    /**
     * Either `url` or both `domain` and `path` are required. Optional.
     */
    path?: string;

    /**
     * Unix time in seconds. Optional.
     */
    expires?: number;

    /**
     * Optional.
     */
    httpOnly?: boolean;

    /**
     * Optional.
     */
    secure?: boolean;

    /**
     * Optional.
     */
    sameSite?: 'Strict' | 'Lax' | 'None';

    /**
     * For partitioned third-party cookies (aka
     * [CHIPS](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies)), the
     * partition key. Optional.
     */
    partitionKey?: string;
  }> = []
) => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  });
  if (cookies.length > 0) {
    context.addCookies(cookies);
  }
  const page = await context.newPage();
  const mediaRegex = /\.(jpg|jpeg|png|gif|webp|mp4|mov)$/i;

  if (!loadMedia) {
    await page.route('**/*', async (route) => {
      const request = route.request();
      const resourceType = request.resourceType().toLowerCase();
      if (
        resourceType === 'image' ||
        resourceType === 'media' ||
        mediaRegex.test(new URL(request.url()).pathname)
      ) {
        await route.abort();
      } else {
        await route.continue();
      }
    });
  }

  let htmlUrl: string;
  if (mediaFulfilled) {
    page.on('response', async (response) => {
      const request = response.request();
      const resourceType = request.resourceType().toLowerCase();
      const mediaUrl = response.url();
      if (
        (resourceType === 'image' ||
          resourceType === 'media' ||
          mediaRegex.test(new URL(mediaUrl).pathname)) &&
        response.ok()
      ) {
        await mediaFulfilled(mediaUrl, htmlUrl, resourceType, page, response);
      }
    });
  }

  const htmls: { url: string; finalUrl: string; isFulfilled: boolean }[] = [];
  await urls.forEachAsync(async (url) => {
    htmlUrl = url;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (error) {
      console.error(`Failed to download ${url}:`, error);
      if (htmlRejected) {
        await htmlRejected(page, url, error as Error);
      }
      htmls.push({ url, finalUrl: page.url(), isFulfilled: false });
      return;
    }

    await htmlFulfilled(page, url);
    htmls.push({ url, finalUrl: page.url(), isFulfilled: true });
    await setTimeout(wait); // Wait for the specified time to ensure all images are loaded
  });

  await browser.close();
  return htmls;
};

export const compileMdx = async (directory: string): Promise<void> => {
  const mdxFiles = await readFiles(directory, true, '.mdx');

  console.warn(`Checking ${mdxFiles.length} MDX files for syntax errors...`);

  const results = await mdxFiles.mapAsync(async (file) => {
    const content = await fs.readFile(file, { encoding: 'utf8' });
    try {
      await compile(content);
      return true;
    } catch (error) {
      const errorName = error instanceof Error ? error.name : '';
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`\n\n${file}:${errorName}`);
      console.error(errorMessage);
      return false;
    }
  });

  console.warn(
    `\nMDX syntax check completed. ${results.filter((result) => result).length} passed, ${results.filter((result) => !result).length} failed.`
  );
};

// export const convertEncoding = (content: Buffer, fromEncoding: string = 'gb2312', toEncoding: string = 'utf8'): Buffer => {
//   const decodedContent = Iconv.decode(content, fromEncoding);
//   const encodedContent = Iconv.encode(decodedContent, toEncoding);
//   return encodedContent;
// };

// export const convertFileEncoding = async (filePath: string, fromEncoding: string = 'gb2312', toEncoding: string = 'utf8'): Promise<void> => {
//   const content = await fs.readFile(filePath);
//   const convertedContent = convertEncoding(content, fromEncoding, toEncoding);
//   await fs.rename(filePath, `${filePath}.bak`); // Backup the original file
//   await fs.writeFile(filePath, convertedContent);
// };

// export const convertDirectoryEncoding = async (directory: string, extension?: string, fromEncoding: string = 'gb2312', toEncoding: string = 'utf8'): Promise<void> => {
//   const files = await readFiles(directory, true, extension);
//   for (const file of files) {
//     await convertFileEncoding(file, fromEncoding, toEncoding);
//   }
// };
