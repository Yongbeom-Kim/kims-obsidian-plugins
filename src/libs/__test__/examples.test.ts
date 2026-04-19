import { transformMarkdownToCloze } from "../md-transform/cloze-transform";
import { expect, test } from "vitest";

test('Comment example applies cloze deletions around dash delimiters', () => {
    const input = `
# [[Bash - Get Word, Byte, Line Count]]
## Overview[^1]
- Get line, word, byte count in file - \`wc file\`
- Get line, word, byte count in command output - \`command | wc\`

## \`wc\` Flags[^1]
- \`wc\` options:
\t- Count lines - \`-l\`
\t- Count words - \`-w\`

## Test
- $x \\ne 2$
### Ax
- Count bytes - \`-c\`
- Count characters - \`-m\`x
`.trim()

    const expected = `
# [[Bash - Get Word, Byte, Line Count]]

## Overview\\[^1]
- Get line, word, byte count in file - {{c1:: \`wc file\` }}
- Get line, word, byte count in command output - {{c2:: \`command | wc\` }}

## \`wc\` Flags\\[^1]
- \`wc\` options:
  - Count lines - {{c3:: \`-l\` }}
  - Count words - {{c4:: \`-w\` }}

## Test
- $x \\ne 2$

### Ax
- Count bytes - {{c5:: \`-c\` }}
- Count characters - {{c6:: \`-m\`x }}
`.trim()

    const result = transformMarkdownToCloze(input)
    expect(result).toBe(expected);
});
