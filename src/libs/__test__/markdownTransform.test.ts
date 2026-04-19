import { transformMarkdownToCloze } from "../md-transform/cloze-transform";
import { expect, test } from "vitest";

test('Paragraph cloze transform with dash', () => {
    const input = `
# HEADER
- 1 $math$ - hello $math$
1. 2 \`code\` - hi \`code\`
2. But math $x - y$ does not transform
3. Code \`x - y\` does not transform as well

3 - hello
`.trim()

    const expected = `
# HEADER
- 1 $math$ - {{c1:: hello $math$ }}
1. 2 \`code\` - {{c2:: hi \`code\` }}
2. But math $x - y$ does not transform
3. Code \`x - y\` does not transform as well

3 - hello
`.trim()
    const result = transformMarkdownToCloze(input)
    expect(result).toBe(expected);
});

test('Paragraph cloze transform with equals', () => {
    const input = `
# HEADER
- 1 $math$ = hello $math$
1. 2 \`code\` = hi \`code\`
2. But math $x = y$ does not transform
3. Code \`x = y\` does not transform as well

3 = hello
`.trim()

    const expected = `
# HEADER
- 1 $math$ = {{c1:: hello $math$ }}
1. 2 \`code\` = {{c2:: hi \`code\` }}
2. But math $x = y$ does not transform
3. Code \`x = y\` does not transform as well

3 = hello
`.trim()
    const result = transformMarkdownToCloze(input)
    expect(result).toBe(expected);
});

test('Obsidian wikilinks are preserved as dedicated nodes and do not become cloze deletions', () => {
    const input = `
- [[xyz - 123]]
- [[xyz - 123]] - hello
`.trim()

    const expected = `
- [[xyz - 123]]
- [[xyz - 123]] - {{c1:: hello }}
`.trim()

    const result = transformMarkdownToCloze(input)
    expect(result).toBe(expected);
});

test('Prompt cloze can be enabled explicitly', () => {
    const input = `
- [[xyz - 123]] - hello
`.trim()

    const expected = `
- {{c1:::: [[xyz - 123]] }} - {{c1:: hello }}
`.trim()

    const result = transformMarkdownToCloze(input, { includePromptCloze: true })
    expect(result).toBe(expected);
});
