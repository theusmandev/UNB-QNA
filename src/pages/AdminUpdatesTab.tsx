import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { formatSimpleDate } from '../lib/date'
import type { Update } from '../types'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import DOMPurify from 'dompurify'

const REACTIONS = ['👍', '❤️', '😂', '🎉']

// Configure DOMPurify to ensure links open in a new tab
DOMPurify.addHook('afterSanitizeAttributes', function(node) {
  if ('target' in node) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const CustomToolbar = () => (
  <div id="toolbar" className="border-b border-black/10 flex flex-wrap gap-y-2 p-2 bg-gray-50 rounded-t-lg">
    <span className="ql-formats mr-2">
      <button className="ql-bold" />
      <button className="ql-italic" />
      <button className="ql-underline" />
      <button className="ql-strike" />
      <button className="ql-clean" />
    </span>
    <span className="ql-formats mr-2">
      <select className="ql-header" defaultValue="">
        <option value="1">H1</option>
        <option value="2">H2</option>
        <option value="3">H3</option>
        <option value="">Normal</option>
      </select>
    </span>
    <span className="ql-formats mr-2">
      <button className="ql-list" value="ordered" />
      <button className="ql-list" value="bullet" />
      <button className="ql-blockquote" />
      <button className="ql-direction" value="rtl" />
    </span>
    <span className="ql-formats mr-2 flex items-center">
      <select className="ql-align" />
      <button className="ql-ltr !w-auto px-1.5 font-semibold text-xs text-gray-600 border border-gray-300 rounded mx-0.5 hover:bg-gray-200">LTR</button>
      <button className="ql-rtl !w-auto px-1.5 font-semibold text-xs text-gray-600 border border-gray-300 rounded mx-0.5 hover:bg-gray-200">RTL</button>
    </span>
    <span className="ql-formats mr-2">
      <button className="ql-link" />
      <button className="ql-image" />
    </span>
    <span className="ql-formats flex items-center">
      <button className="ql-undo !w-auto px-1.5 font-semibold text-xs text-gray-600 border border-gray-300 rounded mx-0.5 hover:bg-gray-200">Undo</button>
      <button className="ql-redo !w-auto px-1.5 font-semibold text-xs text-gray-600 border border-gray-300 rounded mx-0.5 hover:bg-gray-200">Redo</button>
    </span>
  </div>
);

export default function AdminUpdatesTab() {
  const quillRef = useRef<ReactQuill>(null)
  
  const modules = useMemo(() => ({
    toolbar: {
      container: '#toolbar',
      handlers: {
        ltr: function() {
          const quill = quillRef.current?.getEditor()
          if (quill) {
            quill.format('direction', false)
            quill.format('align', false)
          }
        },
        rtl: function() {
          const quill = quillRef.current?.getEditor()
          if (quill) {
            quill.format('direction', 'rtl')
            quill.format('align', 'right')
          }
        },
        undo: function() {
          const quill = quillRef.current?.getEditor()
          ;(quill as any)?.history.undo()
        },
        redo: function() {
          const quill = quillRef.current?.getEditor()
          ;(quill as any)?.history.redo()
        }
      }
    },
    history: {
      delay: 500,
      maxStack: 100,
      userOnly: true
    }
  }), [])

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

  async function togglePin(update: Update) {
    const { error } = await supabase
      .from('updates')
      .update({ is_pinned: !update.is_pinned, pinned_at: !update.is_pinned ? new Date().toISOString() : null })
      .eq('id', update.id)
      
    if (error) {
      alert(error.message)
    } else {
      load()
    }
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
          <div className="bg-white [&_.ql-container]:min-h-[250px] [&_.ql-container]:text-base [&_.ql-editor]:min-h-[250px] rounded-lg border border-black/10 overflow-hidden focus-within:border-wa-teal flex flex-col">
            <CustomToolbar />
            <ReactQuill
              ref={quillRef}
              theme="snow"
              modules={modules}
              value={newContent}
              onChange={setNewContent}
              placeholder="Write your announcement or update here..."
              className="border-none flex-1 [&_.ql-container.ql-snow]:border-none [&_.ql-editor]:resize-y"
            />
          </div>
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
              <div 
                className="whitespace-pre-wrap text-[15px] leading-relaxed text-wa-ink [&_a]:text-[#027EB5] [&_a]:underline [&_a]:decoration-[#027EB5]/30 hover:[&_a]:decoration-[#027EB5]"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(update.content, { 
                    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'img', 'ul', 'ol', 'li', 'u', 's', 'strike', 'blockquote', 'h1', 'h2', 'h3'], 
                    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'dir'] 
                  }) 
                }}
              />
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
                    onClick={() => togglePin(update)}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                      update.is_pinned 
                        ? 'border-wa-teal bg-wa-teal/10 text-wa-teal' 
                        : 'border-black/10 text-wa-ink hover:bg-gray-50'
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={update.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                    </svg>
                    {update.is_pinned ? 'Pinned' : 'Pin'}
                  </button>
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
