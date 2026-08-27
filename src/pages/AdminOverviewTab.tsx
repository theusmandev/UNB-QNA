import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface LoyalReader {
  reader_name: string | null
  reader_email: string
  response_count: number
}

interface OverviewStats {
  total_questions: number
  active_questions: number
  unique_readers: number
  published_replies: number
  pending_replies: number
  total_updates: number
  loyal_readers: LoyalReader[]
}

export default function AdminOverviewTab() {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_admin_overview_stats')
      if (!error && data) {
        setStats(data as OverviewStats)
      }
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('admin-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'updates' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading || !stats) return <p className="text-sm text-wa-muted">Loading…</p>

  const averageResponsesPerQuestion = stats.total_questions > 0
    ? ((stats.published_replies + stats.pending_replies) / stats.total_questions).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-wa-ink">{stats.total_questions}</p>
          <p className="text-xs text-wa-muted">{stats.active_questions} active</p>
          <p className="mt-1 text-[11px] font-medium text-wa-teal uppercase tracking-wider">Total Questions</p>
        </div>
        
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-wa-ink">{stats.unique_readers}</p>
          <p className="text-xs text-wa-muted">Unique emails</p>
          <p className="mt-1 text-[11px] font-medium text-wa-teal uppercase tracking-wider">Total Readers</p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-wa-ink">{stats.published_replies}</p>
          <p className="text-xs text-wa-muted">{stats.pending_replies} pending</p>
          <p className="mt-1 text-[11px] font-medium text-wa-teal uppercase tracking-wider">Total Replies</p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-wa-ink">{stats.total_updates}</p>
          <p className="text-xs text-wa-muted">Published</p>
          <p className="mt-1 text-[11px] font-medium text-wa-teal uppercase tracking-wider">Total Updates</p>
        </div>
        
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-wa-ink">{averageResponsesPerQuestion}</p>
          <p className="text-xs text-wa-muted">Overall average</p>
          <p className="mt-1 text-[11px] font-medium text-wa-teal uppercase tracking-wider">Responses / Question</p>
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-wa-ink">Top Loyal Readers</h2>
        {stats.loyal_readers.length === 0 && <p className="text-sm text-wa-muted">No responses yet.</p>}
        
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {stats.loyal_readers.map((r, index) => {
              const rank = index + 1;
              let rankStyle = "bg-gray-100 text-gray-500" // default
              if (rank === 1) rankStyle = "bg-yellow-100 text-yellow-700 font-bold"
              else if (rank === 2) rankStyle = "bg-gray-200 text-gray-600 font-bold"
              else if (rank === 3) rankStyle = "bg-orange-100 text-orange-800 font-bold"
              
              return (
                <li key={r.reader_email} className="flex items-center justify-between p-3 sm:px-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${rankStyle}`}>
                      {rank}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-wa-ink">
                        {r.reader_name || 'Anonymous Reader'}
                      </p>
                      <p className="truncate text-[11px] text-wa-muted">
                        {r.reader_email}
                      </p>
                    </div>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="text-sm font-semibold text-wa-teal">
                      {r.response_count}
                    </p>
                    <p className="text-[10px] text-wa-muted">messages</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
