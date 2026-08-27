import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { formatSimpleDate } from '../lib/date'
import { isUrdu } from '../lib/isUrdu'
import DOMPurify from 'dompurify'
import type { Update } from '../types'

// Configure DOMPurify to ensure links open in a new tab
DOMPurify.addHook('afterSanitizeAttributes', function(node) {
  if ('target' in node) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const REACTIONS = ['👍', '❤️', '😂', '🎉']

interface UpdatesTabProps {
  visitorId: string
}

export default function UpdatesTab({ visitorId }: UpdatesTabProps) {
  const [updates, setUpdates] = useState<Update[]>(() => {
    try {
      const cached = localStorage.getItem('unb_cached_updates')
      if (cached) return JSON.parse(cached)
    } catch {}
    return []
  })
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('unb_cached_updates')
    } catch {
      return true
    }
  })
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadedCount, setLoadedCount] = useState(20)
  const [myReactions, setMyReactions] = useState<Record<string, string[]>>(() => {
    try {
      const cached = localStorage.getItem('unb_cached_reactions')
      if (cached) return JSON.parse(cached)
    } catch {}
    return {}
  })
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const loadedCountRef = useRef(loadedCount)
  useEffect(() => {
    loadedCountRef.current = loadedCount
  }, [loadedCount])

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function load() {
    const limitToFetch = loadedCountRef.current
    const { data } = await supabase.rpc('get_updates_with_reactions', {
      p_limit: limitToFetch + 1,
      p_offset: 0
    })
    const items = (data as Update[]) ?? []
    
    let fetchedUpdates = []
    if (items.length > limitToFetch) {
      setHasMore(true)
      fetchedUpdates = items.slice(0, limitToFetch)
    } else {
      setHasMore(false)
      fetchedUpdates = items
    }
    setUpdates(fetchedUpdates)
    try { localStorage.setItem('unb_cached_updates', JSON.stringify(fetchedUpdates.slice(0, 20))) } catch {}
    
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
      try { localStorage.setItem('unb_cached_reactions', JSON.stringify(reactMap)) } catch {}
    }

    setLoading(false)
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextLimit = loadedCount + 10
    
    const { data } = await supabase.rpc('get_updates_with_reactions', {
      p_limit: nextLimit + 1,
      p_offset: 0
    })
    const items = (data as Update[]) ?? []
    
    if (items.length > nextLimit) {
      setHasMore(true)
      setUpdates(items.slice(0, nextLimit))
    } else {
      setHasMore(false)
      setUpdates(items)
    }
    
    setLoadedCount(nextLimit)
    setLoadingMore(false)
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
              <h3 
                dir={isUrdu(update.title) ? 'rtl' : 'ltr'}
                className={`text-base font-semibold text-wa-ink ${isUrdu(update.title) ? 'urdu-text text-right' : 'text-left'}`}
              >
                {update.title}
              </h3>
              <div className="flex items-center gap-1 mt-1">
                {update.is_pinned && (
                  <svg className="text-wa-muted" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                  </svg>
                )}
                <span className="text-[10px] text-wa-muted whitespace-nowrap">
                  {formatSimpleDate(update.created_at)}
                </span>
              </div>
            </div>

            {!isExpanded && (
              <p className="text-xs text-wa-teal mt-1 font-medium">Tap to read</p>
            )}

            {isExpanded && (
              <>
                <div 
                  className={`whitespace-pre-wrap text-[15px] leading-relaxed mt-2 [&_a]:text-[#027EB5] [&_a]:underline [&_a]:decoration-[#027EB5]/30 hover:[&_a]:decoration-[#027EB5] [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2
                    ${isUrdu(update.content) ? 'urdu-text text-right text-wa-ink' : 'text-left text-wa-ink'}`}
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(update.content, { 
                      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'img', 'ul', 'ol', 'li', 'u', 's', 'strike', 'blockquote', 'h1', 'h2', 'h3'], 
                      ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'dir'] 
                    }) 
                  }}
                />
                
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
      {hasMore && (
        <div className="flex justify-center py-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full bg-white px-5 py-2 text-[14px] font-medium text-wa-teal shadow-sm border border-wa-teal/20 active:bg-gray-50 disabled:opacity-50 transition-all hover:shadow-md"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
