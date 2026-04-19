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
- {{c1:::: 1 $math$ }} - {{c1:: hello $math$ }}
1. {{c2:::: 2 \`code\` }} - {{c2:: hi \`code\` }}
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
- {{c1:::: 1 $math$ }} = {{c1:: hello $math$ }}
1. {{c2:::: 2 \`code\` }} = {{c2:: hi \`code\` }}
2. But math $x = y$ does not transform
3. Code \`x = y\` does not transform as well

3 = hello
`.trim()
    const result = transformMarkdownToCloze(input)
    expect(result).toBe(expected);
});