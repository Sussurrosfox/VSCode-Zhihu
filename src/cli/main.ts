import { CookieSession, resolveCookiePath } from "./cookies";
import { HttpClient } from "./http";
import { HelpText, parseArguments } from "./options";
import { parseForDryRun, publish, whoami } from "./publisher";

function writeJson(value: any): void {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export async function run(argv: string[]): Promise<void> {
    const options = parseArguments(argv);
    if (options.help) {
        process.stdout.write(`${HelpText}\n`);
        return;
    }

    if (options.command === "publish" && options.dryRun) {
        writeJson(parseForDryRun(options.file, options.title, options.cover));
        return;
    }

    const cookiePath = resolveCookiePath(options.cookieFile);
    const http = new HttpClient(new CookieSession(cookiePath));
    if (options.command === "whoami") {
        const profile = await whoami(http);
        if (options.json) writeJson(profile);
        else process.stdout.write(`${profile.name} (${profile.url_token}, ${profile.id})\n`);
        return;
    }
    if (options.command === "publish") {
        const result = await publish(http, options.file, options.title,
            options.cover, options.writeLink);
        if (options.json) writeJson(result);
        else process.stdout.write(`${result.url}\n`);
    }
}
