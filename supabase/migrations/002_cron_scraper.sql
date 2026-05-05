-- ============================================================
-- ImmoAgent — Cron job chasseur autonome (pg_cron + pg_net)
-- ============================================================
-- Prérequis : extensions pg_cron et pg_net activées dans le projet Supabase.
-- Activer via : Dashboard → Database → Extensions → pg_cron + pg_net

-- Extension pg_cron pour les jobs planifiés
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─── Colonne run_logs sur opportunities (audit) ───────────────────────────────

alter table public.opportunities
  add column if not exists run_id text,
  add column if not exists notified_at timestamptz;

-- ─── Table scraper_runs (historique des exécutions) ──────────────────────────

create table if not exists public.scraper_runs (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  total_found  integer default 0,
  total_saved  integer default 0,
  status       text not null default 'running'
                check (status in ('running', 'success', 'error')),
  error        text,
  log          text[]
);

alter table public.scraper_runs enable row level security;

create policy "Service role full access on scraper_runs"
  on public.scraper_runs for all using (true) with check (true);

-- ─── Cron job : 7h00 chaque matin (heure Paris = UTC+1/+2) ──────────────────

select cron.schedule(
  'immoagent-daily-scraper',
  '0 6 * * *',   -- 6h UTC = 7h Paris (hiver) / 8h (été)
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/daily-scraper',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ─── Vue pour le frontend (opportunités récentes enrichies) ──────────────────

create or replace view public.opportunities_recent as
select
  id,
  listing_url,
  title,
  price,
  surface,
  city,
  postal_code,
  rendement_brut,
  score_total,
  score_dvf,
  score_rentabilite,
  score_quartier,
  score_nego,
  dvf_ecart_pct,
  published_at,
  created_at,
  -- Durée depuis la création
  extract(day from now() - created_at)::int as age_jours
from public.opportunities
where created_at > now() - interval '30 days'
order by score_total desc, created_at desc;

comment on view public.opportunities_recent is
  'Opportunités chasseur des 30 derniers jours, triées par score décroissant.';
