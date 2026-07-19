import {
  extractRedditPost,
  formatRedditPost,
  fetchRedditImageBuffers,
} from '../src/lib/bot/providers/reddit-extract.ts'

const url = process.argv[2] || 'https://www.reddit.com/r/ObsidianMD/s/d5ay16alEV'
const post = await extractRedditPost(url)
if (!post) {
  console.error('FAILED: null post')
  process.exit(1)
}
console.log(formatRedditPost(post))
console.log('images:', post.imageUrls)
const bufs = await fetchRedditImageBuffers(post.imageUrls)
console.log('downloaded buffers:', bufs.map(b => b.length))
