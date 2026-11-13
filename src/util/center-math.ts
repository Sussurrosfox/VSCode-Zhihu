import * as MarkdownIt from "markdown-it";

/** Center display equations without changing inline equations. */
export function centerDisplayMath(parser: MarkdownIt): void {
    const renderMathBlock = parser.renderer.rules.math_block;
    if (!renderMathBlock) return;
    parser.renderer.rules.math_block = (tokens, index, options, env, self) =>
        renderMathBlock(tokens, index, options, env, self)
            .replace(/^<p>/, '<p style="text-align:center">');
}
