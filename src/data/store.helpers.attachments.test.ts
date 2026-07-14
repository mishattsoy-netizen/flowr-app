import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveAttachmentsForVision } from './store.helpers'
import type { AIAttachment } from './store.types'

// Regression test for a live bug (2026-07-14): once attachments were uploaded to
// Supabase Storage (spec §5b), they carried an absolute https:// public URL. The
// vision payload builder only converted relative '/...' URLs to base64 and then
// kept only data: URIs — so every attachment was dropped and the model received
// NO image at all, while the chat still displayed the pictures. It replied
// "Note created. Please provide the content you'd like me to add to it."

const STORAGE_URL = 'https://xyz.supabase.co/storage/v1/object/public/user_uploads/u/1.jpg'

function attachment(url: string, type: AIAttachment['type'] = 'image'): AIAttachment {
  return { type, url, name: '1.jpg' }
}

beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: 'https://app.flowr.website' } })
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    blob: async () => new Blob(['bytes'], { type: 'image/jpeg' }),
  })))
  // jsdom-free stand-in for FileReader.readAsDataURL
  class FakeFileReader {
    result: string | null = null
    onloadend: (() => void) | null = null
    onerror: (() => void) | null = null
    readAsDataURL(_blob: Blob) {
      this.result = 'data:image/jpeg;base64,Ynl0ZXM='
      this.onloadend?.()
    }
  }
  vi.stubGlobal('FileReader', FakeFileReader)
})

afterEach(() => vi.unstubAllGlobals())

describe('resolveAttachmentsForVision', () => {
  it('fetches an absolute storage URL back into a data: URI so vision receives the image', async () => {
    const [resolved] = await resolveAttachmentsForVision([attachment(STORAGE_URL)])
    expect(resolved.url.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(fetch).toHaveBeenCalledWith(STORAGE_URL)
  })

  it('resolves every attachment in a multi-image batch, not just the first', async () => {
    const resolved = await resolveAttachmentsForVision([
      attachment(STORAGE_URL), attachment(STORAGE_URL), attachment(STORAGE_URL),
    ])
    expect(resolved.every(a => a.url.startsWith('data:'))).toBe(true)
  })

  it('still resolves relative paths against the app origin', async () => {
    await resolveAttachmentsForVision([attachment('/api/images?file=x.png')])
    expect(fetch).toHaveBeenCalledWith('https://app.flowr.website/api/images?file=x.png')
  })

  it('leaves an existing data: URI untouched (no refetch)', async () => {
    const [resolved] = await resolveAttachmentsForVision([attachment('data:image/png;base64,AAAA')])
    expect(resolved.url).toBe('data:image/png;base64,AAAA')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps the attachment as-is when the fetch fails, instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, statusText: 'Forbidden' })))
    const [resolved] = await resolveAttachmentsForVision([attachment(STORAGE_URL)])
    expect(resolved.url).toBe(STORAGE_URL)
  })
})
