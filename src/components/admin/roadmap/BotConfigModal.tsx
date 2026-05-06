import React, { useState, useEffect } from 'react'
import { X, Save, Bot, Network, Settings } from 'lucide-react'
import RouterSettings from './RouterSettings'
import { RoadmapRouterChain } from './RoadmapClient'
import { cn } from '@/lib/utils'

interface Props {
  onClose: () => void
  routerChains: RoadmapRouterChain[]
}

export default function BotConfigModal({ onClose, routerChains }: Props) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'classifier' | 'router'>('prompt')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [classifierPrompt, setClassifierPrompt] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/roadmap/config')
      .then(res => res.ok ? res.json() : {})
      .then((data: { system_prompt?: string; classifier_prompt?: string }) => {
        setSystemPrompt(data?.system_prompt || '')
        setClassifierPrompt(data?.classifier_prompt || '')
      })
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    await fetch('/api/admin/roadmap/config', {
      method: 'PATCH',
      body: JSON.stringify({ system_prompt: systemPrompt, classifier_prompt: classifierPrompt })
    })
    setIsSaving(false)
    // Add toast later
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl flex flex-col popup-glass-big rounded-2xl overflow-hidden shadow-2xl border border-[var(--bone-15)] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--bone-6)] bg-[var(--bone-3)] shrink-0">
          <div className="flex items-center gap-2 text-[var(--bone-100)]">
            <SettingsIcon className="w-5 h-5" />
            <span className="font-display font-medium text-lg">Planning Assistant Config</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 border-b border-[var(--bone-6)] bg-[var(--bone-1)] shrink-0">
          <button
            onClick={() => setActiveTab('prompt')}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'prompt' ? "border-[var(--bone-100)] text-[var(--bone-100)]" : "border-transparent text-[var(--bone-60)] hover:text-[var(--bone-100)]"
            )}
          >
            <Bot className="w-4 h-4" /> System Prompt
          </button>
          <button
            onClick={() => setActiveTab('classifier')}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'classifier' ? "border-[var(--bone-100)] text-[var(--bone-100)]" : "border-transparent text-[var(--bone-60)] hover:text-[var(--bone-100)]"
            )}
          >
            <Bot className="w-4 h-4" /> Classifier Prompt
          </button>
          <button
            onClick={() => setActiveTab('router')}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'router' ? "border-[var(--bone-100)] text-[var(--bone-100)]" : "border-transparent text-[var(--bone-60)] hover:text-[var(--bone-100)]"
            )}
          >
            <Network className="w-4 h-4" /> Router Matrix
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 min-h-[400px] max-h-[60vh]">
          {activeTab === 'prompt' ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[var(--bone-100)]">System Prompt</label>
              </div>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="You are a planning assistant..."
                className="w-full bg-[#1A1A1A] border border-[var(--bone-15)] rounded-xl p-4 text-sm text-[var(--bone-100)] font-mono outline-none resize-y min-h-[250px] focus:border-[var(--bone-30)] transition-colors"
              />
            </div>
          ) : activeTab === 'classifier' ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[var(--bone-100)]">Classifier Prompt</label>
              </div>
              <textarea
                value={classifierPrompt}
                onChange={e => setClassifierPrompt(e.target.value)}
                placeholder="Classify this message..."
                className="w-full bg-[#1A1A1A] border border-[var(--bone-15)] rounded-xl p-4 text-sm text-[var(--bone-100)] font-mono outline-none resize-y min-h-[250px] focus:border-[var(--bone-30)] transition-colors"
              />
            </div>
          ) : (
            <RouterSettings initialChains={routerChains} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-[var(--bone-6)] bg-[var(--bone-3)] shrink-0 gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)] text-sm font-medium transition-colors">
            Close
          </button>
          {(activeTab === 'prompt' || activeTab === 'classifier') && (
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bone-100)] text-black hover:opacity-90 text-sm font-medium transition-opacity disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Prompt'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingsIcon(props: any) {
  return <Settings {...props} />
}
