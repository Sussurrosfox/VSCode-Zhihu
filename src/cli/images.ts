import * as OSS from "ali-oss";
import * as fs from "fs";
import * as md5 from "md5";
import * as path from "path";
import { ZhihuOSSAgent } from "../const/HTTP";
import { ImageHostAPI, ImageUpload } from "../const/URL";
import { HttpClient, networkError, requireSuccess } from "./http";
import { ParsedArticle, setImageSource } from "./markdown";
import { CliError } from "./options";

function isZhihuImage(source: string): boolean {
    try {
        const url = new URL(source);
        return /^https?:$/.test(url.protocol) && url.hostname.toLowerCase() === "pic4.zhimg.com";
    } catch (error) {
        return false;
    }
}

function isRemote(source: string): boolean {
    return /^https?:\/\//i.test(source);
}

function imageExtension(source: string): string {
    try {
        const resourcePath = isRemote(source) ? new URL(source).pathname : source;
        return path.extname(resourcePath).toLowerCase();
    } catch (error) {
        return "";
    }
}

export class ImageUploader {
    private readonly cache: { [key: string]: Promise<string> } = {};

    public constructor(private readonly http: HttpClient) {}

    public upload(source: string, baseDir: string): Promise<string> {
        if (isZhihuImage(source)) return Promise.resolve(source);
        const key = isRemote(source) ? source : path.resolve(baseDir, source);
        if (!this.cache[key]) this.cache[key] = this.doUpload(source, baseDir);
        return this.cache[key];
    }

    public async uploadArticleImages(article: ParsedArticle): Promise<string | undefined> {
        for (const image of article.images) {
            const uploaded = await this.upload(image.src, article.baseDir);
            setImageSource(image.token, uploaded);
        }
        if (!article.coverSource) return undefined;
        return this.upload(article.coverSource, article.baseDir);
    }

    private async doUpload(source: string, baseDir: string): Promise<string> {
        const buffer = await this.readImage(source, baseDir);
        if (!buffer.length) throw new CliError("图片内容为空，无法上传。");
        const hash = md5(buffer);
        const prefetch = await this.http.request({
            uri: ImageUpload,
            method: "POST",
            body: { image_hash: hash, source: "answer" },
            json: true,
            headers: {},
        });
        requireSuccess(prefetch, "图片上传预检");
        const body = prefetch.body;
        if (!body || typeof body !== "object") {
            throw new CliError("图片上传预检响应无效。");
        }

        if (body.upload_token) {
            await this.putToOss(body, buffer);
        }
        return `${ImageHostAPI}/v2-${hash}${imageExtension(source)}`;
    }

    private async readImage(source: string, baseDir: string): Promise<Buffer> {
        if (isRemote(source)) {
            const response = await this.http.request({
                uri: source,
                method: "GET",
                encoding: null,
                json: false,
                headers: {},
            });
            requireSuccess(response, "远程图片下载");
            if (!Buffer.isBuffer(response.body)) {
                throw new CliError("远程图片下载响应无效。");
            }
            return response.body;
        }
        if (/^[a-z][a-z\d+.-]*:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) {
            throw new CliError("仅支持本地路径或 HTTP(S) 图片。");
        }
        try {
            return fs.readFileSync(path.resolve(baseDir, source));
        } catch (error) {
            throw new CliError("无法读取本地图片，请检查相对路径和权限。");
        }
    }

    private async putToOss(body: any, buffer: Buffer): Promise<void> {
        const token = body.upload_token;
        const uploadFile = body.upload_file;
        if (!token || !uploadFile || typeof uploadFile.object_key !== "string" ||
            typeof token.access_id !== "string" || typeof token.access_key !== "string" ||
            typeof token.access_token !== "string") {
            throw new CliError("图片上传预检响应缺少必要字段。");
        }
        const options = {
            ...ZhihuOSSAgent.options,
            accessKeyId: token.access_id,
            accessKeySecret: token.access_key,
            stsToken: token.access_token,
        };
        try {
            const client = new OSS(options);
            const result: any = await client.put(uploadFile.object_key, buffer);
            const status = result && result.res &&
                (result.res.status || result.res.statusCode);
            if (!status || status < 200 || status >= 300) {
                throw new Error("OSS status");
            }
        } catch (error) {
            throw networkError(error, "图片 OSS 上传");
        }
    }
}
