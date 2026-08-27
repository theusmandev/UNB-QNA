import { useState, useRef, useEffect } from 'react'
import { isUrdu } from '../lib/isUrdu'
import { linkify } from '../lib/linkify'

type Variant = 'reader' | 'reader-pending' | 'channel'

interface ChatBubbleProps {
  id?: string
  text: string
  variant: Variant
  /** Shown above the bubble text — e.g. the channel name on admin replies. */
  label?: string
  timestamp?: string
  showTick?: boolean
  reactions?: Record<string, number>
  myReactions?: string[]
  onReact?: (id: string, reaction: string) => void
}

function formatTime(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '🙏']

export default function ChatBubble({ id, text, variant, label, timestamp, showTick, reactions, myReactions = [], onReact }: ChatBubbleProps) {
  const rtl = isUrdu(text)
  const isOutgoingSide = variant === 'channel'

  const bubbleColor =
    variant === 'channel' ? 'bg-wa-outgoing' : variant === 'reader-pending' ? 'bg-white/70' : 'bg-wa-incoming'

  // Long-press and double-tap state
  const [showPicker, setShowPicker] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTapRef = useRef<number>(0)
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (variant !== 'channel' || !id || !onReact) return
    // Only primary clicks/touches
    if (e.button !== 0 && e.pointerType === 'mouse') return
    
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      // Double tap detected
      setShowPicker(true)
      if (pressTimer.current) clearTimeout(pressTimer.current)
      return
    }
    lastTapRef.current = now
    
    pressTimer.current = setTimeout(() => {
      setShowPicker(true)
    }, 500)
  }

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (variant === 'channel' && id && onReact) {
      e.preventDefault()
      setShowPicker(true)
    }
  }

  // Calculate total reactions and top emojis
  const totalReactions = reactions ? Object.values(reactions).reduce((a, b) => a + b, 0) : 0
  
  let topEmojis: string[] = []
  if (reactions) {
    const validEntries = Object.entries(reactions).filter(([_, count]) => count > 0)
    
    validEntries.sort((a, b) => {
      const aIsMine = myReactions.includes(a[0])
      const bIsMine = myReactions.includes(b[0])
      
      if (aIsMine && !bIsMine) return -1
      if (!aIsMine && bIsMine) return 1
      
      // Fallback to sorting by count descending
      return b[1] - a[1]
    })
    
    topEmojis = validEntries.slice(0, 3).map(([emoji]) => emoji)
  }
  
  const hasMyReaction = myReactions.length > 0

  return (
    <>
      <div className={`flex w-full ${isOutgoingSide ? 'justify-end' : 'justify-start'} px-3 py-1 relative`}>
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={cancelPress}
          onPointerMove={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={handleContextMenu}
          style={
            variant === 'channel'
              ? {
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none', // TypeScript might complain about msUserSelect without casting, but React accepts it. Actually let's use standard React camelCase.
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties
              : {}
          }
          className={[
            'relative max-w-[82%] sm:max-w-[70%] rounded-lg px-3 py-2 shadow-bubble transition-transform active:scale-[0.98]',
            bubbleColor,
            isOutgoingSide ? 'bubble-tail-out' : 'bubble-tail-in',
            variant === 'reader-pending' ? 'border border-dashed border-wa-muted/40' : '',
          ].join(' ')}
        >
          {showPicker && (
            <div 
              className={`absolute -top-10 z-50 flex items-center gap-1 rounded-full bg-white px-2 py-1.5 shadow-lg border border-black/5 ${isOutgoingSide ? 'right-0' : 'left-0'}`}
              onPointerDown={(e) => e.stopPropagation()} // Prevent bubble press
            >
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowPicker(false)
                    if (id && onReact) onReact(id, emoji)
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xl hover:bg-gray-100 active:bg-gray-200 transition-colors ${myReactions.includes(emoji) ? 'bg-wa-teal/10' : ''}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {label && <p className="text-xs font-semibold text-wa-teal mb-0.5">{label}</p>}
          <p
            dir={rtl ? 'rtl' : 'ltr'}
            className={[
              'whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-wa-ink',
              rtl ? 'urdu-text text-right' : 'text-left',
            ].join(' ')}
          >
            {variant === 'channel' ? linkify(text) : text}
          </p>

          <div className={`mt-1 flex items-end justify-between gap-3`}>
            {/* Reaction Badge (Inline) */}
            {totalReactions > 0 ? (
              <div 
                onClick={(e) => {
                  if (variant === 'channel' && id && onReact) {
                    e.stopPropagation()
                    setShowPicker(true)
                  }
                }}
                className={`flex cursor-pointer items-center gap-1 rounded-full border-[1px] border-black/5 bg-white/60 px-1.5 py-[2px] shadow-sm ${hasMyReaction ? 'bg-blue-50/80 border-blue-200' : ''}`}
              >
                <div className="flex gap-1.5">
                  {topEmojis.map((emoji, i) => (
                    <span key={i} className="text-[12px] leading-none">{emoji}</span>
                  ))}
                </div>
                {totalReactions > 1 && (
                  <span className="text-[11px] font-medium text-wa-muted">{totalReactions}</span>
                )}
              </div>
            ) : (
              <div /> /* Empty div to push timestamp to the right if justify-between is used */
            )}

            {/* Timestamp */}
            <div className={`flex items-center gap-1 flex-none ${rtl ? 'order-first' : ''}`}>
              {variant === 'reader-pending' && (
                <span className="text-[11px] italic text-wa-muted">Sent · awaiting reply</span>
              )}
              {timestamp && <span className="text-[10px] text-wa-muted">{formatTime(timestamp)}</span>}
              {showTick && (
                <svg width="14" height="10" viewBox="0 0 16 11" className="text-wa-muted" fill="none">
                  <path
                    d="M1 5.5L5 9.5L11.5 1.5M5.5 9.5L15 1"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full screen overlay to dismiss picker */}
      {showPicker && (
        <div 
          className="fixed inset-0 z-40 bg-transparent" 
          onPointerDown={() => setShowPicker(false)}
          onContextMenu={(e) => { e.preventDefault(); setShowPicker(false) }}
        />
      )}
    </>
  )
}
