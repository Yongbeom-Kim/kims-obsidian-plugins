import { expect, test } from 'vitest';
import { createObsidianOpenUrl, markdownToHtml } from '../md-transform/html-transform';

test('createObsidianOpenUrl encodes vault and file path for obsidian deep links', () => {
  expect(createObsidianOpenUrl('1_Knowledge/0_Permanent/Apache Hive - Partitioning', 'vault-v2'))
    .toBe('obsidian://open?vault=vault-v2&file=1_Knowledge%2F0_Permanent%2FApache%20Hive%20-%20Partitioning.md')
});

test('markdownToHtml renders obsidian wikilinks as anchor tags with obsidian deep links', async () => {
  const html = await markdownToHtml('[[1_Knowledge/0_Permanent/Apache Hive - Partitioning]]', 'vault-v2')

  expect(html).toBe('<p><a href="obsidian://open?vault=vault-v2&#x26;file=1_Knowledge%2F0_Permanent%2FApache%20Hive%20-%20Partitioning.md">1_Knowledge/0_Permanent/Apache Hive - Partitioning</a></p>')
});

test('markdownToHtml uses the provided vault name in generated obsidian links', async () => {
  const html = await markdownToHtml('[[note/path]]', 'team-vault')

  expect(html).toContain('obsidian://open?vault=team-vault&#x26;file=note%2Fpath.md')
});

test('markdownToHtml renders markdown tables as semantic html tables instead of paragraphs', async () => {
  const html = await markdownToHtml(`
| Prompt | Answer |
| - | - |
| TCP handshake | {{c1:: synchronize }} |
`.trim(), 'vault-v2')

  expect(html).toContain('<table>')
  expect(html).toContain('<thead>')
  expect(html).toContain('<tbody>')
  expect(html).toContain('<th>Prompt</th>')
  expect(html).toContain('<td>TCP handshake</td>')
  expect(html).toContain('<td>{{c1:: synchronize }}</td>')
});

test('markdownToHtml renders obsidian links inside table cells as anchor tags', async () => {
  const html = await markdownToHtml(`
| Topic | Reference |
| - | - |
| TCP handshake | [[Protocols/TCP]] |
`.trim(), 'vault-v2')

  expect(html).toContain('<table>')
  expect(html).toContain('obsidian://open?vault=vault-v2&#x26;file=Protocols%2FTCP.md')
  expect(html).toContain('<a href="obsidian://open?vault=vault-v2&#x26;file=Protocols%2FTCP.md">Protocols/TCP</a>')
});

test('markdownToHtml keeps inline math inside table cells without breaking table markup', async () => {
  const html = await markdownToHtml(`
| Topic | Answer |
| - | - |
| Identity | {{c1:: $x = 1$ }} |
`.trim(), 'vault-v2')

  expect(html).toContain('<table>')
  expect(html).toContain('{{c1:: \\(x = 1\\) }}')
});
