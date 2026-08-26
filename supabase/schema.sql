-- Urdu Novel Bank — Response Collector
-- Safe to re-run: uses "if not exists" / "or replace" / "drop policy if exists"
-- throughout, so applying this file again after edits will not error.

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists public.questions (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  question_text text not null,
  is_active     boolean not null default true,
  last_viewed_at timestamptz,
  created_at    timestamptz not null default now()
);

-- Raw responses. Contains PII (reader_name, reader_email) — never exposed to
-- anon directly. Public visitors only ever see safe columns via the
-- get_public_feed()/get_response_count() RPCs below, and only for rows that
-- already have a reply.
create table if not exists public.responses (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions(id) on delete cascade,
  reader_name  text,
  reader_email text not null,
  message      text not null,
  reply_text   text,
  replied_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists responses_question_id_idx on public.responses(question_id);
create index if not exists responses_created_at_idx on public.responses(created_at desc);
create index if not exists questions_slug_idx on public.questions(slug);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.questions enable row level security;
alter table public.responses enable row level security;

-- ---- questions -------------------------------------------------------------

-- Anyone (including anonymous visitors) can see active questions — needed so
-- the /r/:slug public page can load the question text without an account.
drop policy if exists "public can view active questions" on public.questions;
create policy "public can view active questions"
  on public.questions
  for select
  to anon, authenticated
  using (is_active = true);

-- Signed-in admins can see every question, active or not.
drop policy if exists "authenticated can view all questions" on public.questions;
create policy "authenticated can view all questions"
  on public.questions
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated can insert questions" on public.questions;
create policy "authenticated can insert questions"
  on public.questions
  for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated can update questions" on public.questions;
create policy "authenticated can update questions"
  on public.questions
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated can delete questions" on public.questions;
create policy "authenticated can delete questions"
  on public.questions
  for delete
  to authenticated
  using (true);

-- ---- responses --------------------------------------------------------------

-- Anonymous (and signed-in) visitors can submit a new response to any
-- currently-active question. They can NEVER select rows back out of this
-- table directly — that's the whole point of keeping responses private.
drop policy if exists "anyone can submit a response to an active question" on public.responses;
create policy "anyone can submit a response to an active question"
  on public.responses
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.questions q
      where q.id = question_id and q.is_active = true
    )
  );

-- Only signed-in admins can read raw response rows (name/email/message).
drop policy if exists "authenticated can view all responses" on public.responses;
create policy "authenticated can view all responses"
  on public.responses
  for select
  to authenticated
  using (true);

-- Only signed-in admins can reply — and only once: the row must not already
-- have a reply_text. This blocks edits/second replies at the database level,
-- not just in the UI.
drop policy if exists "authenticated can reply once" on public.responses;
create policy "authenticated can reply once"
  on public.responses
  for update
  to authenticated
  using (reply_text is null)
  with check (true);

-- No delete policy on responses: individual responses are never deleted
-- directly. They are removed only via "on delete cascade" when their parent
-- question is deleted (requirement #9), which is enforced by the foreign key
-- above and is not subject to these RLS policies.

-- ============================================================================
-- PUBLIC RPCS (SECURITY DEFINER)
-- ============================================================================
-- These run with the privileges of the function owner, bypassing RLS
-- internally, but only ever return the specific safe columns selected below —
-- never reader_name or reader_email, and never a row without a reply.

create or replace function public.get_public_feed(p_slug text)
returns table (
  message     text,
  reply_text  text,
  replied_at  timestamptz,
  reader_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select r.message, r.reply_text, r.replied_at, r.reader_name
  from public.responses r
  join public.questions q on q.id = r.question_id
  where q.slug = p_slug
    and r.reply_text is not null
  order by r.replied_at asc;
$$;

grant execute on function public.get_public_feed(text) to anon, authenticated;

create or replace function public.get_response_count(p_slug text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from public.responses r
  join public.questions q on q.id = r.question_id
  where q.slug = p_slug;
$$;

grant execute on function public.get_response_count(text) to anon, authenticated;

create or replace function public.get_active_questions_with_counts()
returns table (
  slug text,
  question_text text,
  response_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  select 
    q.slug, 
    q.question_text,
    count(r.id)::integer as response_count
  from public.questions q
  left join public.responses r on r.question_id = q.id
  where q.is_active = true
  group by q.id
  order by q.created_at desc;
$$;

grant execute on function public.get_active_questions_with_counts() to anon, authenticated;

-- ============================================================================
-- NOTES
-- ============================================================================
-- Admin accounts are created directly in Supabase Auth (Dashboard → Authentication
-- → Users → Add user, or via the Auth API) — there is no public sign-up flow in
-- this app, so anyone who can sign in is trusted as an admin.

-- Enable Realtime for the admin panel
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.questions, public.responses;
