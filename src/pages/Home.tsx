import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { channelName, supabase } from '../lib/supabase'
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
      <Header subtitle="Active Questions" />

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
            {questions.map((q) => (
              <li
                key={q.slug}
                onClick={() => navigate(`/r/${q.slug}`)}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100"
              >
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-wa-header text-xl font-semibold text-white">
                  {channelName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p 
                    dir={/[\u0600-\u06FF]/.test(q.question_text) ? 'rtl' : 'ltr'}
                    className={`truncate text-[15px] font-semibold text-wa-ink ${
                      /[\u0600-\u06FF]/.test(q.question_text) ? 'urdu-text text-right' : 'text-left'
                    }`}
                  >
                    {q.question_text}
                  </p>
                  <p className="mt-0.5 text-[13px] text-wa-muted">
                    {q.response_count} response{q.response_count === 1 ? '' : 's'}
                  </p>
                </div>
              </li>
            ))}
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
