// import TurndownService from 'turndown';
// import { gfm } from '@truto/turndown-plugin-gfm';
import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import htmlToMarkdown from '@xberg-io/html-to-markdown';
const { convert, VisitResult } = htmlToMarkdown;
import { exists, readFiles } from '../common.ts';
import { defaultLocale, currentDataRootDirectory } from './html-download.ts';
import { LinkTagName } from './html-trim.ts';

// const turndownService = new TurndownService();
// turndownService.use(gfm);
//turndownService.turndown(stringOfHTML);

const trimmedHtmlRootDirectory = path.join(currentDataRootDirectory, 'html-trimmed');
const markdownRootDirectory = path.resolve(
    currentDataRootDirectory,
    `../../src/content/contents/${defaultLocale}`
);

const linkElementStart = new RegExp(`<${LinkTagName.toLowerCase()}`, 'gi');
const linkElementEnd = new RegExp(`</${LinkTagName.toLowerCase()}`, 'gi');

const convertHtmlContentToMarkdown = (htmlContent: string): string => {
    // const markdownContent = turndownService.turndown(htmlContent);
    // return markdownContent;
    const index = htmlContent.indexOf('<style class="frontmatter">');
    const frontmatterJson =
        index > -1
            ? htmlContent.substring(
                  index + '<style class="frontmatter">'.length,
                  htmlContent.indexOf('</style>')
              )
            : '';
    let listDepth = -1;
    const listIndentWidth = 4;
    const markdownContent = convert(htmlContent, {
        listIndentWidth: listIndentWidth,
        //brInTables: false,
        compactTables: true,
        preserveTags: [LinkTagName],
        bullets: '-',
        visitor: {
            visitCustomElement: (
                _ctx: htmlToMarkdown.NodeContext,
                tagName: string,
                html: string
            ): htmlToMarkdown.VisitResult.Continue | { Custom: string } => {
                if (tagName.toLowerCase() !== LinkTagName.toLowerCase()) {
                    throw new Error(`Unexpected custom tag: ${tagName}`);
                }
                return {
                    [VisitResult.Custom]: html
                        .replace(linkElementStart, `<${LinkTagName}`)
                        .replace(linkElementEnd, `</${LinkTagName}`),
                };
            },
            visitListItem: (
                _ctx: htmlToMarkdown.NodeContext,
                ordered: boolean,
                marker: string,
                text: string
            ): htmlToMarkdown.VisitResult.Continue | { Custom: string } => {
                if (!text) {
                    return VisitResult.Continue;
                }
                const indent = ' '.repeat(listDepth * listIndentWidth);
                return {
                    [VisitResult.Custom]: ordered
                        ? `${indent}1.  ${text}`
                        : `${indent}${marker}   ${text}`,
                };
            },
            visitListStart: (_ctx: htmlToMarkdown.NodeContext, _ordered: boolean) => {
                listDepth++;
                return VisitResult.Continue;
            },
            visitListEnd: (_ctx: htmlToMarkdown.NodeContext, _ordered: boolean, _output: string) => {
                // if (listDepth === 0) {
                //     listDepth--;
                //     let isFixed = false;
                //     const items = output.split('\n').map((item) => {
                //         if (item && item.length >= 3 && item[2] !== ' ') {
                //             isFixed = true;
                //             return `-   ${item.substring(2)}`;
                //         }
                //         return item;
                //     });
                //     return isFixed
                //         ? { [VisitResult.Custom]: items.join('\n') }
                //         : VisitResult.Continue;
                // }
                listDepth--;
                return VisitResult.Continue;
            },
            visitLineBreak: (
                ctx: htmlToMarkdown.NodeContext
            ): htmlToMarkdown.VisitResult.Continue | { Custom: string } => {
                const parentTag = ctx.parentTag?.toLowerCase();
                if (parentTag === 'td' || parentTag === 'th') {
                    return { [VisitResult.Custom]: '<br />' };
                }
                return VisitResult.Continue;
            },
            // visitLink: (
            //     ctx: htmlToMarkdown.NodeContext,
            //     href: string,
            //     text: string,
            //     title?: string | undefined | null
            // ): htmlToMarkdown.VisitResult.Continue | { Custom: string } => {
            //     return VisitResult.Continue;
            // },
            visitElementEnd: (
                ctx: htmlToMarkdown.NodeContext,
                output: string
            ): htmlToMarkdown.VisitResult.Continue | { Custom: string } => {
                if (ctx.tagName.toLowerCase() === 'a' && output.toLowerCase().startsWith('<http')) {
                    console.error(`Unexpected output: ${output}`);
                    const url = output.substring(1, output.indexOf('>'));
                    return { [VisitResult.Custom]: `[${url}](${url})` };
                }
                return VisitResult.Continue;
            },
        } as htmlToMarkdown.VisitorHandle,
    });
    let isFixed = false;
    const contents = markdownContent.content!.split('\n').map((item) => {
        if (!item || item.length < 3) {
            return item;
        }

        if (item[0] === '-' && item[1] === ' ' && item[2] !== ' ') {
            isFixed = true;
            return `-   ${item.substring(2)}`;
        }

        if (item[0] === '|') {
            return item
                .replaceAll('  |', () => {
                    isFixed = true;
                    return ' |';
                })
                .replaceAll('<br>', () => {
                    isFixed = true;
                    return '<br />';
                })
                .replaceAll(/(?:<br \/>){2,}/g, () => {
                    isFixed = true;
                    return '<br />';
                });
        }

        return item;
    });
    const content = isFixed ? contents.join('\n') : markdownContent.content!;
    return frontmatterJson ? matter.stringify(content, JSON.parse(frontmatterJson)) : content;
};

const convertHtmlFileToMarkdown = async (
    htmlFile: string,
    markdownFile: string,
    overwrite: boolean = false
): Promise<{ file: string; isSkipped: boolean }> => {
    const markdownDirectory = path.dirname(markdownFile);
    if (!(await exists(markdownDirectory))) {
        await fs.mkdir(markdownDirectory, { recursive: true });
    }
    if (!overwrite && (await exists(markdownFile))) {
        return { file: markdownFile, isSkipped: true };
    }

    const htmlContent = await fs.readFile(htmlFile, { encoding: 'utf8' });
    const markdownContent = convertHtmlContentToMarkdown(htmlContent);
    await fs.writeFile(markdownFile, markdownContent, { encoding: 'utf8' });
    return { file: markdownFile, isSkipped: false };
};

export const convertAllHtmlFiles = async (
    trimmedHtmlFiles: string[] = [],
    overwrite: boolean = false
) => {
    if (trimmedHtmlFiles.length === 0) {
        trimmedHtmlFiles = await readFiles(trimmedHtmlRootDirectory, true, '.html');
    }

    console.warn(`Found ${trimmedHtmlFiles.length} HTML files to convert.`);
    const markdownFiles = [];
    for (const trimmedHtmlFile of trimmedHtmlFiles) {
        // const parsedTrimedHtmlFile = path.parse(trimmedHtmlFile);
        // const id = urlPathToId(fileNameToUrlPath(parsedTrimedHtmlFile.name));
        const markdownFile = trimmedHtmlFile
            .replace(trimmedHtmlRootDirectory, markdownRootDirectory)
            .replace('.html', '.mdx');
        console.warn(`Converting ${trimmedHtmlFile} to ${markdownFile}`);
        markdownFiles.push(
            await convertHtmlFileToMarkdown(trimmedHtmlFile, markdownFile, overwrite)
        );
    }
    return markdownFiles;
};
