import React, { useState, useRef, useEffect } from 'react'
import { Settings, Send, Bot, Zap, Brain, Wand2, Check, X, Square, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { RoadmapPhase, RoadmapTask, RoadmapRouterChain } from './RoadmapClient'
import BotConfigModal from './BotConfigModal'
import { cn } from '@/lib/utils'

interface Props {
  phases: RoadmapPhase[]
  tasks: RoadmapTask[]
  setPhases: React.Dispatch<React.SetStateAction<RoadmapPhase[]>>
  setTasks: React.Dispatch<React.SetStateAction<RoadmapTask[]>>
  routerChains: RoadmapRouterChain[]
}

type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
}

export default function PlanningAssistant({ phases, tasks, setPhases, setTasks, routerChains }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'auto' | 'fast' | 'complex'>('auto')
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const userMsg = input.trim()
    setInput('')
    
    const newMessages: Message[] = [...messages, { id: crypto.randomUUID(), role: 'user', content: userMsg }]
    setMessages(newMessages)
    setIsLoading(true)

    const controller = new AbortController()
    setAbortController(controller)

    try {
      const res = await fetch('/api/admin/roadmap/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: userMsg,
          mode,
          history: newMessages.slice(-10),
          phases,
          tasks
        })
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: data.content, model: data.model }])
      } else {
        const err = await res.json()
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'system', content: `Error: ${err.error}` }])
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'system', content: `Network error: ${e.message}` }])
      }
    } finally {
      setIsLoading(false)
      setAbortController(null)
    }
  }

  const handleStop = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      setIsLoading(false)
    }
  }

  const renderContent = (content: string, isLastAssistantMessage: boolean) => {
    // Basic ROADMAP_ACTION parser
    const parts = content.split(/(\[ROADMAP_ACTION\][\s\S]*?\[\/ROADMAP_ACTION\])/)
    
    return parts.map((part, i) => {
      if (part.startsWith('[ROADMAP_ACTION]') && part.endsWith('[/ROADMAP_ACTION]')) {
        const jsonStr = part.replace('[ROADMAP_ACTION]', '').replace('[/ROADMAP_ACTION]', '').trim()
        try {
          const action = JSON.parse(jsonStr)
          return <ActionBlock key={i} action={action} phases={phases} setPhases={setPhases} setTasks={setTasks} />
        } catch (e) {
          return <div key={i} className="text-red-400 text-xs">Failed to parse action block</div>
        }
      }
      return (
        <div key={i} className="prose prose-invert prose-sm max-w-none text-[var(--bone-80)]">
          {isLastAssistantMessage ? (
            <TypewriterMessage content={part} />
          ) : (
            <ReactMarkdown>{part}</ReactMarkdown>
          )}
        </div>
      )
    })
  }

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--bone-6)] shrink-0">
          <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--bone-100)]">
              <Bot className="w-5 h-5" />
              <span className="font-display font-medium text-lg">Planning Assistant</span>
            </div>
            <button 
              onClick={() => setIsConfigOpen(true)}
              className="p-1.5 rounded-lg text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="px-4 py-3 flex items-center justify-center border-b border-[var(--bone-6)] shrink-0 bg-transparent">
          <div className="max-w-[1200px] mx-auto w-full flex items-center justify-center gap-2">
            {(['fast', 'auto', 'complex'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wide transition-colors",
                  mode === m 
                    ? "bg-[var(--bone-100)] text-black" 
                    : "text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                )}
              >
                {m === 'fast' ? <Zap className="w-3 h-3" /> : m === 'auto' ? <Wand2 className="w-3 h-3" /> : <Brain className="w-3 h-3" />}
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="max-w-[1200px] mx-auto w-full flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-[var(--bone-40)] text-center gap-3">
                <Bot className="w-12 h-12 opacity-50" />
                <p className="text-sm max-w-[250px]">Describe a feature or ask for a plan. I will generate actionable phases and tasks.</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={cn("flex flex-col gap-1", msg.role === 'user' ? "items-end" : "items-start")}>
                  <div className={cn(
                    "px-4 py-2.5 rounded-2xl max-w-[90%] overflow-hidden",
                    msg.role === 'user' 
                      ? "bg-[var(--bone-10)] text-[var(--bone-100)] rounded-br-sm" 
                      : msg.role === 'system'
                      ? "bg-red-500/10 text-red-400 border border-red-500/20 text-xs"
                      : "bg-white/5 border-none text-[var(--bone-100)] rounded-bl-sm"
                  )}>
                    <div className="break-words overflow-wrap-anywhere [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all">
                    {renderContent(msg.content, msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id)}
                    </div>
                  </div>
                  {msg.model && (
                    <span className="text-[10px] text-[var(--bone-40)] px-2">{msg.model}</span>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex flex-col items-start gap-1">
                <div className="px-4 py-3 rounded-2xl max-w-[90%] bg-white/5 border-none rounded-bl-sm flex items-center gap-2 h-[36px] animate-pulse">
                   <Loader2 className="w-3.5 h-3.5 text-[var(--bone-60)] animate-spin" />
                   <span className="text-xs text-[var(--bone-60)] font-medium">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 shrink-0 bg-transparent">
          <div className="max-w-[1200px] mx-auto w-full relative flex items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask anything or generate tasks..."
              className="w-full bg-[var(--bone-6)] border-none rounded-[var(--radius-8)] py-3 pl-4 pr-12 text-sm text-[var(--bone-100)] placeholder:text-[var(--bone-40)] outline-none resize-none min-h-[44px] max-h-[200px] transition-colors custom-scrollbar"
              rows={Math.min(5, input.split('\n').length)}
            />
            {isLoading ? (
              <button
                onClick={handleStop}
                className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                title="Stop generation"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="absolute right-2 bottom-2 p-1.5 rounded-lg text-[var(--bone-40)] hover:text-[var(--bone-100)] disabled:opacity-30 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isConfigOpen && (
        <BotConfigModal 
          onClose={() => setIsConfigOpen(false)} 
          routerChains={routerChains}
        />
      )}
    </>
  )
}

function ActionBlock({ action, phases, setPhases, setTasks }: any) {
  const [status, setStatus] = useState<'pending' | 'applied' | 'rejected' | 'error'>('pending')
  const [error, setError] = useState('')
  const [selectedPhaseId, setSelectedPhaseId] = useState(action.phase_id || '')

  // Check if the phase_id is a real UUID (exists in phases list)
  const isValidPhaseId = phases.some((p: any) => p.id === selectedPhaseId)
  const needsPhaseSelection = action.action === 'create_task' && !isValidPhaseId

  const handleApply = async () => {
    try {
      setError('')
      if (action.action === 'create_task') {
        const phaseId = selectedPhaseId
        if (!phaseId || !phases.some((p: any) => p.id === phaseId)) {
          setError('Select a valid phase first')
          return
        }
        const res = await fetch('/api/admin/roadmap/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phase_id: phaseId,
            title: action.title,
            description: action.description || '',
            priority: action.priority || 'medium',
            sub_tasks: action.sub_tasks || [],
            tags: action.tags || [],
            agent_prompt: action.agent_prompt || '',
          })
        })
        if (res.ok) {
          const newTask = await res.json()
          setTasks((prev: any) => [...prev, newTask])
          setStatus('applied')
        } else {
          const err = await res.json()
          setError(err.error || 'Failed to create task')
          setStatus('error')
        }
      } else if (action.action === 'create_phase') {
        const res = await fetch('/api/admin/roadmap/phases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: action.title, 
            description: action.description || '',
            color: action.color || '#6366f1'
          })
        })
        if (res.ok) {
          const newPhase = await res.json()
          setPhases((prev: any) => [...prev, newPhase])
          setStatus('applied')
        } else {
          const err = await res.json()
          setError(err.error || 'Failed to create phase')
          setStatus('error')
        }
      }
    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
  }

  if (status === 'applied') return <div className="text-xs text-green-400 flex items-center gap-1 py-1"><Check className="w-3 h-3"/> Applied: {action.title}</div>
  if (status === 'rejected') return <div className="text-xs text-red-400 flex items-center gap-1 py-1"><X className="w-3 h-3"/> Rejected</div>

  return (
    <div className="bg-white/5 border-none rounded-[var(--radius-8)] p-3 my-2 flex flex-col gap-2">
      <div className="text-xs font-mono text-[var(--bone-60)]">
        {action.action === 'create_task' ? 'Create Task' : 'Create Phase'}: <span className="text-[var(--bone-100)] font-medium">{action.title}</span>
      </div>
      {action.description && <div className="text-xs text-[var(--bone-80)] line-clamp-2">{action.description}</div>}
      
      {/* Phase selector for tasks with invalid phase_id */}
      {needsPhaseSelection && (
        <select 
          value={selectedPhaseId} 
          onChange={e => setSelectedPhaseId(e.target.value)}
          className="text-xs bg-[var(--bone-6)] border-none rounded px-2 py-1 text-[var(--bone-100)] outline-none"
        >
          <option value="">Select phase...</option>
          {phases.map((p: any) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      )}
      
      {error && <div className="text-xs text-red-400">{error}</div>}
      
      <div className="flex gap-2 justify-end mt-1">
        <button onClick={() => setStatus('rejected')} className="text-xs px-2 py-1 rounded bg-[var(--bone-10)] hover:bg-red-400/20 hover:text-red-400 transition-colors">Reject</button>
        <button onClick={handleApply} className="text-xs px-2 py-1 rounded bg-[var(--bone-100)] text-black font-medium hover:opacity-90 transition-opacity">Apply</button>
      </div>
    </div>
  )
}

function TypewriterMessage({ content }: { content: string }) {
  const [displayContent, setDisplayContent] = useState('')
  const [hasFinishedTyping, setHasFinishedTyping] = useState(false)
  const displayedLenRef = useRef(0)
  const lastTimeRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    // Reset if content changes heavily
    if (content.length < displayedLenRef.current) {
      displayedLenRef.current = 0
      setDisplayContent('')
      setHasFinishedTyping(false)
    }

    if (hasFinishedTyping && displayContent === content) return

    const step = (now: number) => {
      const remaining = content.length - displayedLenRef.current

      if (remaining <= 0) {
        setHasFinishedTyping(true)
        setDisplayContent(content)
        return
      }

      const elapsed = lastTimeRef.current ? now - lastTimeRef.current : 1000
      // ~20-30 chars per frame batch for fast streaming effect
      if (elapsed > 16) {
        lastTimeRef.current = now
        const next = Math.min(content.length, displayedLenRef.current + Math.floor(Math.random() * 8) + 2)
        displayedLenRef.current = next
        setDisplayContent(content.substring(0, next))
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [content, hasFinishedTyping, displayContent])

  const isAtEnd = (node: any) => {
    if (!node?.position?.end?.offset) return false;
    return node.position.end.offset >= displayContent.trim().length;
  };

  return (
    <div className={cn("relative", !hasFinishedTyping && "prose-streaming")}>
      <ReactMarkdown
        components={{
          p: ({ node, children }: any) => {
            const atEnd = !hasFinishedTyping && isAtEnd(node) && !!children;
            return (
              <p className="mb-2 last:mb-0 break-words">
                {children}
                {atEnd && <span className="ai-cursor-inline ml-1">█</span>}
              </p>
            )
          },
          li: ({ node, children }: any) => {
            const atEnd = !hasFinishedTyping && isAtEnd(node);
            return (
              <li className="break-words">
                {children}
                {atEnd && <span className="ai-cursor-inline ml-1">█</span>}
              </li>
            )
          }
        }}
      >
        {displayContent}
      </ReactMarkdown>
    </div>
  )
}
