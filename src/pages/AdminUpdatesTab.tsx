import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatSimpleDate } from '../lib/date'
import type { Update } from '../types'

const REACTIONS = ['👍', '❤️', '😂', '🎉']

export default function AdminUpdatesTab() {
  const [updates, setUpdates] = useState<Update[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('get_updates_with_reactions')
    setUpdates((data as Update[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'updates' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'update_reactions' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function handleCreate() {
    const title = newTitle.trim()
    const text = newContent.trim()
    if (!title || !text || creating) return

    setCreating(true)
    const { error } = await supabase.from('updates').insert({ title, content: text })
    setCreating(false)

    if (!error) {
      setNewTitle('')
      setNewContent('')
      load()
    } else {
      alert("Error posting update: " + error.message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this update? This will remove all reactions too.")) return
    await supabase.from('updates').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-wa-ink">Post a new update</h2>
        <div className="flex flex-col gap-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Update Title"
            className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-wa-teal font-medium"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write your announcement or update here..."
            className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-wa-teal min-h-[80px] resize-y"
          />
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim() || !newContent.trim()}
              className="rounded-lg bg-wa-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {creating ? 'Posting…' : 'Post update'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-wa-ink">Past Updates</h2>
        {loading && <p className="text-sm text-wa-muted">Loading…</p>}
        {!loading && updates.length === 0 && <p className="text-sm text-wa-muted">No updates yet.</p>}
        <ul className="space-y-3">
          {updates.map((update) => (
            <li key={update.id} className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold text-wa-ink mb-1">{update.title}</h3>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-wa-ink">
                {update.content}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3">
                <div className="flex items-center gap-2">
                  {REACTIONS.map((emoji) => {
                    const count = update.reactions?.[emoji] || 0
                    if (count === 0) return null
                    return (
                      <span key={emoji} className="flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 text-xs">
                        <span>{emoji}</span>
                        <span className="font-medium text-wa-muted">{count}</span>
                      </span>
                    )
                  })}
                  {!Object.values(update.reactions || {}).some(c => c > 0) && (
                    <span className="text-xs text-wa-muted">No reactions yet</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-wa-muted">
                    {formatSimpleDate(update.created_at)}
                  </span>
                  <button
                    onClick={() => handleDelete(update.id)}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
