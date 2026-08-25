/** Turns question text into a short, URL-safe slug with a random suffix
 *  so two similar questions never collide. */
export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '')

  const suffix = Math.random().toString(36).slice(2, 7)
  return base ? `${base}-${suffix}` : suffix
}

/** True if the string contains any Arabic-script characters (covers Urdu, since
 *  Urdu is written in an extended Arabic script — used to auto-detect RTL + font. */
export function isArabicScript(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)
}
