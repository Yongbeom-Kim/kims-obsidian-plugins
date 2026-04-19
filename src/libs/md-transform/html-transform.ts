import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { ObsidianLink } from "./obsidian-link-types";
import { remarkParseObsidianLink } from "./remark-obsidian-link";

const createMarkdownToHtmlProcessor = () =>
  unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkParseObsidianLink)
    .use(remarkRehype, {
      handlers: {
        inlineMath(state, node) {
          return {
            type: 'text',
            value: `\\(${node.value}\\)`,
          }
        },
        math(state, node) {
          return {
            type: 'text',
            value: `\\[${node.value}\\]`,
          }
        },
        obsidianLink(_state, node: ObsidianLink) {
          return {
            type: 'text',
            value: `[[${node.value}]]`,
          }
        },
      },
    })
    .use(rehypeStringify)


export const markdownToHtml = async (markdown: string): Promise<string> => {
  const file = await createMarkdownToHtmlProcessor().process(markdown)
  return String(file)
}
