import { Link } from 'react-router-dom'
import { channelName } from '../lib/supabase'

interface HeaderProps {
  title?: string
  subtitle?: string
  right?: React.ReactNode
  icon?: string | null
  showBack?: boolean
}

export default function Header({ title = channelName, subtitle = 'Channel', right, icon, showBack }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 bg-wa-header px-3 py-2.5 text-white shadow">
      {showBack && (
        <Link to="/" className="flex items-center justify-center pr-1 -mr-1 hover:bg-white/10 rounded-full p-1 transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
      )}
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/15 text-lg font-semibold">
        {icon || channelName.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-tight">{title}</h1>
        <p className="truncate text-[12px] text-white/75 leading-tight">{subtitle}</p>
      </div>
      {right}
    </header>
  )
}
