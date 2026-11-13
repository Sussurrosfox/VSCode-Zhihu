import * as fs from "fs";
import * as MarkdownIt from "markdown-it";
import * as markdownItZhihu from "markdown-it-zhihu";
import * as path from "path";
import { CliError } from "./options";
import { centerDisplayMath } from "../util/center-math";

export interface ImageReference {
    src: string;
    token: any;
}

export interface ParsedArticle {
    filePath: string;
    originalText: string;
    baseDir: string;
    tokens: any[];
    title: string;
    coverSource?: string;
    coverTokenIndex?: number;
    headingStart: number;
    headingEnd: number;
    articleId?: string;
    articleUrl?: string;
    images: ImageReference[];
    parser: MarkdownIt;
}

export function createMarkdownParser(): MarkdownIt {
    const parser = new MarkdownIt({ html: true }).use(markdownItZhihu);
    centerDisplayMath(parser);
    parser.renderer.rules.table_open = () =>
        `<table data-draft-node="block" data-draft-type="table" data-size="normal" data-row-style="striped"><tbody>`;
    parser.renderer.rules.table_close = () => "</tbody></table>";
    parser.renderer.rules.thead_open = () => "";
    parser.renderer.rules.thead_close = () => "";
    parser.renderer.rules.tbody_open = () => "";
    parser.renderer.rules.tbody_close = () => "";
    return parser;
}

function parseShebang(text: string): { id?: string, url?: string, body: string } {
    const lf = text.indexOf("\n");
    const firstLine = text.slice(0, lf < 0 ? text.length : lf).replace(/\r$/, "");
    if (!/^#[!！]/.test(firstLine)) return { body: text };
    const match = /^#[!！]\s*(\S+)\s*$/.exec(firstLine);
    if (!match) throw new CliError("首行 #! 必须包含一个知乎文章 URL。");

    let url: URL;
    try {
        url = new URL(match[1]);
    } catch (error) {
        throw new CliError("首行 #! URL 无效。");
    }
    const host = url.hostname.toLowerCase();
    if (/(?:^|\.)zhihu\.com$/.test(host) &&
        (/^\/question\/\d+/i.test(url.pathname) || /\/answer\/\d+/i.test(url.pathname))) {
        throw new CliError("CLI 仅支持知乎专栏文章，不支持问题或回答链接。");
    }
    const article = /^\/p\/(\d+)\/?$/i.exec(url.pathname);
    if (host !== "zhuanlan.zhihu.com" || !article || !/^https?:$/.test(url.protocol)) {
        throw new CliError("首行 #! 必须是有效的知乎专栏文章 URL。");
    }
    return {
        id: article[1],
        url: `https://zhuanlan.zhihu.com/p/${article[1]}`,
        body: lf < 0 ? "" : text.slice(lf + 1),
    };
}

function imageSource(token: any): string | undefined {
    if (!token.attrs) return undefined;
    const src = token.attrs.filter((attr: string[]) => attr[0] === "src")[0];
    return src ? src[1] : undefined;
}

export function setImageSource(token: any, src: string): void {
    const attr = token.attrs.filter((item: string[]) => item[0] === "src")[0];
    if (attr) attr[1] = src;
}

function collectImages(tokens: any[], result: ImageReference[] = []): ImageReference[] {
    for (const token of tokens) {
        if (token.type === "image") {
            const src = imageSource(token);
            if (src) result.push({ src, token });
        }
        if (token.children) collectImages(token.children, result);
    }
    return result;
}

function plainInline(parser: MarkdownIt, content: string): string {
    return parser.renderInline(content).replace(/<[^<>]+\/?>/g, "").trim();
}

export function parseArticle(filePath: string, titleOverride?: string,
    coverOverride?: string): ParsedArticle {
    const absolutePath = path.resolve(filePath);
    let originalText: string;
    try {
        originalText = fs.readFileSync(absolutePath, "utf8");
    } catch (error) {
        throw new CliError("无法读取 Markdown 文件，请检查路径和权限。");
    }
    if (!originalText.trim()) throw new CliError("Markdown 文档为空。");

    const shebang = parseShebang(originalText);
    const parser = createMarkdownParser();
    const tokens = parser.parse(shebang.body, {});
    const headingStart = tokens.findIndex(token => token.type === "heading_open" && token.tag === "h1");
    let headingEnd = -1;
    let headingTitle: string | undefined;
    if (headingStart >= 0) {
        headingEnd = tokens.findIndex((token, index) => index > headingStart &&
            token.type === "heading_close" && token.tag === "h1");
        if (headingEnd < 0 || !tokens[headingStart + 1]) {
            throw new CliError("无法解析第一个 H1 标题。");
        }
        headingTitle = plainInline(parser, tokens[headingStart + 1].content);
    }
    const title = titleOverride !== undefined ? titleOverride.trim() : headingTitle;
    if (!title) throw new CliError("未找到 H1 标题，请添加 H1 或使用 --title。");

    const baseDir = path.dirname(absolutePath);
    let coverSource = coverOverride;
    let coverTokenIndex: number | undefined;
    if (headingStart >= 0) {
        for (let i = 0; i < headingStart; i++) {
            if (tokens[i].type !== "inline" || !tokens[i].children) continue;
            for (const child of tokens[i].children) {
                if (child.type !== "image") continue;
                const src = imageSource(child);
                if (src) {
                    if (coverOverride === undefined) coverSource = src;
                    coverTokenIndex = i;
                }
            }
        }
    }

    return {
        filePath: absolutePath,
        originalText,
        baseDir,
        tokens,
        title,
        coverSource,
        coverTokenIndex,
        headingStart,
        headingEnd,
        articleId: shebang.id,
        articleUrl: shebang.url,
        images: collectImages(tokens),
        parser,
    };
}

export function renderArticle(article: ParsedArticle): string {
    const tokens = article.tokens.filter((token, index) => {
        if (article.headingStart >= 0 && index >= article.headingStart && index <= article.headingEnd) {
            return false;
        }
        return index !== article.coverTokenIndex;
    });
    return article.parser.renderer.render(tokens, {}, {});
}

export function dryRunInfo(article: ParsedArticle): any {
    return {
        dryRun: true,
        title: article.title,
        cover: article.coverSource || null,
        images: article.images.map(image => image.src),
        articleId: article.articleId || null,
        articleUrl: article.articleUrl || null,
        update: article.articleId !== undefined,
        file: article.filePath,
    };
}
