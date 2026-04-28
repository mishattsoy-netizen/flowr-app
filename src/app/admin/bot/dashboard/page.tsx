import { getDashboardStats } from './actions'
import { Brain, ThumbsUp, ThumbsDown, RotateCcw, Check, X } from 'lucide-react'

export default async function BotDashboardPage() {
  const stats = await getDashboardStats()

  const statCards = [
    { label: 'Brain Entries', value: stats.totalBrainEntries, icon: Brain, color: 'text-purple-400' },
    { label: 'Liked Responses', value: stats.likedCount, icon: ThumbsUp, color: 'text-green-400' },
    { label: 'Disliked Responses', value: stats.dislikedCount, icon: ThumbsDown, color: 'text-red-400' },
    { label: 'Last Session Plans', value: stats.lastSessionPlans, icon: RotateCcw, color: 'text-blue-400' },
  ]

  const categoryOrder = ['rules', 'mistakes', 'patterns', 'personality', 'questions']
  const categoryColors: Record<string, string> = {
    rules: 'bg-indigo-500', mistakes: 'bg-red-500', patterns: 'bg-green-500',
    personality: 'bg-purple-500', questions: 'bg-yellow-500'
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Analysis Dashboard</h1>
        <p className="text-muted-foreground text-sm font-medium">Brain health and learning activity overview.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(card => (
          <div key={card.label} className="bg-[var(--bone-6)] border border-[var(--bone-10)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} strokeWidth={2} />
              <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
            </div>
            <div className="text-3xl font-display text-foreground">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Brain breakdown */}
      <div className="bg-[var(--bone-6)] border border-[var(--bone-10)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Brain entries by category</h3>
        <div className="space-y-2.5">
          {categoryOrder.map(cat => {
            const count = stats.entriesByCategory[cat] ?? 0
            const max = Math.max(...Object.values(stats.entriesByCategory), 1)
            const pct = Math.round((count / max) * 100)
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-20 capitalize">{cat}</span>
                <div className="flex-1 bg-[var(--bone-10)] rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${categoryColors[cat]}`} style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
                </div>
                <span className="text-xs text-foreground w-6 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Last session summary */}
      {stats.lastSessionDate && (
        <div className="bg-[var(--bone-6)] border border-[var(--bone-10)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Last routine session</h3>
          <p className="text-xs text-muted-foreground mb-4">{new Date(stats.lastSessionDate).toLocaleString()}</p>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-foreground font-medium">{stats.lastSessionPlans}</span>
              <span className="text-muted-foreground">plans</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-foreground font-medium">{stats.lastSessionAccepted}</span>
              <span className="text-muted-foreground">accepted</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <X className="w-3.5 h-3.5 text-red-400" />
              <span className="text-foreground font-medium">{stats.lastSessionRejected}</span>
              <span className="text-muted-foreground">rejected</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
