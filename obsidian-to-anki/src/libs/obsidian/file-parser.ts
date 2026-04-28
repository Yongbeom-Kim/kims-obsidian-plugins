const USER_NOTE_START_DELIMITER =  '%% ANKI_NOTE_BEGIN %%'
const USER_NOTE_END_DELIMITER = '%% ANKI_NOTE_END %%'

const GENERATED_NOTE_START_DELIMITER = '%% ANKI_GENERATED_NOTE_BEGIN %%'
const GENERATED_NOTE_END_DELIMITER = '%% ANKI_GENERATED_NOTE_END %%'

const hasDelimitedSection = (content: string, startDelimiter: string, endDelimiter: string): boolean => {
  const startIdx = content.indexOf(startDelimiter)
  if (startIdx === -1) return false

  const endIdx = content.indexOf(endDelimiter, startIdx + startDelimiter.length)
  return endIdx !== -1
}

export const hasUserNoteDelimiters = (content: string): boolean => {
  return hasDelimitedSection(content, USER_NOTE_START_DELIMITER, USER_NOTE_END_DELIMITER)
}

export const hasGeneratedNoteDelimiters = (content: string): boolean => {
  return hasDelimitedSection(content, GENERATED_NOTE_START_DELIMITER, GENERATED_NOTE_END_DELIMITER)
}

export const getUserNoteBetweenDelimiters = (content: string): string => {
  const startIdx = content.indexOf(USER_NOTE_START_DELIMITER)
  if (startIdx === -1) return ''
  const endIdx = content.indexOf(USER_NOTE_END_DELIMITER, startIdx + USER_NOTE_START_DELIMITER.length)
  if (endIdx === -1) return ''
  return content.slice(startIdx + USER_NOTE_START_DELIMITER.length, endIdx).trim()
}

export const regenerateGeneratedNoteSection = (content: string, newGeneratedNote: string): string => {
  const startIdx = content.indexOf(GENERATED_NOTE_START_DELIMITER)
  if (startIdx === -1) return content
  const endIdx = content.indexOf(GENERATED_NOTE_END_DELIMITER, startIdx + GENERATED_NOTE_START_DELIMITER.length)
  if (endIdx === -1) return content
  const before = content.slice(0, startIdx + GENERATED_NOTE_START_DELIMITER.length)
  const after = content.slice(endIdx)
  return `${before}\n${newGeneratedNote.trim()}\n${after}`
}


export const parseAnkiTargetDeck = (content: string): string | undefined => {
  const match = content.match(/^Anki Target Deck:\s*(.+)$/m)
  return match?.[1]?.trim?.()
}

export const parseAnkiCardType = (content: string): string | undefined => {
  const match = content.match(/^Anki Card Type:\s*(.+)$/m)
  return match?.[1]?.trim?.()
}

export const parseAnkiNoteId = (content: string): string | undefined => {
  const match = content.match(/<!-- Anki Note Id:\s*(.+?)\s*-->/)
  return match?.[1]?.trim?.()
}

export const generateAnkiNoteIdMarker = (noteId: string): string => {
  return `<!-- Anki Note Id: ${noteId} -->`
}

export const hasGeneratedCloze = (content: string): boolean => {
  return /\{\{c\d+::/.test(content)
}
