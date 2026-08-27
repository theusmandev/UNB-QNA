import { useState, useRef } from 'react'
import { isUrdu } from '../lib/isUrdu'

interface ComposeBarProps {
  onSend: (message: string) => Promise<void> | void
  disabled?: boolean
}

export default function ComposeBar({ onSend, disabled }: ComposeBarProps) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const rtl = !!value && isUrdu(value)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      await onSend(trimmed)
      setValue('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } finally {
      setSending(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  return (
    <div className="sticky bottom-0 z-10 flex items-end gap-2 border-t border-black/5 bg-[#F0F0F0] px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        dir={rtl ? 'rtl' : 'ltr'}
        placeholder="Type a message"
        rows={1}
        maxLength={3000}
        disabled={disabled || sending}
        className={[
          'max-h-[30vh] min-h-[42px] flex-1 resize-none rounded-[20px] bg-white px-4 py-2.5 text-[0.95rem] leading-snug text-wa-ink shadow-sm outline-none placeholder:text-wa-muted disabled:opacity-60',
          rtl ? 'urdu-text text-right' : 'text-left',
        ].join(' ')}
      />
      <button
        onClick={handleSend}
        disabled={disabled || sending || !value.trim()}
        aria-label="Send"
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-wa-teal text-white shadow-sm transition active:scale-95 disabled:opacity-40"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
        </svg>
      </button>
    </div>
  )
}
