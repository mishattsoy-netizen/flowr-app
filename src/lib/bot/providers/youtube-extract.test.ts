import { describe, it, expect } from 'vitest'
import { isYouTubeUrl, normalizeYoutubeUrl, parseTimestamp } from './youtube-extract'

describe('isYouTubeUrl', () => {
  it('accepts youtube and youtu.be', () => {
    expect(isYouTubeUrl('https://youtu.be/DlXb3zSLdFY?si=abc')).toBe(true)
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=DlXb3zSLdFY')).toBe(true)
    expect(isYouTubeUrl('https://reddit.com/r/x')).toBe(false)
  })
})

describe('normalizeYoutubeUrl', () => {
  it('strips share params from youtu.be', () => {
    expect(normalizeYoutubeUrl('https://youtu.be/DlXb3zSLdFY?si=yGWNoHVwyfrBGUEO')).toBe(
      'https://www.youtube.com/watch?v=DlXb3zSLdFY'
    )
  })
  it('keeps watch?v= form clean', () => {
    expect(
      normalizeYoutubeUrl('https://www.youtube.com/watch?v=DlXb3zSLdFY&list=PLxxx&t=12')
    ).toBe('https://www.youtube.com/watch?v=DlXb3zSLdFY')
  })
})

describe('parseTimestamp', () => {
  it('parses mm:ss and hh:mm:ss', () => {
    expect(parseTimestamp('5:30')).toBe(330)
    expect(parseTimestamp('1:02:15')).toBe(3735)
  })
})
