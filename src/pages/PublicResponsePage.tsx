import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLocalIdentity } from '../hooks/useLocalIdentity'
import { formatSimpleDate } from '../lib/date'
import { channelName } from '../lib/supabase'
import Header from '../components/Header'
import ChatBubble from '../components/ChatBubble'
import ComposeBar from '../components/ComposeBar'
import IdentityModal from '../components/IdentityModal'
import { isUrdu } from '../lib/isUrdu'
import type { PublicFeedItem, Question, VisitorIdentity } from '../types'

export default function PublicResponsePage() {
  const { slug = '' } = useParams()
  const { identity, saveIdentity, pending, addPending } = useLocalIdentity(slug)

  const [question, setQuestion] = useState<Question | null | undefined>(undefined) // undefined = loading
  const [feed, setFeed] = useState<PublicFeedItem[]>([])
  const [myReactions, setMyReactions] = useState<Record<string, string[]>>({})
  const [count, setCount] = useState<number | null>(null)
  const [showIdentityModal, setShowIdentityModal] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const forceScrollRef = useRef(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const prevFeedLength = useRef(0)
  const prevPendingLength = useRef(0)

  function handleScroll() {
    if (!scrollContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150
    isNearBottomRef.current = isNearBottom
    if (isNearBottom) {
      setUnreadCount(c => c > 0 ? 0 : c)
    }
  }

  const load = useCallback(async () => {
    const { data: q, error: qErr } = await supabase
      .from('questions')
      .select('id, slug, question_text, is_active, accepting_responses, created_at, icon_emoji, sender_name')
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

    const loadedFeed = (feedData as PublicFeedItem[]) ?? []
    setFeed(loadedFeed)
    if (typeof countData === 'number') setCount(countData)

    if (identity?.email) {
      // Need visitor ID which is hash of email/userAgent
      // The easiest way is to use identity but we don't have visitorId directly here without calling the hook with 'public'
      // Wait, useLocalIdentity returns visitorId as well!
    }

    try {
      const viewed = JSON.parse(localStorage.getItem('unb_viewed_counts') || '{}')
      viewed[slug] = loadedFeed.length
      localStorage.setItem('unb_viewed_counts', JSON.stringify(viewed))
    } catch {
      // ignore localStorage errors
    }
  }, [slug])

  // We need visitorId to load reactions.
  const { visitorId } = useLocalIdentity(slug)

  const loadReactions = useCallback(async () => {
    if (!visitorId || feed.length === 0) return
    const responseIds = feed.map(f => f.id).filter(Boolean)
    if (responseIds.length === 0) return

    const { data: myReacts } = await supabase
      .from('response_reactions')
      .select('response_id, reaction')
      .eq('visitor_id', visitorId)
      .in('response_id', responseIds)
    
    const reactMap: Record<string, string[]> = {}
    myReacts?.forEach((r) => {
      if (!reactMap[r.response_id]) reactMap[r.response_id] = []
      reactMap[r.response_id].push(r.reaction)
    })
    setMyReactions(reactMap)
  }, [visitorId, feed])

  useEffect(() => {
    loadReactions()
  }, [loadReactions])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    
    const channel = supabase
      .channel(`public-feed-${slug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'response_reactions' }, load)
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [load, slug])

  useEffect(() => {
    const newItems =
      (feed.length - prevFeedLength.current) +
      (pending.length - prevPendingLength.current)
    const isFirstLoad = prevFeedLength.current === 0 && prevPendingLength.current === 0

    prevFeedLength.current = feed.length
    prevPendingLength.current = pending.length

    if (forceScrollRef.current || isNearBottomRef.current) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }, 100)
      forceScrollRef.current = false
      setUnreadCount(0)
    } else if (newItems > 0 && !isFirstLoad) {
      setUnreadCount((c) => c + newItems)
    }
  }, [feed.length, pending.length])

  async function handleReact(responseId: string, reaction: string) {
    if (!visitorId) return

    const hasReacted = myReactions[responseId]?.includes(reaction)
    
    // Optimistic UI
    setMyReactions((prev) => {
      const next = { ...prev }
      if (!next[responseId]) next[responseId] = []
      if (hasReacted) {
        next[responseId] = next[responseId].filter(r => r !== reaction)
      } else {
        next[responseId] = [...next[responseId], reaction]
      }
      return next
    })

    setFeed((prev) => 
      prev.map(f => {
        if (f.id === responseId) {
          const nextReactions = { ...(f.reactions || {}) }
          const currentCount = nextReactions[reaction] || 0
          if (hasReacted) {
            nextReactions[reaction] = Math.max(0, currentCount - 1)
          } else {
            nextReactions[reaction] = currentCount + 1
          }
          return { ...f, reactions: nextReactions }
        }
        return f
      })
    )

    await supabase.rpc('toggle_response_reaction', {
      p_response_id: responseId,
      p_visitor_id: visitorId,
      p_reaction: reaction
    })
  }

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

    forceScrollRef.current = true
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
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <Header
        title={question.sender_name || channelName}
        subtitle={count !== null ? `${count} response${count === 1 ? '' : 's'}` : 'Channel'}
        icon={question.icon_emoji}
        showBack={true}
      />

      <div className="relative flex-1 flex flex-col min-h-0">
        <div ref={scrollContainerRef} onScroll={handleScroll} className="chat-wallpaper flex-1 overflow-y-auto py-3">
        {/* Original question, styled like a channel announcement */}
        <div className="mx-auto max-w-xl px-3">
          <div className="rounded-lg bg-[#FCF3D7] px-3 py-2.5 shadow-bubble">
            <p className="text-xs font-semibold text-wa-teal">Question</p>
            <p
              dir="auto"
              style={{ unicodeBidi: 'plaintext' }}
              className={`text-[15px] leading-relaxed break-words whitespace-pre-wrap text-wa-ink
                ${isUrdu(question.question_text) ? 'urdu-text mt-0.5' : ''}`}
            >
              {question.question_text}
            </p>
            <div className="mt-1 flex items-center justify-end">
              <span className="text-[10px] text-black/40">
                Posted on {formatSimpleDate(question.created_at)}
              </span>
            </div>
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
                id={item.id}
                variant="channel"
                text={item.reply_text}
                label={question.sender_name || channelName}
                timestamp={item.replied_at}
                reactions={item.reactions}
                myReactions={item.id ? myReactions[item.id] : []}
                onReact={handleReact}
              />
            </div>
          ))}

          {pending.filter(pItem => !feed.some(fItem => fItem.message === pItem.message)).map((item, i) => (
            <ChatBubble key={`pending-${i}`} variant="reader-pending" text={item.message} showTick />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {unreadCount > 0 && (
        <button
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
            setUnreadCount(0)
          }}
          className="absolute bottom-[80px] right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-wa-teal shadow-md border border-gray-100 hover:bg-gray-50 focus:outline-none"
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-wa-teal text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount}
          </span>
        </button>
      )}
    </div>

      {error && <p className="bg-red-50 px-4 py-1.5 text-center text-xs text-red-600">{error}</p>}

      {question.accepting_responses ? (
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
