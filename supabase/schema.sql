-- ============================================================================
-- InstaBuilt — Supabase schema (Phase 2)
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run.
-- Creates the tables + Row Level Security (RLS) policies used by the client
-- dashboard. The anon key is safe to ship; data access is enforced HERE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Public newsletter sign-ups (Phase 1 form destination).
create table if not exists public.newsletter_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists newsletter_signups_email_key
  on public.newsletter_signups (lower(email));

-- Public contact-form submissions (Phase 1 form destination).
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  company text,
  phone text,
  interest text,
  message text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- A client's saved house design.
create table if not exists public.house_designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_line text not null,
  size text not null,
  materials jsonb not null default '[]'::jsonb,
  interior_selections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists house_designs_user_id_idx
  on public.house_designs (user_id, created_at desc);

-- A price estimate, linked to a house_design.
create table if not exists public.price_estimates (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.house_designs (id) on delete cascade,
  estimate_amount numeric(12, 2),
  currency text not null default 'EUR',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists price_estimates_design_id_idx
  on public.price_estimates (design_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.newsletter_signups enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.house_designs enable row level security;
alter table public.price_estimates enable row level security;

-- -- house_designs: a user may only read/write their OWN rows -----------------
drop policy if exists "house_designs_select_own" on public.house_designs;
create policy "house_designs_select_own" on public.house_designs
  for select using (auth.uid() = user_id);

drop policy if exists "house_designs_insert_own" on public.house_designs;
create policy "house_designs_insert_own" on public.house_designs
  for insert with check (auth.uid() = user_id);

drop policy if exists "house_designs_update_own" on public.house_designs;
create policy "house_designs_update_own" on public.house_designs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "house_designs_delete_own" on public.house_designs;
create policy "house_designs_delete_own" on public.house_designs
  for delete using (auth.uid() = user_id);

-- -- price_estimates: reachable only through a design the user owns ----------
drop policy if exists "price_estimates_select_own" on public.price_estimates;
create policy "price_estimates_select_own" on public.price_estimates
  for select using (
    exists (
      select 1 from public.house_designs d
      where d.id = price_estimates.design_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "price_estimates_insert_own" on public.price_estimates;
create policy "price_estimates_insert_own" on public.price_estimates
  for insert with check (
    exists (
      select 1 from public.house_designs d
      where d.id = price_estimates.design_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "price_estimates_delete_own" on public.price_estimates;
create policy "price_estimates_delete_own" on public.price_estimates
  for delete using (
    exists (
      select 1 from public.house_designs d
      where d.id = price_estimates.design_id and d.user_id = auth.uid()
    )
  );

-- -- newsletter_signups: anyone may subscribe (public form), owner reads ------
drop policy if exists "newsletter_signups_insert_public" on public.newsletter_signups;
create policy "newsletter_signups_insert_public" on public.newsletter_signups
  for insert with check (user_id is null or user_id = auth.uid());

drop policy if exists "newsletter_signups_select_own" on public.newsletter_signups;
create policy "newsletter_signups_select_own" on public.newsletter_signups
  for select using (auth.uid() = user_id);

-- -- contact_submissions: anyone may submit (public form), owner reads --------
drop policy if exists "contact_submissions_insert_public" on public.contact_submissions;
create policy "contact_submissions_insert_public" on public.contact_submissions
  for insert with check (user_id is null or user_id = auth.uid());

drop policy if exists "contact_submissions_select_own" on public.contact_submissions;
create policy "contact_submissions_select_own" on public.contact_submissions
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Notes
--   * Admins read everything via the Supabase dashboard / service role,
--     which bypasses RLS — that is the intended path for reviewing
--     newsletter/contact submissions.
--   * For production, consider adding rate-limiting / CAPTCHA on the public
--     insert policies (newsletter_signups, contact_submissions).
-- ---------------------------------------------------------------------------
