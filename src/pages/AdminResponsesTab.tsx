import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { linkify } from '../lib/linkify'
import type { Question, ResponseRow } from '../types'

interface ReaderStat {
  total_count: number
  replied_count: number
}

export default function AdminResponsesTab({
  selectedQuestionId = 'all',
  onSelectQuestion,
}: {
  selectedQuestionId?: string
  onSelectQuestion?: (id: string) => void
}) {
  const [questions, setQuestions] = useState<Question[]>([])
  const filter = selectedQuestionId
  const [statusFilter, setStatusFilter] = useState<'pending' | 'answered' | 'all'>('pending')
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [publishing, setPublishing] = useState<string | null>(null)

  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const limit = 20

  const [readerStats, setReaderStats] = useState<Record<string, ReaderStat>>({})

  useEffect(() => {
    supabase.from('questions').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setQuestions(data ?? [])
    })
  }, [])

  useEffect(() => {
    if (filter !== 'all') {
      supabase
        .from('questions')
        .update({ last_viewed_at: new Date().toISOString() })
        .eq('id', filter)
        .then()
    }
  }, [filter])

  const loadReaderStats = useCallback(async () => {
    if (filter === 'all') {
      setReaderStats({})
      return
    }
    const { data } = await supabase.rpc('get_reader_stats_for_question', {
      p_question_id: filter,
    })
    const map: Record<string, ReaderStat> = {}
    if (data) {
      for (const row of data as { reader_email: string; total_count: number; replied_count: number }[]) {
        map[row.reader_email] = { total_count: row.total_count, replied_count: row.replied_count }
      }
    }
    setReaderStats(map)
  }, [filter])

  async function loadResponses(currentOffset = 0, isLoadMore = false, customLimit?: number) {
    if (!isLoadMore) setLoading(true)
    else setLoadingMore(true)
    
    const fetchLimit = customLimit ?? limit

    let query = supabase
      .from('responses')
      .select('*')
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + fetchLimit - 1)

    if (filter !== 'all') {
      query = query.eq('question_id', filter)
    }

    if (statusFilter === 'pending') {
      query = query.is('reply_text', null)
    } else if (statusFilter === 'answered') {
      query = query.not('reply_text', 'is', null)
    }

    const { data: rs } = await query
    const list = (rs as ResponseRow[]) ?? []

    if (isLoadMore) {
      setResponses(prev => {
        const existing = new Set(prev.map(p => p.id))
        const newItems = list.filter(n => !existing.has(n.id))
        return [...prev, ...newItems]
      })
    } else {
      setResponses(list)
    }

    setHasMore(list.length === fetchLimit)
    if (!isLoadMore) setLoading(false)
    else setLoadingMore(false)
  }

  useEffect(() => {
    setOffset(0)
    loadResponses(0, false)
    loadReaderStats()
  }, [filter, statusFilter, loadReaderStats])

  useEffect(() => {
    const channel = supabase
      .channel(`admin-responses-${filter}-${statusFilter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, () => {
        setOffset(prev => {
          loadResponses(0, false, prev + limit)
          return prev
        })
        loadReaderStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [filter, statusFilter, loadReaderStats])

  function loadMore() {
    const nextOffset = offset + limit
    setOffset(nextOffset)
    loadResponses(nextOffset, true)
  }

  async function publish(response: ResponseRow) {
    const reply = (replyDrafts[response.id] || '').trim()
    if (!reply) return
    setPublishing(response.id)
    const { error } = await supabase
      .from('responses')
      .update({ reply_text: reply, replied_at: new Date().toISOString() })
      .eq('id', response.id)
      .is('reply_text', null) // belt-and-braces: only ever reply once, matching the RLS policy
    setPublishing(null)
    if (!error) {
      loadResponses(0, false, offset + limit)
      loadReaderStats()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-wa-muted">Question</label>
          <select
            value={filter}
            onChange={(e) => onSelectQuestion?.(e.target.value)}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm outline-none bg-white"
          >
            <option value="all">All questions</option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.question_text.slice(0, 40)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-wa-muted">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm outline-none bg-white"
          >
            <option value="pending">Pending</option>
            <option value="answered">Answered</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {loading && <p className="text-sm text-wa-muted">Loading…</p>}
      {!loading && responses.length === 0 && <p className="text-sm text-wa-muted">No responses here yet.</p>}

      <ul className="space-y-3">
        {responses.map((r) => {
          const stats = readerStats[r.reader_email]
          const displayName = r.reader_name || 'This reader'

          return (
            <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <p className="text-sm font-medium text-wa-ink">{r.reader_name || 'Anonymous Reader'}</p>
                <p className="text-[11px] text-wa-muted">{r.reader_email}</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-wa-ink">{r.message}</p>

              {r.reply_text ? (
                <div className="mt-3 rounded-lg bg-wa-outgoing p-3">
                  <p className="text-xs font-semibold text-wa-teal">Published reply</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-wa-ink">{linkify(r.reply_text)}</p>
                </div>
              ) : (
                <div className="mt-3">
                  {stats && stats.total_count > 1 && (
                    <p className="mb-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-700">
                      📋 {displayName} has sent {stats.total_count} message{stats.total_count === 1 ? '' : 's'} for this question
                      {stats.replied_count > 0 && (
                        <> · {stats.replied_count} already replied</>
                      )}
                    </p>
                  )}
                  <p className="mb-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                    This will publish the response text and your reply publicly — the reader's name and
                    email stay private.
                  </p>
                  <textarea
                    value={replyDrafts[r.id] || ''}
                    onChange={(e) => setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    placeholder="Write your public reply…"
                    rows={2}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-wa-teal"
                  />
                  <button
                    onClick={() => publish(r)}
                    disabled={publishing === r.id || !(replyDrafts[r.id] || '').trim()}
                    className="mt-2 rounded-lg bg-wa-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {publishing === r.id ? 'Publishing…' : 'Reply & Publish'}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {hasMore && responses.length > 0 && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-semibold text-wa-ink shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
