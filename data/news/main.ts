// import * as chinaUrls from './china-urls.ts';
// import path from 'path/win32';
// import { convertDirectoryEncoding } from '../common.ts';
import * as chinaDownload from './china-download.ts';
// import * as hk01Urls from './hk01-urls.ts';
// import * as hk01Download from './hk01-download.ts';
// import * as googleUrls from './google-urls.ts';
// import * as googleDownload from './google-download.ts';

// await googleUrls.writeUrls(true);
// await googleDownload.downloadHtmlFiles();
// googleUrls.printUrls();
// await hk01Urls.getUrls(true);
// await hk01Urls.getTagUrls();
// await googleUrls.printUrls();
// await chinaUrls.getUrls(true);
// await googleUrls.getUrls();
// await chinaUrls.printUrls();
// await hk01Urls.downloadHtmlFiles();
// await hk01Urls.convertToMarkdown();
// await hk01Download.updateMarkdownFiles();
// await chinaDownload.downloadHtmlFiles();
// await chinaDownload.trimHtmlFiles();
// await chinaDownload.downloadPaginationHtmlFiles();
// await chinaDownload.convertPaginationHtmlFiles7();

// await convertDirectoryEncoding(path.join(import.meta.dirname, "china-raw2"), '.html', 'gb2312', 'utf8');

await chinaDownload.downloadImages();