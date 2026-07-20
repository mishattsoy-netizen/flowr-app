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

  it('omits the injected brain block content when none is provided', async () => {
    // tools.txt legitimately mentions "[BRAIN]" in prose (the rule explaining
    // what the brain block is) — so this asserts the actual injected content
    // is absent, not a bare substring match against the marker itself.
    const brainBlock = '[BRAIN]\nSome curated user knowledge.\n[/BRAIN]'
    const { staticPrompt } = await buildSystemPrompt('REGULAR', baseContext)
    expect(staticPrompt).not.toContain(brainBlock)
    expect(staticPrompt).not.toContain('Some curated user knowledge.')
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

describe('buildSystemPrompt — AI prefs overlays', () => {
  it('injects concise style and a soft language default', async () => {
    const { staticPrompt } = await buildSystemPrompt('REGULAR', {
      ...baseContext,
      responseStyle: 'concise',
      replyLanguage: 'fr',
    })
    expect(staticPrompt).toContain('[RESPONSE STYLE]')
    expect(staticPrompt).toContain('Prefer concise replies')
    expect(staticPrompt).toContain('[REPLY LANGUAGE]')
    expect(staticPrompt).toContain('Default reply language: French')
    expect(staticPrompt).toContain('honor an explicit language switch')
  })

  it('omits overlays for balanced + auto', async () => {
    const { staticPrompt } = await buildSystemPrompt('REGULAR', {
      ...baseContext,
      responseStyle: 'balanced',
      replyLanguage: 'auto',
    })
    expect(staticPrompt).not.toContain('[RESPONSE STYLE]')
    expect(staticPrompt).not.toContain('[REPLY LANGUAGE]')
  })
})

describe('buildSystemPrompt — entity mentions', () => {
  const mentionPhrases = [
    'flowr:<type>:<id>',
    'write it as a clickable mention',
    'Only mention entities you have a real',
    'Mentionable types: note, folder, canvas, workspace',
  ]

  it('includes entity mention instructions in the static prompt', async () => {
    const { staticPrompt } = await buildSystemPrompt('REGULAR', baseContext)
    for (const phrase of mentionPhrases) {
      expect(staticPrompt).toContain(phrase)
    }
  })

  it('still strips the static prompt for IMAGE_GEN', async () => {
    const { staticPrompt, dynamicContext } = await buildSystemPrompt('IMAGE_GEN', baseContext)
    expect(staticPrompt).toBe('')
    expect(dynamicContext).toBe('')
  })
})

