import path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { chromium, type Page } from 'playwright';
import { setTimeout } from 'timers/promises';
import fetchSync from 'sync-fetch';
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
    callback: (value: T, index: number, array: T[]) => Promise<void>
  ): Promise<void> {
    for (let index = 0; index < this.length; index++) {
      await callback(this[index], index, this);
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
  const uid = title
    .toLowerCase()
    .replaceAll(
      /[_!&,<>:"/|│?*+^\\.[\](){}【】（）“”‘’『』「」《》〈〉、，。·￥…—·・～？！：﹕；×∽｜\u3000]|\s+/g,
      '-'
    )
    .replaceAll(/[']/g, '')
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

export const fetchFile = async (url: string, filePath: string): Promise<void> => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
  }
  const fileData = await response.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(fileData));
};

export const fetchFileSync = (url: string, filePath: string): void => {
  const response = fetchSync(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to download file from ${url}: ${response.status} ${response.statusText}`
    );
  }
  const fileData = response.arrayBuffer();
  fsSync.writeFileSync(filePath, Buffer.from(fileData));
};

export const fetchString = async (url: string, cookie?: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
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
  return await response.text();
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
  }>,
  getHtmlFilePath: (url: string) => Promise<string | undefined>,
  getHtml?: (page: Page) => Promise<string>,
  getMediaFilePath?: (
    mediaUrl: string,
    mediaType: string,
    htmlUrl: string
  ) => Promise<string | undefined>,
  overwriteHtml: boolean = false,
  overwriteImages: boolean = false,
  loadMedia: boolean = false,
  wait: number = 1000
) => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  });
  context.addCookies(cookies);
  const page = await context.newPage();
  const mediaRegex = /\.(jpg|jpeg|png|gif|webp|mp4|mov)$/i;

  if (!loadMedia) {
    await page.route('**/*', async (route) => {
      const request = route.request();
      const resourceType = request.resourceType().toLowerCase();
      if (resourceType === 'image' || resourceType === 'media' || mediaRegex.test(request.url())) {
        await route.abort();
      } else {
        await route.continue();
      }
    });
  }

  let htmlUrl: string;
  if (getMediaFilePath) {
    page.on('response', async (response) => {
      const request = response.request();
      const resourceType = request.resourceType().toLowerCase();
      const mediaUrl = response.url();
      if (
        (resourceType === 'image' || resourceType === 'media' || mediaRegex.test(request.url())) &&
        response.ok()
      ) {
        try {
          const imageFilePath = await getMediaFilePath(mediaUrl, resourceType, htmlUrl);
          if (!imageFilePath) {
            return;
          }
          if (!overwriteImages && (await exists(imageFilePath))) {
            console.warn(`Image already exists and overwrite is false: ${imageFilePath}`);
            return;
          }

          const buffer = await response.body();
          await fs.writeFile(imageFilePath, buffer);
          console.warn(`Downloaded image: ${imageFilePath}`);
        } catch (error) {
          console.error(`Failed to download image from ${mediaUrl}:`, error);
        }
      }
    });
  }

  const htmlFiles: { url: string; file: string; isSkipped: boolean }[] = [];
  await urls.forEachAsync(async (url) => {
    htmlUrl = url;
    try {
      const htmlFilePath = await getHtmlFilePath(url);
      if (!htmlFilePath) {
        return;
      }
      if (!overwriteHtml && (await exists(htmlFilePath))) {
        console.warn(`File already exists, skipping: ${htmlFilePath}`);
        htmlFiles.push({ url, file: htmlFilePath, isSkipped: true });
        return;
      }

      await page.goto(url, { waitUntil: 'networkidle' });
      const htmlContent = getHtml ? await getHtml(page) : await page.content();
      await fs.writeFile(htmlFilePath, htmlContent, { encoding: 'utf8' });
      console.warn(`Downloaded and saved HTML for ${url} to ${htmlFilePath}`);
      htmlFiles.push({ url, file: htmlFilePath, isSkipped: false });
    } catch (error) {
      console.error(`Failed to download ${url}:`, error);
    }

    await setTimeout(wait); // Wait for the specified time to ensure all images are loaded
  });

  await browser.close();

  return htmlFiles;
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
