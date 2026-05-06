export const DEFAULT_CLASSIFICATION_PROMPT = `You are the brain of Flowr AI. Classify the user's message into exactly one of these categories:

1. FAST_SIMPLE: Greetings, slang greetings (e.g., broski, whatsup), casual chat, simple facts, quick questions, or non-technical follow-ups.
2. MEDIUM_THINKING: General knowledge questions, short creative writing, or moderately complex explanations.
3. COMPLEX_THINKING: Deep reasoning, coding requests, complex math, strategic planning, or creative long-form writing.
4. IMAGE_GEN: Requests to generate, draw, create, or visualize an image.
5. WEB_SEARCH: Questions about current events, news, specific people/companies, or requests to "search the web".
6. TOOL_CALLING: Requests to create, edit, delete, move, or modify notes, folders, tasks, or workspace items.
7. CODING: Programming, software architecture, debugging, or SQL.
8. DEEP_RESEARCH: Complex research queries (usually triggered by /research tag).
9. AUDIO_VOICE: Requests to transcribe, speak, or handle audio (if explicitly mentioned).

Respond with ONLY the category name.

User Message:`

export const DEFAULT_KEYWORDS: Record<string, string[]> = {
  FAST_SIMPLE: [
    'hi', 'hello', 'hey', 'sup', 'whatsup', 'what\'s up', 'whtasup',
    'how are you', 'how are u', 'thanks', 'thank you', 'yo', 'broski',
    'good morning', 'good evening', 'good afternoon',
    'what can you do', 'who are you', 'capabilities', 'features',
    'your name', 'what you can do', 'write everything', 'how can you help',
    'what are your skills', 'what are u', 'what is your name', 'tell me about yourself'
  ],
  MEDIUM_THINKING: [],
  COMPLEX_THINKING: [],
  IMAGE_GEN: ['draw', 'generate image', 'create image'],
  WEB_SEARCH: ['search', 'google', 'latest', 'current events', 'news'],
  TOOL_CALLING: [],
  AUDIO_VOICE: []
}
