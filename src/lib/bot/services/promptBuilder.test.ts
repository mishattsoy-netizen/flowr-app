import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, type PromptBuilderContext } from './promptBuilder'

const baseContext: PromptBuilderContext = {
  isGlobalPromptEnabled: true,
  skipSummary: true,
  currentSummary: null,
}

describe('buildSystemPrompt — brain block placement', () => {
  it('includes the brain block before chain instructions, inside the cached static prompt', async () => {
    const brainBlock = '[BRAIN]\nSome curated user knowledge.\n[/BRAIN]'
    const { staticPrompt } = await buildSystemPrompt('REGULAR', {
      ...baseContext,
      brainBlock,
    })

    const brainIndex = staticPrompt.indexOf(brainBlock)
    expect(brainIndex).toBeGreaterThan(-1)

    // Cache-boundary invariant: the brain block must sit in the shared prefix,
    // strictly before the per-category chain instructions diverge — otherwise
    // every category cache-writes its own copy of the brain segment.
    const chainInstructions = staticPrompt.slice(brainIndex + brainBlock.length)
    expect(chainInstructions.length).toBeGreaterThan(0)
  })

  it('omits the brain block entirely when none is provided', async () => {
    const { staticPrompt } = await buildSystemPrompt('REGULAR', baseContext)
    expect(staticPrompt).not.toContain('[BRAIN]')
  })

  it('strips the brain block for IMAGE_GEN along with the rest of the system prompt', async () => {
    const brainBlock = '[BRAIN]\nSome curated user knowledge.\n[/BRAIN]'
    const { staticPrompt, dynamicContext } = await buildSystemPrompt('IMAGE_GEN', {
      ...baseContext,
      brainBlock,
    })
    expect(staticPrompt).toBe('')
    expect(dynamicContext).toBe('')
  })
})
