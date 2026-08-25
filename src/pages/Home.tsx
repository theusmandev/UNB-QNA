import { Link } from 'react-router-dom'
import { channelName } from '../lib/supabase'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-wa-bg px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-wa-header text-2xl font-semibold text-white">
        {channelName.charAt(0)}
      </div>
      <h1 className="text-lg font-semibold text-wa-ink">{channelName}</h1>
      <p className="max-w-xs text-sm text-wa-muted">
        This is the response collector for {channelName}. Open a question link shared on the channel to
        respond, or sign in below to manage questions.
      </p>
      <Link to="/admin/login" className="mt-2 rounded-lg bg-wa-teal px-4 py-2 text-sm font-semibold text-white">
        Admin sign in
      </Link>
    </div>
  )
}
