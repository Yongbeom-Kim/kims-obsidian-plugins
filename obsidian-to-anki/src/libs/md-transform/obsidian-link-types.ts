import type { Data, Literal } from 'mdast';

export interface ObsidianLink extends Literal {
  type: 'obsidianLink'
  data?: Data
}

declare module 'mdast' {
  interface PhrasingContentMap {
    obsidianLink: ObsidianLink
  }

  interface RootContentMap {
    obsidianLink: ObsidianLink
  }
}

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    obsidianLink: 'obsidianLink'
    obsidianLinkMarker: 'obsidianLinkMarker'
    obsidianLinkValue: 'obsidianLinkValue'
  }
}
