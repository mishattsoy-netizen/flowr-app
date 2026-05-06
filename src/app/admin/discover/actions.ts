'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { addModel, updateModel } from '@/app/admin/models/actions'
import { getVaultKey } from '@/lib/vault'

export interface DiscoveredModel {
  id: string
  displayName: string
  provider: string
  contextWindow: number | null
  maxOutputTokens: number | null
  rpd: number | null
  rpm: number | null
  modalities: {
    input: string[]
    output: string[]
  }
  inRegistry: boolean
}

export async function fetchProviderModels(
  provider: string,
  apiKey: string
): Promise<DiscoveredModel[]> {
  // fetch from provider
  let raw: DiscoveredModel[] = []

  switch (provider) {
    case 'google':
      raw = await fetchGoogle(apiKey)
      break
    case 'groq':
      raw = await fetchGroq(apiKey)
      break
    case 'pollinations':
      raw = await fetchPollinations(apiKey)
      break
    case 'huggingface':
      raw = await fetchHuggingFace(apiKey)
      break
    case 'openrouter':
      raw = await fetchOpenRouter(apiKey)
      break
    case 'cloudflare':
      raw = await fetchCloudflare(apiKey)
      break
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }

  // cross-reference registry
  const { data: existing } = await supabaseAdmin
    .from('models')
    .select('id')

  const registryIds = new Set((existing ?? []).map((m: any) => m.id))
  return raw.map(m => ({ ...m, inRegistry: registryIds.has(m.id) }))
}

export { addModel, updateModel }

async function fetchGoogle(apiKey: string): Promise<DiscoveredModel[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`
  )
  if (!res.ok) throw new Error(`Google API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return (data.models ?? [])
    .filter((m: any) =>
      Array.isArray(m.supportedGenerationMethods) &&
      m.supportedGenerationMethods.includes('generateContent')
    )
    .map((m: any) => {
      const id = m.name.replace('models/', '')
      const nameLower = id.toLowerCase()
      const hasVision = nameLower.includes('vision') || nameLower.includes('pro') || nameLower.includes('flash')
      return {
        id,
        displayName: m.displayName ?? id,
        provider: 'google',
        contextWindow: m.inputTokenLimit ?? null,
        maxOutputTokens: m.outputTokenLimit ?? null,
        rpd: null,
        rpm: null,
        modalities: {
          input: hasVision ? ['text', 'image'] : ['text'],
          output: ['text'],
        },
        inRegistry: false,
      }
    })
}

async function fetchGroq(apiKey: string): Promise<DiscoveredModel[]> {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return (data.data ?? []).map((m: any) => {
    const idLower = (m.id ?? '').toLowerCase()
    const isAudio = idLower.includes('whisper')
    return {
      id: m.id,
      displayName: m.id,
      provider: 'groq',
      contextWindow: m.context_window ?? null,
      maxOutputTokens: null,
      rpd: null,
      rpm: null,
      modalities: {
        input: isAudio ? ['audio'] : ['text'],
        output: ['text'],
      },
      inRegistry: false,
    }
  })
}

async function fetchPollinations(apiKey: string): Promise<DiscoveredModel[]> {
  const headers: Record<string, string> = {}
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch('https://text.pollinations.ai/models', { headers })
  if (!res.ok) throw new Error(`Pollinations API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  const models = Array.isArray(data) ? data : (data.models ?? [])
  return models.map((m: any) => ({
    id: typeof m === 'string' ? m : (m.name ?? m.id ?? String(m)),
    displayName: typeof m === 'string' ? m : (m.description ?? m.name ?? m.id ?? String(m)),
    provider: 'pollinations',
    contextWindow: m.contextLength ?? null,
    maxOutputTokens: null,
    rpd: null,
    rpm: null,
    modalities: { input: ['text'], output: ['text'] },
    inRegistry: false,
  }))
}

async function fetchHuggingFace(apiKey: string): Promise<DiscoveredModel[]> {
  const res = await fetch(
    'https://huggingface.co/api/models?filter=text-generation&sort=downloads&limit=100',
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  if (!res.ok) throw new Error(`HuggingFace API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return (data ?? [])
    .filter((m: any) => !m.gated)
    .map((m: any) => ({
      id: m.modelId ?? m.id,
      displayName: m.modelId ?? m.id,
      provider: 'huggingface',
      contextWindow: null,
      maxOutputTokens: null,
      rpd: null,
      rpm: null,
      modalities: { input: ['text'], output: ['text'] },
      inRegistry: false,
    }))
}

async function fetchOpenRouter(apiKey: string): Promise<DiscoveredModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return (data.data ?? [])
    .filter((m: any) => {
      const isFreeId = (m.id ?? '').endsWith(':free')
      const price = m.pricing?.prompt
      const isFreePrice = price === '0' || price === '0.000' || price === 0
      return isFreeId || isFreePrice
    })
    .map((m: any) => {
      const arch = m.architecture ?? {}
      return {
        id: m.id,
        displayName: m.name ?? m.id,
        provider: 'openrouter',
        contextWindow: m.context_length ?? null,
        maxOutputTokens: null,
        rpd: null,
        rpm: null,
        modalities: {
          input: arch.input_modalities ?? ['text'],
          output: arch.output_modalities ?? ['text'],
        },
        inRegistry: false,
      }
    })
}

async function fetchCloudflare(apiKey: string): Promise<DiscoveredModel[]> {
  const accountId = await getVaultKey('CLOUDFLARE_ACCOUNT_ID')
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID not found in vault')

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  if (!res.ok) throw new Error(`Cloudflare API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return ((data.result ?? data.models ?? []) as any[]).map((m: any) => {
    const taskName = (m.task?.name ?? '').toLowerCase()
    const hasImage = taskName.includes('image') || taskName.includes('vision')
    const hasAudio = taskName.includes('audio') || taskName.includes('speech')
    const input = hasAudio ? ['audio'] : hasImage ? ['text', 'image'] : ['text']
    const output = hasImage && taskName.includes('generat') ? ['image'] : ['text']
    return {
      id: m.name ?? m.id,
      displayName: m.description ?? m.name ?? m.id,
      provider: 'cloudflare',
      contextWindow: null,
      maxOutputTokens: null,
      rpd: null,
      rpm: null,
      modalities: { input, output },
      inRegistry: false,
    }
  })
}