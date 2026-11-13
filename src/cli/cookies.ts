import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Cookie, CookieJar } from "tough-cookie";
import * as FileCookieStore from "tough-cookie-filestore";
import { CliError } from "./options";

const StorageSuffix = ["User", "globalStorage", "niudai.vscode-zhihu", "cookie.json"];

function cookieCandidates(): string[] {
    const products = ["Code", "Code - Insiders", "VSCodium"];
    let configRoot: string;
    if (process.platform === "win32") {
        configRoot = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    } else if (process.platform === "darwin") {
        configRoot = path.join(os.homedir(), "Library", "Application Support");
    } else {
        configRoot = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    }
    return products.map(product => path.join(configRoot, product, ...StorageSuffix));
}

export function resolveCookiePath(cliPath?: string): string {
    if (cliPath) return path.resolve(cliPath);
    if (process.env.ZHIHU_COOKIE_FILE) return path.resolve(process.env.ZHIHU_COOKIE_FILE);
    const candidates = cookieCandidates();
    return candidates.filter(candidate => fs.existsSync(candidate))[0] || candidates[0];
}

function prepareCookieFile(filePath: string): void {
    try {
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, "{}", "utf8");
            return;
        }
        if (!fs.readFileSync(filePath, "utf8").trim()) {
            fs.writeFileSync(filePath, "{}", "utf8");
        }
    } catch (error) {
        throw new CliError("无法准备 Cookie 文件，请检查路径和权限。");
    }
}

export class CookieSession {
    public readonly jar: CookieJar;
    public readonly filePath: string;
    private xsrfToken?: string;

    public constructor(filePath: string) {
        this.filePath = filePath;
        prepareCookieFile(filePath);
        try {
            const store = new FileCookieStore(filePath);
            this.jar = new CookieJar(store);
        } catch (error) {
            throw new CliError("Cookie 文件格式无效或无法读取。");
        }
        this.refreshXsrf();
    }

    public cookieHeader(uri: string): string {
        try {
            return this.jar.getCookieStringSync(uri);
        } catch (error) {
            throw new CliError("无法读取请求所需的 Cookie。");
        }
    }

    public xsrfHeader(): string | undefined {
        this.refreshXsrf();
        return this.xsrfToken;
    }

    public async saveResponseCookies(setCookies: string[] | undefined, uri: string): Promise<void> {
        if (!setCookies) return;
        for (const value of setCookies) {
            const cookie = Cookie.parse(value);
            if (!cookie) continue;
            try {
                await new Promise<void>((resolve, reject) => {
                    this.jar.setCookie(cookie, uri, { ignoreError: true }, error => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
            } catch (error) {
                throw new CliError("保存响应 Cookie 失败。");
            }
        }
        this.refreshXsrf();
    }

    private refreshXsrf(): void {
        try {
            const cookies = this.jar.getCookiesSync("https://www.zhihu.com/");
            const xsrf = cookies.filter(cookie => cookie.key === "_xsrf")[0];
            this.xsrfToken = xsrf ? xsrf.value : undefined;
        } catch (error) {
            this.xsrfToken = undefined;
        }
    }
}
