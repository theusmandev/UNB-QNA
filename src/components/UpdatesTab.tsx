import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatSimpleDate } from '../lib/date'
import type { Update } from '../types'

const REACTIONS = ['👍', '❤️', '😂', '🎉']

interface UpdatesTabProps {
  visitorId: string
}

export default function UpdatesTab({ visitorId }: UpdatesTabProps) {
  const [updates, setUpdates] = useState<Update[]>([])
  const [loading, setLoading] = useState(true)
  const [myReactions, setMyReactions] = useState<Record<string, string[]>>({})
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function load() {
    const { data } = await supabase.rpc('get_updates_with_reactions')
    setUpdates((data as Update[]) ?? [])
    
    // Also load the current visitor's reactions so we can highlight what they clicked
    if (visitorId) {
      const { data: myReacts } = await supabase
        .from('update_reactions')
        .select('update_id, reaction')
        .eq('visitor_id', visitorId)
      
      const reactMap: Record<string, string[]> = {}
      myReacts?.forEach((r) => {
        if (!reactMap[r.update_id]) reactMap[r.update_id] = []
        reactMap[r.update_id].push(r.reaction)
      })
      setMyReactions(reactMap)
    }

    setLoading(false)
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('public-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'updates' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'update_reactions' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [visitorId])

  async function handleReact(updateId: string, reaction: string) {
    if (!visitorId) return

    // Optimistic UI update
    const hasReacted = myReactions[updateId]?.includes(reaction)
    
    setMyReactions((prev) => {
      const next = { ...prev }
      if (!next[updateId]) next[updateId] = []
      
      if (hasReacted) {
        next[updateId] = next[updateId].filter(r => r !== reaction)
      } else {
        next[updateId] = [...next[updateId], reaction]
      }
      return next
    })

    setUpdates((prev) => 
      prev.map(u => {
        if (u.id === updateId) {
          const nextReactions = { ...u.reactions }
          const currentCount = nextReactions[reaction] || 0
          if (hasReacted) {
            nextReactions[reaction] = Math.max(0, currentCount - 1)
          } else {
            nextReactions[reaction] = currentCount + 1
          }
          return { ...u, reactions: nextReactions }
        }
        return u
      })
    )

    await supabase.rpc('toggle_update_reaction', {
      p_update_id: updateId,
      p_visitor_id: visitorId,
      p_reaction: reaction
    })
    
    // The realtime subscription will eventually true this up anyway, but optimistic makes it feel instant.
  }

  if (loading) {
    return <div className="flex h-32 items-center justify-center text-sm text-wa-muted">Loading updates…</div>
  }

  if (updates.length === 0) {
    return <div className="flex h-32 items-center justify-center text-sm text-wa-muted">No updates yet.</div>
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {updates.map((update) => {
        const isExpanded = expandedIds.has(update.id)

        return (
          <div 
            key={update.id} 
            onClick={() => !isExpanded && toggleExpand(update.id)}
            className={`rounded-xl bg-[#FCF3D7] p-3 shadow-sm ${!isExpanded ? 'cursor-pointer hover:bg-[#FBEBB5] transition-colors' : ''}`}
          >
            <div className="flex justify-between items-start gap-2">
              <h3 className="text-base font-semibold text-wa-ink">{update.title}</h3>
              <span className="text-[10px] text-wa-muted whitespace-nowrap mt-1">
                {formatSimpleDate(update.created_at)}
              </span>
            </div>

            {!isExpanded && (
              <p className="text-xs text-wa-teal mt-1 font-medium">Tap to read</p>
            )}

            {isExpanded && (
              <>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-wa-ink mt-2">
                  {update.content}
                </p>
                
                <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {REACTIONS.map((emoji) => {
                      const count = update.reactions?.[emoji] || 0
                      const isActive = myReactions[update.id]?.includes(emoji)

                      return (
                        <button
                          key={emoji}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReact(update.id, emoji)
                          }}
                          className={`flex items-center gap-1 rounded-full px-2 py-1 transition-colors ${
                            isActive 
                              ? 'bg-wa-teal/10 border border-wa-teal/30' 
                              : 'bg-white/60 border border-transparent hover:bg-white'
                          }`}
                        >
                          <span className="text-[14px] leading-none">{emoji}</span>
                          {count > 0 && (
                            <span className={`text-[11px] font-medium ${isActive ? 'text-wa-teal' : 'text-wa-muted'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(update.id)
                    }}
                    className="text-[10px] font-medium text-wa-muted hover:text-wa-ink"
                  >
                    Hide
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
