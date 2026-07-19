import { fetchTranscript } from 'youtube-transcript'
import { logger } from '../../logger'
import type { ExtractedPage } from './content-extract'

const CAP_CHARS = 60_000 // applies to all YouTube transcript fetches (auto-injection and read_url tool)

export interface TranscriptOptions {
  /** Start time in seconds (e.g. 300 for 5:00) */
  startTime?: number
  /** End time in seconds (e.g. 600 for 10:00) */
  endTime?: number
  /** Language code (e.g. 'en', 'de') */
  lang?: string
}

export type YoutubeExtractResult =
  | { ok: true; page: ExtractedPage }
  | { ok: false; error: string; kind: 'network' | 'no_captions' | 'unavailable' | 'other' }

/** Normalize youtu.be / watch URLs and strip tracking params that confuse extractors. */
export function normalizeYoutubeUrl(url: string): string {
  try {
    const u = new URL(url)
    // youtu.be/VIDEO_ID
    if (/youtu\.be$/i.test(u.hostname.replace(/^www\./, ''))) {
      const id = u.pathname.replace(/^\//, '').slice(0, 11)
      if (id.length === 11) return `https://www.youtube.com/watch?v=${id}`
    }
    const v = u.searchParams.get('v')
    if (v && v.length === 11) return `https://www.youtube.com/watch?v=${v}`
    // /shorts/ID or /embed/ID
    const m = u.pathname.match(/\/(?:shorts|embed|live)\/([a-zA-Z0-9_-]{11})/)
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`
    return url
  } catch {
    return url
  }
}

function classifyYoutubeError(error: any): {
  kind: 'network' | 'no_captions' | 'unavailable' | 'other'
  message: string
} {
  const msg = String(error?.message || error || 'unknown error')
  const causeCode = String(error?.cause?.code || '')
  const causeHost = String(error?.cause?.hostname || '')
  const lower = msg.toLowerCase()

  // Node undici: TypeError: fetch failed + cause ENOTFOUND / ECONNREFUSED / etc.
  if (
    lower.includes('fetch failed') ||
    causeCode === 'ENOTFOUND' ||
    causeCode === 'ECONNREFUSED' ||
    causeCode === 'ETIMEDOUT' ||
    causeCode === 'ECONNRESET' ||
    causeCode === 'CERT_HAS_EXPIRED' ||
    lower.includes('network') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused')
  ) {
    const detail = causeCode
      ? ` (${causeCode}${causeHost ? ` ${causeHost}` : ''})`
      : msg.includes('fetch failed')
        ? ' (fetch failed — server cannot reach youtube.com)'
        : ` (${msg})`
    return {
      kind: 'network',
      message:
        `Cannot reach YouTube from the Flowr server${detail}. ` +
        `This is a network/DNS issue on the machine running Flowr, not missing captions. ` +
        `The video may still show captions in your browser (browser DNS/VPN can differ from Node). ` +
        `Fix: ensure the server can resolve and reach www.youtube.com (DNS, VPN, firewall).`,
    }
  }

  if (
    lower.includes('transcript is disabled') ||
    lower.includes('no transcripts are available') ||
    lower.includes('not available')
  ) {
    return {
      kind: 'no_captions',
      message: 'This video has no usable captions/transcript available via YouTube’s API.',
    }
  }

  if (lower.includes('no longer available') || lower.includes('unavailable')) {
    return {
      kind: 'unavailable',
      message: 'This YouTube video is unavailable (private, deleted, or region-blocked).',
    }
  }

  if (lower.includes('too many requests') || lower.includes('captcha')) {
    return {
      kind: 'network',
      message: 'YouTube rate-limited this IP (captcha). Try again later or from a different network.',
    }
  }

  return { kind: 'other', message: `YouTube transcript failed: ${msg}` }
}

/**
 * Fetch a YouTube video transcript with optional time-range filtering.
 * Prefer `extractYoutubeTranscriptDetailed` when you need the real failure reason.
 */
export async function extractYoutubeTranscript(
  url: string,
  options?: TranscriptOptions
): Promise<ExtractedPage | null> {
  const result = await extractYoutubeTranscriptDetailed(url, options)
  return result.ok ? result.page : null
}

/**
 * Same as extractYoutubeTranscript but returns structured errors so callers
 * don't claim "no captions" when the real issue is DNS/network.
 */
export async function extractYoutubeTranscriptDetailed(
  url: string,
  options?: TranscriptOptions
): Promise<YoutubeExtractResult> {
  try {
    if (!isYouTubeUrl(url)) {
      logger.warn(`Skipping non-YouTube URL in extractYoutubeTranscript`)
      return { ok: false, kind: 'other', error: 'Not a YouTube URL' }
    }

    const cleanUrl = normalizeYoutubeUrl(url)
    logger.info(`Extracting YouTube transcript`)
    const allSegments = await fetchTranscript(cleanUrl, {
      lang: options?.lang,
    })

    if (!allSegments || allSegments.length === 0) {
      return {
        ok: false,
        kind: 'no_captions',
        error: 'YouTube returned an empty transcript (captions may be disabled for this video).',
      }
    }

    const filtered = allSegments.filter(s => {
      if (options?.startTime !== undefined && s.offset < options.startTime) return false
      if (options?.endTime !== undefined && s.offset >= options.endTime) return false
      return true
    })

    if (filtered.length === 0) {
      return {
        ok: false,
        kind: 'no_captions',
        error: 'No transcript segments in the requested time range.',
      }
    }

    const fullText = filtered.map(s => s.text).join(' ')
    const content = fullText.slice(0, CAP_CHARS).trim()
    if (!content) {
      return {
        ok: false,
        kind: 'no_captions',
        error: 'Transcript was empty after processing.',
      }
    }

    return {
      ok: true,
      page: { url: cleanUrl, title: 'YouTube Video Transcript', content },
    }
  } catch (error: any) {
    const classified = classifyYoutubeError(error)
    logger.warn(`Failed to extract YouTube transcript: ${classified.message}`)
    return { ok: false, kind: classified.kind, error: classified.message }
  }
}

/** Check if a URL points to YouTube */
export function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url)
}

/**
 * Parse a human timestamp like "5:30" or "1:02:15" into total seconds.
 * Returns null for invalid input.
 */
export function parseTimestamp(str: string): number | null {
  if (!str) return null
  const parts = str.trim().split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0]
  return null
}
