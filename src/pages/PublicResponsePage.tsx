import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLocalIdentity } from '../hooks/useLocalIdentity'
import Header from '../components/Header'
import ChatBubble from '../components/ChatBubble'
import ComposeBar from '../components/ComposeBar'
import IdentityModal from '../components/IdentityModal'
import type { PublicFeedItem, Question, VisitorIdentity } from '../types'

export default function PublicResponsePage() {
  const { slug = '' } = useParams()
  const { identity, saveIdentity, pending, addPending } = useLocalIdentity(slug)

  const [question, setQuestion] = useState<Question | null | undefined>(undefined) // undefined = loading
  const [feed, setFeed] = useState<PublicFeedItem[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [showIdentityModal, setShowIdentityModal] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data: q, error: qErr } = await supabase
      .from('questions')
      .select('id, slug, question_text, is_active, created_at')
      .eq('slug', slug)
      .maybeSingle()

    if (qErr || !q) {
      setQuestion(null)
      return
    }
    setQuestion(q as Question)

    const [{ data: feedData }, { data: countData }] = await Promise.all([
      supabase.rpc('get_public_feed', { p_slug: slug }),
      supabase.rpc('get_response_count', { p_slug: slug }),
    ])

    setFeed((feedData as PublicFeedItem[]) ?? [])
    if (typeof countData === 'number') setCount(countData)
  }, [slug])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [feed.length, pending.length])

  async function submitResponse(message: string, id: VisitorIdentity) {
    if (!question) return
    setError(null)
    // IMPORTANT: no .select()/.single() after .insert() for anonymous inserts —
    // RLS would evaluate the SELECT policy on the returned row and reject it
    // even though the insert itself is allowed. Update the UI from local state instead.
    const { error: insertError } = await supabase.from('responses').insert({
      question_id: question.id,
      reader_email: id.email,
      reader_name: id.name,
      message,
    })

    if (insertError) {
      setError('Could not send your message. Please try again.')
      return
    }

    addPending(message)
    setCount((c) => (c === null ? null : c + 1))
  }

  function handleSend(message: string) {
    if (!identity) {
      setPendingMessage(message)
      setShowIdentityModal(true)
      return
    }
    return submitResponse(message, identity)
  }

  function handleIdentityConfirm(id: VisitorIdentity) {
    saveIdentity(id)
    setShowIdentityModal(false)
    if (pendingMessage) {
      submitResponse(pendingMessage, id)
      setPendingMessage(null)
    }
  }

  if (question === undefined) {
    return (
      <div className="flex h-screen items-center justify-center text-wa-muted text-sm">Loading…</div>
    )
  }

  if (question === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-lg font-semibold text-wa-ink">This link isn't available</p>
        <p className="text-sm text-wa-muted">The question may have been removed or is no longer active.</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <Header
        subtitle={count !== null ? `${count} response${count === 1 ? '' : 's'}` : 'Channel'}
      />

      <div className="chat-wallpaper flex-1 overflow-y-auto py-3">
        {/* Original question, styled like a channel announcement */}
        <div className="mx-auto max-w-xl px-3">
          <div className="rounded-lg bg-[#FCF3D7] px-3 py-2.5 shadow-bubble">
            <p className="text-xs font-semibold text-wa-teal">Question</p>
            <p
              dir={/[\u0600-\u06FF]/.test(question.question_text) ? 'rtl' : 'ltr'}
              className={
                /[\u0600-\u06FF]/.test(question.question_text)
                  ? 'urdu-text mt-0.5 text-right text-wa-ink'
                  : 'mt-0.5 text-left text-[0.95rem] leading-relaxed text-wa-ink'
              }
            >
              {question.question_text}
            </p>
          </div>
        </div>

        <div className="mx-auto mt-2 max-w-xl">
          {feed.length === 0 && pending.length === 0 && (
            <p className="mt-8 px-6 text-center text-sm text-wa-muted">
              No answers published yet — be the first to ask.
            </p>
          )}

          {feed.map((item, i) => (
            <div key={i}>
              <ChatBubble variant="reader" text={item.message} label={item.reader_name || 'Anonymous'} />
              <ChatBubble
                variant="channel"
                text={item.reply_text}
                label="Urdu Novel Bank"
                timestamp={item.replied_at}
              />
            </div>
          ))}

          {pending.filter(pItem => !feed.some(fItem => fItem.message === pItem.message)).map((item, i) => (
            <ChatBubble key={`pending-${i}`} variant="reader-pending" text={item.message} showTick />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {error && <p className="bg-red-50 px-4 py-1.5 text-center text-xs text-red-600">{error}</p>}

      {question.is_active ? (
        <ComposeBar onSend={handleSend} />
      ) : (
        <div className="border-t border-black/5 bg-[#F0F0F0] px-4 py-3 text-center text-xs text-wa-muted">
          This question is no longer accepting new responses.
        </div>
      )}

      {showIdentityModal && (
        <IdentityModal
          onConfirm={handleIdentityConfirm}
          onCancel={() => {
            setShowIdentityModal(false)
            setPendingMessage(null)
          }}
        />
      )}
    </div>
  )
}
