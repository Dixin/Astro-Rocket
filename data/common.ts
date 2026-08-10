import path from 'path';
import * as fs from 'fs/promises';

declare global {
    interface Array<T> {
        forEachAsync(
            callback: (value: T, index: number, array: T[]) => Promise<void>
        ): Promise<void>;

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
