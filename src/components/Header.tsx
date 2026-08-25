import { channelName } from '../lib/supabase'

interface HeaderProps {
  subtitle?: string
  right?: React.ReactNode
}

export default function Header({ subtitle = 'Channel', right }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 bg-wa-header px-3 py-2.5 text-white shadow">
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/15 text-lg font-semibold">
        {channelName.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-tight">{channelName}</h1>
        <p className="truncate text-[12px] text-white/75 leading-tight">{subtitle}</p>
      </div>
      {right}
    </header>
  )
}
