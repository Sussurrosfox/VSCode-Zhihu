# Zhihu On VSCode CLI

插件从 0.6.6 起附带独立 Node.js CLI。CLI 不加载 VS Code，也不需要打开编辑器，可直接在终端、脚本或 AI agent 中发布和更新知乎专栏文章。

## 入口

安装 VSIX 后，入口位于扩展目录的 `dist/cli.js`：

```bash
node "<扩展目录>/dist/cli.js" --help
```

Windows Stable 的扩展目录通常为：

```text
%USERPROFILE%\.vscode\extensions\niudai.vscode-zhihu-0.6.6
```

在源码目录中则使用：

```bash
node tools/VSCode-Zhihu/dist/cli.js --help
```

`package.json` 也声明了 `vscode-zhihu` 的 npm `bin`；使用 npm 打包/链接该插件源码时会生成对应命令。

## 登录态

CLI 默认复用插件已有的 Cookie。若尚未登录，先在 VS Code 中执行一次 `Zhihu: Login`。

默认查找 Stable、Insiders、VSCodium 的 `globalStorage/niudai.vscode-zhihu/cookie.json`。也可显式指定：

```bash
node dist/cli.js whoami --cookie-file "/path/to/cookie.json" --json
```

或使用环境变量：

```bash
ZHIHU_COOKIE_FILE="/path/to/cookie.json" node dist/cli.js whoami
```

优先级为 `--cookie-file` > `ZHIHU_COOKIE_FILE` > 默认路径。Cookie、XSRF 和 OSS 临时凭证不会写入 CLI 日志。

## 检查登录

```bash
node dist/cli.js whoami --json
```

成功时输出账号的 `id`、`url_token` 和 `name`；未登录或请求失败时退出码非零。

## 发布或更新文章

```bash
node dist/cli.js publish article.md --json
```

Markdown 规则与插件一致：

- 第一个 `# H1` 是文章标题，不会重复出现在正文中。
- H1 前的图片是封面，不会重复出现在正文中。
- 本地图片路径相对于 Markdown 文件；本地及站外图片会先上传至知乎图床。
- 首行 `#! https://zhuanlan.zhihu.com/p/<id>` 表示更新该文章。
- 新建成功后默认把文章链接写回首行；再次执行会更新而非重复创建。

可选参数：

```text
--title <标题>       覆盖 H1 标题
--cover <图片>       覆盖封面，支持本地路径或 HTTP(S) 图片
--no-write-link      新建后不修改 Markdown
--json               stdout 输出机器可读 JSON
--dry-run            只做本地解析，不联网、不上传、不写文件
--cookie-file <path> 使用指定 Cookie 文件
```

Agent 推荐调用方式：

```bash
node dist/cli.js publish article.md --dry-run --json
node dist/cli.js publish article.md --json
```

成功的 JSON 包含 `articleId`、`url`、`title`、`cover` 和 `update`。所有参数、网络及发布错误均返回非零退出码；JSON 模式下错误也以 JSON 输出。

## 本地构建

```bash
npm install
npm run vscode:prepublish
npx vsce package
```

`vscode:prepublish` 会同时构建原有 `dist/extension.js` 和新的 `dist/cli.js`。
