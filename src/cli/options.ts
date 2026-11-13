export type CommandName = "whoami" | "publish";

export interface CliOptions {
    command?: CommandName;
    help: boolean;
    json: boolean;
    file?: string;
    title?: string;
    cover?: string;
    dryRun: boolean;
    writeLink: boolean;
    cookieFile?: string;
}

export class CliError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "CliError";
        Object.setPrototypeOf(this, CliError.prototype);
    }
}

export const HelpText = `用法：
  node dist/cli.js whoami [--json] [--cookie-file <path>]
  node dist/cli.js publish <article.md> [--title <标题>] [--cover <图片>] [--json]
                         [--dry-run] [--no-write-link] [--cookie-file <path>]
  node dist/cli.js --help

Cookie 路径优先级：--cookie-file > ZHIHU_COOKIE_FILE > VS Code 默认路径。
--dry-run 仅解析本地 Markdown，不联网、不上传，也不写入任何文件。`;

function requireValue(argv: string[], index: number, option: string): string {
    const value = argv[index + 1];
    if (value === undefined || value.length === 0 || /^--/.test(value)) {
        throw new CliError(`${option} 需要一个非空参数。`);
    }
    return value;
}

function setOnce(target: CliOptions, key: "title" | "cover" | "cookieFile" | "file",
    value: string, option: string): void {
    if (target[key] !== undefined) {
        throw new CliError(`${option} 不能重复指定。`);
    }
    target[key] = value;
}

export function parseArguments(argv: string[]): CliOptions {
    const options: CliOptions = {
        help: false,
        json: false,
        dryRun: false,
        writeLink: true,
    };
    if (argv.length === 0) {
        throw new CliError("缺少命令。使用 --help 查看用法。");
    }
    if (argv.indexOf("--help") >= 0 || argv.indexOf("-h") >= 0) {
        options.help = true;
        return options;
    }
    const command = argv[0];
    if (command !== "whoami" && command !== "publish") {
        throw new CliError(`未知命令：${command || "(空)"}。`);
    }
    options.command = command;
    const booleanSeen: { [key: string]: boolean } = {};

    for (let i = 1; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--json" || arg === "--dry-run" || arg === "--no-write-link") {
            if (booleanSeen[arg]) throw new CliError(`${arg} 不能重复指定。`);
            booleanSeen[arg] = true;
            if (arg === "--json") options.json = true;
            if (arg === "--dry-run") options.dryRun = true;
            if (arg === "--no-write-link") options.writeLink = false;
            continue;
        }
        if (arg === "--title" || arg === "--cover" || arg === "--cookie-file") {
            const value = requireValue(argv, i, arg);
            i++;
            if (arg === "--title") setOnce(options, "title", value, arg);
            if (arg === "--cover") setOnce(options, "cover", value, arg);
            if (arg === "--cookie-file") setOnce(options, "cookieFile", value, arg);
            continue;
        }
        if (arg.indexOf("-") === 0) {
            throw new CliError(`未知选项：${arg}。`);
        }
        if (command === "publish") setOnce(options, "file", arg, "Markdown 文件");
        else throw new CliError(`whoami 不接受位置参数：${arg}。`);
    }

    if (command === "publish" && !options.file) {
        throw new CliError("publish 需要指定 Markdown 文件。");
    }
    if (command === "whoami" && (options.title !== undefined || options.cover !== undefined ||
        options.dryRun || !options.writeLink)) {
        throw new CliError("该选项只能用于 publish。");
    }
    if (options.title !== undefined && !options.title.trim()) {
        throw new CliError("标题不能为空。");
    }
    return options;
}
