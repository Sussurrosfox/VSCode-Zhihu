---
name: zhihu-vscode-publish
description: 通过 Zhihu On VSCode 插件附带的独立 CLI 发布或更新知乎专栏文章，支持 Markdown、首个 H1 标题、封面、本地/远程图片、dry-run 与 JSON 输出。当用户要求把 Markdown 发布到知乎、更新已有知乎文章、检查插件登录态，或要求 agent 不使用 GUI 直接发文时使用。仅用于专栏文章，不用于知乎回答。
---

# Zhihu VSCode Publish

使用 `scripts/zhihu_cli.py` 调用最新安装的插件 CLI；不要操作 VS Code GUI，也不要硬编码插件版本路径。

## 调用入口

```bash
python "<Skill 目录>/scripts/zhihu_cli.py" --help
```

包装脚本自动查找 Stable、Insiders、VSCodium 中最新的 `niudai.vscode-zhihu-*/dist/cli.js`。需要固定入口时设置 `ZHIHU_VSCODE_CLI` 为 `cli.js` 路径。

## 发布流程

1. 仅在用户明确要求发布或更新时执行真实发布。
2. 先 dry-run，并检查 JSON 中的 `title`、`cover`、`images`、`articleId` 和 `update`：

```bash
python "<Skill 目录>/scripts/zhihu_cli.py" publish article.md --dry-run --json
```

3. 若需验证登录，运行：

```bash
python "<Skill 目录>/scripts/zhihu_cli.py" whoami --json
```

失败时让用户先在 VS Code 执行 `Zhihu: Login`，不要尝试读取或打印 Cookie。

4. 正式执行：

```bash
python "<Skill 目录>/scripts/zhihu_cli.py" publish article.md --json
```

5. 检查退出码和 JSON 结果，向用户返回 `url`、`articleId` 及 `update`。非零退出时报告错误，不要重试创建新文章。

## 规则

- 第一个 H1 是标题；H1 前图片是封面；两者不会重复进入正文。
- 相对图片以 Markdown 文件所在目录为基准。
- 首行 `#! https://zhuanlan.zhihu.com/p/<id>` 表示更新原文章。确认 `update:true`，避免误建重复文章。
- 新建成功后默认回写首行链接；除非用户明确要求，否则不要添加 `--no-write-link` 或删除该链接。
- 可用 `--title <标题>`、`--cover <图片>` 覆盖标题与封面。
- 可用 `--cookie-file <path>` 或 `ZHIHU_COOKIE_FILE` 指定登录态；不得输出其内容。
- 批量发布时逐篇 dry-run、逐篇发布并汇总链接，只处理用户指定的文件。
