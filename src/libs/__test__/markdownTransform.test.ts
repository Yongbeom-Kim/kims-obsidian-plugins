import { describe, expect, test } from "vitest";
import { transformMarkdownToCloze } from "../md-transform/cloze-transform";

describe('transformMarkdownToCloze', () => {
    test('applies paragraph cloze transforms around dash delimiters', () => {
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

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('applies paragraph cloze transforms around equals delimiters', () => {
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

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('preserves Obsidian wikilinks as dedicated nodes and does not cloze them directly', () => {
        const input = `
- [[xyz - 123]]
- [[xyz - 123]] - hello
`.trim()

        const expected = `
- [[xyz - 123]]
- [[xyz - 123]] - {{c1:: hello }}
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('can generate prompt cloze wrappers when enabled explicitly', () => {
        const input = `
- [[xyz - 123]] - hello
`.trim()

        const expected = `
- {{c1:::: [[xyz - 123]] }} - {{c1:: hello }}
`.trim()

        expect(transformMarkdownToCloze(input, { includePromptCloze: true })).toBe(expected);
    });

    test('keeps the existing markdown example stable across nested lists and mixed content', () => {
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

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('uses hash comments to delimit code-block cloze runs and resets on blank lines', () => {
        const input = `
\`\`\`py
some code

# comment
code1
code2

code3

# comment
# detail
code
\`\`\`
`.trim()

        const expected = `
\`\`\`py
some code

# comment
{{c1:: code1}}
{{c1:: code2}}

code3

# comment
# detail
{{c2:: code}}
\`\`\`
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('treats whitespace-only lines inside code blocks as blank-line resets', () => {
        const input = `
\`\`\`py
# comment
code1
   
code2

# comment
code3
\`\`\`
`.trim()

        const expected = `
\`\`\`py
# comment
{{c1:: code1}}
   
code2

# comment
{{c2:: code3}}
\`\`\`
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('allows indented hash comments in code blocks to start cloze runs while preserving indentation', () => {
        const input = `
\`\`\`py
    # comment
    code1
    code2
\`\`\`
`.trim()

        const expected = `
\`\`\`py
    # comment
{{c1::     code1}}
{{c1::     code2}}
\`\`\`
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('leaves code blocks unchanged when no hash-comment delimiter appears', () => {
        const input = `
\`\`\`py
code1
code2
\`\`\`
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(input);
    });

    test('does not create a cloze run when a comment is followed immediately by a blank line', () => {
        const input = `
\`\`\`py
# comment

code1
\`\`\`
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(input);
    });

    test('keeps cloze numbering monotonic across list items and code blocks in a larger markdown note', () => {
        const input = `
# Card
- Prompt - answer

\`\`\`py
setup()

# reveal
line1
line2
\`\`\`

- Follow-up - result
`.trim()

        const expected = `
# Card
- Prompt - {{c1:: answer }}

\`\`\`py
setup()

# reveal
{{c2:: line1}}
{{c2:: line2}}
\`\`\`

- Follow-up - {{c3:: result }}
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('clozes every non-header body cell outside the first column in a basic markdown table', () => {
        const input = `
| Prompt | Answer |
| - | - |
| TCP handshake | synchronize |
| HTTP 404 | not found |
`.trim()

        const expected = `
| Prompt | Answer |
| - | - |
| TCP handshake | {{c1:: synchronize }} |
| HTTP 404 | {{c2:: not found }} |
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('clozes each eligible data cell independently across wider rows', () => {
        const input = `
| Topic | Hint | Answer |
| - | - | - |
| TCP handshake | SYN packet | synchronize |
| HTTP status | client error | not found |
`.trim()

        const expected = `
| Topic | Hint | Answer |
| - | - | - |
| TCP handshake | {{c1:: SYN packet }} | {{c2:: synchronize }} |
| HTTP status | {{c3:: client error }} | {{c4:: not found }} |
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('preserves alignment markers and escaped pipes while clozing eligible table cells', () => {
        const input = `
| Topic | Hint | Answer |
| :-- | :-: | --: |
| TCP handshake | a \\| b | synchronize |
`.trim()

        const expected = `
| Topic | Hint | Answer |
| :- | :-: | -: |
| TCP handshake | {{c1:: a \\| b }} | {{c2:: synchronize }} |
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('skips empty data cells without consuming cloze numbering for later cells', () => {
        const input = `
| Topic | A | B |
| - | - | - |
| TCP handshake | | ACK |
| HTTP status | client error | |
`.trim()

        const expected = `
| Topic | A | B |
| - | - | - |
| TCP handshake | | {{c1:: ACK }} |
| HTTP status | {{c2:: client error }} | |
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('preserves inline code, math, and wikilinks inside table cells while clozing eligible data cells', () => {
        const input = `
| Topic | Hint | Answer |
| - | - | - |
| [[TCP]] | \`SYN\` | $x = 1$ |
`.trim()

        const expected = `
| Topic | Hint | Answer |
| - | - | - |
| [[TCP]] | {{c1:: \`SYN\` }} | {{c2:: $x = 1$ }} |
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('does not double-wrap cells that already contain cloze markup', () => {
        const input = `
| Topic | Hint | Answer |
| - | - | - |
| TCP handshake | {{c9:: SYN packet }} | synchronize |
`.trim()

        const expected = `
| Topic | Hint | Answer |
| - | - | - |
| TCP handshake | {{c9:: SYN packet }} | {{c1:: synchronize }} |
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });

    test('ignores includePromptCloze for table cells while keeping numbering monotonic', () => {
        const input = `
- Prompt - answer

| Topic | A | B |
| - | - | - |
| TCP handshake | SYN | ACK |
`.trim()

        const expected = `
- {{c1:::: Prompt }} - {{c1:: answer }}

| Topic | A | B |
| - | - | - |
| TCP handshake | {{c2:: SYN }} | {{c3:: ACK }} |
`.trim()

        expect(transformMarkdownToCloze(input, { includePromptCloze: true })).toBe(expected);
    });

    test('keeps cloze numbering monotonic across list items, table data cells, and code blocks', () => {
        const input = `
# Card
- Prompt - answer

| Topic | A | B |
| - | - | - |
| TCP handshake | SYN | ACK |

\`\`\`py
# reveal
line1
\`\`\`
`.trim()

        const expected = `
# Card
- Prompt - {{c1:: answer }}

| Topic | A | B |
| - | - | - |
| TCP handshake | {{c2:: SYN }} | {{c3:: ACK }} |

\`\`\`py
# reveal
{{c4:: line1}}
\`\`\`
`.trim()

        expect(transformMarkdownToCloze(input)).toBe(expected);
    });
});
