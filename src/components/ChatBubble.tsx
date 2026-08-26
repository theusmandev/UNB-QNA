import { isUrdu } from '../lib/isUrdu'
import { linkify } from '../lib/linkify'

type Variant = 'reader' | 'reader-pending' | 'channel'

interface ChatBubbleProps {
  text: string
  variant: Variant
  /** Shown above the bubble text — e.g. the channel name on admin replies. */
  label?: string
  timestamp?: string
  showTick?: boolean
}

function formatTime(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function ChatBubble({ text, variant, label, timestamp, showTick }: ChatBubbleProps) {
  const rtl = isUrdu(text)
  const isOutgoingSide = variant === 'channel'

  const bubbleColor =
    variant === 'channel' ? 'bg-wa-outgoing' : variant === 'reader-pending' ? 'bg-white/70' : 'bg-wa-incoming'

  return (
    <div className={`flex w-full ${isOutgoingSide ? 'justify-end' : 'justify-start'} px-3 py-1`}>
      <div
        className={[
          'relative max-w-[82%] sm:max-w-[70%] rounded-lg px-3 py-2 shadow-bubble',
          bubbleColor,
          isOutgoingSide ? 'bubble-tail-out' : 'bubble-tail-in',
          variant === 'reader-pending' ? 'border border-dashed border-wa-muted/40' : '',
        ].join(' ')}
      >
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
        <div className={`mt-1 flex items-center gap-1 ${rtl ? 'justify-start' : 'justify-end'}`}>
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
  )
}
