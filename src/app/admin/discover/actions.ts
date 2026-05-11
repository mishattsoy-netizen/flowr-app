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
  isPaid?: boolean
  promptCost?: number | null
  completionCost?: number | null
}

export async function fetchProviderModels(
  provider: string,
  keyId: string
): Promise<DiscoveredModel[]> {
  // If keyId is provided, decrypt it from the vault; otherwise use empty string
  const apiKey = keyId ? (await getVaultKey(keyId) ?? '') : ''

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
    case 'siliconflow':
      raw = await fetchSiliconFlow(apiKey)
      break
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }

  // deduplicate by ID
  const uniqueRaw = new Map<string, DiscoveredModel>()
  for (const m of raw) {
    if (!uniqueRaw.has(m.id)) {
      uniqueRaw.set(m.id, m)
    }
  }
  raw = Array.from(uniqueRaw.values())

  // cross-reference registry
  const { data: existing } = await supabaseAdmin
    .from('models')
    .select('id')

  const registryIds = new Set((existing ?? []).map((m: any) => m.id))
  return raw.map(m => ({ ...m, inRegistry: registryIds.has(m.id) }))
}

export { addModel, updateModel }

function getModalities(id: string, customInput?: string[], customOutput?: string[]) {
  const idLower = id.toLowerCase()
  const isImageGen = idLower.includes('flux') || idLower.includes('diffusion') || idLower.includes('sdxl') || idLower.includes('stable-diffusion') || idLower.includes('dreamshaper') || idLower.includes('dall-e') || idLower.includes('dalle') || idLower.includes('midjourney') || idLower.includes('imagen') || idLower.includes('playground') || idLower.includes('animagine') || idLower.includes('illustrious')
  
  const isAudio = idLower.includes('whisper') || idLower.includes('tts') || idLower.includes('audio') || idLower.includes('speech') || idLower.includes('voice')

  let input = customInput ?? ['text']
  let output = customOutput ?? ['text']

  if (isImageGen) {
    if (!input.includes('text')) input.push('text')
    output = ['image']
  } else if (isAudio) {
    if (idLower.includes('tts') || idLower.includes('speech')) {
      input = ['text']
      output = ['audio']
    } else {
      input = ['audio']
      output = ['text']
    }
  }

  return { input, output }
}

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
      const isPro = nameLower.includes('pro')
      const isFlash = nameLower.includes('flash')
      const hasVision = nameLower.includes('vision') || isPro || isFlash
      const defaultInput = hasVision ? ['text', 'image'] : ['text']
      return {
        id,
        displayName: m.displayName ?? id,
        provider: 'google',
        contextWindow: m.inputTokenLimit ?? null,
        maxOutputTokens: m.outputTokenLimit ?? null,
        rpd: null,
        rpm: null,
        modalities: getModalities(id, defaultInput, ['text']),
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
    const defaultInput = isAudio ? ['audio'] : ['text']
    return {
      id: m.id,
      displayName: m.id,
      provider: 'groq',
      contextWindow: m.context_window ?? null,
      maxOutputTokens: null,
      rpd: null,
      rpm: null,
      modalities: getModalities(m.id, defaultInput, ['text']),
      inRegistry: false,
    }
  })
}

async function fetchPollinations(apiKey: string): Promise<DiscoveredModel[]> {
  const headers: Record<string, string> = {}
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch('https://gen.pollinations.ai/v1/models', { headers })
  if (!res.ok) throw new Error(`Pollinations API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  const list = data.data ?? []
  return list.map((m: any) => {
    return {
      id: m.id,
      displayName: m.id,
      provider: 'pollinations',
      contextWindow: m.context_length ?? null,
      maxOutputTokens: null,
      rpd: null,
      rpm: null,
      modalities: getModalities(m.id, m.input_modalities ?? ['text'], m.output_modalities ?? ['text']),
      inRegistry: false,
    }
  })
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
      modalities: getModalities(m.modelId ?? m.id, ['text'], ['text']),
      inRegistry: false,
    }))
}

async function fetchOpenRouter(apiKey: string): Promise<DiscoveredModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return (data.data ?? []).map((m: any) => {
    const arch = m.architecture ?? {}
    const promptPrice = parseFloat(m.pricing?.prompt ?? '0')
    const completionPrice = parseFloat(m.pricing?.completion ?? '0')
    const isFree = (m.id ?? '').toLowerCase().endsWith(':free') || (promptPrice === 0 && completionPrice === 0)

    return {
      id: m.id,
      displayName: m.name ?? m.id,
      provider: 'openrouter',
      contextWindow: m.context_length ?? null,
      maxOutputTokens: null,
      rpd: null,
      rpm: null,
      modalities: getModalities(m.id, arch.input_modalities ?? ['text'], arch.output_modalities ?? ['text']),
      inRegistry: false,
      isPaid: !isFree,
      promptCost: isFree ? 0 : promptPrice,
      completionCost: isFree ? 0 : completionPrice,
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
      modalities: getModalities(m.name ?? m.id, input, output),
      inRegistry: false,
    }
  })
}

async function fetchSiliconFlow(apiKey: string): Promise<DiscoveredModel[]> {
  const res = await fetch('https://api.siliconflow.cn/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`SiliconFlow API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  // SiliconFlow sometimes returns duplicates; deduplicate by ID
  const seenIds = new Set<string>()
  const filtered = (data.data ?? []).filter((m: any) => {
    if (seenIds.has(m.id)) return false
    seenIds.add(m.id)
    return true
  })

  return filtered.map((m: any) => {
    return {
      id: m.id,
      displayName: m.id,
      provider: 'siliconflow',
      contextWindow: null,
      maxOutputTokens: null,
      rpd: null,
      rpm: null,
      modalities: getModalities(m.id),
      inRegistry: false,
    }
  })
}