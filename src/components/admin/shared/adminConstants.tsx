"use client";

import React from 'react';
import { Wrench, Globe, Brain, Layers, Bolt, Image as ImageIcon, Mic, Cpu } from 'lucide-react';
import type { FlowIntentCategory } from '@/data/store';

export const CATEGORY_ICONS: Record<FlowIntentCategory, React.ReactNode> = {
  tool_call:        <Wrench strokeWidth={2} className="w-4 h-4" />,
  web_search:       <Globe strokeWidth={2} className="w-4 h-4" />,
  complex:          <Brain strokeWidth={2} className="w-4 h-4" />,
  medium:           <Layers strokeWidth={2} className="w-4 h-4" />,
  fast:             <Bolt strokeWidth={2} className="w-4 h-4" />,
  image_generation: <ImageIcon strokeWidth={2} className="w-4 h-4" />,
  audio_voice:      <Mic strokeWidth={2} className="w-4 h-4" />,
  CLASSIFIER:       <Cpu strokeWidth={2} className="w-4 h-4" />,
};


export const PROVIDER_COLORS: Record<string, string> = {
  gemini:     'text-blue-400 bg-blue-500/10 border-blue-500/20',
  groq:       'text-orange-400 bg-orange-500/10 border-orange-500/20',
  openrouter: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  local:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  flowr:      'text-accent bg-[var(--bone-6)] border-white/5',
};
