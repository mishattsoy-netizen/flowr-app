# Fix Production Performance Gap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the AI performance gap in production by resolving the missing standalone prompts, unexpiring router cache, and 10s function timeout.

**Architecture:** We will copy the prompts folder into the standalone build output in `build.js` and use path resolution fallbacks. We will also add a 5-minute cache revalidation to `router-config.ts` and set a 60s timeout for Vercel in `route.ts`.

**Tech Stack:** Next.js (Standalone output mode), Node.js (fs, path), Vercel

---

### Task 1: Fix Prompts missing in Standalone Build

**Files:**
- Modify: `build.js`
- Modify: `src/lib/bot/prompts/index.ts`
- Modify: `src/lib/bot/classifier.ts`

**Step 1: Update `build.js` to copy prompts**

```javascript
// Add to the postbuild tasks block (line 74ish):
    fs.cpSync('src/lib/bot/prompts', '.next/standalone/src/lib/bot/prompts', { recursive: true, force: true });
```

**Step 2: Update `src/lib/bot/prompts/index.ts` path resolution**

```typescript
// Replace PROMPTS_DIR initialization with:
import { existsSync } from 'fs'

function getPromptsDir(): string {
  const cwdPath = join(process.cwd(), 'src', 'lib', 'bot', 'prompts')
  if (existsSync(cwdPath)) return cwdPath
  return join(__dirname, '..', '..', '..', '..', 'src', 'lib', 'bot', 'prompts')
}

const PROMPTS_DIR = getPromptsDir()
```

**Step 3: Update `src/lib/bot/classifier.ts` path resolution**

```typescript
// Add function to top of file
function getPromptsDir(): string {
  const fs = require('fs')
  const path = require('path')
  const cwdPath = path.join(process.cwd(), 'src/lib/bot/prompts')
  if (fs.existsSync(cwdPath)) return cwdPath
  return path.join(__dirname, '../../../../src/lib/bot/prompts')
}
```
Update all three instances of `path.join(process.cwd(), 'src/lib/bot/prompts/...')` to use `path.join(getPromptsDir(), '...')`.

**Step 4: Run build to verify it works**

Run: `node build.js`
Expected: Succeeds and copies the prompts correctly (no crash).

**Step 5: Commit**

```bash
git add build.js src/lib/bot/prompts/index.ts src/lib/bot/classifier.ts
git commit -m "fix: copy prompts to standalone and harden path resolution"
```

---

### Task 2: Fix Stale Router Cache

**Files:**
- Modify: `src/lib/router-config.ts`

**Step 1: Update revalidate**

Find `revalidate: false` and change them to `revalidate: 300`:

```typescript
const getCachedForMode = (m: RouterMode) => unstable_cache(
  async () => fetchRouterChainFromDb(category, m),
  ['router-chain', category, m],
  { tags: ['router-config'], revalidate: 300 }
)()
```
*(There are two instances to change)*

**Step 2: Commit**

```bash
git add src/lib/router-config.ts
git commit -m "fix: set router config cache to revalidate every 5 minutes"
```

---

### Task 3: Increase Vercel function timeout

**Files:**
- Modify: `src/app/api/ai/chat/route.ts`

**Step 1: Export maxDuration**

```typescript
// Add near the top imports
export const maxDuration = 60;
```

**Step 2: Commit**

```bash
git add src/app/api/ai/chat/route.ts
git commit -m "fix: increase chat route maxDuration to 60s"
```
