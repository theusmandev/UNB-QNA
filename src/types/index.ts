export interface Question {
  id: string
  slug: string
  question_text: string
  is_active: boolean
  accepting_responses: boolean
  created_at: string
  last_viewed_at?: string
}

/** Full row — only ever fetched by an authenticated admin. Contains PII. */
export interface ResponseRow {
  id: string
  question_id: string
  reader_name: string | null
  reader_email: string
  message: string
  reply_text: string | null
  replied_at: string | null
  created_at: string
}

/** Safe public shape returned by the get_public_feed RPC — no name/email, ever. */
export interface PublicFeedItem {
  message: string
  reply_text: string
  replied_at: string
  reader_name: string | null
}

/** Locally-known identity for this visitor's device, stored in localStorage. */
export interface VisitorIdentity {
  email: string
  name: string | null
}

/** A response the visitor sent from this device, kept locally so we can show
 *  it back to them ("sent ✓") without ever reading it back from the server. */
export interface LocalPendingResponse {
  message: string
  created_at: string
}

/** Safe public shape returned by the get_active_questions_with_counts RPC */
export interface ActiveQuestionWithCount {
  slug: string
  question_text: string
  response_count: number
  published_reply_count: number
}
