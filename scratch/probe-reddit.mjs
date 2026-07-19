const UA = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/json',
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

const share = 'https://www.reddit.com/r/ObsidianMD/s/d5ay16alEV'

// 1) resolve share
const r1 = await fetch(share, { redirect: 'manual', headers: UA })
console.log('share status', r1.status, 'loc', r1.headers.get('location'))

const resolved =
  r1.headers.get('location') ||
  (await fetch(share, { redirect: 'follow', headers: UA }).then((r) => r.url))

console.log('resolved', resolved)
const clean = resolved.split('?')[0]

// 2) HTML page
const r2 = await fetch(clean, { headers: UA, redirect: 'follow' })
const html = await r2.text()
console.log('html status', r2.status, 'len', html.length)
console.log('og:title', meta(html, 'og:title'))
console.log('og:description', (meta(html, 'og:description') || '').slice(0, 200))
console.log('og:image', meta(html, 'og:image'))

// 3) JSON variants
for (const jsonUrl of [
  clean.replace(/\/$/, '') + '.json',
  'https://old.reddit.com' + new URL(clean).pathname.replace(/\/$/, '') + '.json',
]) {
  const r = await fetch(jsonUrl, {
    headers: { ...UA, Accept: 'application/json' },
  })
  const t = await r.text()
  console.log('json', r.status, jsonUrl.slice(0, 80), t.slice(0, 60).replace(/\n/g, ' '))
}
