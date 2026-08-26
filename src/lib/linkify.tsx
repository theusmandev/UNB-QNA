import { ReactNode } from 'react'

const URL_REGEX = /(https?:\/\/[^\s]+)/g

export function linkify(text: string): ReactNode[] | string {
  if (!text) return text

  const parts = text.split(URL_REGEX)
  
  if (parts.length === 1) return text

  return parts.map((part, i) => {
    if (part.match(URL_REGEX)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#027EB5] underline decoration-[#027EB5]/30 hover:decoration-[#027EB5] transition-colors"
        >
          {part}
        </a>
      )
    }
    return part
  })
}
