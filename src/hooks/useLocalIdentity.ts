import { useCallback, useEffect, useState } from 'react'
import type { LocalPendingResponse, VisitorIdentity } from '../types'

const IDENTITY_KEY = 'unb_identity'
const pendingKey = (slug: string) => `unb_pending_${slug}`

/** Manages the visitor's saved email/name and this device's locally-known
 *  "sent" responses for a given question — never trusts or re-reads the
 *  database for this data, only localStorage. */
export function useLocalIdentity(slug: string) {
  const [identity, setIdentityState] = useState<VisitorIdentity | null>(null)
  const [pending, setPending] = useState<LocalPendingResponse[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IDENTITY_KEY)
      setIdentityState(raw ? JSON.parse(raw) : null)
    } catch {
      setIdentityState(null)
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(pendingKey(slug))
      setPending(raw ? JSON.parse(raw) : [])
    } catch {
      setPending([])
    }
  }, [slug])

  const saveIdentity = useCallback((next: VisitorIdentity) => {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(next))
    setIdentityState(next)
  }, [])

  const addPending = useCallback(
    (message: string) => {
      const entry: LocalPendingResponse = { message, created_at: new Date().toISOString() }
      const next = [...pending, entry]
      localStorage.setItem(pendingKey(slug), JSON.stringify(next))
      setPending(next)
    },
    [pending, slug]
  )

  return { identity, saveIdentity, pending, addPending }
}
