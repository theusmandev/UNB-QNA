import { useState } from 'react'
import type { VisitorIdentity } from '../types'

interface IdentityModalProps {
  onConfirm: (identity: VisitorIdentity) => void
  onCancel: () => void
}

export default function IdentityModal({ onConfirm, onCancel }: IdentityModalProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Enter a valid email address to continue.')
      return
    }
    onConfirm({ email: trimmedEmail, name: name.trim() || null })
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
        <h2 className="text-base font-semibold text-wa-ink">One last thing</h2>
        <p className="mt-1 text-sm text-wa-muted">
          Your message stays private between you and {"Urdu Novel Bank"}. Your name and email are never shown
          publicly.
        </p>

        <label className="mt-4 block text-xs font-medium text-wa-muted">Email (required)</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[0.95rem] outline-none focus:border-wa-teal"
          autoFocus
        />

        <label className="mt-3 block text-xs font-medium text-wa-muted">Name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Anonymous Reader"
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[0.95rem] outline-none focus:border-wa-teal"
        />

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-black/10 py-2.5 text-sm font-medium text-wa-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-wa-teal py-2.5 text-sm font-semibold text-white"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
