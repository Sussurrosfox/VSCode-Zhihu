import * as fs from "fs";
import { SelfProfileAPI, ZhuanlanAPI, ZhuanlanURL } from "../const/URL";
import { HttpClient, requireSuccess } from "./http";
import { ImageUploader } from "./images";
import { dryRunInfo, parseArticle, renderArticle } from "./markdown";
import { CliError } from "./options";

export interface PublishResult {
    dryRun: boolean;
    title: string;
    cover?: string;
    articleId: string;
    url: string;
    update: boolean;
}

export async function whoami(http: HttpClient): Promise<any> {
    const response = await http.request({ uri: SelfProfileAPI, json: true, headers: {} });
    requireSuccess(response, "登录状态检查");
    const profile = response.body;
    if (!profile || (typeof profile.id !== "string" && typeof profile.id !== "number") ||
        typeof profile.url_token !== "string" || typeof profile.name !== "string") {
        throw new CliError("未登录或账号信息响应无效。");
    }
    return {
        id: profile.id,
        url_token: profile.url_token,
        name: profile.name,
    };
}

function newDraftHeaders(): { [key: string]: string } {
    return {
        "authority": "zhuanlan.zhihu.com",
        "origin": "https://zhuanlan.zhihu.com",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "referer": "https://zhuanlan.zhihu.com/write",
        "x-requested-with": "fetch",
    };
}

async function createDraft(http: HttpClient): Promise<string> {
    const response = await http.request({
        uri: `${ZhuanlanAPI}/drafts`,
        method: "POST",
        body: { title: "h", delta_time: 0 },
        json: true,
        headers: newDraftHeaders(),
    });
    requireSuccess(response, "新建文章草稿");
    if (!response.body || (typeof response.body.id !== "string" &&
        typeof response.body.id !== "number")) {
        throw new CliError("新建文章草稿响应缺少文章 ID。");
    }
    return String(response.body.id);
}

async function saveAndPublish(http: HttpClient, articleId: string, content: string,
    title: string, titleImage?: string): Promise<void> {
    const patch = await http.request({
        uri: `${ZhuanlanAPI}/${articleId}/draft`,
        method: "PATCH",
        body: {
            content,
            title,
            titleImage,
            isTitleImageFullScreen: false,
        },
        json: true,
        headers: {},
    });
    requireSuccess(patch, "保存文章草稿");

    const published = await http.request({
        uri: `${ZhuanlanAPI}/${articleId}/publish`,
        method: "PUT",
        body: { column: undefined, commentPermission: "anyone" },
        json: true,
        headers: {},
    });
    requireSuccess(published, "发布文章");
}

export function parseForDryRun(file: string, title?: string, cover?: string): any {
    return dryRunInfo(parseArticle(file, title, cover));
}

export async function publish(http: HttpClient, file: string, title?: string,
    cover?: string, writeLink: boolean = true): Promise<PublishResult> {
    const article = parseArticle(file, title, cover);
    const uploader = new ImageUploader(http);
    const titleImage = await uploader.uploadArticleImages(article);
    const content = renderArticle(article);
    const updating = article.articleId !== undefined;
    const articleId = updating ? article.articleId : await createDraft(http);
    await saveAndPublish(http, articleId, content, article.title, titleImage);
    const url = `${ZhuanlanURL}${articleId}`;

    if (!updating && writeLink) {
        try {
            fs.writeFileSync(article.filePath, `#! ${url}\n${article.originalText}`, "utf8");
        } catch (error) {
            throw new CliError("文章已发布，但写入首行链接失败，请检查文件权限。");
        }
    }
    return {
        dryRun: false,
        title: article.title,
        cover: titleImage,
        articleId,
        url,
        update: updating,
    };
}
