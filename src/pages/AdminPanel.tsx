import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { channelName } from '../lib/supabase'
import AdminOverviewTab from './AdminOverviewTab'
import AdminQuestionsTab from './AdminQuestionsTab'
import AdminResponsesTab from './AdminResponsesTab'
import AdminUpdatesTab from './AdminUpdatesTab'
import AdminSettingsTab from './AdminSettingsTab'

type Tab = 'overview' | 'questions' | 'responses' | 'updates' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'questions', label: 'Questions' },
  { id: 'responses', label: 'Responses' },
  { id: 'updates', label: 'Updates' },
  { id: 'settings', label: 'Settings' },
]

export default function AdminPanel() {
  const { signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('all')

  const handleViewResponses = (questionId: string) => {
    setSelectedQuestionId(questionId)
    setTab('responses')
  }

  return (
    <div className="min-h-screen bg-wa-bg pb-10">
      <header className="sticky top-0 z-10 bg-wa-header text-white shadow">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-[15px] font-semibold leading-tight">{channelName} Admin</h1>
            <p className="text-[12px] text-white/70">Response collector</p>
          </div>
          <button
            onClick={() => signOut()}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium"
          >
            Sign out
          </button>
        </div>
        <div className="mx-auto flex max-w-4xl gap-1 px-2 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id)
                if (t.id === 'questions') {
                   // reset filter when navigating back to questions tab manually
                   setSelectedQuestionId('all')
                }
              }}
              className={`whitespace-nowrap shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition ${
                tab === t.id ? 'border-white text-white' : 'border-transparent text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-5">
        {tab === 'overview' && <AdminOverviewTab />}
        {tab === 'questions' && <AdminQuestionsTab onViewResponses={handleViewResponses} />}
        {tab === 'responses' && (
          <AdminResponsesTab 
            selectedQuestionId={selectedQuestionId} 
            onSelectQuestion={setSelectedQuestionId} 
          />
        )}
        {tab === 'updates' && <AdminUpdatesTab />}
        {tab === 'settings' && <AdminSettingsTab />}
      </main>
    </div>
  )
}
