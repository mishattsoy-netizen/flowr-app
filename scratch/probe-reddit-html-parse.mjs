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
  if (!/Please wait for verification/i.test(html)) return { html, url: r.url }

  const seed = (html.match(/\(async e=>e\+e\)\("([a-f0-9]+)"\)/i) || [])[1]
  const token = (html.match(/name="token"\s+value="([^"]+)"/i) || [])[1]
  const action = (html.match(/<form[^>]+action="([^"]+)"/i) || [])[1]
  const solution = seed + seed
  const next = new URL(action, new URL(r.url).origin)
  next.searchParams.set('solution', solution)
  next.searchParams.set('js_challenge', '1')
  next.searchParams.set('token', token)
  const r2 = await fetch(next.href, {
    headers: { ...UA, Referer: r.url },
    redirect: 'follow',
  })
  return { html: await r2.text(), url: r2.url }
}

const share = 'https://www.reddit.com/r/ObsidianMD/s/d5ay16alEV'
const resolved = (await resolveShare(share)).split('?')[0]
const { html, url } = await fetchThroughChallenge(resolved)
console.log('final', url, 'len', html.length)

// search markers
for (const key of [
  'og:title',
  'og:description',
  'og:image',
  'post-title',
  'faceplate-tracker',
  'shreddit-post',
  'selftext',
  'after_one_year',
  '"title":',
  'application/ld+json',
]) {
  console.log(key, html.includes(key))
}

// shreddit-post attributes
const shreddit = html.match(/<shreddit-post[\s\S]{0,3000}?>/i)
console.log('shreddit-post tag sample', shreddit?.[0]?.slice(0, 1500))

// ld+json
const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]
console.log('ld+json count', ld.length)
for (const m of ld.slice(0, 3)) {
  try {
    const j = JSON.parse(m[1])
    console.log('ld keys', Object.keys(j), 'name', j.name || j.headline, 'desc', String(j.description || '').slice(0, 120))
  } catch {
    console.log('ld parse fail', m[1].slice(0, 100))
  }
}

// post title attribute
const postTitle = html.match(/post-title="([^"]+)"/i)
console.log('post-title attr', postTitle?.[1])
const author = html.match(/author="([^"]+)"/i)
console.log('author attr', author?.[1])
const contentHref = html.match(/content-href="([^"]+)"/i)
console.log('content-href', contentHref?.[1])

// look for i.redd.it
const images = [...html.matchAll(/https:\/\/i\.redd\.it\/[a-z0-9]+\.(?:jpg|png|webp|gif)/gi)].map(m => m[0])
console.log('i.redd.it', [...new Set(images)].slice(0, 10))

const previews = [...html.matchAll(/https:\/\/preview\.redd\.it\/[^"'\s]+/gi)].map(m => m[0]).slice(0, 5)
console.log('preview samples', previews)
