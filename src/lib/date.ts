export function formatSimpleDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''

    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    // Check if same day
    if (d.toDateString() === today.toDateString()) {
      return 'Today'
    }
    
    // Check if yesterday
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }

    // Otherwise "25 Aug" or "25 Aug 2023" if different year
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
    if (d.getFullYear() !== today.getFullYear()) {
      options.year = 'numeric'
    }
    return d.toLocaleDateString('en-GB', options)
  } catch {
    return ''
  }
}
