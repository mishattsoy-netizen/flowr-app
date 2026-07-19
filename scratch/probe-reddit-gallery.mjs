const UA = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

async function resolveShare(url) {
  const r = await fetch(url, { redirect: 'manual', headers: UA })
  const loc = r.headers.get('location')
  return loc ? new URL(loc, url).href.split('?')[0] : url
}

async function fetchThroughChallenge(url) {
  const r = await fetch(url, { headers: UA, redirect: 'follow' })
  let html = await r.text()
  if (!/Please wait for verification/i.test(html)) return html
  const seed = (html.match(/\(async e=>e\+e\)\("([a-f0-9]+)"\)/i) || [])[1]
  const token = (html.match(/name="token"\s+value="([^"]+)"/i) || [])[1]
  const action = (html.match(/<form[^>]+action="([^"]+)"/i) || [])[1]
  const next = new URL(action, new URL(r.url).origin)
  next.searchParams.set('solution', seed + seed)
  next.searchParams.set('js_challenge', '1')
  next.searchParams.set('token', token)
  const r2 = await fetch(next.href, { headers: { ...UA, Referer: r.url }, redirect: 'follow' })
  return r2.text()
}

const share = 'https://www.reddit.com/r/ObsidianMD/s/d5ay16alEV'
const resolved = await resolveShare(share)
const html = await fetchThroughChallenge(resolved)

const post = html.match(/<shreddit-post\b[\s\S]*?<\/shreddit-post>/i)?.[0] || ''
console.log('post len', post.length)

// gallery carousel markers
for (const key of [
  'gallery-carousel',
  'gallery-item',
  'lightbox',
  'media-lightbox',
  'slot="post-media',
  'slot="media',
  'faceplate-img',
  'figure',
  'srcset',
  'i.redd.it',
  'preview.redd.it',
  'external-preview',
]) {
  console.log(key, (post.match(new RegExp(key, 'gi')) || []).length)
}

// all preview URLs inside post only
const previews = [...post.matchAll(/https:\/\/preview\.redd\.it\/[^"'\s<>]+/gi)].map(m =>
  m[0].replace(/&amp;/g, '&')
)
const unique = [...new Set(previews.map(p => p.split('?')[0]))]
console.log('unique preview bases in post', unique.length)
for (const u of unique) console.log(' ', u)

const ired = [...post.matchAll(/https:\/\/i\.redd\.it\/[^"'\s<>]+/gi)].map(m => m[0])
console.log('i.redd.it in post', [...new Set(ired)])

// post-media slot chunk
const mediaSlot = post.match(/slot="[^"]*media[^"]*"[\s\S]{0,5000}/i)
console.log('media slot sample', mediaSlot?.[0]?.slice(0, 800))

// gallery carousel
const carousel = post.match(/gallery-carousel[\s\S]{0,3000}/i)
console.log('carousel sample', carousel?.[0]?.slice(0, 1000))
