import { useEffect, useState, useCallback } from 'react'
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

  // Filter States
  const [globalTime, setGlobalTime] = useState<'today' | 'last_7_days' | 'last_30_days' | 'all_time'>('all_time')
  const [questionStatus, setQuestionStatus] = useState<'all' | 'active' | 'inactive'>('all')
  
  const [leaderboardTime, setLeaderboardTime] = useState<'this_week' | 'this_month' | 'all_time'>('all_time')
  const [readerType, setReaderType] = useState<'all' | 'named' | 'anonymous'>('all')

  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupResults, setLookupResults] = useState<any[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lookupEmail.trim()) return
    setIsSearching(true)
    const { data, error } = await supabase.rpc('get_reader_history', {
      p_email: lookupEmail.trim()
    })
    setIsSearching(false)
    if (!error && data) {
      setLookupResults(data)
    } else {
      setLookupResults([])
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_admin_overview_stats', {
      p_time_global: globalTime,
      p_time_leaderboard: leaderboardTime,
      p_question_status: questionStatus,
      p_reader_type: readerType
    })
    
    if (!error && data) {
      setStats(data as OverviewStats)
    }
    setLoading(false)
  }, [globalTime, leaderboardTime, questionStatus, readerType])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('admin-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'updates' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  if (!stats) return <p className="text-sm text-wa-muted">Loading…</p>

  return (
    <div className="space-y-6">
      
      {/* Zone A Filters: Global Stats */}
      <div className="flex flex-wrap items-center gap-4 border-b border-black/5 pb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-wa-muted">Time</label>
          <select
            value={globalTime}
            onChange={(e) => setGlobalTime(e.target.value as any)}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm outline-none bg-white focus:border-wa-teal focus:ring-1 focus:ring-wa-teal"
          >
            <option value="today">Today</option>
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="all_time">All time</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-wa-muted">Questions</label>
          <select
            value={questionStatus}
            onChange={(e) => setQuestionStatus(e.target.value as any)}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm outline-none bg-white focus:border-wa-teal focus:ring-1 focus:ring-wa-teal"
          >
            <option value="all">All</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
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
      </div>

      {/* Reader Email Lookup */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-wa-ink mb-3">Reader History Lookup</h2>
        <form onSubmit={handleLookup} className="flex gap-2 mb-4">
          <input
            type="email"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            placeholder="Enter reader email address..."
            className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-wa-teal focus:ring-1 focus:ring-wa-teal"
            required
          />
          <button
            type="submit"
            disabled={isSearching}
            className="rounded-lg bg-wa-teal px-4 py-2 text-sm font-semibold text-white hover:bg-wa-teal/90 disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {lookupResults !== null && (
          <div className="mt-4 border-t border-black/5 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-wa-muted uppercase tracking-wider">
                {lookupResults.length} Result{lookupResults.length !== 1 && 's'}
              </h3>
              <button 
                onClick={() => setLookupResults(null)}
                className="text-xs text-wa-teal hover:underline"
              >
                Clear
              </button>
            </div>
            
            {lookupResults.length === 0 ? (
              <p className="text-sm text-wa-muted">No history found for this email.</p>
            ) : (
              <ul className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                {lookupResults.map((r, i) => (
                  <li key={r.response_id || i} className="rounded-lg border border-black/5 p-3">
                    <p className="text-[11px] font-medium text-wa-muted mb-1.5 flex justify-between">
                      <span>In response to: {r.question_text}</span>
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </p>
                    <p className="text-sm text-wa-ink whitespace-pre-wrap">{r.message}</p>
                    
                    {r.reply_text && (
                      <div className="mt-2 ml-4 rounded-lg bg-wa-outgoing p-3">
                        <p className="text-[10px] font-semibold text-wa-teal mb-0.5 flex justify-between">
                          <span>Admin Reply</span>
                          {r.replied_at && <span>{new Date(r.replied_at).toLocaleDateString()}</span>}
                        </p>
                        <p className="text-sm text-wa-ink whitespace-pre-wrap">{r.reply_text}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="pt-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-wa-ink">Top Loyal Readers</h2>
          
          {/* Zone B Filters: Leaderboard Stats */}
          <div className="flex items-center gap-3">
            <select
              value={readerType}
              onChange={(e) => setReaderType(e.target.value as any)}
              className="rounded-lg border border-black/10 px-2 py-1 text-xs outline-none bg-white focus:border-wa-teal"
            >
              <option value="all">All readers</option>
              <option value="named">Named only</option>
              <option value="anonymous">Anonymous only</option>
            </select>
            <select
              value={leaderboardTime}
              onChange={(e) => setLeaderboardTime(e.target.value as any)}
              className="rounded-lg border border-black/10 px-2 py-1 text-xs outline-none bg-white focus:border-wa-teal"
            >
              <option value="all_time">All time</option>
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
            </select>
          </div>
        </div>

        <div className={`overflow-hidden rounded-xl bg-white shadow-sm transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
          {stats.loyal_readers.length === 0 ? (
            <p className="p-4 text-sm text-wa-muted">No responses match these filters.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {stats.loyal_readers.map((r, index) => {
                const rank = index + 1;
                let rankStyle = "bg-gray-100 text-gray-500" // default
                if (rank === 1) rankStyle = "bg-yellow-100 text-yellow-700 font-bold shadow-sm"
                else if (rank === 2) rankStyle = "bg-gray-200 text-gray-600 font-bold shadow-sm"
                else if (rank === 3) rankStyle = "bg-orange-100 text-orange-800 font-bold shadow-sm"
                
                return (
                  <li key={r.reader_email} className="flex items-center justify-between p-3 sm:px-4 hover:bg-gray-50/50 transition-colors">
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
          )}
        </div>
      </div>
    </div>
  )
}
