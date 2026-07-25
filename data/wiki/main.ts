import { dataRootDirectory, exists, readFiles } from '../common.ts';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as htmlDownload from './html-download.ts';
import * as htmlTrim from './html-trim.ts';
import * as markdown from './markdown.ts';

//const rawHtmlFiles = await htmlDownload.downloadAllHtmlFiles();
const rawHtmlFiles = await htmlDownload.downloadHtmlsAndImages(false, false);
const trimmedHtmlFiles = await htmlTrim.trimAllHtmlFiles(
    rawHtmlFiles.map(({ file }) => file),
    htmlTrim.defaultAuthor,
    new Date(),
    true
);
const convertedMarkdownFiles = await markdown.convertAllHtmlFiles(
    trimmedHtmlFiles.map(({ file }) => file),
    true
);
