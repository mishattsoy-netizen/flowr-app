/**
 * Given the full accumulated streaming text, returns the text truncated
 * right before any currently-open, not-yet-closed structural block (a GFM
 * table, a fenced code block, or an [m]...[/m] mono-pill), so an incomplete
 * block never renders as raw/broken markdown mid-stream. Once isDone is
 * true, the full original text is always returned regardless of detected
 * open blocks — a safety net so a genuinely malformed/never-closed block
 * doesn't permanently hide content once streaming has stopped.
 */
export function deferIncompleteBlock(text: string, isDone: boolean): string {
  if (isDone || !text) return text

  const openFenceIndex = findOpenCodeFenceStart(text)
  if (openFenceIndex !== -1) {
    return text.slice(0, openFenceIndex).replace(/\s+$/, '')
  }

  const openPillIndex = findOpenPillStart(text)
  if (openPillIndex !== -1) {
    return text.slice(0, openPillIndex).replace(/\s+$/, '')
  }

  const openTableIndex = findOpenTableStart(text)
  if (openTableIndex !== -1) {
    return text.slice(0, openTableIndex).replace(/\s+$/, '')
  }

  return text
}

function findOpenCodeFenceStart(text: string): number {
  const fenceMatches = [...text.matchAll(/```/g)]
  if (fenceMatches.length % 2 === 0) return -1
  // Odd count: the last fence opens a block that never closed.
  return fenceMatches[fenceMatches.length - 1].index ?? -1
}

function findOpenPillStart(text: string): number {
  const lastClose = text.lastIndexOf('[/m]')
  const searchFrom = lastClose === -1 ? 0 : lastClose + 4
  const openIndex = text.indexOf('[m]', searchFrom)
  return openIndex
}

function findOpenTableStart(text: string): number {
  const lines = text.split('\n')
  let openTableStartLine = -1
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // A table row starts with a pipe. While streaming, the very last line
    // may not yet have its trailing pipe — it's still part of the table.
    const looksLikeTableRow = /^\s*\|/.test(line)

    if (looksLikeTableRow) {
      if (!inTable) {
        inTable = true
        openTableStartLine = i
      }
      // else: still inside the table block.
    } else if (inTable) {
      // A blank or non-table line closes the table.
      inTable = false
      openTableStartLine = -1
    }
  }

  if (!inTable || openTableStartLine === -1) return -1

  // Compute the character offset of the start of openTableStartLine.
  let offset = 0
  for (let i = 0; i < openTableStartLine; i++) {
    offset += lines[i].length + 1 // +1 for the '\n' that split() consumed
  }
  return offset
}
