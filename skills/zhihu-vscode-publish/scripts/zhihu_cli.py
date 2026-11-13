#!/usr/bin/env python3
"""Locate the newest Zhihu On VSCode CLI and forward all arguments to it."""

import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


def version_key(cli_path):
    match = re.search(r"niudai\.vscode-zhihu-(\d+(?:\.\d+)*)",
                      cli_path.parent.parent.name)
    version = tuple(map(int, match.group(1).split("."))) if match else ()
    return version, cli_path.stat().st_mtime


def find_cli():
    override = os.environ.get("ZHIHU_VSCODE_CLI")
    if override:
        cli = Path(override).expanduser().resolve()
        if cli.is_file():
            return cli
        raise RuntimeError("ZHIHU_VSCODE_CLI 指向的文件不存在。")

    candidates = []
    for folder in (".vscode", ".vscode-insiders", ".vscode-oss"):
        extension_root = Path.home() / folder / "extensions"
        candidates.extend(extension_root.glob(
            "niudai.vscode-zhihu-*/dist/cli.js"))
    candidates = [path for path in candidates if path.is_file()]
    if not candidates:
        raise RuntimeError(
            "未找到 Zhihu On VSCode CLI。请安装 0.6.5 或更高版本，"
            "或用 ZHIHU_VSCODE_CLI 指定 dist/cli.js。")
    return max(candidates, key=version_key)


def main():
    if shutil.which("node") is None:
        raise RuntimeError("未找到 Node.js，请先安装并加入 PATH。")
    cli = find_cli()
    return subprocess.call(["node", str(cli)] + sys.argv[1:])


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as error:
        print(f"错误：{error}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
