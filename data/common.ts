import path from 'path';
import * as fs from 'fs/promises';
import { chromium, type Page } from 'playwright';
import { setTimeout } from 'timers/promises';

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
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
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

export const downloadFile = async (url: string, filePath: string): Promise<void> => {
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

export const downloadString = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
  }
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
  getHtmlFilePath: (url: string) => string | undefined,
  getHtml?: (page: Page) => Promise<string>,
  getImageFilePath?: (url: string) => string | undefined,
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

  if (!loadMedia) {
    await page.route('**/*', async (route) => {
      const request = route.request();
      const resourceType = request.resourceType().toLowerCase();
      if (
        resourceType === 'image' ||
        resourceType === 'media' ||
        /\.(jpg|jpeg|png|gif|webp|mp4|mov)$/i.test(request.url())
      ) {
        await route.abort();
      } else {
        await route.continue();
      }
    });
  }

  if (getImageFilePath) {
    page.on('response', async (response) => {
      if (response.request().resourceType() === 'image' && response.ok()) {
        try {
          const url = response.url();
          const imageFilePath = getImageFilePath(url);
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
          console.error(`Failed to download image from ${response.url()}:`, error);
        }
      }
    });
  }

  const htmlFiles: { file: string; isSkipped: boolean }[] = [];
  for (const url of urls) {
    try {
      const htmlFilePath = getHtmlFilePath(url);
      if (!htmlFilePath) {
        continue;
      }
      if (!overwriteHtml && (await exists(htmlFilePath))) {
        console.warn(`File already exists, skipping: ${htmlFilePath}`);
        htmlFiles.push({ file: htmlFilePath, isSkipped: true });
        continue;
      }

      await page.goto(url, { waitUntil: 'networkidle' });
      const htmlContent = getHtml ? await getHtml(page) : await page.content();
      await fs.writeFile(htmlFilePath, htmlContent, { encoding: 'utf8' });
      console.warn(`Downloaded and saved HTML for ${url} to ${htmlFilePath}`);
      htmlFiles.push({ file: htmlFilePath, isSkipped: false });
    } catch (error) {
      console.error(`Failed to download ${url}:`, error);
    }

    await setTimeout(wait); // Wait for the specified time to ensure all images are loaded
  }

  await browser.close();

  return htmlFiles;
};
