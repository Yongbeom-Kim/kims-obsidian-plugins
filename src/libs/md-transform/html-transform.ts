import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype, { type Options as RemarkRehypeOptions } from "remark-rehype";
import { unified } from "unified";
import type { Element } from 'hast';
import type { ObsidianLink } from "./obsidian-link-types";
import { remarkParseObsidianLink } from "./remark-obsidian-link";

const createObsidianOpenUrl = (linkTarget: string, vaultName: string): string => {
  const normalizedPath = linkTarget.endsWith('.md') ? linkTarget : `${linkTarget}.md`
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(normalizedPath)}`
}

const createObsidianLinkElement = (node: ObsidianLink, vaultName: string): Element => ({
  type: 'element',
  tagName: 'a',
  properties: {
    href: createObsidianOpenUrl(node.value, vaultName),
  },
  children: [{
    type: 'text',
    value: node.value,
  }],
})

const createRemarkRehypeOptions = (vaultName: string): RemarkRehypeOptions => ({
  handlers: {
    inlineMath(_state, node) {
      return {
        type: 'text',
        value: `\\(${node.value}\\)`,
      }
    },
    math(_state, node) {
      return {
        type: 'text',
        value: `\\[${node.value}\\]`,
      }
    },
    obsidianLink(_state, node: ObsidianLink) {
      return createObsidianLinkElement(node, vaultName)
    },
  },
})

const createMarkdownToHtmlProcessor = (vaultName: string) =>
  unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkParseObsidianLink)
    .use(remarkRehype, createRemarkRehypeOptions(vaultName))
    .use(rehypeStringify)


export const markdownToHtml = async (markdown: string, vaultName: string): Promise<string> => {
  const file = await createMarkdownToHtmlProcessor(vaultName).process(markdown)
  return String(file)
}

export { createObsidianOpenUrl }
