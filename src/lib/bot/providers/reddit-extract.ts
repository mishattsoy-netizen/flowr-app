import { logger } from '../../logger'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const MAX_IMAGES = 4
const BODY_CAP = 20_000

export interface RedditPost {
  url: string
  title: string
  author: string
  subreddit: string
  body: string
  imageUrls: string[]
  isVideo: boolean
}

export function isRedditUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    return host === 'reddit.com' || host === 'old.reddit.com' || host === 'np.reddit.com' || host === 'redd.it'
  } catch {
    return false
  }
}

/** True for share short-links like /r/sub/s/abc123 */
export function isRedditShareUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return /\/r\/[^/]+\/s\/[^/]+/i.test(u.pathname)
  } catch {
    return false
  }
}

/** Normalize a canonical post URL to the Reddit JSON endpoint. */
export function toRedditJsonUrl(url: string): string {
  const u = new URL(url)
  const host = u.hostname.replace(/^www\./, '').toLowerCase()

  if (host === 'redd.it') {
    const id = u.pathname.replace(/\//g, '')
    return `https://www.reddit.com/comments/${id}.json`
  }

  let path = u.pathname.replace(/\/$/, '')
  if (path.endsWith('.json')) {
    return `https://www.reddit.com${path}`
  }
  return `https://www.reddit.com${path}.json`
}

/**
 * Follow 301/302 for share links (/r/x/s/code) and redd.it short links
 * so we land on /r/sub/comments/id/title/.
 */
export async function resolveRedditUrl(url: string): Promise<string> {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    const needsResolve = host === 'redd.it' || isRedditShareUrl(url)
    if (!needsResolve) {
      // Still strip tracking query for consistency
      const u = new URL(url)
      return `https://www.reddit.com${u.pathname.replace(/\/$/, '') || '/'}`
    }

    const res = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10_000),
    })
    const loc = res.headers.get('location')
    if (loc) {
      const absolute = new URL(loc, url)
      return `https://www.reddit.com${absolute.pathname.replace(/\/$/, '') || '/'}`
    }

    // Fallback: allow automatic redirect follow
    const followed = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    })
    const finalPath = new URL(followed.url).pathname.replace(/\/$/, '')
    return `https://www.reddit.com${finalPath || '/'}`
  } catch (e: any) {
    logger.warn(`Reddit URL resolve failed: ${e.message}`)
    return url
  }
}

function unescapeUrl(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
}

function looksLikeImageUrl(url: string): boolean {
  if (/snoovatar|avatar|styles\/profileIcon|\/cms\//i.test(url)) return false
  return (
    /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) ||
    /i\.redd\.it|preview\.redd\.it|i\.imgur\.com/i.test(url)
  )
}

function collectImageUrls(data: any): string[] {
  const out: string[] = []
  const push = (raw?: string) => {
    if (!raw || typeof raw !== 'string') return
    const cleaned = unescapeUrl(raw)
    if (!looksLikeImageUrl(cleaned)) return
    if (!out.includes(cleaned)) out.push(cleaned)
  }

  if (data.is_gallery && data.gallery_data?.items && data.media_metadata) {
    for (const item of data.gallery_data.items) {
      const meta = data.media_metadata[item.media_id]
      if (!meta || meta.status === 'failed') continue
      push(meta?.s?.u || meta?.s?.gif)
      if (out.length >= MAX_IMAGES) break
    }
    return out.slice(0, MAX_IMAGES)
  }

  if (typeof data.url === 'string' && looksLikeImageUrl(data.url) && !data.is_video) {
    push(data.url)
  }

  const previewSrc = data.preview?.images?.[0]?.source?.url
  push(previewSrc)

  if (typeof data.url_overridden_by_dest === 'string') {
    push(data.url_overridden_by_dest)
  }

  return out.slice(0, MAX_IMAGES)
}

/**
 * Pure parser — exported for unit tests without network.
 * `listing` is the JSON array Reddit returns for a comments URL.
 */
export function parseRedditListing(listing: any, originalUrl: string): RedditPost | null {
  try {
    if (!Array.isArray(listing) || listing.length === 0) return null
    const child = listing[0]?.data?.children?.[0]
    if (!child || child.kind !== 't3' || !child.data) return null
    const d = child.data

    const title = (d.title || '').trim()
    const body = String(d.selftext || '').trim().slice(0, BODY_CAP)
    const author = String(d.author || '').trim()
    const subreddit = String(d.subreddit || '').trim()
    const permalink = d.permalink
      ? `https://www.reddit.com${d.permalink}`.replace(/\/$/, '')
      : originalUrl
    const isVideo = !!d.is_video || d.post_hint === 'hosted:video' || d.post_hint === 'rich:video'
    const imageUrls = isVideo ? [] : collectImageUrls(d)

    if (isVideo) {
      const preview = d.preview?.images?.[0]?.source?.url
      if (preview) {
        const cleaned = unescapeUrl(preview)
        if (looksLikeImageUrl(cleaned)) imageUrls.push(cleaned)
      }
    }

    if (!title && !body && imageUrls.length === 0) return null

    return {
      url: permalink,
      title: title || '(no title)',
      author,
      subreddit,
      body,
      imageUrls: imageUrls.slice(0, MAX_IMAGES),
      isVideo,
    }
  } catch {
    return null
  }
}

/**
 * Collect media image URLs from a shreddit-post HTML fragment only.
 * Prefer gallery-carousel / post-media regions so page chrome (avatars,
 * sidebar ads, comment embeds) never leak into vision.
 */
export function collectImagesFromPostHtml(postHtml: string): string[] {
  const imageUrls: string[] = []
  const pushImg = (raw: string) => {
    const cleaned = unescapeUrl(raw).replace(/&amp;/g, '&')
    if (!looksLikeImageUrl(cleaned)) return
    // Skip decorative/background layers that are low-opacity duplicates
    const base = cleaned.split('?')[0]
    if (imageUrls.some(u => u.split('?')[0] === base)) return
    imageUrls.push(cleaned)
  }

  // Prefer the media slot / gallery carousel when present
  const mediaChunks: string[] = []
  const mediaContainer = postHtml.match(
    /slot="post-media-container"[\s\S]*?(?=<div slot="|<\/shreddit-post>|$)/i
  )
  if (mediaContainer) mediaChunks.push(mediaContainer[0])
  const carousel = postHtml.match(/<gallery-carousel\b[\s\S]*?<\/gallery-carousel>/i)
  if (carousel) mediaChunks.push(carousel[0])
  const scope = mediaChunks.length > 0 ? mediaChunks.join('\n') : postHtml

  // i.redd.it direct hosts
  for (const m of scope.matchAll(/https:\/\/i\.redd\.it\/[a-z0-9]+\.(?:jpe?g|png|webp|gif)/gi)) {
    pushImg(m[0])
    if (imageUrls.length >= MAX_IMAGES) return imageUrls
  }

  // preview.redd.it — unique stems, prefer largest width
  const previews = [...scope.matchAll(/https:\/\/preview\.redd\.it\/[^"'\s<>]+/gi)].map(m =>
    unescapeUrl(m[0])
  )
  const bestByStem = new Map<string, { url: string; width: number }>()
  for (const p of previews) {
    if (!looksLikeImageUrl(p)) continue
    // Skip opacity-background duplicates by preferring width>=640 when available
    const stem = p.split('?')[0].split('/').pop() || p
    const width = Number((p.match(/[?&]width=(\d+)/i) || [])[1] || 0)
    const prev = bestByStem.get(stem)
    if (!prev || width > prev.width) bestByStem.set(stem, { url: p, width })
  }
  for (const { url } of bestByStem.values()) {
    pushImg(url)
    if (imageUrls.length >= MAX_IMAGES) break
  }

  // external-preview / i.imgur.com sometimes used for image posts
  if (imageUrls.length < MAX_IMAGES) {
    for (const m of scope.matchAll(
      /https:\/\/(?:external-preview\.redd\.it|i\.imgur\.com)\/[^"'\s<>]+/gi
    )) {
      pushImg(m[0])
      if (imageUrls.length >= MAX_IMAGES) break
    }
  }

  return imageUrls.slice(0, MAX_IMAGES)
}

/** Parse SSR HTML from shreddit (after optional JS challenge). */
export function parseRedditHtml(html: string, pageUrl: string): RedditPost | null {
  try {
    if (!html || /Please wait for verification/i.test(html)) return null

    // Restrict all parsing to the post element when present — the rest of the
    // page includes sidebars, ads, and comment media that must not enter vision.
    const postBlock =
      html.match(/<shreddit-post\b[\s\S]*?<\/shreddit-post>/i)?.[0] || html

    const attr = (name: string): string => {
      const re = new RegExp(`${name}="([^"]*)"`, 'i')
      const tag = postBlock.match(/<shreddit-post\b[^>]*>/i)?.[0] || postBlock
      const m = tag.match(re)
      return m ? unescapeUrl(m[1]) : ''
    }

    const title =
      attr('post-title') ||
      (html.match(/property="og:title"\s+content="([^"]+)"/i) || [])[1] ||
      ''
    const author = attr('author')
    const subPrefixed = attr('subreddit-prefixed-name') // r/Name
    const subreddit =
      attr('subreddit-name') ||
      (subPrefixed.startsWith('r/') ? subPrefixed.slice(2) : subPrefixed)
    const permalink = attr('permalink')
    const postType = (attr('post-type') || '').toLowerCase()
    const isVideo = postType === 'video' || postType === 'gif'

    // Body: schema:articleBody inside the post
    let body = ''
    const articleBody = postBlock.match(
      /property="schema:articleBody"[^>]*>([\s\S]*?)<\/div>/i
    )
    if (articleBody) {
      body = articleBody[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }

    const imageUrls = isVideo ? [] : collectImagesFromPostHtml(postBlock)
    // Video: keep a single static preview from media if present
    if (isVideo) {
      const previews = collectImagesFromPostHtml(postBlock)
      if (previews[0]) imageUrls.push(previews[0])
    }

    const decodedTitle = unescapeUrl(title).trim()
    if (!decodedTitle && !body && imageUrls.length === 0) return null

    const finalUrl = permalink
      ? `https://www.reddit.com${permalink}`.replace(/\/$/, '')
      : pageUrl.replace(/\/$/, '')

    return {
      url: finalUrl,
      title: decodedTitle || '(no title)',
      author: author.trim(),
      subreddit: subreddit.trim(),
      body: body.slice(0, BODY_CAP),
      imageUrls: imageUrls.slice(0, MAX_IMAGES),
      isVideo,
    }
  } catch {
    return null
  }
}

/**
 * Reddit sometimes serves a JS "Please wait for verification" interstitial.
 * The page auto-submits solution = seed + seed with a token — reproduce that.
 */
export async function fetchRedditHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      logger.warn(`Reddit HTML fetch failed: ${res.status} ${res.statusText}`)
      return null
    }
    let html = await res.text()

    if (/Please wait for verification/i.test(html)) {
      const seed = (html.match(/\(async e=>e\+e\)\("([a-f0-9]+)"\)/i) || [])[1]
      const token = (html.match(/name="token"\s+value="([^"]+)"/i) || [])[1]
      const action = (html.match(/<form[^>]+action="([^"]+)"/i) || [])[1]
      if (!seed || !token || !action) {
        logger.warn('Reddit JS challenge present but could not parse form')
        return null
      }
      const next = new URL(action, new URL(res.url).origin)
      next.searchParams.set('solution', seed + seed)
      next.searchParams.set('js_challenge', '1')
      next.searchParams.set('token', token)

      const res2 = await fetch(next.href, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Referer: res.url,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
      })
      if (!res2.ok) {
        logger.warn(`Reddit challenge response failed: ${res2.status}`)
        return null
      }
      html = await res2.text()
      if (/Please wait for verification/i.test(html)) {
        logger.warn('Reddit JS challenge did not clear')
        return null
      }
    }

    return html
  } catch (e: any) {
    logger.warn(`Reddit HTML fetch error: ${e.message}`)
    return null
  }
}

export function formatRedditPost(post: RedditPost): string {
  const mediaNote = post.isVideo
    ? post.imageUrls.length > 0
      ? `Media: video post (static preview attached for vision)`
      : `Media: video post (no playable video; text only)`
    : post.imageUrls.length > 0
      ? `Media: ${post.imageUrls.length} image(s) attached for vision`
      : `Media: none`

  const lines = [
    '[REDDIT POST]',
    `Title: ${post.title}`,
    post.author ? `Author: u/${post.author}` : null,
    post.subreddit ? `Subreddit: r/${post.subreddit}` : null,
    `URL: ${post.url}`,
    mediaNote,
    'Body:',
    post.body || '(no text body)',
  ].filter(Boolean)

  return lines.join('\n')
}

async function extractViaJson(canonicalUrl: string): Promise<RedditPost | null> {
  try {
    const jsonUrl = toRedditJsonUrl(canonicalUrl)
    const res = await fetch(jsonUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    const text = await res.text()
    if (!ct.includes('json') && !text.trimStart().startsWith('[') && !text.trimStart().startsWith('{')) {
      return null
    }
    const listing = JSON.parse(text)
    return parseRedditListing(listing, canonicalUrl)
  } catch {
    return null
  }
}

/**
 * Fetch + parse a Reddit post. Returns null if URL is not Reddit or all strategies fail.
 *
 * Strategy:
 * 1. Resolve share/short links to /comments/... URL
 * 2. Try .json API
 * 3. Fall back to HTML + JS-challenge solve + shreddit-post parse
 */
export async function extractRedditPost(url: string): Promise<RedditPost | null> {
  if (!isRedditUrl(url)) return null

  try {
    logger.info(`Extracting Reddit post`)
    const canonical = await resolveRedditUrl(url)

    const fromJson = await extractViaJson(canonical)
    if (fromJson) {
      logger.info(`Reddit post extracted via JSON`)
      return fromJson
    }

    logger.info(`Reddit JSON unavailable; trying HTML`)
    const html = await fetchRedditHtml(canonical)
    if (!html) return null
    const fromHtml = parseRedditHtml(html, canonical)
    if (fromHtml) {
      logger.info(`Reddit post extracted via HTML (${fromHtml.imageUrls.length} image URL(s))`)
      return fromHtml
    }

    logger.warn(`Reddit extract failed for both JSON and HTML`)
    return null
  } catch (e: any) {
    logger.warn(`Failed to extract Reddit post: ${e.message}`)
    return null
  }
}

function isImageBuffer(buf: Buffer): boolean {
  if (buf.length < 24) return false
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true
  // WEBP (RIFF....WEBP)
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return true
  return false
}

/** Download post images for vision. Skips failures; max MAX_IMAGES. */
export async function fetchRedditImageBuffers(imageUrls: string[]): Promise<Buffer[]> {
  const buffers: Buffer[] = []
  for (const imageUrl of imageUrls.slice(0, MAX_IMAGES)) {
    try {
      const res = await fetch(imageUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: 'https://www.reddit.com/',
        },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 0 && buf.length <= 5 * 1024 * 1024 && isImageBuffer(buf)) {
        buffers.push(buf)
      }
    } catch (e: any) {
      logger.warn(`Reddit image fetch failed: ${e.message}`)
    }
  }
  return buffers
}
