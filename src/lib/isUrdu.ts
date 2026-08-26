export function isUrdu(text: string): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF]/.test(text);
}
