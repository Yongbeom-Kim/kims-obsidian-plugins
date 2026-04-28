import type { Plugin } from 'unified';
import type { ObsidianLink } from './obsidian-link-types';

const OPEN_BRACKET = 91
const CLOSE_BRACKET = 93

const isLineEnding = (code: number | null): boolean => code === 10 || code === 13

const obsidianLinkSyntax = {
  text: {
    [OPEN_BRACKET]: {
      name: 'obsidianLink',
      tokenize(effects: any, ok: any, nok: any) {
        let hasValue = false

        return start

        function start(code: number | null) {
          if (code !== OPEN_BRACKET) {
            return nok(code)
          }

          effects.enter('obsidianLink')
          effects.enter('obsidianLinkMarker')
          effects.consume(code)
          return open
        }

        function open(code: number | null) {
          if (code !== OPEN_BRACKET) {
            return nok(code)
          }

          effects.consume(code)
          effects.exit('obsidianLinkMarker')
          effects.enter('obsidianLinkValue')
          return value
        }

        function value(code: number | null) {
          if (code === null || isLineEnding(code) || code === OPEN_BRACKET) {
            return nok(code)
          }

          if (code === CLOSE_BRACKET) {
            if (!hasValue) {
              return nok(code)
            }

            effects.exit('obsidianLinkValue')
            effects.enter('obsidianLinkMarker')
            effects.consume(code)
            return close
          }

          hasValue = true
          effects.consume(code)
          return value
        }

        function close(code: number | null) {
          if (code !== CLOSE_BRACKET) {
            return nok(code)
          }

          effects.consume(code)
          effects.exit('obsidianLinkMarker')
          effects.exit('obsidianLink')
          return ok
        }
      },
    },
  },
}

const obsidianLinkFromMarkdown = {
  enter: {
    obsidianLink(this: any, token: any) {
      this.enter({ type: 'obsidianLink', value: '' }, token)
    },
  },
  exit: {
    obsidianLinkValue(this: any, token: any) {
      const node = this.stack[this.stack.length - 1] as ObsidianLink
      node.value = this.sliceSerialize(token)
    },
    obsidianLink(this: any, token: any) {
      this.exit(token)
    },
  },
}

const obsidianLinkToMarkdown = {
  handlers: {
    obsidianLink(node: ObsidianLink) {
      return `[[${node.value}]]`
    },
  },
}

export const remarkParseObsidianLink: Plugin = function remarkParseObsidianLink() {
  const data = this.data() as {
    fromMarkdownExtensions?: unknown[]
    micromarkExtensions?: unknown[]
    toMarkdownExtensions?: unknown[]
  }

  const micromarkExtensions = data.micromarkExtensions || (data.micromarkExtensions = [])
  const fromMarkdownExtensions = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = [])
  const toMarkdownExtensions = data.toMarkdownExtensions || (data.toMarkdownExtensions = [])

  if (!micromarkExtensions.includes(obsidianLinkSyntax)) {
    micromarkExtensions.push(obsidianLinkSyntax)
  }

  if (!fromMarkdownExtensions.includes(obsidianLinkFromMarkdown)) {
    fromMarkdownExtensions.push(obsidianLinkFromMarkdown)
  }

  if (!toMarkdownExtensions.includes(obsidianLinkToMarkdown)) {
    toMarkdownExtensions.push(obsidianLinkToMarkdown)
  }
}

