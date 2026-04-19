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
