import remarkGfm from "remark-gfm";
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

const TABLE_MARKDOWN_OPTIONS = {
  tableCellPadding: true,
  tablePipeAlign: false,
}

export const transformMarkdownToCloze = (markdown: string, options: ClozeTransformOptions = {}): string => {
    const ast = markdownToAst(markdown)
    const transformedAst = convertToClozeAST(ast, options)
    return astToMarkdown(transformedAst)
}

const markdownToAst = (markdown: string) => unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkParseObsidianLink)
  .parse(markdown) as Root

const convertToClozeAST = (ast: Root, options: ClozeTransformOptions): Root => {
  const astCopy = structuredClone(ast)
  const visitor = new MarkdownAstToClozeTransfomer(options)
  visit(astCopy, visitor.visit)
  return astCopy
}

const astToMarkdown = (tree: Root): string =>
  unified()
    .use(remarkParseObsidianLink)
    .use(remarkGfm, TABLE_MARKDOWN_OPTIONS)
    .use(remarkStringify, {
      bullet: '-',
      join: [(left, right, parent) => {
        if (parent?.type === 'root' && left.type === 'heading' && right.type === 'list') {
          return 0
        }

        if (parent?.type === 'root' && left.type === 'list' && right.type === 'list') {
          return 0
        }

        return undefined
      }],
    })
    .use(remarkMath)
    .stringify(tree)
    .trim()


type TextNode = UnistNode & { type: 'text'; value: string }
type ParentNode = UnistNode & { children?: UnistNode[] }
type ParagraphNode = ParentNode & { type: 'paragraph' }
type ListItemNode = UnistNode & { type: 'listItem' }
type CodeNode = UnistNode & { type: 'code'; value: string }
type TableCellNode = ParentNode & { type: 'tableCell' }
type TableRowNode = ParentNode & { type: 'tableRow'; children?: TableCellNode[] }
type TableNode = ParentNode & { type: 'table'; children?: TableRowNode[] }

const CLOZE_END = ' }}'
const HASH_COMMENT_PREFIX = '#'
const CLOZE_START_PATTERN = /\{\{c\d+::/

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

const createCodeBlockCloze = (line: string, clozeIndex: number): string =>
  `{{c${clozeIndex}:: ${line}}}`

const getNodeTextContent = (nodes: UnistNode[]): string => {
  return nodes.map((node) => {
    const nodeWithValue = node as { value?: unknown }
    if (typeof nodeWithValue.value === 'string') {
      return nodeWithValue.value
    }

    return getNodeTextContent((node as ParentNode).children ?? [])
  }).join('')
}

class MarkdownAstToClozeTransfomer {
  private clozeIndex = 0
  private readonly includePromptCloze: boolean

  constructor(options: ClozeTransformOptions = {}) {
    this.includePromptCloze = options.includePromptCloze ?? false
  }

  visit = (node: UnistNode, _index?: number, parent?: UnistNode) => {
    if (node.type === 'paragraph') {
      this.visitParagraphNode(node as ParagraphNode, parent)
      return
    }

    if (node.type === 'table') {
      this.visitTableNode(node as TableNode)
      return
    }

    if (node.type === 'code') {
      this.visitCodeNode(node as CodeNode)
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

  private visitTableNode(table: TableNode): void {
    const rows = (table.children ?? []) as TableRowNode[]
    if (rows.length === 0) {
      return
    }

    for (const [rowIndex, row] of rows.entries()) {
      if (rowIndex === 0) {
        continue
      }

      for (const [cellIndex, cell] of ((row.children ?? []) as TableCellNode[]).entries()) {
        if (cellIndex === 0) {
          continue
        }

        this.maybeClozeTableCell(cell)
      }
    }
  }

  private visitCodeNode(codeBlock: CodeNode): void {
    codeBlock.value = this.transformCodeBlockValue(codeBlock.value)
  }

  private maybeClozeTableCell(cell: TableCellNode): void {
    const children = cell.children ?? []
    if (getNodeTextContent(children).trim().length === 0 || this.hasExistingCloze(children)) {
      return
    }

    this.clozeIndex += 1
    cell.children = [
      createClozeAnswerStartNode(this.clozeIndex),
      ...children,
      createClozeEndNode(),
    ]
  }

  private hasExistingCloze(nodes: UnistNode[]): boolean {
    return nodes.some((node) => this.nodeContainsExistingCloze(node))
  }

  private nodeContainsExistingCloze(node: UnistNode): boolean {
    if (this.isTextNode(node)) {
      return CLOZE_START_PATTERN.test(node.value)
    }

    return this.hasExistingCloze((node as ParentNode).children ?? [])
  }

  private transformCodeBlockValue(codeBlockValue: string): string {
    const lines = codeBlockValue.split('\n')
    const transformedLines: string[] = []
    let shouldStartCloze = false
    let activeCodeBlockClozeIndex: number | null = null

    for (const line of lines) {
      if (this.isBlankCodeLine(line)) {
        transformedLines.push(line)
        shouldStartCloze = false
        activeCodeBlockClozeIndex = null
        continue
      }

      if (this.isHashCommentLine(line)) {
        transformedLines.push(line)
        shouldStartCloze = true
        activeCodeBlockClozeIndex = null
        continue
      }

      if (!shouldStartCloze && activeCodeBlockClozeIndex === null) {
        transformedLines.push(line)
        continue
      }

      if (activeCodeBlockClozeIndex === null) {
        this.clozeIndex += 1
        activeCodeBlockClozeIndex = this.clozeIndex
      }

      transformedLines.push(createCodeBlockCloze(line, activeCodeBlockClozeIndex))
    }

    return transformedLines.join('\n')
  }

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

  private createTextNode(value: string): TextNode {
    return {
      type: 'text',
      value,
    }
  }

  private isTextNode(node: UnistNode): node is TextNode {
    return node.type === 'text' && typeof (node as TextNode).value === 'string'
  }

  private isListItemNode(node?: UnistNode): node is ListItemNode {
    return node?.type === 'listItem'
  }

  private isBlankCodeLine(line: string): boolean {
    return line.trim().length === 0
  }

  private isHashCommentLine(line: string): boolean {
    return line.trimStart().startsWith(HASH_COMMENT_PREFIX)
  }
}
