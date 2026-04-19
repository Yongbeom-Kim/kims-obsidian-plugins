import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const createMarkdownToHtmlProcessor = () =>
  unified()
    .use(remarkParse)
    .use(remarkMath)
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
      },
    })
    .use(rehypeStringify)


export const markdownToHtml = async (markdown: string): Promise<string> => {
  const file = await createMarkdownToHtmlProcessor().process(markdown)
  return String(file)
}