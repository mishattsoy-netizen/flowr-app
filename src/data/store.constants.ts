import type { FlowRouterConfig, PriorityModel, CloudModel } from './store.types';

// Bump when model IDs change to bust stale localStorage
export const FLOW_ROUTER_VERSION = 13;

export const DEFAULT_FLOW_ROUTER_CONFIG: FlowRouterConfig = {
  enabled: true,
  preferKeyRotation: true,
  version: FLOW_ROUTER_VERSION,
  categories: [
    {
      key: 'tool_call',
      label: 'Tool Calling',
      description: 'Handles complex function calling and workspace actions (Gemini 2.5 Flash).',
      models: [
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google', enabled: true, dailyLimit: 20 },
        { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', provider: 'groq', enabled: true, dailyLimit: 1000 },
        { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', provider: 'groq', enabled: true, dailyLimit: 1000 },
      ],
    },
    {
      key: 'web_search',
      label: 'Web Search',
      description: 'Optimized for RAG, search grounding, and online queries (Google Search Grounding).',
      models: [
        { id: 'google-search-grounding', label: 'Google Search Grounding', provider: 'google', enabled: true, dailyLimit: 1500 },
        { id: 'tavily-search', label: 'Tavily Search', provider: 'vault', enabled: true, dailyLimit: 0 },
        { id: 'duckduckgo-search', label: 'DuckDuckGo Search', provider: 'vault', enabled: true, dailyLimit: 0 },
      ],
    },
    {
      key: 'complex',
      label: 'Complex Thinking',
      description: 'Deep reasoning and analysis (Llama 3.3 70B).',
      models: [
        { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', provider: 'groq', enabled: true, dailyLimit: 1000 },
        { id: 'gemini-3-flash', label: 'Gemini 3 Flash', provider: 'google', enabled: true, dailyLimit: 20 },
        { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', provider: 'groq', enabled: true, dailyLimit: 1000 },
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google', enabled: true, dailyLimit: 20 },
        { id: 'gemma-4-31b', label: 'Gemma 4 31B', provider: 'google', enabled: true, dailyLimit: 1500 },
      ],
    },
    {
      key: 'medium',
      label: 'Medium',
      description: 'Balanced performance for general-purpose requests (Gemini 3.1 Flash Lite).',
      models: [
        { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', provider: 'google', enabled: true, dailyLimit: 500 },
        { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', provider: 'groq', enabled: true, dailyLimit: 1000 },
        { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', provider: 'groq', enabled: true, dailyLimit: 1000 },
        { id: 'gemma-4-26b', label: 'Gemma 4 26B', provider: 'google', enabled: true, dailyLimit: 1500 },
      ],
    },
    {
      key: 'fast',
      label: 'Fast',
      description: 'Sub-second latency (Gemini 3.1 Flash Lite).',
      models: [
        { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', provider: 'google', enabled: true, dailyLimit: 500 },
        { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', provider: 'groq', enabled: true, dailyLimit: 14400 },
        { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', provider: 'google', enabled: true, dailyLimit: 20 },
        { id: 'allam-2-7b', label: 'Allam 2 7B', provider: 'google', enabled: true, dailyLimit: 14400 },
        { id: 'gemma-3-4b', label: 'Gemma 3 4B', provider: 'google', enabled: true, dailyLimit: 1500 },
      ],
    },
    {
      key: 'image_generation',
      label: 'Image Generation',
      description: 'Creative and high-fidelity image output.',
      hidden: true,
      models: [
        { id: 'cloudflare-workers-ai', label: 'Cloudflare AI', provider: 'cloudflare', enabled: true, dailyLimit: 100000 },
        { id: 'imagen-4-ultra-generate', label: 'Imagen 4 Ultra', provider: 'google', enabled: true, dailyLimit: 25 },
        { id: 'imagen-4-fast-generate', label: 'Imagen 4 Fast', provider: 'google', enabled: true, dailyLimit: 25 },
        { id: 'huggingface-stable-diffusion', label: 'Stable Diffusion (HF)', provider: 'huggingface', enabled: true, dailyLimit: 0 },
      ],
    },
    {
      key: 'audio_voice',
      label: 'Audio & Voice',
      description: 'Transcribe audio, native voice dialog, and text-to-speech.',
      hidden: true,
      models: [
        { id: 'gemini-3-flash-live', label: 'Gemini 3 Flash Live', provider: 'google', enabled: true, dailyLimit: 0 },
        { id: 'whisper-large-v3-turbo', label: 'Whisper Large V3 Turbo', provider: 'groq', enabled: true, dailyLimit: 2000 },
        { id: 'gemini-2.5-flash-native-audio-dialog', label: 'Gemini 2.5 Audio Dialog', provider: 'google', enabled: true, dailyLimit: 0 },
        { id: 'whisper-large-v3', label: 'Whisper Large V3', provider: 'groq', enabled: true, dailyLimit: 2000 },
        { id: 'gemini-3.1-flash-tts', label: 'Gemini 3.1 TTS', provider: 'google', enabled: true, dailyLimit: 0 },
      ],
    },
  ],
};

export const PRIORITY_MODELS: PriorityModel[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', status: 'checking' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', status: 'checking' },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', status: 'checking' },
  { id: 'google-search-grounding', name: 'Search Grounding', status: 'checking' },
  { id: 'gemini-3-flash-live', name: 'Flash Live (Voice)', status: 'checking' },
  { id: 'cloudflare-workers-ai', name: 'Cloudflare AI (Image)', status: 'checking' },
];

export const INITIAL_CLOUD_MODELS: CloudModel[] = [
  { id: 'flowr/flow-1.0', label: 'Flow 1.0 🌊', provider: 'flowr', description: 'Smart intent router — automatically picks the best model for each task.' },
  { id: 'flowr/gemma4-hybrid', label: 'Gemma 4 Hybrid ✨', provider: 'google', isFree: true, isThinking: true, description: 'Smart Gemma 4 hybrid: 31B for tools & reasoning, 26B MoE for fast answers.' },
];
