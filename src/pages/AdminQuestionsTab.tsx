import { useEffect, useState } from 'react'
import { publicBaseUrl, supabase } from '../lib/supabase'
import { slugify } from '../lib/slug'
import type { Question } from '../types'

interface QuestionWithCount extends Question {
  response_count: number
  unread_count: number
}

export default function AdminQuestionsTab({ onViewResponses }: { onViewResponses?: (id: string) => void }) {
  const [questions, setQuestions] = useState<QuestionWithCount[]>([])
  const [newText, setNewText] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: qs } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false })

    const list = (qs as Question[]) ?? []
    const withCounts: QuestionWithCount[] = await Promise.all(
      list.map(async (q) => {
        const { count } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('question_id', q.id)
        
        let unreadCount = count ?? 0
        if (q.last_viewed_at) {
          const { count: unread } = await supabase
            .from('responses')
            .select('*', { count: 'exact', head: true })
            .eq('question_id', q.id)
            .gt('created_at', q.last_viewed_at)
          unreadCount = unread ?? 0
        }
        
        return { ...q, response_count: count ?? 0, unread_count: unreadCount }
      })
    )
    setQuestions(withCounts)
    setLoading(false)
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('admin-questions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function handleCreate() {
    const text = newText.trim()
    if (!text || creating) return
    setCreating(true)
    const slug = slugify(text)
    const { error } = await supabase.from('questions').insert({ slug, question_text: text })
    setCreating(false)
    if (!error) {
      setNewText('')
      load()
    }
  }

  async function toggleActive(q: QuestionWithCount) {
    await supabase.from('questions').update({ is_active: !q.is_active }).eq('id', q.id)
    load()
  }

  async function handleDelete(q: QuestionWithCount) {
    if (!confirm(`Delete this question and all ${q.response_count} response(s)? This can't be undone.`)) return
    await supabase.from('questions').delete().eq('id', q.id)
    load()
  }

  function copyLink(slug: string) {
    const url = `${publicBaseUrl}/r/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 1500)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-wa-ink">Ask a new question</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="What would you like readers to answer?"
            className="flex-1 rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-wa-teal"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newText.trim()}
            className="rounded-lg bg-wa-teal px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {creating ? 'Posting…' : 'Post question'}
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-wa-ink">All questions</h2>
        {loading && <p className="text-sm text-wa-muted">Loading…</p>}
        {!loading && questions.length === 0 && <p className="text-sm text-wa-muted">No questions yet.</p>}
        <ul className="space-y-2">
          {questions.map((q) => (
            <li key={q.id} className="rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-wa-ink">{q.question_text}</p>
                <div className="flex items-center gap-2">
                  {q.unread_count > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
                      {q.unread_count}
                    </span>
                  )}
                  <span
                    className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      q.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {q.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-wa-muted">
                {q.response_count} response{q.response_count === 1 ? '' : 's'} · /r/{q.slug}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => onViewResponses?.(q.id)}
                  className="rounded-lg bg-wa-teal px-2.5 py-1 text-xs font-medium text-white shadow-sm"
                >
                  View responses
                </button>
                <button
                  onClick={() => copyLink(q.slug)}
                  className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium text-wa-ink"
                >
                  {copiedSlug === q.slug ? 'Copied!' : 'Copy link'}
                </button>
                <button
                  onClick={() => toggleActive(q)}
                  className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium text-wa-ink"
                >
                  {q.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(q)}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
