import { fetchTranscript } from 'youtube-transcript';
import { logger } from '../../logger';
import type { ExtractedPage } from './content-extract';

const AUTO_CAP_CHARS = 10_000;   // auto-injection (WEB_SEARCH)
const TOOL_CAP_CHARS = 60_000;   // explicit read_url tool call

export interface TranscriptOptions {
  /** Start time in seconds (e.g. 300 for 5:00) */
  startTime?: number;
  /** End time in seconds (e.g. 600 for 10:00) */
  endTime?: number;
  /** Language code (e.g. 'en', 'de') */
  lang?: string;
}

/**
 * Fetch a YouTube video transcript with optional time-range filtering.
 * Returns null if the video has no captions or the fetch fails.
 */
export async function extractYoutubeTranscript(
  url: string,
  options?: TranscriptOptions
): Promise<ExtractedPage | null> {
  try {
    // Defensive: only process YouTube URLs (belt-and-suspenders beyond call-site guards)
    if (!isYouTubeUrl(url)) {
      logger.warn(`Skipping non-YouTube URL in extractYoutubeTranscript`);
      return null;
    }

    logger.info(`Extracting YouTube transcript`);
    const allSegments = await fetchTranscript(url, { lang: options?.lang });

    if (!allSegments || allSegments.length === 0) return null;

    // Filter by time range when provided
    const filtered = allSegments.filter(s => {
      if (options?.startTime !== undefined && s.offset < options.startTime) return false;
      if (options?.endTime !== undefined && s.offset >= options.endTime) return false;
      return true;
    });

    if (filtered.length === 0) return null;

    const fullText = filtered.map(s => s.text).join(' ');

    // When a specific time range was requested, use the larger cap
    // (the user intentionally chose that window — don't truncate it)
    const cap = (options?.startTime !== undefined || options?.endTime !== undefined)
      ? TOOL_CAP_CHARS
      : AUTO_CAP_CHARS;

    const content = fullText.slice(0, cap).trim();
    if (!content) return null;

    return { url, title: 'YouTube Video Transcript', content };
  } catch (error: any) {
    logger.warn(`Failed to extract YouTube transcript: ${error.message}`);
    return null;
  }
}

/** Check if a URL points to YouTube */
export function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

/**
 * Parse a human timestamp like "5:30" or "1:02:15" into total seconds.
 * Returns null for invalid input.
 */
export function parseTimestamp(str: string): number | null {
  if (!str) return null;
  const parts = str.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}
