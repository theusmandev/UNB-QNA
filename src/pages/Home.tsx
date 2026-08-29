import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { channelName, supabase } from '../lib/supabase'
import { formatSimpleDate } from '../lib/date'
import { isUrdu } from '../lib/isUrdu'
import { useLocalIdentity } from '../hooks/useLocalIdentity'
import { useSiteSettings } from '../contexts/SiteSettingsContext'
import Header from '../components/Header'
import UpdatesTab from '../components/UpdatesTab'
import type { ActiveQuestionWithCount } from '../types'

declare global {
  interface Window {
    globalDeferredPrompt: any;
  }
}

export default function Home() {
  const [questions, setQuestions] = useState<ActiveQuestionWithCount[]>(() => {
    try {
      const cached = localStorage.getItem('unb_cached_chats')
      if (cached) return JSON.parse(cached)
    } catch {}
    return []
  })
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('unb_cached_chats')
    } catch {
      return true
    }
  })
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [activeTab, setActiveTab] = useState<'chats' | 'updates'>('chats')
  const [hasUnreadUpdates, setHasUnreadUpdates] = useState(false)
  
  // PWA Install states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showIOSPrompt, setShowIOSPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const { showInstallBanner, installBannerCampaign } = useSiteSettings()
  const [dismissedCampaign, setDismissedCampaign] = useState(() => {
    const stored = localStorage.getItem('unb_dismissed_campaign')
    if (stored) return parseInt(stored, 10)
    if (localStorage.getItem('unb_dismiss_install') === 'true') return 1
    return 0
  })

  const isDismissed = dismissedCampaign >= installBannerCampaign

  const navigate = useNavigate()
  
  // We just need the visitorId for reactions
  const { visitorId } = useLocalIdentity('home')

  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    
    const endX = e.changedTouches[0].clientX
    const endY = e.changedTouches[0].clientY
    
    const deltaX = endX - touchStartX.current
    const deltaY = endY - touchStartY.current
    
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 40) {
      if (deltaX > 0 && activeTab === 'updates') {
        setActiveTab('chats')
      } else if (deltaX < 0 && activeTab === 'chats') {
        setActiveTab('updates')
      }
    }
    
    touchStartX.current = null
    touchStartY.current = null
  }

  useEffect(() => {
    async function loadInitial() {
      const { data } = await supabase.rpc('get_active_questions_with_counts', {
        p_limit: 21,
        p_offset: 0
      })
      const items = (data as ActiveQuestionWithCount[]) ?? []
      let newQuestions = []
      if (items.length > 20) {
        setHasMore(true)
        newQuestions = items.slice(0, 20)
      } else {
        setHasMore(false)
        newQuestions = items
      }
      
      setQuestions(newQuestions)
      try { localStorage.setItem('unb_cached_chats', JSON.stringify(newQuestions)) } catch {}
      setLoading(false)
    }
    loadInitial()

    // PWA: Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true)
    }

    // PWA: Android / Desktop install prompt
    if (window.globalDeferredPrompt) {
      setDeferredPrompt(window.globalDeferredPrompt)
    }
    
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      window.globalDeferredPrompt = e
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // PWA: iOS Safari manual install prompt (only show if not installed and not dismissed)
    const ua = window.navigator.userAgent
    const isIOS = /ipad|iphone|ipod/.test(ua.toLowerCase())
    if (isIOS && !(window.navigator as any).standalone && !isInstalled) {
      setShowIOSPrompt(true)
    }

    // Check for unread updates
    async function checkUpdates() {
      const { data } = await supabase.from('updates').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (data) {
        const lastSeen = localStorage.getItem('unb_last_seen_update')
        if (!lastSeen || new Date(data.created_at) > new Date(lastSeen)) {
          setHasUnreadUpdates(true)
        }
      }
    }
    checkUpdates()

    const channel = supabase.channel('home-updates-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'updates' }, () => {
        setHasUnreadUpdates(true)
      })
      .subscribe()

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      supabase.removeChannel(channel)
    }
  }, [isInstalled])

  useEffect(() => {
    if (activeTab === 'updates') {
      setHasUnreadUpdates(false)
      localStorage.setItem('unb_last_seen_update', new Date().toISOString())
    }
  }, [activeTab])

  async function handleInstallApp() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  function dismissInstall() {
    setDismissedCampaign(installBannerCampaign)
    localStorage.setItem('unb_dismissed_campaign', installBannerCampaign.toString())
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const { data } = await supabase.rpc('get_active_questions_with_counts', {
      p_limit: 11,
      p_offset: questions.length
    })
    const items = (data as ActiveQuestionWithCount[]) ?? []
    if (items.length > 10) {
      setHasMore(true)
      setQuestions((prev) => [...prev, ...items.slice(0, 10)])
    } else {
      setHasMore(false)
      setQuestions((prev) => [...prev, ...items])
    }
    setLoadingMore(false)
  }

  let totalUnreadChats = 0
  try {
    const viewed = JSON.parse(localStorage.getItem('unb_viewed_counts') || '{}')
    questions.forEach(q => {
      if (q.published_reply_count > 0) {
        totalUnreadChats += Math.max(0, q.published_reply_count - (viewed[q.slug] || 0))
      }
    })
  } catch {}

  const rightHeader = (
    <a 
      href="https://whatsapp.com/channel/0029VaurdEY0wajrnyeAl50Y" 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 active:bg-white/30"
      aria-label="WhatsApp Channel"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
      </svg>
    </a>
  )

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white">
      <Header subtitle="Response Collector" right={rightHeader} />

      {/* PWA Install Banner */}
      {!isInstalled && !isDismissed && showInstallBanner && (deferredPrompt || showIOSPrompt) && (
        <div className="bg-wa-teal/10 px-4 py-3 flex items-center justify-between gap-3 border-b border-wa-teal/20">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-wa-ink">Install Urdu Novel Bank</h4>
            <p className="text-xs text-wa-muted mt-0.5">
              {showIOSPrompt 
                ? "Tap Share in your browser, then 'Add to Home Screen' for quick access." 
                : "Add this app to your home screen for quick access."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-none">
            {deferredPrompt && (
              <button 
                onClick={handleInstallApp}
                className="rounded-full bg-wa-teal px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
              >
                Install
              </button>
            )}
            <button onClick={dismissInstall} className="text-wa-muted p-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <div 
        className="flex-1 overflow-y-auto bg-gray-50/50 pb-20"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeTab === 'chats' ? (
          loading ? (
            <div className="flex h-32 items-center justify-center text-sm text-wa-muted">
              Loading…
            </div>
          ) : questions.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-wa-muted">
              No active questions at the moment.
            </div>
          ) : (
            <>
              <ul className="divide-y divide-black/5 bg-white">
                {questions.map((q) => {
                  let unreadCount = 0
                  if (q.published_reply_count > 0) {
                    try {
                      const viewed = JSON.parse(localStorage.getItem('unb_viewed_counts') || '{}')
                      unreadCount = Math.max(0, q.published_reply_count - (viewed[q.slug] || 0))
                    } catch {
                      unreadCount = q.published_reply_count
                    }
                  }

                  return (
                    <li
                      key={q.slug}
                      onClick={() => navigate(`/r/${q.slug}`)}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100"
                    >
                      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-wa-header text-xl font-semibold text-white">
                        {q.icon_emoji || channelName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p 
                            dir="auto"
                            style={{ unicodeBidi: 'plaintext' }}
                            className={`truncate text-[15px] font-semibold text-wa-ink ${
                              isUrdu(q.question_text) ? 'urdu-text' : ''
                            }`}
                          >
                            {q.question_text}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <p className="text-[13px] text-wa-muted">
                              {q.response_count} response{q.response_count === 1 ? '' : 's'}
                            </p>
                            {q.accepting_responses && (
                              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-none flex-col items-end justify-center gap-1">
                          <div className="flex items-center gap-1">
                            {q.is_pinned && (
                              <svg className="text-wa-muted" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                              </svg>
                            )}
                            <span className="text-[11px] text-wa-muted">{formatSimpleDate(q.created_at)}</span>
                          </div>
                          {unreadCount > 0 ? (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
                              {unreadCount}
                            </span>
                          ) : (
                            <div className="h-5" />
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {hasMore && (
                <div className="flex justify-center py-6">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-full bg-white px-5 py-2 text-[14px] font-medium text-wa-teal shadow-sm border border-wa-teal/20 active:bg-gray-50 disabled:opacity-50 transition-all hover:shadow-md"
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )
        ) : (
          <UpdatesTab visitorId={visitorId} />
        )}
      </div>
      
      <div className="sticky bottom-0 z-40 flex w-full bg-[#F0F0F0] border-t border-black/5 pb-safe mt-auto">
        <button 
          onClick={() => setActiveTab('chats')}
          className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${activeTab === 'chats' ? 'text-wa-teal' : 'text-wa-muted hover:bg-black/5'}`}
        >
          <div className="relative">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            {totalUnreadChats > 0 && (
              <span className="absolute -top-1.5 -right-2.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-green-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-[#F0F0F0]">
                {totalUnreadChats}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Chats</span>
        </button>

        <button 
          onClick={() => setActiveTab('updates')}
          className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${activeTab === 'updates' ? 'text-wa-teal' : 'text-wa-muted hover:bg-black/5'}`}
        >
          <div className="relative">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 8v4l3 3"></path>
            </svg>
            {hasUnreadUpdates && (
              <span className="absolute 1 top-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-[#F0F0F0]" />
            )}
          </div>
          <span className="text-[10px] font-medium">Updates</span>
        </button>
      </div>
    </div>
  )
}
