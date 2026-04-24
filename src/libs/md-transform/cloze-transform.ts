import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { Root } from "remark-parse/lib";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { Node as UnistNode } from "unist";
import { remarkParseObsidianLink } from "./remark-obsidian-link";

export type ClozeTransformOptions = {
  includePromptCloze?: boolean
}

export const transformMarkdownToCloze = (markdown: string, options: ClozeTransformOptions = {}): string => {
    const ast = markdownToAst(markdown)
    const transformedAst = convertToClozeAST(ast, options)
    return astToMarkdown(transformedAst)
}

const markdownToAst = (markdown: string) => unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkParseObsidianLink)
  .parse(markdown) as Root

const convertToClozeAST = (ast: Root, options: ClozeTransformOptions): Root => {
  const astCopy = JSON.parse(JSON.stringify(ast)) // TODO: dangerous
  const visitor = new MarkdownAstToClozeTransfomer(options)
  visit(astCopy, visitor.visit)
  return astCopy
}

const astToMarkdown = (tree: Root): string =>
  unified()
    .use(remarkParseObsidianLink)
    .use(remarkStringify, {
      // Keep unordered list output stable for tests and plugin output.
      bullet: '-',
      // Control when root-level nodes should be written without a blank line.
      join: [(left, right, parent) => {
        // Preserve the common markdown pattern of a heading immediately
        // followed by a list without inserting an empty line.
        if (parent?.type === 'root' && left.type === 'heading' && right.type === 'list') {
          return 0
        }

        // Avoid separating adjacent top-level lists, such as a '-' list
        // followed by an ordered list, with an extra blank line.
        if (parent?.type === 'root' && left.type === 'list' && right.type === 'list') {
          return 0
        }

        // Use remark's default spacing rules for every other node pair.
        return undefined
      }],
    })
    .use(remarkMath)
    .stringify(tree)
    .trim()


type TextNode = UnistNode & { type: 'text'; value: string }
type ParagraphNode = UnistNode & { type: 'paragraph'; children?: UnistNode[] }
type ListItemNode = UnistNode & { type: 'listItem' }

const CLOZE_END = ' }}'

const createClozePromptStartNode = (clozeIndex: number): TextNode => ({
  type: 'text',
  value: `{{c${clozeIndex}:::: `,
})

const createClozeAnswerStartNode = (clozeIndex: number): TextNode => ({
  type: 'text',
  value: `{{c${clozeIndex}:: `,
})

const createClozeEndNode = (): TextNode => ({
  type: 'text',
  value: CLOZE_END,
})

const createSeparatorNode = (separator: '-' | '='): TextNode => ({
  type: 'text',
  value: ` ${separator} `,
})

class MarkdownAstToClozeTransfomer {
  private clozeIndex = 0
  private readonly includePromptCloze: boolean

  constructor(options: ClozeTransformOptions = {}) {
    this.includePromptCloze = options.includePromptCloze ?? false
  }

  visit = (node: UnistNode, _index?: number, parent?: UnistNode) => {
    if (node.type === 'paragraph') {
      this.visitParagraphNode(node as ParagraphNode, parent)
    }
  }

  private visitParagraphNode(paragraph: ParagraphNode, parent?: UnistNode): void {
    if (!this.isListItemNode(parent)) {
      return
    }

    const children = paragraph.children
    if (!children?.length) {
      return
    }
    const split = this.splitParagraphChildrenAtFirstSeparator(children)
    if (!split) {
      return
    }

    this.clozeIndex += 1
    paragraph.children = this.includePromptCloze
      ? [
        createClozePromptStartNode(this.clozeIndex),
        ...split.before,
        createClozeEndNode(),
        createSeparatorNode(split.separator),
        createClozeAnswerStartNode(this.clozeIndex),
        ...split.after,
        createClozeEndNode(),
      ]
      : [
        ...split.before,
        createSeparatorNode(split.separator),
        createClozeAnswerStartNode(this.clozeIndex),
        ...split.after,
        createClozeEndNode(),
      ]
  }

/**
 * Splits paragraph children at the first occurrence of a separator \s([-=])\s
 * surrounded by whitespace. Only considers text nodes and stops at the first
 * newline encountered before a match.
 *
 * @param children - Array of child nodes within a paragraph.
 * @returns Object with `before` and `after` node arrays and the matched
 *          `separator`, or `null` if no valid separator is found or if either
 *          side is empty.
 */
  private splitParagraphChildrenAtFirstSeparator(children: UnistNode[]): { before: UnistNode[]; after: UnistNode[]; separator: '-' | '=' } | null {
    const before: UnistNode[] = []
    const after: UnistNode[] = []
    let foundSeparator: '-' | '=' | null = null

    for (const child of children) {
      if (!foundSeparator) {
        if (!this.isTextNode(child)) {
          before.push(child)
          continue
        }

        const newlineIndex = child.value.indexOf('\n')
        const firstLineValue = newlineIndex >= 0 ? child.value.slice(0, newlineIndex) : child.value
        const match = /(.*?)(\s([-=])\s)(.*)/.exec(firstLineValue)

        if (!match) {
          if (newlineIndex >= 0) {
            return null
          }

          before.push(child)
          continue
        }

        const [, frontText, , separator, backText] = match
        if (frontText) {
          before.push(this.createTextNode(frontText))
        }

        foundSeparator = separator as '-' | '='

        const afterText = `${backText}${newlineIndex >= 0 ? child.value.slice(newlineIndex) : ''}`
        if (afterText) {
          after.push(this.createTextNode(afterText))
        }
        continue
      }

      after.push(child)
    }

    if (!foundSeparator || before.length === 0 || after.length === 0) {
      return null
    }

    return { before, after, separator: foundSeparator }
  }

  private isTextNode(node: UnistNode): node is TextNode {
    return node.type === 'text' && typeof (node as TextNode).value === 'string'
  }

  private isListItemNode(node?: UnistNode): node is ListItemNode {
    return node?.type === 'listItem'
  }

  private createTextNode(value: string): TextNode {
    return { type: 'text', value }
  }
}
