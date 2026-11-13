#!/usr/bin/env node
import { run } from "./cli/main";
import { CliError } from "./cli/options";

run(process.argv.slice(2)).catch(error => {
    const message = error instanceof CliError ? error.message : "操作失败。";
    if (process.argv.slice(2).indexOf("--json") >= 0) {
        process.stdout.write(`${JSON.stringify({ error: message })}\n`);
    } else {
        process.stderr.write(`错误：${message}\n`);
    }
    process.exitCode = 1;
});
