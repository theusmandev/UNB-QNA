# Urdu Novel Bank — Q&A

A WhatsApp Channel "Questions"-style app: you post a question and share a link,
readers reply privately, and you choose which replies to publish as a public
Q&A back on the page — the reader's name and email are never shown publicly.

Built with React + Vite + TypeScript + Tailwind, Supabase (Postgres + Auth),
deployed as a static site on Cloudflare Pages. Entirely free-tier.

## How it works

- `/r/:slug` — public page: the question, a public feed of already-answered
  Q&As, and a box to privately send a new response (email required, name
  optional, asked once per device and remembered locally).
- `/admin/login` — admin sign-in (Supabase Auth, email + password).
- `/admin` — Overview / Questions / Responses tabs: create questions, copy
  share links, and reply to private responses. The moment you reply, that
  response becomes a public Q&A. Unanswered responses stay private forever.

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **SQL Editor**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the
   `questions` and `responses` tables, enables Row Level Security, and sets up
   the `get_public_feed` / `get_response_count` functions that let the public
   page read safe, PII-free data without an account.
   - The script is idempotent — re-running it after you tweak it won't error.
3. Create your admin account: **Authentication → Users → Add user**, and set
   an email + password. There's no public sign-up in this app, so anyone who
   can sign in is treated as an admin — only create accounts for people you
   trust.
4. Copy your **Project URL** and **anon public key** from
   **Project Settings → API** — you'll need them next.

### Why the RLS is shaped this way

- `questions`: anyone can `select` rows where `is_active = true` (so the
  public page can load); only signed-in users can insert/update/delete or see
  inactive questions.
- `responses`: anyone can `insert` (subject to the target question being
  active) but **nobody anonymous can `select` this table** — it holds
  `reader_name`/`reader_email`. Only signed-in admins can read raw rows, and
  the "reply" `update` policy only allows updating rows where `reply_text is
  null`, so a response can only ever be replied to once, enforced by the
  database itself.
- Public reads instead go through `get_public_feed(slug)` and
  `get_response_count(slug)`, two `security definer` SQL functions that only
  ever return `message`, `reply_text`, `replied_at` (never name/email), and
  only for rows that already have a reply. Both are explicitly
  `grant execute`d to the `anon` role — without that grant, anonymous calls
  fail with a permissions error even though the function itself is fine.
- Deleting a question cascades (`on delete cascade`) to delete all of its
  responses automatically.

### The insert-then-select RLS pitfall (already avoided here)

When an anonymous visitor submits a response, the app calls
`supabase.from('responses').insert({...})` **without** chaining `.select()` or
`.single()` afterwards. If you add one, Postgres also evaluates the `SELECT`
RLS policy on the row being returned from the insert — which anon doesn't
have — and the whole insert fails with *"new row violates row-level security
policy"*, even though the insert itself was allowed. The UI instead updates
from the data it already has locally (see `useLocalIdentity`).

## 2. Run locally

```bash
npm install
cp .env.example .env
# edit .env with your Supabase URL + anon key
npm run dev
```

Open the printed local URL. Visit `/admin/login` to sign in, create a
question in the **Questions** tab, then open its `/r/:slug` link to try the
public flow.

## 3. Deploy to Cloudflare Pages (free)

1. Push this project to a GitHub/GitLab repo.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect
   to Git**, and pick the repo.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Add environment variables (**Settings → Environment variables**, for both
   Production and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_PUBLIC_BASE_URL`, `VITE_CHANNEL_NAME`.
5. Deploy. Cloudflare rebuilds automatically on every push.

Because this is a single-page app using client-side routing, Cloudflare Pages
already serves `index.html` for unmatched paths by default, so `/r/:slug` and
`/admin` deep links work on refresh without extra config.

## 4. Point respond.urdunovelbanks.com at it

1. In Cloudflare Pages, open your project → **Custom domains → Set up a
   custom domain**, enter `respond.urdunovelbanks.com`, and follow the
   prompts.
2. If `urdunovelbanks.com`'s DNS is already on Cloudflare, it can add the
   required `CNAME` record for you automatically. Otherwise, add a `CNAME`
   record for `respond` pointing at `<your-project>.pages.dev` in your DNS
   provider.
3. Once DNS propagates and the domain shows **Active** in Cloudflare Pages,
   set `VITE_PUBLIC_BASE_URL=https://respond.urdunovelbanks.com` in your Pages
   environment variables and redeploy, so the admin panel's "Copy link"
   button generates links on the real subdomain.

## Project structure

```
src/
  components/     ChatBubble, Header, ComposeBar, IdentityModal, ProtectedRoute
  hooks/          useAuth, useLocalIdentity
  lib/            supabase client, slug helper
  pages/          Home, PublicResponsePage, AdminLogin, AdminPanel + 3 tabs
  types/          shared TS types
supabase/
  schema.sql      full idempotent schema, RLS policies, RPC functions
```
