import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useLiveViewers() {
  // Map of slug -> count
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const channel = supabase.channel('presence-global')

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ slug: string }>()
        const counts: Record<string, number> = {}
        
        for (const presenceKey in state) {
          const presences = state[presenceKey]
          for (const presence of presences) {
            if (presence.slug) {
              counts[presence.slug] = (counts[presence.slug] || 0) + 1
            }
          }
        }
        
        setViewerCounts(counts)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return viewerCounts
}
