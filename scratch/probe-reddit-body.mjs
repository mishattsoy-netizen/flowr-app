const UA = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

async function resolveShare(url) {
  const r = await fetch(url, { redirect: 'manual', headers: UA })
  const loc = r.headers.get('location')
  if (loc) return new URL(loc, url).href
  return url
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
const resolved = (await resolveShare(share)).split('?')[0]
const html = await fetchThroughChallenge(resolved)

// shreddit-post full open tag + first chunk of inner
const m = html.match(/<shreddit-post\b[\s\S]*?<\/shreddit-post>/i)
console.log('shreddit-post length', m?.[0]?.length)
console.log(m?.[0]?.slice(0, 3000))
console.log('---tail---')
console.log(m?.[0]?.slice(-1500))

// gallery slot images
const mediaIds = [...html.matchAll(/media-id="([^"]+)"/gi)].map(x => x[1])
console.log('media-ids', [...new Set(mediaIds)].slice(0, 20))

// faceplate-img or img src in post
const imgSrcs = [...html.matchAll(/src="(https:\/\/(?:i|preview)\.redd\.it\/[^"]+)"/gi)].map(x => x[1])
console.log('unique img count', new Set(imgSrcs).size)
console.log([...new Set(imgSrcs)].slice(0, 8).map(u => u.replace(/&amp;/g, '&').slice(0, 100)))

// text content slots
for (const pat of [
  /slot="text-body"[\s\S]{0,2000}/i,
  /data-testid="post-content"[\s\S]{0,2000}/i,
  /class="[^"]*md[^"]*"[\s\S]{0,500}/i,
  /property="schema:articleBody"[\s\S]{0,500}/i,
]) {
  const hit = html.match(pat)
  console.log('pattern', pat, 'hit', !!hit, hit?.[0]?.slice(0, 200)?.replace(/\s+/g, ' '))
}
