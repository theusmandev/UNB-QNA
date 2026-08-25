import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ResponseRow } from '../types'

export default function AdminOverviewTab() {
  const [questionCount, setQuestionCount] = useState<number | null>(null)
  const [responseCount, setResponseCount] = useState<number | null>(null)
  const [recent, setRecent] = useState<ResponseRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ count: qCount }, { count: rCount }, { data: recentData }] = await Promise.all([
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('responses').select('*', { count: 'exact', head: true }),
        supabase
          .from('responses')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(8),
      ])
      setQuestionCount(qCount ?? 0)
      setResponseCount(rCount ?? 0)
      setRecent((recentData as ResponseRow[]) ?? [])
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('admin-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) return <p className="text-sm text-wa-muted">Loading…</p>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-wa-ink">{questionCount}</p>
          <p className="text-xs text-wa-muted">Questions</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-wa-ink">{responseCount}</p>
          <p className="text-xs text-wa-muted">Total responses</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-wa-ink">Recent responses</h2>
        {recent.length === 0 && <p className="text-sm text-wa-muted">No responses yet.</p>}
        <ul className="space-y-2">
          {recent.map((r) => (
            <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-wa-ink">{r.reader_name || 'Anonymous Reader'}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    r.reply_text ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {r.reply_text ? 'Published' : 'Awaiting reply'}
                </span>
              </div>
              <p className="text-[11px] text-wa-muted">{r.reader_email}</p>
              <p className="mt-1 line-clamp-2 text-sm text-wa-ink">{r.message}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
