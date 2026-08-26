import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { channelName, supabase } from '../lib/supabase'
import { formatSimpleDate } from '../lib/date'
import Header from '../components/Header'
import type { ActiveQuestionWithCount } from '../types'

export default function Home() {
  const [questions, setQuestions] = useState<ActiveQuestionWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('get_active_questions_with_counts')
      setQuestions((data as ActiveQuestionWithCount[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white">
      <Header subtitle="Response Collector" />

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-wa-muted">
            Loading…
          </div>
        ) : questions.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-wa-muted">
            No active questions at the moment.
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {questions.map((q) => {
              let unreadCount = 0
              if (q.published_reply_count > 0) {
                try {
                  const viewed = JSON.parse(localStorage.getItem('unb_viewed_counts') || '{}')
                  unreadCount = Math.max(0, q.published_reply_count - (viewed[q.slug] || 0))
                } catch {
                  unreadCount = q.published_reply_count
                }
              }

              return (
                <li
                  key={q.slug}
                  onClick={() => navigate(`/r/${q.slug}`)}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100"
                >
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-wa-header text-xl font-semibold text-white">
                    {channelName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p 
                        dir={/[\u0600-\u06FF]/.test(q.question_text) ? 'rtl' : 'ltr'}
                        className={`truncate text-[15px] font-semibold text-wa-ink ${
                          /[\u0600-\u06FF]/.test(q.question_text) ? 'urdu-text text-right' : 'text-left'
                        }`}
                      >
                        {q.question_text}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="text-[13px] text-wa-muted">
                          {q.response_count} response{q.response_count === 1 ? '' : 's'}
                        </p>
                        {q.accepting_responses && (
                          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-none flex-col items-end justify-center gap-1">
                      <span className="text-[11px] text-wa-muted">{formatSimpleDate(q.created_at)}</span>
                      {unreadCount > 0 ? (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
                          {unreadCount}
                        </span>
                      ) : (
                        <div className="h-5" />
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      
      <div className="bg-[#F0F0F0] py-3 text-center border-t border-black/5">
        <Link to="/admin/login" className="text-xs font-medium text-wa-muted hover:text-wa-teal transition-colors">
          Admin access
        </Link>
      </div>
    </div>
  )
}
