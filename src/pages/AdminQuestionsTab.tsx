import { useEffect, useState } from 'react'
import { publicBaseUrl, supabase } from '../lib/supabase'
import { formatSimpleDate } from '../lib/date'
import { slugify } from '../lib/slug'
import type { Question } from '../types'

interface QuestionWithCount extends Question {
  response_count: number
  unread_count: number
}

export default function AdminQuestionsTab({ onViewResponses }: { onViewResponses?: (id: string) => void }) {
  const [questions, setQuestions] = useState<QuestionWithCount[]>([])
  const [newText, setNewText] = useState('')
  const [customSlug, setCustomSlug] = useState('')
  const [iconEmoji, setIconEmoji] = useState('')
  const [slugError, setSlugError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const limit = 20

  async function load(currentOffset = 0, isLoadMore = false, customLimit?: number) {
    if (!isLoadMore) setLoading(true)
    else setLoadingMore(true)
    
    const fetchLimit = customLimit ?? limit

    const { data: qs } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + fetchLimit - 1)

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
    
    if (isLoadMore) {
      setQuestions(prev => {
        const existingIds = new Set(prev.map(p => p.id))
        const newItems = withCounts.filter(n => !existingIds.has(n.id))
        return [...prev, ...newItems]
      })
    } else {
      setQuestions(withCounts)
    }
    
    setHasMore(list.length === fetchLimit)
    if (!isLoadMore) setLoading(false)
    else setLoadingMore(false)
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('admin-questions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => {
        setOffset(prev => {
          load(0, false, prev + limit)
          return prev
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, () => {
        setOffset(prev => {
          load(0, false, prev + limit)
          return prev
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  function loadMore() {
    const nextOffset = offset + limit
    setOffset(nextOffset)
    load(nextOffset, true)
  }

  async function handleCreate() {
    setSlugError(null)
    const text = newText.trim()
    if (!text || creating) return

    let finalSlug = ''
    if (customSlug.trim()) {
      const normalized = customSlug.trim().toLowerCase().replace(/\s+/g, '-')
      if (!/^[a-z0-9-]+$/.test(normalized)) {
        setSlugError("Link can only contain lowercase letters, numbers, and hyphens.")
        return
      }
      finalSlug = normalized
    } else {
      finalSlug = slugify(text)
    }

    setCreating(true)
    const { error } = await supabase.from('questions').insert({ 
      slug: finalSlug, 
      question_text: text,
      icon_emoji: iconEmoji.trim() || null
    })
    setCreating(false)
    
    if (error) {
      if (error.code === '23505') {
        setSlugError("This link is already taken, try another.")
      } else {
        setSlugError("An error occurred while creating the question.")
      }
      return
    }
    
    setNewText('')
    setCustomSlug('')
    setIconEmoji('')
    load()
  }

  async function toggleActive(q: QuestionWithCount) {
    await supabase.from('questions').update({ is_active: !q.is_active }).eq('id', q.id)
    load()
  }

  async function togglePin(q: QuestionWithCount) {
    const { error } = await supabase
      .from('questions')
      .update({ is_pinned: !q.is_pinned, pinned_at: !q.is_pinned ? new Date().toISOString() : null })
      .eq('id', q.id)
      
    if (error) {
      alert(error.message)
    } else {
      load()
    }
  }

  async function toggleAccepting(q: QuestionWithCount) {
    await supabase.from('questions').update({ accepting_responses: !q.accepting_responses }).eq('id', q.id)
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
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="What would you like readers to answer?"
              className="flex-1 rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-wa-teal"
            />
            <input
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
              placeholder="Custom link (optional)"
              className="sm:w-48 rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-wa-teal"
            />
            <input
              value={iconEmoji}
              onChange={(e) => setIconEmoji(e.target.value)}
              placeholder="Emoji"
              maxLength={5}
              className="w-16 text-center rounded-lg border border-black/10 px-2 py-2.5 text-sm outline-none focus:border-wa-teal"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newText.trim()}
              className="rounded-lg bg-wa-teal px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {creating ? 'Posting…' : 'Post question'}
            </button>
          </div>
          {slugError && <p className="text-xs font-medium text-red-600">{slugError}</p>}
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
                  {!q.accepting_responses && (
                    <span className="flex-none rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      Closed to new responses
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
                {q.response_count} response{q.response_count === 1 ? '' : 's'} · /r/{q.slug} · Posted {formatSimpleDate(q.created_at)}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAccepting(q)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      q.accepting_responses ? 'bg-wa-teal' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      q.accepting_responses ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                  <span className="text-xs font-medium text-wa-ink">Accepting responses</span>
                </div>
                <div className="flex flex-wrap gap-2">
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
                    onClick={() => togglePin(q)}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                      q.is_pinned 
                        ? 'border-wa-teal bg-wa-teal/10 text-wa-teal' 
                        : 'border-black/10 text-wa-ink'
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={q.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                    </svg>
                    {q.is_pinned ? 'Pinned' : 'Pin'}
                  </button>
                  <button
                    onClick={() => handleDelete(q)}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {hasMore && questions.length > 0 && (
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
    </div>
  )
}
