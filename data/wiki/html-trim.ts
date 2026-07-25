import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { decodeHtml, exists, getLanguageFromLocale, readFiles } from '../common.ts';

import {
    defaultLocale,
    fileNameToUrlPath,
    getUrlListFile as getUrlListFile,
    imagesToSkip,
    urlDomain,
    currentDataRootDirectory,
} from './html-download.ts';

const rawHtmlRootDirectory = path.join(currentDataRootDirectory, 'html-raw');
const trimmedHtmlRootDirectory = path.join(currentDataRootDirectory, 'html-trimmed');
const markdownImageDirectory = `../../../../assets/${defaultLocale}/`;
export const LinkTagName = 'ContentLink';
const LinkIdPrefix = `${defaultLocale}/`;
export const defaultAuthor = 'Beyond.ms';

const mapId = (id: string) => (id in idMapping ? idMapping[id] : id);
export const urlPathToId = (urlPath: string): string =>
    mapId(
        decodeURIComponent(urlPath)
            .toLowerCase()
            .replaceAll(
                /[^a-z0-9\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu,
                '-'
            )
            .replaceAll('_', '-')
            .replaceAll(/-+/g, '-')
            .replaceAll(/^-+|-+$/g, '')
            .trim()
    );

const tags: Record<string, string[]> = {
    en: ['Beyond', 'Wong Ka Kui', 'Wong Ka Keung', 'Paul Wong', 'Yip Sai Wing', 'Film'],
    'zh-CN': ['Beyond', '黄家驹', '黄家强', '黄贯中', '叶世荣', '演唱会', '电影'],
    'zh-SG': ['Beyond', '黄家驹', '黄家强', '黄贯中', '叶世荣', '演唱会', '电影'],
    'zh-HK': ['Beyond', '黃家駒', '黃家強', '黃貫中', '葉世榮', '演唱會', '電影'],
    'zh-MO': ['Beyond', '黃家駒', '黃家強', '黃貫中', '葉世榮', '演唱會', '電影'],
    'zh-TW': ['Beyond', '黃家駒', '黃家強', '黃貫中', '葉世榮', '演唱會', '電影'],
};

const idMapping: Record<string, string> = {
    'beyond-band': 'beyond',
};

const featuredIds = [
    'Beyond',
    '黃家駒',
    '黃家強',
    '黃貫中',
    '葉世榮',
    'Beyond_(band)',
    'Wong_Ka_Kui',
    'Wong_Ka_Keung',
    'Paul_Wong_(musician)',
    'Yip_Sai_Wing',
]
    .map(urlPathToId)
    .distinct();

const localIdsCache: Record<string, string[]> = {};
const getLocalIdsFromUrls = async (language: string): Promise<string[]> => {
    const cache = localIdsCache[language];
    if (cache) {
        return cache;
    }

    const content = await fs.readFile(getUrlListFile(language), { encoding: 'utf8' });
    const localIds = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.replace(`https://${language}.${urlDomain}/${defaultLocale}/`, ''))
        .map(urlPathToId);
    localIdsCache[language] = localIds;
    return localIds;
};

const sameLanguageLinks: string[] = [];
const crossLanguageLinks: string[] = [];

const trimHtmlContent = async (
    htmlContent: string,
    language: string,
    localIds: string[],
    sourceUrl: string,
    id: string,
    locale: string,
    author: string,
    publishedAt: Date
): Promise<{
    html: string;
    metadata: {
        title: string;
        sourceUrl: string;
        uid: string;
        description: string;
        publishedAt: Date;
        author: string;
        tags: string[];
        locale: string;
        featured: boolean;
        image: string | undefined;
        imageAlt: string | undefined;
    };
}> => {
    const $: cheerio.CheerioAPI = cheerio.load(htmlContent, {
        xml: {
            selfClosingTags: true,
            lowerCaseTags: false,
            decodeEntities: false,
        },
    });
    // if ($('title').text().startsWith('Beyond - ')) {
    //     //debugger;
    // }
    const $content = $('#mw-content-text > div.mw-content-ltr.mw-parser-output');

    $content
        .find(
            'script, style, abbr, table.metadata, .noteTA, .mw-editsection, .navbox-styles, .navbox, .mw-cite-backlink, .mw-collapsible-toggle, span[style*="display:none"]'
        )
        .remove();
    for (const tagName of ['meta', 'link', 'cite', 'map', 'wbr', 'big', 'bdi']) {
        do {
            $content.find(tagName).each((_index, element) => {
                const $element = $(element);
                $element.replaceWith($element.contents());
            });
        } while ($content.find(tagName).length > 0);
    }

    $content.find('[hidden="until-found"]').removeAttr('hidden');

    // $content.find('h2#外部連結').parent().next('ol').remove().end().remove();
    // $content.find('h2#參見').parent().next('ul').remove().end().remove();

    // Remove the footnotes heading.
    const $references = $content.find('h2#參考資料, h2#References');
    if ($references.length > 0) {
        $content.append(`<p>${decodeHtml($references.text()).trim()}</p>`);
        $references.parent('div').remove();
    }

    $content
        .find('ol.references')
        .parent('div')
        .remove()
        .end()
        .find('li')
        .each((_index, item) => {
            const $item = $(item);
            $item.find('.mw-cite-backlink, br').remove();
            const referenceNumber = $item.attr('id')?.split('-').pop() || '';
            $content.append(
                `<p data-reference="${referenceNumber}">[^${referenceNumber}]: ${$item.html()?.replaceAll('\r\n', '').replaceAll('\n', '').replaceAll(/\s+/g, ' ')}</p>` as string
            );
        });

    // References.
    $content.find('sup.reference').each((_index, sup) => {
        const $sup = $(sup);
        const referenceNumber = $sup.text().trim().replace('[', '[^');
        $sup.replaceWith(`<span class="reference">${referenceNumber}</span>`);
    });

    // Heedings.
    $content.find('h2, h3, h4, h5, h6, h7, h8, h9').each((_index, heading) => {
        const $heading = $(heading);
        $heading.parent('div').replaceWith($heading);
    });

    const pageTitle = decodeHtml($('title').text());
    const title = pageTitle.substring(0, pageTitle.lastIndexOf(' - '));
    // Images.
    $content.find('img').each((_index, image) => {
        const $image = $(image);
        const source = $image.attr('src') || '';
        if (imagesToSkip.some((skip) => source.endsWith(skip))) {
            $image.remove();
            return;
        }
        const $parentLink = $image.parent('a');
        if ($parentLink.length > 0) {
            const imageFileName = decodeURIComponent(
                $image.attr('src')!.split('/').pop()!.split('?')[0]
            );
            const linkFileName = decodeHtml(
                decodeURIComponent($parentLink.attr('href')!.split('/').pop()!.split('?')[0])
            ).replace('File:', '');
            if (imageFileName.endsWith(linkFileName) || linkFileName.endsWith(imageFileName)) {
                $parentLink.replaceWith($parentLink.contents());
            } else {
                console.error(
                    `Image ${imageFileName} has a parent link with href ${$parentLink.attr('href')} that does not match the expected href /${defaultLocale}/File:${imageFileName}. Removing the parent link.`
                );
            }
        }

        const $imageParent = $image.parent('div');
        if ($imageParent.length > 0 && $image.siblings().length === 0) {
            $imageParent.replaceWith($imageParent.contents());
        }

        const imageFile = decodeURIComponent($image.attr('src')!.split('/').pop()!.split('?')[0]);
        $image.attr('src', `${markdownImageDirectory}${imageFile}`);
        if (!$image.attr('alt')) {
            $image.attr('alt', title);
        }
    });

    $content.find('a').each((_index, link) => {
        const $link = $(link);
        if ($link.hasClass('new')) {
            // Links to new page.
            $link.replaceWith(`<span class="link-new">${$link.text()}</span>`);
            return;
        }

        if ($link.hasClass('extiw')) {
            // Links crossing languages.
            $link.replaceWith(
                `<span class="extiw link-cross-language" data-href="${$link.attr('href')}">${$link.text()}</span>`
            );
            return;
        }

        const href = ($link.attr('href') || '')
            .replace(`https://${language}.${urlDomain}`, '')
            .replace(`//${language}.${urlDomain}`, '');

        if (!href.startsWith(`/${defaultLocale}/`)) {
            return;
        }

        const hrefPath = href.replace(`/${defaultLocale}/`, '');
        const hrefId = urlPathToId(hrefPath);

        // Links to other pages in the same language.
        const html = ($link.html() || '')
            .replaceAll('\r\n', '')
            .replaceAll('\n', '')
            .replaceAll(/\s+/g, ' ');
        if (!localIds.includes(hrefId)) {
            //console.warn(`Replaced link: ${$a.text()}`);
            sameLanguageLinks.push($link.text() || '');
            $link.replaceWith(
                `<span class="link-same-language" data-href="${href}">${html}</span>`
            );
        } else {
            $link.replaceWith(
                `<${LinkTagName} uid="${LinkIdPrefix}${hrefId}">${html}</${LinkTagName}>`
            );
        }
    });

    // Remove lists' parent divs.
    $content.find('ol, ul').each((_index, list) => {
        const $list = $(list);
        const $parent = $list.parent('div');
        if ($list.siblings().length === 0 && $parent.length > 0) {
            $parent.replaceWith($parent.contents());
        }
    });

    // Remove list items.
    $content.find('li').each((_index, item) => {
        const $item = $(item);
        const text = decodeHtml($item.text()).trim();
        if (!text && $item.find('img').length === 0) {
            $item.remove();
            return;
        }

        if ($item.siblings().length === 0) {
            const $nestedList = $item.children('ul, ol');
            if ($nestedList.length > 0) {
                if ($nestedList.find('ul, ol').length > 0) {
                    throw new Error(`Nested lists found in list item: ${$item.html()}`);
                }
                $item.parent('ul, ol').replaceWith($item.contents());
            }
        }

        $item.find('br').remove();
        const html = $item.html();
        if (html) {
            $item.html(html.replaceAll('\r\n', '').replaceAll('\n', '').replaceAll(/\s+/g, ' '));
        }
    });

    $content.find('table').each((_index, table) => {
        const $table = $(table);
        $table.find('table').insertAfter($table);
    });

    // Split tables with rowspan or colspan attributes.
    $content.find('table').each((_index, table) => {
        const $table = $(table);

        const $cells = $table.find('td, th');
        $cells.each((_index, cell) => {
            const $cell = $(cell);

            $cell.find('div').each((_index, div) => {
                const $div = $(div);
                if ($div.contents().length === 0) {
                    $div.remove();
                    return;
                }
                if (
                    $div.children().length <= 1 ||
                    $div
                        .find('*')
                        .toArray()
                        .every((child) =>
                            $(child).is(`br, a, b, i, span, p, div, ul, ol ,li, ${LinkTagName}`)
                        )
                ) {
                    $div.replaceWith($div.contents());
                } else {
                    console.error(
                        `Table div contains elements other than <br>, <a>, <span>, <p>, <div>, <ul>, <ol>, <li>, <${LinkTagName}>: ${$div.html()}`
                    );
                }
            });

            const $lists = $cell.find('ul, ol');
            $lists.each((_index, list) => {
                const $list = $(list);
                if ($list.find('ul, ol').length > 0) {
                    throw new Error(`Nested lists found in table cell: ${$cell.html()}`);
                }
                $list.replaceWith(
                    $list
                        .children('li')
                        .toArray()
                        .map(
                            (li, index) =>
                                `<span data-list-index="${index}">-   ${$(li).html()?.trim()}</span>`
                        )
                        .join('<br />')
                );
            });

            const html = $cell.html();
            if (html) {
                $cell.html(
                    html
                        .replaceAll('\r\n', '')
                        .replaceAll('\n', '')
                        .replaceAll(/\s+/g, ' ')
                        .trimEnd()
                        .replaceAll(/(?:<br\s*\/?>)+/gi, '<br />')
                        .replace(/<br\s*\/?>\s*$/, '')
                );
            }
        });

        const colspans = $cells
            .map((_index, cell) => $(cell).attr('colspan') || '1')
            .toArray()
            .distinct();
        if (colspans.length === 1) {
            $cells.each((_index, cell) => {
                $(cell).removeAttr('colspan');
            });
        }
        const rowspans = $cells
            .map((_index, cell) => $(cell).attr('rowspan') || '1')
            .toArray()
            .distinct();
        if (rowspans.length === 1) {
            $cells.each((_index, cell) => {
                $(cell).removeAttr('rowspan');
            });
        }

        if ($table.find('td[rowspan], td[colspan], th[rowspan], th[colspan]').length > 0) {
            const $clonedTable = splitTable($, $table);
            const { isNormalized, columnCounts } = normalizeTableCells($, $clonedTable);
            if (!isNormalized || columnCounts.distinct().length !== 1) {
                throw new Error(
                    `Table with inconsistent column counts (${columnCounts.join(', ')}) found. Skipping table: ${$clonedTable.html()}`
                );
            }
            $table.replaceWith($clonedTable);
        }
    });

    $content.find('p').each((_index, paragraph) => {
        const $paragraph = $(paragraph);
        $paragraph.contents().each((_index, node) => {
            let isFixed = false;
            if (node.type === 'text') {
                const text = node.nodeValue
                    .replaceAll('&lt;', () => {
                        isFixed = true;
                        return '《';
                    })
                    .replaceAll('&gt;', () => {
                        isFixed = true;
                        return '》';
                    });
                if (isFixed) {
                    node.nodeValue = text;
                }
            }
        });
    });

    // Metadata
    const $image = $content.find('img').first();
    const imageSource = $image.attr('src');
    if (imageSource && (imageSource.startsWith('//') || imageSource.startsWith('https://'))) {
        throw new Error(`Image source should be a relative path, but got: ${imageSource}`);
    }
    const metadata: {
        title: string;
        sourceUrl: string;
        uid: string;
        description: string;
        publishedAt: Date;
        author: string;
        tags: string[];
        locale: string;
        featured: boolean;
        image: string | undefined;
        imageAlt: string | undefined;
    } = {
        title,
        sourceUrl,
        uid: id,
        description: $content
            .find('h1, h2, h3, h4, h5, h6, h7, h8, h9')
            .toArray()
            .map((heading) => decodeHtml($(heading).text()).trim())
            .join(' | '),
        publishedAt,
        author,
        tags: [],
        locale,
        featured: featuredIds.includes(id),
        image: imageSource,
        imageAlt: $image.length > 0 ? $image.attr('alt') || title : undefined,
    };
    const contentText = $content.text().toLowerCase() || '';
    tags[locale]
        .filter((tag) => contentText.includes(tag.toLowerCase()))
        .forEach((tag) => {
            metadata.tags.push(tag);
        });

    const contentHtml = $content.html()!.replaceAll('※', '');
    return {
        html: `<style class="frontmatter">${JSON.stringify(metadata)}</style>${contentHtml}`,
        metadata,
    };
};

const normalizeTableCells = (
    $: cheerio.CheerioAPI,
    $table: ReturnType<ReturnType<typeof cheerio.load>>
): { isNormalized: boolean; columnCounts: number[] } => {
    const $initialRows = $table.children('tbody').children('tr');
    for (let rowIndex = $initialRows.length - 1; rowIndex >= 0; rowIndex--) {
        const $row = $initialRows.eq(rowIndex);
        if (
            $row
                .children()
                .toArray()
                .every(function (cell) {
                    const $cell = $(cell);
                    return !$cell.text().trim() && $cell.find('img').length === 0;
                })
        ) {
            $row.remove();
        }
    }

    const columnCounts: number[] = [];
    const $rows = $table.children('tbody').children('tr');
    const $firstRow = $rows.first();
    const firstRowColumnCount =
        $firstRow.children('[rowspan]').length === 0 &&
        $firstRow.children('[colspan]').length === 0 &&
        $firstRow
            .children()
            .toArray()
            .every((cell) => $(cell).text().trim())
            ? $firstRow.children().length
            : 0;
    $rows.each((_index, row) => {
        columnCounts.push(0);

        const $row = $(row);
        $row.children('[rowspan]').each((_index, cell) => {
            const $cell = $(cell);
            if (!$cell.attr('rowspan')) {
                $cell.removeAttr('rowspan');
            }
        });
        $row.children('[colspan]').each((_index, cell) => {
            const $cell = $(cell);
            if (!$cell.attr('colspan')) {
                $cell.removeAttr('colspan');
            }
        });
    });

    // Process rows impacted by rowspan.
    $rows.each((rowIndex, row) => {
        $(row)
            .children('[rowspan]')
            .each((_index, cell) => {
                const rowSpan = parseInt($(cell).attr('rowspan') || '1', 10);
                for (
                    let rowIndexToSpan = rowIndex;
                    rowIndexToSpan < rowIndex + rowSpan;
                    rowIndexToSpan++
                ) {
                    columnCounts[rowIndexToSpan]++;
                }
            });
    });

    // Process rows impacted by colspan.
    $rows.each((rowIndex, row) => {
        const $cells = $(row).children();
        if (
            columnCounts[rowIndex] > 0 ||
            $cells.toArray().some((cell) => $(cell).attr('colspan'))
        ) {
            $cells.each((_index, cell) => {
                const $cell = $(cell);
                columnCounts[rowIndex] += parseInt($cell.attr('colspan') || '1', 10);
                if ($cell.attr('rowspan')) {
                    columnCounts[rowIndex]--;
                }
            });
        }
    });

    // Process rows without any rowspan or colspan.
    const rowIndexesWithoutSpan: number[] = [];
    $rows.each((rowIndex, row) => {
        if (columnCounts[rowIndex] === 0) {
            rowIndexesWithoutSpan.push(rowIndex);
            columnCounts[rowIndex] = $(row).children().length;
        }
    });

    if (rowIndexesWithoutSpan.length > 0) {
        const columnCountsWithoutSpan = rowIndexesWithoutSpan.map((rowIndexWithoutSpan) => {
            return columnCounts[rowIndexWithoutSpan];
        });

        if (columnCountsWithoutSpan.distinct().length !== 1) {
            const groups = Object.groupBy(
                columnCountsWithoutSpan.map((count, index) => ({ count, index })),
                (item) => item.count
            );
            const sortedGroups = Object.entries(groups).sort((a, b) => b[1]!.length - a[1]!.length);
            const mostCommonGroup = sortedGroups[0];
            let mostCommonColumnCount =
                mostCommonGroup[1]!.length >= columnCountsWithoutSpan.length / 2
                    ? parseInt(mostCommonGroup[0], 10)
                    : firstRowColumnCount;
            if (
                mostCommonGroup[1]!.length < columnCountsWithoutSpan.length / 2 &&
                firstRowColumnCount <= 0
            ) {
                throw new Error(
                    `Inconsistent column counts found in rows without rowspan/colspan: ${columnCountsWithoutSpan.join(', ')} at indexes ${rowIndexesWithoutSpan.join(', ')}. Cannot normalize table: ${$table.html()}`
                );
            }

            if (
                mostCommonColumnCount < firstRowColumnCount &&
                Math.max(...columnCountsWithoutSpan) === firstRowColumnCount
            ) {
                mostCommonColumnCount = firstRowColumnCount;
            }

            rowIndexesWithoutSpan.forEach((rowIndexWithoutSpan, index) => {
                if (columnCounts[rowIndexWithoutSpan] === mostCommonColumnCount) {
                    return;
                }

                const $row = $rows.eq(rowIndexWithoutSpan);
                if (columnCounts[rowIndexWithoutSpan] < mostCommonColumnCount) {
                    while (columnCounts[rowIndexWithoutSpan] < mostCommonColumnCount) {
                        const $clonedCell = $row.children().last().clone();
                        $clonedCell.removeAttr('rowspan').removeAttr('colspan').contents().remove();
                        $row.append($clonedCell);
                        columnCounts[rowIndexWithoutSpan]++;
                        columnCountsWithoutSpan[index]++;
                    }
                } else if (columnCounts[rowIndexWithoutSpan] > mostCommonColumnCount) {
                    throw new Error(
                        `Row at index ${rowIndexWithoutSpan} has more columns (${columnCounts[rowIndexWithoutSpan]}) than the most common count (${mostCommonColumnCount}). Column counts are ${columnCountsWithoutSpan.join(', ')} at indexes ${rowIndexesWithoutSpan.join(', ')}. Cannot normalize table: ${$table.html()}`
                    );
                }
            });

            if (columnCountsWithoutSpan.distinct().length !== 1) {
                throw new Error(
                    `Inconsistent column counts found after normalization: ${columnCounts.join(', ')}. Cannot normalize table: ${$table.html()}`
                );
            }
        }

        $rows.each((rowIndex, row) => {
            if (columnCounts[rowIndex] === columnCountsWithoutSpan[0]) {
                return;
            }

            const $row = $(row);
            if (columnCounts[rowIndex] > columnCountsWithoutSpan[0]) {
                const $cellsWithSpan = $row.children('[colspan]');
                $cellsWithSpan.each((_index, cell) => {
                    const $cell = $(cell);
                    while (columnCounts[rowIndex] > columnCountsWithoutSpan[0]) {
                        const columnSpan = parseInt($cell.attr('colspan') || '1', 10);
                        if (columnSpan <= 1) {
                            break;
                        }
                        $cell.attr('colspan', (columnSpan - 1).toString(10));
                        columnCounts[rowIndex]--;
                    }
                });
            } else if (columnCounts[rowIndex] < columnCountsWithoutSpan[0]) {
                while (columnCounts[rowIndex] < columnCountsWithoutSpan[0]) {
                    const $clonedCell = $row.children().last().clone();
                    $clonedCell.removeAttr('rowspan').removeAttr('colspan').contents().remove();
                    $row.append($clonedCell);
                    columnCounts[rowIndex]++;
                }
            }
        });

        if (columnCounts.distinct().length !== 1) {
            throw new Error(
                `Inconsistent column counts found after normalization: ${columnCounts.join(', ')}. Cannot normalize table: ${$table.html()}`
            );
        }
        return { isNormalized: true, columnCounts };
    } else {
        // All rows are impacted by rowspan/colspan, check for consistency.
        if (columnCounts.distinct().length === 1) {
            return { isNormalized: true, columnCounts };
        }
        const groups = Object.groupBy(
            columnCounts.map((count, index) => ({ count, index })),
            (item) => item.count
        );
        const sortedGroups = Object.entries(groups).sort((a, b) => b[1]!.length - a[1]!.length);
        const mostCommonGroup = sortedGroups[0];
        const mostCommonColumnCount = parseInt(mostCommonGroup[0], 10);
        if (mostCommonGroup[1]!.length < columnCounts.length / 2) {
            throw new Error(
                `Inconsistent column counts found in rows with rowspan/colspan: ${columnCounts.join(', ')}. Cannot normalize table: ${$table.html()}`
            );
        }

        columnCounts.forEach((count, rowIndex) => {
            if (columnCounts[rowIndex] === mostCommonColumnCount) {
                return;
            }

            const $row = $rows.eq(rowIndex);
            if (columnCounts[rowIndex] < mostCommonColumnCount) {
                while (columnCounts[rowIndex] < mostCommonColumnCount) {
                    const $clonedCell = $row.children().last().clone();
                    $clonedCell.removeAttr('rowspan').removeAttr('colspan').contents().remove();
                    $row.append($clonedCell);
                    columnCounts[rowIndex]++;
                }
            } else if (columnCounts[rowIndex] > mostCommonColumnCount) {
                const $cellsWithSpan = $row.children('[colspan]');
                $cellsWithSpan.each((_index, cell) => {
                    const $cell = $(cell);
                    while (columnCounts[rowIndex] > mostCommonColumnCount) {
                        const columnSpan = parseInt($cell.attr('colspan') || '1', 10);
                        if (columnSpan <= 1) {
                            break;
                        }
                        $cell.attr('colspan', (columnSpan - 1).toString(10));
                        columnCounts[rowIndex]--;
                    }
                });
            }
        });

        if (columnCounts.distinct().length !== 1) {
            throw new Error(
                `Inconsistent column counts found after normalization: ${columnCounts.join(', ')}. Cannot normalize table: ${$table.html()}`
            );
        }

        return { isNormalized: true, columnCounts };
    }
};

export const trimHtmlFile = async (
    rawHtmlFile: string,
    trimmedHtmlFile: string,
    id: string,
    author: string,
    publishedAt: Date,
    overwrite: boolean = false
): Promise<{ file: string; isSkipped: boolean }> => {
    if (!overwrite && (await exists(trimmedHtmlFile))) {
        return { file: trimmedHtmlFile, isSkipped: true };
    }

    const rawHtmlContent = await fs.readFile(rawHtmlFile, { encoding: 'utf8' });
    const parsedRawHtmlFile = path.parse(rawHtmlFile);
    const locale = parsedRawHtmlFile.dir.split(path.sep).pop()!;
    const language = getLanguageFromLocale(locale);
    const localIds = await getLocalIdsFromUrls(language);
    const sourceUrl = `https://${language}.${urlDomain}/${locale === language ? defaultLocale : locale}/${fileNameToUrlPath(parsedRawHtmlFile.name)}`;
    const trimmedHtmlContent = await trimHtmlContent(
        rawHtmlContent,
        language,
        localIds,
        sourceUrl,
        id,
        locale,
        author,
        publishedAt
    );
    const trimmedHtmlDirectory = path.dirname(trimmedHtmlFile);
    if (!(await exists(trimmedHtmlDirectory))) {
        await fs.mkdir(trimmedHtmlDirectory, { recursive: true });
    }
    await fs.writeFile(trimmedHtmlFile, trimmedHtmlContent.html, { encoding: 'utf8' });
    return { file: trimmedHtmlFile, isSkipped: false };
};

function splitRows($: cheerio.CheerioAPI, $table: ReturnType<ReturnType<typeof cheerio.load>>) {
    const $clonedTable = $table.clone();
    $clonedTable
        .children()
        .children()
        .each(function (_index, row) {
            const $currentRow = $(row);
            $currentRow.children().each(function (index, cell) {
                const $cell = $(cell);
                const rowSpan = parseInt($cell.attr('rowspan') || '1', 10);
                if (rowSpan >= 2) {
                    // copy the cell
                    const $clonedCell = $cell.clone();
                    // Remove rowspan
                    $cell.removeAttr('rowspan');
                    const newRowSpan = rowSpan - 1;
                    $clonedCell.attr('rowspan', newRowSpan.toString(10));
                    // last item's index in next row
                    if ($clonedCell.find('li, img').length > 0) {
                        $clonedCell.contents().remove();
                    }
                    const indexOfLastElement = $currentRow.next().children().last().index();
                    if (indexOfLastElement < index) {
                        $currentRow.next().append($clonedCell);
                    } else {
                        // intermediate cell insertion
                        $clonedCell.insertBefore($currentRow.next().children().eq(index));
                    }
                }
            });
        });
    return $clonedTable;
}

function splitColumns($: cheerio.CheerioAPI, $table: ReturnType<ReturnType<typeof cheerio.load>>) {
    const $clonedTable = $table.clone();
    const $tableBody = $clonedTable.children();
    $tableBody.children().each(function (_index, row) {
        const $currentRow = $(row);
        for (let i = 0; i < $currentRow.children().length; i++) {
            const $cell = $currentRow.children().eq(i);
            const columnSpan = parseInt($cell.attr('colspan') || '1', 10);
            if (columnSpan >= 2) {
                // copy the cell
                const $clonedCell = $cell.clone();
                // Remove colspan
                $cell.removeAttr('colspan');
                const newColumnSpan = columnSpan - 1;
                $clonedCell.attr('colspan', newColumnSpan.toString(10));
                // if($clonedCell.html()?.includes('（1993年意外逝世）')) {
                //     debugger;
                // }
                if ($cell.find('li, img, span[data-list-index]').length > 0) {
                    $clonedCell.contents().remove();
                }
                $clonedCell.insertAfter($cell);
            }
        }
    });
    return $clonedTable;
}

function splitTable($: cheerio.CheerioAPI, $table: ReturnType<ReturnType<typeof cheerio.load>>) {
    const { isNormalized, columnCounts } = normalizeTableCells($, $table);
    if (!isNormalized) {
        throw new Error(
            `Table with inconsistent column counts (${columnCounts.join(', ')}) found. Cannot split table: ${$table.html()}`
        );
    }

    const $clonedTableWithColumnsSplitted = splitColumns($, $table);
    const $clonedTableWithRowsSplitted = splitRows($, $clonedTableWithColumnsSplitted);
    $clonedTableWithRowsSplitted
        .find('td[rowspan], th[rowspan], td[colspan], th[colspan]')
        .each(function (_index, cell) {
            const $cell = $(cell);
            $cell.removeAttr('rowspan').removeAttr('colspan');
        });
    return $clonedTableWithRowsSplitted;
}

export const trimAllHtmlFiles = async (
    rawHtmlFiles: string[] = [],
    author: string,
    publishedAt: Date,
    overwrite = false
) => {
    if (rawHtmlFiles.length === 0) {
        rawHtmlFiles = await readFiles(rawHtmlRootDirectory, true, '.html');
    }

    console.warn(`Found ${rawHtmlFiles.length} raw HTML files to process.`);
    const trimedHtmlFiles = [];
    for (const rawHtmlFile of rawHtmlFiles) {
        console.warn(`Trim file: ${rawHtmlFile}`);
        const rawHtmlFileName = path.parse(rawHtmlFile).name;
        const trimmedHtmlFilePath = rawHtmlFile.replace(
            rawHtmlRootDirectory,
            trimmedHtmlRootDirectory
        );
        if (rawHtmlFileName.includes('劉志遠')) {
            console.warn('Debugging 劉志遠');
        }
        const id = urlPathToId(fileNameToUrlPath(rawHtmlFileName));
        trimedHtmlFiles.push(
            await trimHtmlFile(rawHtmlFile, trimmedHtmlFilePath, id, author, publishedAt, overwrite)
        );
    }

    console.warn('Replaced same language links:');
    console.warn(
        sameLanguageLinks
            .distinct()
            .sort((a, b) => a.localeCompare(b))
            .join('\n')
    );
    console.warn('Replaced cross language links:');
    console.warn(
        crossLanguageLinks
            .filter((value, index, array) => array.indexOf(value) === index)
            .sort((a, b) => a.localeCompare(b))
            .join('\n')
    );

    return trimedHtmlFiles;
};
