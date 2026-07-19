import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isRedditUrl,
  isRedditShareUrl,
  toRedditJsonUrl,
  extractRedditPost,
  formatRedditPost,
  parseRedditListing,
  parseRedditHtml,
  resolveRedditUrl,
} from './reddit-extract'

describe('isRedditUrl', () => {
  it('accepts standard post URLs', () => {
    expect(isRedditUrl('https://www.reddit.com/r/pics/comments/abc123/title/')).toBe(true)
    expect(isRedditUrl('https://old.reddit.com/r/pics/comments/abc123/')).toBe(true)
    expect(isRedditUrl('https://redd.it/abc123')).toBe(true)
    expect(isRedditUrl('https://www.reddit.com/comments/abc123/foo')).toBe(true)
    expect(isRedditUrl('https://www.reddit.com/r/ObsidianMD/s/d5ay16alEV')).toBe(true)
  })
  it('rejects non-Reddit URLs', () => {
    expect(isRedditUrl('https://x.com/foo/status/1')).toBe(false)
    expect(isRedditUrl('https://youtube.com/watch?v=x')).toBe(false)
  })
})

describe('isRedditShareUrl', () => {
  it('detects /r/sub/s/code share links', () => {
    expect(isRedditShareUrl('https://www.reddit.com/r/ObsidianMD/s/d5ay16alEV')).toBe(true)
    expect(isRedditShareUrl('https://www.reddit.com/r/pics/comments/abc/title/')).toBe(false)
  })
})

describe('toRedditJsonUrl', () => {
  it('appends .json for standard paths', () => {
    expect(toRedditJsonUrl('https://www.reddit.com/r/pics/comments/abc123/title/')).toBe(
      'https://www.reddit.com/r/pics/comments/abc123/title.json'
    )
  })
  it('expands redd.it short links', () => {
    expect(toRedditJsonUrl('https://redd.it/abc123')).toBe(
      'https://www.reddit.com/comments/abc123.json'
    )
  })
})

describe('parseRedditListing', () => {
  const singleImageListing = [
    {
      data: {
        children: [
          {
            kind: 't3',
            data: {
              title: 'A cool cat',
              selftext: '',
              author: 'alice',
              subreddit: 'pics',
              permalink: '/r/pics/comments/abc123/a_cool_cat/',
              url: 'https://i.redd.it/cat.jpg',
              post_hint: 'image',
              is_video: false,
              is_gallery: false,
              preview: {
                images: [
                  {
                    source: {
                      url: 'https://preview.redd.it/cat.jpg?width=1000&amp;format=pjpg',
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    },
    { data: { children: [] } },
  ]

  it('parses title, author, body, and image urls (unescapes amp)', () => {
    const post = parseRedditListing(
      singleImageListing,
      'https://www.reddit.com/r/pics/comments/abc123/'
    )
    expect(post).not.toBeNull()
    expect(post!.title).toBe('A cool cat')
    expect(post!.author).toBe('alice')
    expect(post!.subreddit).toBe('pics')
    expect(post!.imageUrls.some(u => u.includes('cat.jpg') && !u.includes('&amp;'))).toBe(true)
  })

  it('parses gallery media_metadata', () => {
    const gallery = [
      {
        data: {
          children: [
            {
              kind: 't3',
              data: {
                title: 'Gallery',
                selftext: 'check these',
                author: 'bob',
                subreddit: 'art',
                permalink: '/r/art/comments/g1/gallery/',
                is_gallery: true,
                gallery_data: { items: [{ media_id: 'm1' }, { media_id: 'm2' }] },
                media_metadata: {
                  m1: {
                    status: 'valid',
                    e: 'Image',
                    s: { u: 'https://preview.redd.it/one.jpg?width=1&amp;x=1' },
                  },
                  m2: {
                    status: 'valid',
                    e: 'Image',
                    s: { u: 'https://preview.redd.it/two.jpg' },
                  },
                },
              },
            },
          ],
        },
      },
    ]
    const post = parseRedditListing(gallery, 'https://www.reddit.com/r/art/comments/g1/')
    expect(post!.imageUrls.length).toBe(2)
    expect(post!.body).toContain('check these')
  })

  it('returns null for empty/malformed listing', () => {
    expect(parseRedditListing([], 'https://reddit.com/r/x/comments/y/')).toBeNull()
    expect(parseRedditListing(null as any, 'https://reddit.com/r/x/comments/y/')).toBeNull()
  })
})

describe('parseRedditHtml', () => {
  const sampleHtml = `
    <html><body>
    <!-- page chrome outside the post — must NOT be collected -->
    <img src="https://i.redd.it/qwkcwa2zi3yd1.png" />
    <img src="https://preview.redd.it/reecx2sbdych1.png?width=320" />
    <shreddit-post
      permalink="/r/ObsidianMD/comments/1uvvb33/after_one_year_of_using_obsidian/"
      post-title="After one year of using Obsidian"
      post-type="gallery"
      author="Ok-Cloud-765"
      subreddit-prefixed-name="r/ObsidianMD"
      subreddit-name="ObsidianMD"
    >
      <div property="schema:articleBody" dir="auto">
        <p>I think finally i have the perfect vault for me.</p>
      </div>
      <div slot="post-media-container">
        <gallery-carousel post-id="t3_1uvvb33">
          <ul>
            <li>
              <img src="https://preview.redd.it/after-one-year-v0-aaa.png?width=640&amp;crop=smart" />
            </li>
            <li>
              <img src="https://preview.redd.it/after-one-year-v0-bbb.png?width=1080&amp;crop=smart" />
            </li>
          </ul>
        </gallery-carousel>
      </div>
      <img src="https://preview.redd.it/snoovatar/avatars/headshot.png?width=48" />
    </shreddit-post>
    </body></html>
  `

  it('parses shreddit-post attributes, body, and gallery images only', () => {
    const post = parseRedditHtml(
      sampleHtml,
      'https://www.reddit.com/r/ObsidianMD/comments/1uvvb33/after_one_year_of_using_obsidian'
    )
    expect(post).not.toBeNull()
    expect(post!.title).toBe('After one year of using Obsidian')
    expect(post!.author).toBe('Ok-Cloud-765')
    expect(post!.subreddit).toBe('ObsidianMD')
    expect(post!.body).toContain('perfect vault')
    expect(post!.imageUrls.length).toBe(2)
    expect(post!.imageUrls.every(u => u.includes('after-one-year'))).toBe(true)
    expect(post!.imageUrls.every(u => !u.includes('snoovatar'))).toBe(true)
    expect(post!.imageUrls.every(u => !u.includes('qwkcwa2zi3yd1'))).toBe(true)
    expect(post!.imageUrls.every(u => !u.includes('reecx2sbdych1'))).toBe(true)
    expect(post!.url).toContain('/comments/1uvvb33/')
  })

  it('returns null for verification interstitial', () => {
    expect(
      parseRedditHtml(
        '<title>Reddit - Please wait for verification</title>',
        'https://www.reddit.com/r/x/comments/y/'
      )
    ).toBeNull()
  })
})

describe('formatRedditPost', () => {
  it('includes title body and media note', () => {
    const text = formatRedditPost({
      url: 'https://www.reddit.com/r/pics/comments/abc/',
      title: 'Hello',
      author: 'alice',
      subreddit: 'pics',
      body: 'World',
      imageUrls: ['https://i.redd.it/a.jpg'],
      isVideo: false,
    })
    expect(text).toContain('[REDDIT POST]')
    expect(text).toContain('Hello')
    expect(text).toContain('World')
    expect(text).toMatch(/1 image/i)
  })
})

describe('resolveRedditUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('follows share-link redirects to comments URL', async () => {
    ;(fetch as any).mockResolvedValue({
      headers: {
        get: (k: string) =>
          k.toLowerCase() === 'location'
            ? 'https://www.reddit.com/r/ObsidianMD/comments/1uvvb33/after_one_year_of_using_obsidian/?share_id=x'
            : null,
      },
    })
    const resolved = await resolveRedditUrl(
      'https://www.reddit.com/r/ObsidianMD/s/d5ay16alEV'
    )
    expect(resolved).toBe(
      'https://www.reddit.com/r/ObsidianMD/comments/1uvvb33/after_one_year_of_using_obsidian'
    )
  })
})

describe('extractRedditPost', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null for non-reddit urls without calling fetch', async () => {
    const r = await extractRedditPost('https://example.com')
    expect(r).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('falls back to HTML when JSON returns non-JSON body', async () => {
    const html = `
      <shreddit-post
        permalink="/r/test/comments/abc/hello/"
        post-title="Hello HTML"
        post-type="text"
        author="bob"
        subreddit-name="test"
      >
        <div property="schema:articleBody"><p>Body from HTML</p></div>
      </shreddit-post>
    `
    ;(fetch as any).mockImplementation(async (url: string, init?: any) => {
      // resolveRedditUrl for non-share is sync path without fetch for comments...
      // share not used here — comments URL goes straight to json then html
      if (String(url).endsWith('.json')) {
        return {
          ok: true,
          headers: { get: () => 'text/html' },
          text: async () => '<!DOCTYPE html><html></html>',
        }
      }
      return {
        ok: true,
        url: String(url),
        headers: { get: () => null, getSetCookie: () => [] },
        text: async () => html,
      }
    })

    const r = await extractRedditPost(
      'https://www.reddit.com/r/test/comments/abc/hello/'
    )
    expect(r?.title).toBe('Hello HTML')
    expect(r?.body).toContain('Body from HTML')
  })

  it('returns parsed post on JSON success', async () => {
    const payload = [
      {
        data: {
          children: [
            {
              kind: 't3',
              data: {
                title: 'T',
                selftext: 'Body text',
                author: 'u1',
                subreddit: 'test',
                permalink: '/r/test/comments/abc/',
                url: 'https://www.reddit.com/r/test/comments/abc/',
                is_video: false,
              },
            },
          ],
        },
      },
    ]
    ;(fetch as any).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify(payload),
    })
    const r = await extractRedditPost('https://www.reddit.com/r/test/comments/abc/')
    expect(r?.title).toBe('T')
    expect(r?.body).toBe('Body text')
  })
})
