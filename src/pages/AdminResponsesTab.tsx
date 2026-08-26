import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { linkify } from '../lib/linkify'
import type { Question, ResponseRow } from '../types'

export default function AdminResponsesTab({
  selectedQuestionId = 'all',
  onSelectQuestion,
}: {
  selectedQuestionId?: string
  onSelectQuestion?: (id: string) => void
}) {
  const [questions, setQuestions] = useState<Question[]>([])
  const filter = selectedQuestionId
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [publishing, setPublishing] = useState<string | null>(null)

  useEffect(() => {
    if (filter !== 'all') {
      supabase
        .from('questions')
        .update({ last_viewed_at: new Date().toISOString() })
        .eq('id', filter)
        .then()
    }
  }, [filter])

  async function load() {
    setLoading(true)
    const [{ data: qs }, { data: rs }] = await Promise.all([
      supabase.from('questions').select('*').order('created_at', { ascending: false }),
      supabase.from('responses').select('*').order('created_at', { ascending: false }),
    ])
    setQuestions((qs as Question[]) ?? [])
    setResponses((rs as ResponseRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('admin-responses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const visible = filter === 'all' ? responses : responses.filter((r) => r.question_id === filter)

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
      load()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-wa-muted">Question</label>
        <select
          value={filter}
          onChange={(e) => onSelectQuestion?.(e.target.value)}
          className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm outline-none"
        >
          <option value="all">All questions</option>
          {questions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.question_text.slice(0, 40)}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-wa-muted">Loading…</p>}
      {!loading && visible.length === 0 && <p className="text-sm text-wa-muted">No responses here yet.</p>}

      <ul className="space-y-3">
        {visible.map((r) => (
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
        ))}
      </ul>
    </div>
  )
}
