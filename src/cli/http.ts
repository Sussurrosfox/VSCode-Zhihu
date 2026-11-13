import * as request from "request-promise";
import { CookieSession } from "./cookies";
import { CliError } from "./options";

const DefaultHeaders = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
};

export interface HttpResponse {
    statusCode: number;
    headers: { [key: string]: any };
    body: any;
}

export interface HttpOptions {
    uri: string;
    method?: string;
    body?: any;
    json?: boolean;
    encoding?: null;
    headers?: { [key: string]: string };
}

export class HttpClient {
    public constructor(private readonly cookies: CookieSession) {}

    public async request(options: HttpOptions): Promise<HttpResponse> {
        const headers: { [key: string]: string } = {
            ...DefaultHeaders,
            ...(options.headers || {}),
            cookie: this.cookies.cookieHeader(options.uri),
        };
        const xsrf = this.cookies.xsrfHeader();
        if (xsrf) headers["x-xsrftoken"] = xsrf;
        if (options.body !== undefined && options.json) {
            headers["content-type"] = "application/json; charset=UTF-8";
        }

        let response: HttpResponse;
        try {
            response = await request({
                uri: options.uri,
                method: options.method || "GET",
                body: options.body,
                headers,
                json: options.json === true,
                encoding: options.encoding,
                gzip: false,
                resolveWithFullResponse: true,
                simple: false,
            });
        } catch (error) {
            const code = error && error.code ? ` (${error.code})` : "";
            throw new CliError(`网络请求失败${code}。`);
        }
        await this.cookies.saveResponseCookies(response.headers["set-cookie"], options.uri);
        return response;
    }
}

export function requireSuccess(response: HttpResponse, action: string): void {
    if (!response || response.statusCode < 200 || response.statusCode >= 300) {
        const status = response && response.statusCode ? `，HTTP ${response.statusCode}` : "";
        throw new CliError(`${action}失败${status}。`);
    }
}

export function networkError(error: any, action: string): CliError {
    if (error instanceof CliError) return error;
    const code = error && error.code ? ` (${error.code})` : "";
    return new CliError(`${action}失败${code}。`);
}
