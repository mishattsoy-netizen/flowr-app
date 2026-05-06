export interface RegistryModel {
  id: string
  provider: string
  max_rpd: number | null
  is_favorite: boolean
  input_modalities?: string[]
  output_modalities?: string[]
}

import { Globe, Zap, Layers, Cpu, Command, Image, Brain } from 'lucide-react'

export const PROVIDER_COLORS: Record<string, string> = {
  google: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  groq: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  openrouter: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  ollama: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  vault: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  pollinations: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  huggingface: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  cloudflare: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

export const PROVIDER_DOTS: Record<string, string> = {
  google: 'bg-blue-400',
  groq: 'bg-orange-400',
  openrouter: 'bg-purple-400',
  ollama: 'bg-cyan-400',
  vault: 'bg-emerald-400',
  pollinations: 'bg-pink-400',
  huggingface: 'bg-yellow-400',
  cloudflare: 'bg-amber-400',
}

export const PROVIDER_ICONS: Record<string, any> = {
  google: Globe,
  groq: Zap,
  openrouter: Layers,
  ollama: Cpu,
  vault: Command,
  pollinations: Image,
  huggingface: Brain,
  cloudflare: Zap,
}
