const UA = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

function meta(html, prop) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    'i'
  )
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    'i'
  )
  return (html.match(re) || html.match(re2) || [])[1]
}

async function resolveShare(url) {
  const r = await fetch(url, { redirect: 'manual', headers: UA })
  const loc = r.headers.get('location')
  if (loc) return new URL(loc, url).href
  return url
}

async function fetchWithChallenge(url) {
  const jar = new Map() // simple cookie jar if needed
  const r = await fetch(url, { headers: UA, redirect: 'follow' })
  const setCookie = r.headers.getSetCookie?.() || []
  for (const c of setCookie) {
    const [pair] = c.split(';')
    const [k, v] = pair.split('=')
    jar.set(k, v)
  }
  let html = await r.text()
  console.log('first status', r.status, 'title', (html.match(/<title>[^<]+<\/title>/i) || [])[0], 'final', r.url)

  if (/Please wait for verification/i.test(html)) {
    const seed = (html.match(/\(async e=>e\+e\)\("([a-f0-9]+)"\)/i) || [])[1]
    const token = (html.match(/name="token"\s+value="([^"]+)"/i) || [])[1]
    const action = (html.match(/<form[^>]+action="([^"]+)"/i) || [])[1]
    if (!seed || !token || !action) {
      console.log('challenge parse failed', { seed, token, action })
      return html
    }
    const solution = seed + seed
    const base = new URL(r.url)
    const next = new URL(action, base.origin)
    next.searchParams.set('solution', solution)
    next.searchParams.set('js_challenge', '1')
    next.searchParams.set('token', token)
    // carry original query if any
    for (const [k, v] of new URL(url).searchParams) {
      if (!next.searchParams.has(k)) next.searchParams.set(k, v)
    }
    console.log('challenge GET', next.href)
    const cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    const r2 = await fetch(next.href, {
      headers: { ...UA, Cookie: cookieHeader, Referer: r.url },
      redirect: 'follow',
    })
    html = await r2.text()
    console.log('after challenge', r2.status, 'title', (html.match(/<title>[^<]+<\/title>/i) || [])[0], 'len', html.length, 'final', r2.url)
    // try set-cookie from second response for later json
    return { html, url: r2.url, cookies: cookieHeader }
  }
  return { html, url: r.url, cookies: '' }
}

const share = 'https://www.reddit.com/r/ObsidianMD/s/d5ay16alEV'
const resolved = await resolveShare(share)
console.log('resolved', resolved)
const clean = resolved.split('?')[0]
const { html, url, cookies } = await fetchWithChallenge(clean)
console.log('og:title', meta(html, 'og:title'))
console.log('og:description', (meta(html, 'og:description') || '').slice(0, 250))
console.log('og:image', meta(html, 'og:image'))

// try JSON after challenge cookies
const jsonUrl = clean.replace(/\/$/, '') + '.json'
const jr = await fetch(jsonUrl, {
  headers: {
    ...UA,
    Accept: 'application/json',
    Cookie: cookies,
    Referer: clean,
  },
})
const jt = await jr.text()
console.log('json after challenge', jr.status, jt.slice(0, 120).replace(/\n/g, ' '))
if (jr.ok && jt.startsWith('[') || jt.startsWith('{')) {
  const data = JSON.parse(jt)
  const d = data[0]?.data?.children?.[0]?.data
  console.log('post title', d?.title)
  console.log('selftext', (d?.selftext || '').slice(0, 200))
}
